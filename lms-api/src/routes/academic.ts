import type { FastifyInstance, FastifyRequest } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole, requireTutor } from '../lib/rbac.js';
import { getErrorMonitor } from '../lib/error-monitor.js';
import { countUnreadStudentNotifications, createStudentNotification, listStudentNotifications, markAllStudentNotificationsRead, markStudentNotificationRead } from '../lib/notifications.js';
import { loadAssistantConfig } from '../domains/assistant/config.js';
import { createAssistantService } from '../domains/assistant/service.js';
import { createGroqProvider } from '../domains/assistant/providers/groq.js';
import { createLmStudioProvider } from '../domains/assistant/providers/lmstudio.js';
import { createOpenRouterProvider } from '../domains/assistant/providers/openrouter.js';
import {
  IdParamSchema,
  StudyActivityEventSchema,
  WeeklyReportGenerateSchema,
  WeeklyReportsQuerySchema
} from '../lib/schemas.js';
import { parsePagination } from '../lib/pagination.js';
import { supportBandFromRiskScore } from '../lib/support-band.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_DAILY_XP = 10;
const WEEK_BONUS_XP = 20;
const SUBMISSION_MAX_BYTES = Number(process.env.SUBMISSION_MAX_FILE_BYTES ?? 10 * 1024 * 1024);
const SUBMISSION_ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const SUBMISSION_ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const ODIE_SYSTEM_PROMPT = 'You are Odie, the Project Odysseus AI tutoring assistant. You help learners understand schoolwork step by step without simply giving final answers too early. You are encouraging, clear, and practical. You adapt to the learner’s subject, grade, current assignment, recent performance, and weak areas when available. You use a Socratic tutoring style: ask guiding questions, explain concepts simply, and give worked examples when needed. You may help with study planning, revision, assignment understanding, and career pathways. You must not fabricate marks, assignment details, or results. If context is missing, say what information is needed.';

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function safeFilename(value: string) {
  const base = path.basename(value || 'submission').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 160) || 'submission';
}

function publicUploadPath(key: string) {
  return `/uploads/${key.replace(/\\/g, '/')}`;
}

async function ensureUploadDir(...parts: string[]) {
  const dir = path.resolve(process.cwd(), 'uploads', ...parts);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function normalizeTopicBreakdown(value: any) {
  const parsed = normalizeJson(value, {});
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  return Object.entries(parsed).map(([topic, raw]) => ({
    topic,
    score: typeof raw === 'number' ? raw : Number((raw as any)?.score ?? (raw as any)?.percentage ?? 0),
    support: Number((raw as any)?.support ?? 0) || undefined,
  }));
}

function getWeekRange(from = new Date()) {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const weekday = base.getUTCDay();
  const distanceToMonday = (weekday + 6) % 7;
  const weekStart = new Date(base.getTime() - distanceToMonday * DAY_MS);
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
  return {
    weekStart: toDateOnly(weekStart),
    weekEnd: toDateOnly(weekEnd),
  };
}

function normalizeJson(value: any, fallback: any) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function setPrivateNoStore(reply: any) {
  reply.header('Cache-Control', 'private, no-store, max-age=0');
  reply.header('Pragma', 'no-cache');
}

function logEvent(req: FastifyRequest, event: string, payload: Record<string, unknown>) {
  req.log?.info?.({
    event,
    requestId: req.id,
    role: req.user?.role,
    userId: req.user?.userId,
    ...payload,
  }, 'analytics.event');
}

async function getStudentIdForUser(userId: string) {
  const res = await pool.query(
    `select student_id from users where id = $1`,
    [userId]
  );
  return (res.rows[0]?.student_id as string | null) ?? null;
}

async function userCanAccessStudent(userId: string, role: 'ADMIN' | 'TUTOR' | 'STUDENT', studentId: string, tutorId?: string) {
  if (role === 'ADMIN') return true;
  if (role === 'STUDENT') {
    const own = await getStudentIdForUser(userId);
    return own === studentId;
  }
  if (role === 'TUTOR' && tutorId) {
    const res = await pool.query(
      `select 1
       from tutor_student_map
       where tutor_id = $1 and student_id = $2
       limit 1`,
      [tutorId, studentId]
    );
    if (Number(res.rowCount || 0) > 0) return true;

    const fallback = await pool.query(
      `select 1
       from assignments
       where tutor_id = $1 and student_id = $2 and active = true
       limit 1`,
      [tutorId, studentId]
    );
    return Number(fallback.rowCount || 0) > 0;
  }
  return false;
}

async function ensureStreakRow(client: any, userId: string) {
  await client.query(
    `insert into study_streaks (user_id, current, longest, xp)
     values ($1, 0, 0, 0)
     on conflict (user_id) do nothing`,
    [userId]
  );
}

function toPublicStudentProfile(row: any) {
  const subjects = normalizeJson(row.subjects_json, []);
  return {
    id: row.id,
    name: row.full_name,
    grade: row.grade,
    school: row.school,
    subjects,
    partnerAffiliation: row.partner_affiliation,
    guardian: {
      name: row.guardian_name,
      relationship: row.guardian_relationship,
      contactStatus: row.guardian_phone || row.guardian_email ? 'available_through_admin' : 'not_recorded',
      emergencyContact: Boolean(row.guardian_phone || row.guardian_email),
    },
    completion: {
      required: ['full_name', 'grade', 'school', 'subjects_json', 'guardian_name'],
      completed: [
        row.full_name,
        row.grade,
        row.school,
        Array.isArray(subjects) && subjects.length ? subjects : null,
        row.guardian_name,
      ].filter(Boolean).length,
    },
  };
}

async function getStudentProfile(studentId: string) {
  const res = await pool.query(
    `select s.id, s.full_name, s.grade, s.school, s.subjects_json, s.guardian_name,
            s.guardian_relationship, s.guardian_phone, s.guardian_email, s.partner_affiliation
     from students s
     where s.id = $1`,
    [studentId]
  );
  return res.rows[0] ?? null;
}

async function buildWeeklyReportPayload(studentId: string, weekStart: string, weekEnd: string) {
  const metaRes = await pool.query(
    `select s.id, s.full_name, s.grade, u.id as user_id
     from students s
     left join users u on u.student_id = s.id
     where s.id = $1`,
    [studentId]
  );
  if (metaRes.rowCount === 0) return null;
  const studentMeta = metaRes.rows[0] as {
    id: string;
    full_name: string;
    grade: string | null;
    user_id: string | null;
  };

  const sessionsRes = await pool.query(
    `select
        count(*) filter (where status = 'APPROVED')::int as attended,
        coalesce(sum(duration_minutes) filter (where status = 'APPROVED'), 0)::int as minutes,
        coalesce(string_agg(left(coalesce(notes, ''), 120), '\n' order by date desc), '') as notes
     from sessions
     where student_id = $1
       and date >= $2::date
       and date <= $3::date`,
    [studentId, weekStart, weekEnd]
  );

  const subjectRes = await pool.query(
    `select a.subject,
            count(s.id)::int as sessions,
            coalesce(sum(s.duration_minutes), 0)::int as minutes
     from assignments a
     left join sessions s
       on s.assignment_id = a.id
      and s.status = 'APPROVED'
      and s.date >= $2::date
      and s.date <= $3::date
     where a.student_id = $1
     group by a.subject
     order by a.subject asc`,
    [studentId, weekStart, weekEnd]
  );

  let streakSummary = { current: 0, longest: 0, xp: 0 };
  if (studentMeta.user_id) {
    const streakRes = await pool.query(
      `select current, longest, xp
       from study_streaks
       where user_id = $1`,
      [studentMeta.user_id]
    );
    if (Number(streakRes.rowCount || 0) > 0) {
      streakSummary = {
        current: Number(streakRes.rows[0].current || 0),
        longest: Number(streakRes.rows[0].longest || 0),
        xp: Number(streakRes.rows[0].xp || 0),
      };
    }
  }

  const attended = Number(sessionsRes.rows[0]?.attended || 0);
  const minutesStudied = Number(sessionsRes.rows[0]?.minutes || 0);
  const notesRaw = String(sessionsRes.rows[0]?.notes || '');
  const notesSummary = notesRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  const topicProgress = subjectRes.rows.map((row) => {
    const sessions = Number(row.sessions || 0);
    const minutes = Number(row.minutes || 0);
    const completion = Math.max(0, Math.min(100, Math.round((minutes / 180) * 100)));
    return {
      topic: String(row.subject),
      sessions,
      minutes,
      completion,
    };
  });

  const weakest = [...topicProgress].sort((a, b) => a.completion - b.completion)[0];

  return {
    student: {
      id: studentMeta.id,
      name: studentMeta.full_name,
      grade: studentMeta.grade,
    },
    week: {
      start: weekStart,
      end: weekEnd,
    },
    metrics: {
      sessionsAttended: attended,
      timeStudiedMinutes: minutesStudied,
      streak: streakSummary.current,
      longestStreak: streakSummary.longest,
      xp: streakSummary.xp,
    },
    topicProgress,
    tutorNotesSummary: notesSummary,
    goalsNextWeek: weakest
      ? [`Lift ${weakest.topic} to at least ${Math.min(100, weakest.completion + 15)}% mastery.`]
      : ['Complete at least one focused practice session.'],
  };
}

export async function academicRoutes(app: FastifyInstance) {
  const assistantConfig = loadAssistantConfig();
  const assistantService = createAssistantService(
    assistantConfig,
    [
      createLmStudioProvider(assistantConfig.lmStudioBaseUrl, assistantConfig.lmStudioModel),
      createGroqProvider(assistantConfig.groqApiKey),
      createOpenRouterProvider(assistantConfig.openRouterApiKey),
    ],
    app.log.child({ module: 'student-odie' }),
  );

  const StudentOdieChatSchema = z.object({
    message: z.string().trim().min(1).max(4000),
    conversationId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(120).optional(),
    careerPathwayContext: z.string().trim().max(600).optional(),
  });

  app.post('/student/odie/chat', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const parsed = StudentOdieChatSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let conversationId = parsed.data.conversationId ?? null;
      if (conversationId) {
        const ownerRes = await client.query(
          `select id from odie_conversations where id = $1 and student_id = $2`,
          [conversationId, studentId]
        );
        if (Number(ownerRes.rowCount || 0) === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'conversation_not_found' });
        }
      } else {
        const created = await client.query(
          `insert into odie_conversations (student_id, subject, assignment_id)
           values ($1, $2, $3)
           returning id`,
          [studentId, parsed.data.subject ?? null, parsed.data.assignmentId ?? null]
        );
        conversationId = created.rows[0].id;
      }

      const historyRes = await client.query(
        `select role, content
         from odie_messages
         where conversation_id = $1 and student_id = $2
         order by created_at desc
         limit 12`,
        [conversationId, studentId]
      );
      const history = historyRes.rows.reverse().map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: String(row.content),
      }));

      const [profileRes, assignmentRes, baselineRes] = await Promise.all([
        client.query(`select grade, subjects_json from students where id = $1`, [studentId]),
        parsed.data.assignmentId
          ? client.query(
            `select id, title, subject, instructions, due_date, status
             from learning_assignments
             where id = $1 and student_id = $2 and status in ('published','submitted','reviewed')`,
            [parsed.data.assignmentId, studentId]
          )
          : Promise.resolve({ rows: [] } as any),
        client.query(
          `select subject, percentage, level_band, topic_breakdown_json, recommended_next_steps_json, completed_at
           from baseline_assessments
           where student_id = $1
           order by completed_at desc
           limit 3`,
          [studentId]
        ),
      ]);

      await client.query(
        `insert into odie_messages (conversation_id, student_id, role, content)
         values ($1, $2, 'user', $3)`,
        [conversationId, studentId, parsed.data.message]
      );

      const profile = profileRes.rows[0] ?? {};
      const assignment = assignmentRes.rows[0] ?? null;
      const context = [
        `Learner grade: ${profile.grade ?? 'unknown'}`,
        `Learner subjects: ${JSON.stringify(normalizeJson(profile.subjects_json, []))}`,
        parsed.data.subject ? `Current subject: ${parsed.data.subject}` : '',
        assignment ? `Current assignment: ${assignment.title}; subject: ${assignment.subject}; due: ${assignment.due_date ?? 'not set'}; instructions: ${assignment.instructions ?? 'none provided'}` : '',
        baselineRes.rows.length ? `Recent results: ${JSON.stringify(baselineRes.rows.map((row) => ({
          subject: row.subject,
          percentage: Number(row.percentage),
          levelBand: row.level_band,
          weakAreas: normalizeTopicBreakdown(row.topic_breakdown_json).sort((a: any, b: any) => Number(a.score) - Number(b.score)).slice(0, 3),
          nextSteps: normalizeJson(row.recommended_next_steps_json, []),
        })))}` : 'No recent result context available.',
        parsed.data.careerPathwayContext ? `Career pathway context: ${parsed.data.careerPathwayContext}` : '',
      ].filter(Boolean).join('\n');

      const result = await assistantService.chat({
        message: `${context}\n\nLearner question: ${parsed.data.message}`,
        history,
        systemPrompt: ODIE_SYSTEM_PROMPT,
        requestId: req.id,
      });

      await client.query(
        `insert into odie_messages (conversation_id, student_id, role, content, metadata_json)
         values ($1, $2, 'assistant', $3, $4::jsonb)`,
        [conversationId, studentId, result.text, JSON.stringify(result.metadata)]
      );
      await client.query(`update odie_conversations set updated_at = now() where id = $1`, [conversationId]);
      await client.query('COMMIT');
      return reply.send({ conversationId, message: result.text, text: result.text, metadata: result.metadata });
    } catch (err: any) {
      await client.query('ROLLBACK');
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(err?.statusCode || 500).send({ error: err?.code || 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.post('/student/odie/chat-legacy-disabled', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const parsed = StudentOdieChatSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const persona = 'You are Odie, the Project Odysseus AI tutoring assistant. You help learners understand schoolwork step by step without simply giving final answers too early. You are encouraging, clear, and practical. You adapt to the learner’s subject, grade, current assignment, recent performance, and weak areas when available. You use a Socratic tutoring style: ask guiding questions, explain concepts simply, and give worked examples when needed. You may help with study planning, revision, assignment understanding, and career pathways. You must not fabricate marks, assignment details, or results. If context is missing, say what information is needed.';
    const context = [parsed.data.subject ? `Subject: ${parsed.data.subject}` : '', parsed.data.careerPathwayContext ? `Career context: ${parsed.data.careerPathwayContext}` : ''].filter(Boolean).join('\n');
    return reply.send({
      conversationId: parsed.data.conversationId ?? null,
      message: `${persona}\n\nI can help with your question: "${parsed.data.message}".\n${context}`.slice(0, 1000),
      source: 'mock_fallback',
      studentId,
    });
  });

  app.get('/student/results', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const res = await pool.query(
      `select id, subject, grade, score, total, percentage, level_band,
              topic_breakdown_json, cognitive_breakdown_json, recommended_next_steps_json,
              completed_at, source_type
       from baseline_assessments
       where student_id = $1
       order by completed_at desc
       limit 24`,
      [studentId]
    );
    const items = res.rows.map((row) => ({
      id: row.id,
      title: `${row.subject} result`,
      subject: row.subject,
      score: Number(row.score),
      total: Number(row.total),
      percentage: Number(row.percentage),
      levelBand: row.level_band,
      markedAt: row.completed_at,
      completedAt: row.completed_at,
      topicBreakdown: normalizeTopicBreakdown(row.topic_breakdown_json),
      cognitiveBreakdown: normalizeJson(row.cognitive_breakdown_json, {}),
      recommendedNextSteps: normalizeJson(row.recommended_next_steps_json, []),
      feedbackSummary: row.level_band ? `Current band: ${row.level_band}` : 'Result recorded.',
    }));
    const weakAreas = items
      .flatMap((item) => item.topicBreakdown.map((topic: any) => ({ ...topic, subject: item.subject })))
      .filter((topic: any) => Number.isFinite(Number(topic.score)))
      .sort((a: any, b: any) => Number(a.score) - Number(b.score))
      .slice(0, 8);
    return reply.send({ results: items, items, analytics: { weakAreas } });
  });

  app.get('/student/class-stats', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const res = await pool.query(
      `select latest.subject,
              latest.percentage as learner_score,
              class_stats.class_average,
              class_stats.highest_score,
              class_stats.sample_size
       from lateral (
         select subject, percentage
         from baseline_assessments
         where student_id = $1
         order by completed_at desc
         limit 1
       ) latest
       join lateral (
         select round(avg(percentage)::numeric, 2) as class_average,
                max(percentage) as highest_score,
                count(*)::int as sample_size
         from baseline_assessments
         where subject = latest.subject
       ) class_stats on true`,
      [studentId]
    );
    return reply.send({ stats: res.rows, items: res.rows });
  });

  app.get('/dashboard', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    logEvent(req, 'dashboard_viewed', { role: 'student' });

    const userId = req.user!.userId;
    const studentId = req.user?.studentId ?? await getStudentIdForUser(userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });

    const now = new Date();
    const today = toDateOnly(now);
    const { weekStart, weekEnd } = getWeekRange(now);

    try {
    const profileRow = await getStudentProfile(studentId);
    if (!profileRow) return reply.code(404).send({ error: 'student_not_found' });

    const upcomingRes = await pool.query(
      `select s.id, s.date, s.start_time, s.mode, s.location, a.subject, t.full_name as tutor_name
       from sessions s
       join assignments a on a.id = s.assignment_id
       join tutor_profiles t on t.id = s.tutor_id
       where s.student_id = $1
         and s.date >= $2::date
         and s.status in ('DRAFT', 'SUBMITTED', 'APPROVED')
       order by s.date asc, s.start_time asc
       limit 1`,
      [studentId, today]
    );

    const streakRes = await pool.query(
      `select current, longest, last_credited_date, xp
       from study_streaks
       where user_id = $1`,
      [userId]
    );

    const weekStatsRes = await pool.query(
      `select
          count(*) filter (where sae.type = 'session_attended')::int as sessions_attended,
          coalesce(sum((sae.metadata_json ->> 'durationMinutes')::int), 0)::int as minutes_studied
       from study_activity_events sae
       where sae.user_id = $1
         and sae.occurred_at >= $2::date
         and sae.occurred_at < ($3::date + interval '1 day')`,
      [userId, weekStart, weekEnd]
    );

    const topicRes = await pool.query(
      `select a.subject,
              count(s.id)::int as sessions,
              coalesce(sum(s.duration_minutes), 0)::int as minutes
       from assignments a
       left join sessions s
         on s.assignment_id = a.id
        and s.student_id = a.student_id
        and s.status = 'APPROVED'
       where a.student_id = $1
       group by a.subject
       order by a.subject asc`,
      [studentId]
    );

    const assignedTutorsRes = await pool.query(
      `select distinct t.id, t.full_name, a.subject, t.qualified_subjects_json, t.qualification_band
       from assignments a
       join tutor_profiles t on t.id = a.tutor_id
       where a.student_id = $1 and a.active = true and t.approval_status = 'approved'
       order by t.full_name asc, a.subject asc`,
      [studentId]
    );

    const learningAssignmentsRes = await pool.query(
      `select id, subject, title, instructions, due_date, status, created_at
       from learning_assignments
       where student_id = $1 and status <> 'cancelled'
       order by coalesce(due_date, created_at::date) asc
       limit 8`,
      [studentId]
    );

    const sessionSummariesRes = await pool.query(
      `select s.id, s.date, a.subject, s.student_summary, s.homework_assigned
       from sessions s
       join assignments a on a.id = s.assignment_id
       where s.student_id = $1
         and s.status = 'APPROVED'
         and (s.student_summary is not null or s.homework_assigned is not null)
       order by s.date desc
       limit 5`,
      [studentId]
    );

    const baselineRes = await pool.query(
      `select id, subject, grade, score, total, percentage, level_band,
              cognitive_breakdown_json, topic_breakdown_json, recommended_next_steps_json,
              completed_at, source_type
       from baseline_assessments
       where student_id = $1
       order by completed_at desc
       limit 1`,
      [studentId]
    );

    const goalsRes = await pool.query(
      `select id, title, description, category, subject, target_value, current_value, due_date, status
       from learning_goals
       where student_id = $1 and visible_to_student = true and status <> 'cancelled'
       order by case status when 'active' then 0 when 'paused' then 1 else 2 end,
                due_date asc nulls last,
                created_at desc
       limit 8`,
      [studentId]
    );

    const attendanceRes = await pool.query(
      `select s.id, s.date, s.start_time, a.subject, t.full_name as tutor_name,
              coalesce(s.attendance_status,
                case when s.status = 'APPROVED' then 'present' when s.status = 'REJECTED' then 'missed' else 'scheduled' end
              ) as attendance_status,
              s.status
       from sessions s
       join assignments a on a.id = s.assignment_id
       join tutor_profiles t on t.id = s.tutor_id
       where s.student_id = $1
       order by s.date desc, s.start_time desc
       limit 10`,
      [studentId]
    );

    const latestReportRes = await pool.query(
      `select wr.id, wr.week_start, wr.week_end, wr.created_at, wr.payload_json
       from weekly_reports wr
       join users u on u.id = wr.user_id
       where u.student_id = $1
       order by wr.created_at desc
       limit 1`,
      [studentId]
    );

    const [notifications, unreadNotifications] = await Promise.all([
      listStudentNotifications(pool, studentId, 8),
      countUnreadStudentNotifications(pool, studentId),
    ]);

    const topics = topicRes.rows.map((row) => {
      const sessions = Number(row.sessions || 0);
      const minutes = Number(row.minutes || 0);
      return {
        topic: row.subject,
        sessions,
        minutes,
        completion: Math.max(0, Math.min(100, Math.round((minutes / 240) * 100))),
      };
    });

    const weakestTopic = [...topics].sort((a, b) => a.completion - b.completion)[0] ?? null;
    const weekStats = weekStatsRes.rows[0] ?? { sessions_attended: 0, minutes_studied: 0 };
    const streak = streakRes.rows[0] ?? { current: 0, longest: 0, last_credited_date: null, xp: 0 };

    const scoreRes = await pool.query(
      `select score_date, risk_score, momentum_score, reasons_json, recommended_actions_json
       from student_score_snapshots
       where user_id = $1
       order by score_date desc
       limit 1`,
      [userId]
    );

    const careerRes = await pool.query(
      `select cgs.goal_id, cps.alignment_score
       from career_goal_selections cgs
       left join lateral (
         select alignment_score
         from career_progress_snapshots cps
         where cps.user_id = cgs.user_id
           and cps.goal_id = cgs.goal_id
         order by cps.created_at desc
         limit 1
       ) cps on true
       where cgs.user_id = $1
       order by cgs.created_at asc
       limit 3`,
      [userId]
    );

    const score = scoreRes.rows[0]
      ? {
          date: toDateOnly(new Date(scoreRes.rows[0].score_date)),
          riskScore: Number(scoreRes.rows[0].risk_score || 0),
          momentumScore: Number(scoreRes.rows[0].momentum_score || 0),
          reasons: typeof scoreRes.rows[0].reasons_json === 'string'
            ? JSON.parse(scoreRes.rows[0].reasons_json)
            : scoreRes.rows[0].reasons_json,
          recommendedActions: typeof scoreRes.rows[0].recommended_actions_json === 'string'
            ? JSON.parse(scoreRes.rows[0].recommended_actions_json)
            : scoreRes.rows[0].recommended_actions_json,
        }
      : null;

    const supportStatus = supportBandFromRiskScore(score?.riskScore);

    const careerGoals = careerRes.rows.map((row) => ({
      goalId: row.goal_id,
      alignmentScore: row.alignment_score == null ? null : Number(row.alignment_score),
    }));

    const upcoming = upcomingRes.rows[0]
      ? {
          hasUpcoming: true,
          session: {
            id: upcomingRes.rows[0].id,
            date: toDateOnly(new Date(upcomingRes.rows[0].date)),
            startTime: String(upcomingRes.rows[0].start_time).slice(0, 5),
            mode: upcomingRes.rows[0].mode,
            subject: upcomingRes.rows[0].subject,
            tutorName: upcomingRes.rows[0].tutor_name,
            joinLink: upcomingRes.rows[0].mode === 'online' ? '/tutor/sessions.html' : null,
          }
        }
      : {
          hasUpcoming: false,
          emptyState: {
            title: 'No upcoming session',
            ctaLabel: 'Book a session',
            ctaHref: '/contact'
          }
        };

    const recommendedNext = weakestTopic
      ? {
          title: `Recommended next: ${weakestTopic.topic}`,
          description: `Spend 25 focused minutes on ${weakestTopic.topic} to boost your mastery.`,
          action: 'Start focus mode'
        }
      : {
          title: 'Recommended next',
          description: 'Complete a short practice set to start your streak.',
          action: 'Do practice'
        };

      const scoreDrivenRecommendation = score?.recommendedActions?.[0];
      const goalRecommendation = careerGoals[0]
        ? {
            title: `Next step for goal: ${careerGoals[0].goalId}`,
            description: `Current goal alignment: ${careerGoals[0].alignmentScore ?? 0}%. Keep momentum with one focused practice block.`,
            action: 'View career roadmap'
          }
        : null;

    return reply.send({
      profile: toPublicStudentProfile(profileRow),
      greeting: 'Welcome back, Jaydin — let’s keep the streak alive.',
      today: upcoming,
      thisWeek: {
        minutesStudied: Number(weekStats.minutes_studied || 0),
        sessionsAttended: Number(weekStats.sessions_attended || 0),
        streakDays: Number(streak.current || 0),
      },
      streak: {
        current: Number(streak.current || 0),
        longest: Number(streak.longest || 0),
        lastCreditedDate: streak.last_credited_date ? toDateOnly(new Date(streak.last_credited_date)) : null,
        xp: Number(streak.xp || 0),
      },
      progressSnapshot: topics,
      assignedTutors: assignedTutorsRes.rows,
      academicProfile: {
        grade: profileRow.grade,
        school: profileRow.school,
        enrolledSubjects: normalizeJson(profileRow.subjects_json, []),
        activeTutoringSubjects: topicRes.rows.map((row) => row.subject),
      },
      baseline: baselineRes.rows[0]
        ? {
            ...baselineRes.rows[0],
            score: Number(baselineRes.rows[0].score),
            total: Number(baselineRes.rows[0].total),
            percentage: Number(baselineRes.rows[0].percentage),
            cognitive_breakdown_json: normalizeJson(baselineRes.rows[0].cognitive_breakdown_json, {}),
            topic_breakdown_json: normalizeJson(baselineRes.rows[0].topic_breakdown_json, {}),
            recommended_next_steps_json: normalizeJson(baselineRes.rows[0].recommended_next_steps_json, []),
          }
        : null,
      supportStatus,
      attendance: {
        items: attendanceRes.rows,
        attended: attendanceRes.rows.filter((row) => ['present', 'late'].includes(String(row.attendance_status))).length,
        total: attendanceRes.rows.filter((row) => String(row.attendance_status) !== 'scheduled').length,
      },
      goals: goalsRes.rows.map((row) => ({
        ...row,
        target_value: row.target_value == null ? null : Number(row.target_value),
        current_value: row.current_value == null ? null : Number(row.current_value),
      })),
      latestReport: latestReportRes.rows[0]
        ? {
            id: latestReportRes.rows[0].id,
            weekStart: toDateOnly(new Date(latestReportRes.rows[0].week_start)),
            weekEnd: toDateOnly(new Date(latestReportRes.rows[0].week_end)),
            createdAt: latestReportRes.rows[0].created_at,
            summary: normalizeJson(latestReportRes.rows[0].payload_json, {})?.tutorNotesSummary ?? [],
          }
        : null,
      notifications,
      notificationsUnreadCount: unreadNotifications,
      learningAssignments: learningAssignmentsRes.rows,
      sessionSummaries: sessionSummariesRes.rows,
      recommendedNext: scoreDrivenRecommendation
        ? {
            title: scoreDrivenRecommendation.label,
            description: (score?.reasons?.[0]?.detail || recommendedNext.description),
            action: 'Open recommendation'
          }
        : (goalRecommendation || recommendedNext),
      predictiveScore: score,
      careerGoals,
    });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/student/profile', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const row = await getStudentProfile(studentId);
    if (!row) return reply.code(404).send({ error: 'student_not_found' });
    return reply.send({ profile: toPublicStudentProfile(row) });
  });

  app.get('/student/notifications', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const [notifications, unreadCount] = await Promise.all([
      listStudentNotifications(pool, studentId, 20),
      countUnreadStudentNotifications(pool, studentId),
    ]);
    return reply.send({ notifications, unreadCount });
  });

  app.patch('/student/notifications/:id/read', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const updated = await markStudentNotificationRead(pool, studentId, params.data.id);
    if (updated === 0) return reply.code(404).send({ error: 'notification_not_found' });
    return reply.send({ ok: true });
  });

  app.post('/student/notifications/read-all', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    await markAllStudentNotificationsRead(pool, studentId);
    return reply.send({ ok: true });
  });

  app.get('/student/profile/:id', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const ownStudentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (ownStudentId !== params.data.id) return reply.code(403).send({ error: 'forbidden' });
    const row = await getStudentProfile(params.data.id);
    if (!row) return reply.code(404).send({ error: 'student_not_found' });
    return reply.send({ profile: toPublicStudentProfile(row) });
  });

  app.get('/student/attendance', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const res = await pool.query(
      `select s.id, s.date, s.start_time, a.subject, t.full_name as tutor_name,
              coalesce(s.attendance_status,
                case when s.status = 'APPROVED' then 'present' when s.status = 'REJECTED' then 'missed' else 'scheduled' end
              ) as attendance_status,
              s.status
       from sessions s
       join assignments a on a.id = s.assignment_id
       join tutor_profiles t on t.id = s.tutor_id
       where s.student_id = $1
       order by s.date desc, s.start_time desc
       limit 50`,
      [studentId]
    );
    return reply.send({ attendance: res.rows, items: res.rows });
  });

  app.get('/tutor/students/:id/summary', {
    preHandler: [app.authenticate, requireAuth, requireTutor],
  }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const allowed = await userCanAccessStudent(req.user!.userId, 'TUTOR', params.data.id, req.user!.tutorId);
    if (!allowed) return reply.code(403).send({ error: 'forbidden' });

    const profileRow = await getStudentProfile(params.data.id);
    if (!profileRow) return reply.code(404).send({ error: 'student_not_found' });
    const [baselineRes, goalsRes, scoreRes] = await Promise.all([
      pool.query(
        `select id, subject, grade, score, total, percentage, level_band, topic_breakdown_json,
                recommended_next_steps_json, completed_at, source_type
         from baseline_assessments where student_id = $1 order by completed_at desc limit 1`,
        [params.data.id]
      ),
      pool.query(
        `select id, title, description, category, subject, target_value, current_value, due_date, status
         from learning_goals
         where student_id = $1 and visible_to_tutor = true and status <> 'cancelled'
         order by due_date asc nulls last, created_at desc limit 8`,
        [params.data.id]
      ),
      pool.query(
        `select risk_score, momentum_score, reasons_json
         from student_score_snapshots sss
         join users u on u.id = sss.user_id
         where u.student_id = $1
         order by score_date desc
         limit 1`,
        [params.data.id]
      )
    ]);
    const riskScore = scoreRes.rows[0] ? Number(scoreRes.rows[0].risk_score || 0) : null;
    return reply.send({
      profile: toPublicStudentProfile(profileRow),
      supportStatus: supportBandFromRiskScore(riskScore),
      baseline: baselineRes.rows[0] ?? null,
      goals: goalsRes.rows,
      riskReasons: normalizeJson(scoreRes.rows[0]?.reasons_json, []),
    });
  });

  app.get('/student/learning-assignments', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const res = await pool.query(
      `select la.id, la.subject, la.title, coalesce(la.description, la.instructions) as instructions,
              la.due_date, la.status, la.created_at, la.published_at,
              t.full_name as tutor_name,
              sub.id as submission_id, sub.status as submission_status, sub.submitted_at,
              sub.original_filename, sub.mime_type, sub.size_bytes,
              10 as max_file_size_mb,
              array['pdf','jpg','jpeg','png'] as allowed_file_types
       from learning_assignments la
       join tutor_profiles t on t.id = la.tutor_id
       left join lateral (
         select *
         from assignment_submissions s
         where s.assignment_id = la.id and s.student_id = $1
         order by s.submitted_at desc
         limit 1
       ) sub on true
       where la.student_id = $1 and la.status in ('published','submitted','reviewed')
       order by coalesce(la.due_date, la.created_at::date) asc, la.created_at desc`,
      [studentId]
    );
    return reply.send({ assignments: res.rows, items: res.rows });
  });

  app.get('/student/assignments', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const res = await pool.query(
      `select la.id, la.subject, la.title, coalesce(la.description, la.instructions) as instructions,
              la.due_date, la.status, la.created_at, la.published_at,
              t.full_name as tutor_name,
              sub.id as submission_id, sub.status as submission_status, sub.submitted_at,
              sub.original_filename, sub.mime_type, sub.size_bytes,
              10 as max_file_size_mb,
              array['pdf','jpg','jpeg','png'] as allowed_file_types
       from learning_assignments la
       join tutor_profiles t on t.id = la.tutor_id
       left join lateral (
         select *
         from assignment_submissions s
         where s.assignment_id = la.id and s.student_id = $1
         order by s.submitted_at desc
         limit 1
       ) sub on true
       where la.student_id = $1 and la.status in ('published','submitted','reviewed')
       order by coalesce(la.due_date, la.created_at::date) asc, la.created_at desc`,
      [studentId]
    );
    return reply.send({ assignments: res.rows, items: res.rows });
  });

  app.post('/student/assignments/:id/submissions', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });

    const assignmentRes = await pool.query(
      `select id, student_id, title, subject, due_date, status
        from learning_assignments
        where id = $1 and student_id = $2 and status in ('published','submitted','reviewed')`,
      [params.data.id, studentId]
    );
    if (Number(assignmentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'assignment_not_found' });

    const file = await (req as any).file();
    if (!file) return reply.code(400).send({ error: 'file_required' });
    const originalFilename = safeFilename(file.filename);
    const ext = path.extname(originalFilename).toLowerCase();
    if (!SUBMISSION_ALLOWED_MIME.has(file.mimetype) || !SUBMISSION_ALLOWED_EXT.has(ext)) {
      return reply.code(400).send({ error: 'unsupported_file_type' });
    }
    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (err: any) {
      if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({ error: 'file_too_large', maxBytes: SUBMISSION_MAX_BYTES });
      }
      throw err;
    }
    if (buffer.length <= 0 || buffer.length > SUBMISSION_MAX_BYTES) {
      return reply.code(413).send({ error: 'file_too_large', maxBytes: SUBMISSION_MAX_BYTES });
    }

    const dir = await ensureUploadDir('submissions', studentId, params.data.id);
    const key = path.posix.join('submissions', studentId, params.data.id, `${Date.now()}-${originalFilename}`);
    await fs.writeFile(path.join(dir, path.basename(key)), buffer, { flag: 'wx' });

    const dueDate = assignmentRes.rows[0].due_date ? new Date(assignmentRes.rows[0].due_date) : null;
    const status = dueDate && Date.now() > dueDate.getTime() + DAY_MS - 1 ? 'late' : 'submitted';
    const res = await pool.query(
      `insert into assignment_submissions
       (assignment_id, student_id, file_key, file_url, original_filename, mime_type, size_bytes, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [params.data.id, studentId, key, publicUploadPath(key), originalFilename, file.mimetype, buffer.length, status]
    );

    await createStudentNotification(pool, {
      studentId,
      type: 'assignment_submission_received',
      title: 'Assignment submission received',
      body: `We received your submission for ${assignmentRes.rows[0].title || assignmentRes.rows[0].subject || 'this assignment'}.`,
      link: '/dashboard/assignments/',
      entityType: 'learning_assignment',
      entityId: params.data.id,
      metadata: { status },
    });

    return reply.code(201).send({ submission: res.rows[0] });
  });

  app.get('/student/tutors', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
  }, async (req, reply) => {
    const studentId = req.user?.studentId ?? await getStudentIdForUser(req.user!.userId);
    if (!studentId) return reply.code(404).send({ error: 'student_not_found' });
    const res = await pool.query(
      `select distinct t.id, t.full_name, a.subject, t.qualified_subjects_json, t.qualification_band
       from assignments a
       join tutor_profiles t on t.id = a.tutor_id
       where a.student_id = $1 and a.active = true and t.approval_status = 'approved'
       order by t.full_name asc, a.subject asc`,
      [studentId]
    );
    return reply.send({ tutors: res.rows });
  });

  app.get('/tutor/dashboard', {
    preHandler: [app.authenticate, requireAuth, requireTutor],
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    logEvent(req, 'dashboard_viewed', { role: 'tutor' });

    const tutorId = req.user!.tutorId!;
    const today = toDateOnly(new Date());

    try {
    const todaySessionsRes = await pool.query(
      `select s.id, s.date, s.start_time, s.status, s.mode, st.full_name as student_name
       from sessions s
       join students st on st.id = s.student_id
       where s.tutor_id = $1 and s.date = $2::date
       order by s.start_time asc`,
      [tutorId, today]
    );

    const profileRes = await pool.query(
      `select t.approval_status, t.approval_note, ta.status as application_status
       from tutor_profiles t
       left join tutor_applications ta on ta.tutor_id = t.id
       where t.id = $1`,
      [tutorId]
    );

    const perfRes = await pool.query(
      `select count(s.id) filter (where s.status = 'APPROVED')::int as sessions_completed,
              count(s.id) filter (where s.status in ('SUBMITTED','APPROVED','REJECTED'))::int as reports_submitted,
              count(s.id)::int as sessions_total,
              count(distinct a.student_id)::int as assigned_learners,
              coalesce(sum(vl.hours) filter (where vl.status = 'verified'), 0)::numeric as verified_volunteer_hours,
              count(s.id) filter (where s.status = 'DRAFT' and s.date < current_date)::int as missing_reports
       from tutor_profiles t
       left join assignments a on a.tutor_id = t.id and a.active = true
       left join sessions s on s.tutor_id = t.id
       left join volunteer_logs vl on vl.tutor_id = t.id
       where t.id = $1
       group by t.id`,
      [tutorId]
    );

    const attentionRes = await pool.query(
      `select st.id, st.full_name,
              max(s.date) as last_session_date,
              max(case when s.status = 'REJECTED' then 1 else 0 end)::int as has_missed,
              coalesce(ss.current, 0)::int as current_streak,
              max(sae.occurred_at) as last_activity,
              latest.risk_score,
              latest.momentum_score,
              latest.reasons_json
       from students st
       join tutor_student_map tsm on tsm.student_id = st.id and tsm.tutor_id = $1
       left join users u on u.student_id = st.id
       left join study_streaks ss on ss.user_id = u.id
       left join study_activity_events sae on sae.user_id = u.id
       left join lateral (
         select risk_score, momentum_score, reasons_json
         from student_score_snapshots sss
         where sss.user_id = u.id
         order by score_date desc
         limit 1
       ) latest on true
       left join sessions s on s.student_id = st.id and s.tutor_id = $1
       group by st.id, st.full_name, ss.current, latest.risk_score, latest.momentum_score, latest.reasons_json
       order by latest.risk_score desc nulls last, st.full_name asc`,
      [tutorId]
    );

    const studentsNeedingAttention = attentionRes.rows
      .map((row) => {
        const reasons: string[] = [];
        const currentStreak = Number(row.current_streak || 0);
        const hasMissed = Number(row.has_missed || 0) > 0;
        const lastActivity = row.last_activity ? new Date(row.last_activity as string) : null;
        const riskScore = row.risk_score == null ? null : Number(row.risk_score || 0);
        const momentumScore = row.momentum_score == null ? null : Number(row.momentum_score || 0);

        if (currentStreak === 0) reasons.push('Streak broken');
        if (hasMissed) reasons.push('Missed recent session');
        if (!lastActivity || (Date.now() - lastActivity.getTime()) > 7 * DAY_MS) {
          reasons.push('Low weekly activity');
        }
        if (riskScore != null && riskScore >= 60) {
          reasons.push(`High risk score (${riskScore})`);
        }

        const modelReasons = row.reasons_json
          ? (typeof row.reasons_json === 'string' ? JSON.parse(row.reasons_json) : row.reasons_json)
          : [];

        return {
          studentId: row.id,
          studentName: row.full_name,
          currentStreak,
          riskScore,
          momentumScore,
          modelReasons,
          reasons,
        };
      })
      .filter((row) => row.reasons.length > 0)
      .slice(0, 8);

    return reply.send({
      todaySessions: todaySessionsRes.rows.map((row) => ({
        id: row.id,
        time: String(row.start_time).slice(0, 5),
        studentName: row.student_name,
        status: row.status,
        quickActions: [
          { label: 'Add notes', href: '/tutor/sessions.html' },
          { label: 'Assign practice', href: '/tutor/assignments.html' }
        ]
      })),
      approval: profileRes.rows[0] ?? { approval_status: 'draft' },
      performance: {
        sessionsCompleted: Number(perfRes.rows[0]?.sessions_completed || 0),
        reportsSubmitted: Number(perfRes.rows[0]?.reports_submitted || 0),
        reportSubmissionRate: Number(perfRes.rows[0]?.sessions_total || 0) > 0
          ? Math.round((Number(perfRes.rows[0]?.reports_submitted || 0) / Number(perfRes.rows[0]?.sessions_total || 0)) * 100)
          : 0,
        assignedLearners: Number(perfRes.rows[0]?.assigned_learners || 0),
        verifiedVolunteerHours: Number(perfRes.rows[0]?.verified_volunteer_hours || 0),
        missingReports: Number(perfRes.rows[0]?.missing_reports || 0)
      },
      studentsNeedingAttention,
      quickTools: [
        { id: 'application', label: 'Update application', href: '/tutor/dashboard/#application' },
        { id: 'availability', label: 'Manage availability', href: '/tutor/dashboard/#availability' },
        { id: 'assign_practice', label: 'Assign practice', href: '/tutor/assignments.html' },
        { id: 'session_notes', label: 'Add session notes', href: '/tutor/sessions.html' },
        { id: 'volunteer_hours', label: 'Volunteer hours', href: '/tutor/dashboard/#volunteer' },
        { id: 'message_student', label: 'Message student', href: '/tutor/index.html' },
      ]
    });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/study-activity', {
    preHandler: [app.authenticate, requireAuth, requireRole('STUDENT')],
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const parsed = StudyActivityEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const userId = req.user!.userId;
    const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();
    const occurredDate = toDateOnly(occurredAt);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (parsed.data.dedupeKey) {
        const existingRes = await client.query(
          `select id from study_activity_events where user_id = $1 and dedupe_key = $2 limit 1`,
          [userId, parsed.data.dedupeKey]
        );
        if (Number(existingRes.rowCount || 0) > 0) {
          await client.query('ROLLBACK');
          return reply.send({ ok: true, deduped: true, credited: false });
        }
      }

      await client.query(
        `insert into study_activity_events (user_id, type, occurred_at, metadata_json, dedupe_key)
         values ($1, $2, $3::timestamptz, $4::jsonb, $5)`,
        [userId, parsed.data.type, occurredAt.toISOString(), JSON.stringify(parsed.data.metadata || {}), parsed.data.dedupeKey ?? null]
      );

      await ensureStreakRow(client, userId);

      const streakRes = await client.query(
        `select current, longest, last_credited_date, xp
         from study_streaks
         where user_id = $1
         for update`,
        [userId]
      );

      const current = Number(streakRes.rows[0]?.current || 0);
      const longest = Number(streakRes.rows[0]?.longest || 0);
      const xp = Number(streakRes.rows[0]?.xp || 0);
      const lastCredited = streakRes.rows[0]?.last_credited_date
        ? toDateOnly(new Date(streakRes.rows[0].last_credited_date))
        : null;

      let nextCurrent = current;
      let nextLongest = longest;
      let nextXp = xp;
      let credited = false;

      if (lastCredited !== occurredDate) {
        credited = true;
        if (lastCredited) {
          const prev = Date.parse(`${lastCredited}T00:00:00.000Z`);
          const curr = Date.parse(`${occurredDate}T00:00:00.000Z`);
          const dayDiff = Math.round((curr - prev) / DAY_MS);
          nextCurrent = dayDiff === 1 ? current + 1 : 1;
        } else {
          nextCurrent = 1;
        }
        nextLongest = Math.max(longest, nextCurrent);
        nextXp = xp + BASE_DAILY_XP + (nextCurrent % 7 === 0 ? WEEK_BONUS_XP : 0);

        await client.query(
          `update study_streaks
           set current = $2,
               longest = $3,
               xp = $4,
               last_credited_date = $5::date,
               updated_at = now()
           where user_id = $1`,
          [userId, nextCurrent, nextLongest, nextXp, occurredDate]
        );
      }

      await client.query('COMMIT');

      logEvent(req, 'study_activity.logged', {
        type: parsed.data.type,
        deduped: false,
        credited,
      });

      if (credited) {
        logEvent(req, 'streak_credited', { currentStreak: nextCurrent, xp: nextXp });
      }

      return reply.send({
        ok: true,
        deduped: false,
        credited,
        streak: {
          current: nextCurrent,
          longest: nextLongest,
          lastCreditedDate: credited ? occurredDate : lastCredited,
          xp: nextXp,
        }
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      throw err;
    } finally {
      client.release();
    }
  });

  app.post('/reports/generate', {
    preHandler: [app.authenticate, requireAuth],
  }, async (req, reply) => {
    const parsed = WeeklyReportGenerateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const role = req.user!.role;
    const tutorId = req.user!.tutorId;
    const week = parsed.data.weekStart ? getWeekRange(new Date(`${parsed.data.weekStart}T00:00:00.000Z`)) : getWeekRange(new Date());

    let studentId: string | null = null;
    if (role === 'STUDENT') {
      studentId = req.user!.studentId ?? await getStudentIdForUser(req.user!.userId);
    } else {
      studentId = parsed.data.studentId ?? null;
    }

    if (!studentId) {
      return reply.code(400).send({ error: 'student_id_required' });
    }

    try {
      const allowed = await userCanAccessStudent(req.user!.userId, role, studentId, tutorId);
      if (!allowed) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      const payload = await buildWeeklyReportPayload(studentId, week.weekStart, week.weekEnd);
      if (!payload) {
        return reply.code(404).send({ error: 'student_not_found' });
      }

      const ownerRes = await pool.query(
        `select id from users where student_id = $1`,
        [studentId]
      );
      if (ownerRes.rowCount === 0) {
        return reply.code(409).send({ error: 'student_user_missing' });
      }
      const ownerUserId = ownerRes.rows[0].id as string;

      const res = await pool.query(
        `insert into weekly_reports (user_id, week_start, week_end, payload_json, created_by_user_id)
         values ($1, $2::date, $3::date, $4::jsonb, $5)
         on conflict (user_id, week_start, week_end)
         do update set payload_json = excluded.payload_json,
                       created_by_user_id = excluded.created_by_user_id,
                       created_at = now()
         returning id, user_id, week_start, week_end, created_at`,
        [ownerUserId, week.weekStart, week.weekEnd, JSON.stringify(payload), req.user!.userId]
      );

      await createStudentNotification(pool, {
        studentId,
        type: 'weekly_report_ready',
        title: 'Weekly report ready',
        body: `Your report for ${week.weekStart} to ${week.weekEnd} is now available.`,
        link: '/reports/',
        entityType: 'weekly_report',
        entityId: res.rows[0].id,
        createdByUserId: req.user!.userId,
      });

      logEvent(req, 'report_generated', { reportId: res.rows[0].id });

      return reply.code(201).send({ report: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/reports', {
    preHandler: [app.authenticate, requireAuth],
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = WeeklyReportsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { page, pageSize, offset, limit } = parsePagination(parsed.data as any, { pageSize: 20 });
    const role = req.user!.role;
    const studentIdFilter = parsed.data.studentId;

    const params: any[] = [];
    const filters: string[] = [];

    if (role === 'STUDENT') {
      params.push(req.user!.studentId ?? await getStudentIdForUser(req.user!.userId));
      filters.push(`u.student_id = $${params.length}`);
    } else if (role === 'TUTOR') {
      params.push(req.user!.tutorId);
      filters.push(`exists (
        select 1 from tutor_student_map tsm
        where tsm.tutor_id = $${params.length}
          and tsm.student_id = u.student_id
      )`);
    }

    if (studentIdFilter) {
      if (role === 'STUDENT') {
        return reply.code(403).send({ error: 'forbidden' });
      }
      params.push(studentIdFilter);
      filters.push(`u.student_id = $${params.length}`);
    }

    const where = filters.length ? `where ${filters.join(' and ')}` : '';

    try {
      const listRes = await pool.query(
        `select wr.id, wr.week_start, wr.week_end, wr.created_at,
                u.student_id,
                s.full_name as student_name
         from weekly_reports wr
         join users u on u.id = wr.user_id
         left join students s on s.id = u.student_id
         ${where}
         order by wr.created_at desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, limit, offset]
      );

      const totalRes = await pool.query(
        `select count(*)
         from weekly_reports wr
         join users u on u.id = wr.user_id
         ${where}`,
        params
      );

      return reply.send({
        items: listRes.rows,
        total: Number(totalRes.rows[0]?.count || 0),
        page,
        pageSize,
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/reports', {
    preHandler: [app.authenticate, requireAuth, requireTutor],
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = WeeklyReportsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { page, pageSize, offset, limit } = parsePagination(parsed.data as any, { pageSize: 20 });

    const params: any[] = [req.user!.tutorId];
    const filters: string[] = [`(
      exists (
        select 1 from tutor_student_map tsm
        where tsm.tutor_id = $1
          and tsm.student_id = u.student_id
      )
      or exists (
        select 1 from assignments a
        where a.tutor_id = $1
          and a.student_id = u.student_id
          and a.active = true
      )
    )`];

    if (parsed.data.studentId) {
      params.push(parsed.data.studentId);
      filters.push(`u.student_id = $${params.length}`);
    }

    const where = `where ${filters.join(' and ')}`;
    try {
      const listRes = await pool.query(
        `select wr.id, wr.week_start, wr.week_end, wr.created_at,
                u.student_id,
                s.full_name as student_name
         from weekly_reports wr
         join users u on u.id = wr.user_id
         left join students s on s.id = u.student_id
         ${where}
         order by wr.created_at desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, limit, offset]
      );

      const totalRes = await pool.query(
        `select count(*)
         from weekly_reports wr
         join users u on u.id = wr.user_id
         ${where}`,
        params
      );

      return reply.send({
        items: listRes.rows,
        total: Number(totalRes.rows[0]?.count || 0),
        page,
        pageSize,
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/reports/:id', {
    preHandler: [app.authenticate, requireAuth],
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }

    try {
      const reportRes = await pool.query(
        `select wr.id, wr.user_id, wr.week_start, wr.week_end, wr.payload_json, wr.created_at,
                u.student_id
         from weekly_reports wr
         join users u on u.id = wr.user_id
         where wr.id = $1`,
        [params.data.id]
      );

      if (reportRes.rowCount === 0) {
        return reply.code(404).send({ error: 'report_not_found' });
      }

      const report = reportRes.rows[0];
      const allowed = await userCanAccessStudent(
        req.user!.userId,
        req.user!.role,
        report.student_id,
        req.user!.tutorId
      );
      if (!allowed) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      logEvent(req, 'report_viewed', { reportId: report.id });

      return reply.send({
        report: {
          id: report.id,
          weekStart: toDateOnly(new Date(report.week_start)),
          weekEnd: toDateOnly(new Date(report.week_end)),
          payload: normalizeJson(report.payload_json, {}),
          createdAt: report.created_at,
        }
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
}
