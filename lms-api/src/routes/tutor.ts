import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole, requireTutorSelfScope } from '../lib/rbac.js';
import { getErrorMonitor } from '../lib/error-monitor.js';
import { createStudentNotification } from '../lib/notifications.js';
import {
  CreateSessionSchema,
  DateRangeQuerySchema,
  IdParamSchema,
  LearningAssignmentCreateSchema,
  SessionReportSchema,
  TutorApplicationSchema,
  TutorAvailabilitySchema,
  TutorDocumentUploadSchema,
  TutorSessionsQuerySchema,
  UpdateSessionSchema,
  VolunteerLogSchema
} from '../lib/schemas.js';
import { durationMinutes, isWithinAssignmentWindow } from '../lib/scheduling.js';
import { buildInvoicePdf, renderInvoiceHtml } from '../lib/invoices.js';
import { getPayPeriodStart } from '../lib/pay-periods.js';
import { parsePagination } from '../lib/pagination.js';

export async function tutorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireRole('TUTOR'));
  app.addHook('preHandler', async (req, reply) => {
    if (!req.impersonation) return;
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return reply.code(403).send({ error: 'impersonation_read_only' });
    }
  });

  const normalizeJson = (value: any, fallback: any) => {
    if (value == null) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return value;
  };

  const toDateString = (value: Date) => value.toISOString().slice(0, 10);
  const documentDir = path.resolve(process.cwd(), 'uploads', 'tutor-documents');
  const allowedDocumentBytes = 200 * 1024;

  const isDateLocked = async (dateValue: string) => {
    const weekStart = getPayPeriodStart(dateValue);
    const res = await pool.query(
      `select status from pay_periods where period_start_date = $1::date`,
      [weekStart]
    );
    return Number(res.rowCount || 0) > 0 && res.rows[0].status === 'LOCKED';
  };

  const getSignedAmount = (type: string, amount: number) =>
    type === 'PENALTY' ? -Math.abs(amount) : Math.abs(amount);

  const ensureTutorActive = async (tutorId: string, reply: any) => {
    const res = await pool.query(
      `select active, status, approval_status from tutor_profiles where id = $1`,
      [tutorId]
    );
    if (Number(res.rowCount || 0) === 0) {
      reply.code(404).send({ error: 'tutor_not_found' });
      return false;
    }
    const tutor = res.rows[0];
    if (!tutor.active || tutor.status !== 'ACTIVE' || tutor.approval_status !== 'approved') {
      reply.code(409).send({ error: 'tutor_not_active' });
      return false;
    }
    return true;
  };

  app.get('/tutor/me', async (req, reply) => {
    const userId = req.user!.userId;
    try {
      const res = await pool.query(
        `select u.id, u.email, u.role, t.id as tutor_id, t.full_name, t.phone, t.default_hourly_rate, t.active,
                t.approval_status, t.approval_reviewed_at, t.approval_note, t.qualification_band,
                t.qualified_subjects_json, t.teaching_preferences_json
         from users u
         join tutor_profiles t on t.id = u.tutor_profile_id
         where u.id = $1`,
        [userId]
      );

      if (Number(res.rowCount || 0) === 0) return reply.code(404).send({ error: 'user_not_found' });
      return reply.send({ me: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/application', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    try {
      const res = await pool.query(
        `select ta.*, t.approval_status
         from tutor_profiles t
         left join tutor_applications ta on ta.tutor_id = t.id
         where t.id = $1`,
        [tutorId]
      );
      if (Number(res.rowCount || 0) === 0) return reply.code(404).send({ error: 'tutor_not_found' });
      return reply.send({ application: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.patch('/tutor/application', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const parsed = TutorApplicationSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const data = parsed.data;
    try {
      const res = await pool.query(
        `insert into tutor_applications
         (tutor_id, personal_details_json, subjects_json, grades_json, teaching_preferences_json, experience, availability_notes)
         values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
         on conflict (tutor_id) do update set
           personal_details_json = excluded.personal_details_json,
           subjects_json = excluded.subjects_json,
           grades_json = excluded.grades_json,
           teaching_preferences_json = excluded.teaching_preferences_json,
           experience = excluded.experience,
           availability_notes = excluded.availability_notes,
           status = case when tutor_applications.status = 'approved' then 'changes_requested' else tutor_applications.status end,
           updated_at = now()
         returning *`,
        [
          tutorId,
          JSON.stringify(data.personalDetails),
          JSON.stringify(data.subjects),
          JSON.stringify(data.grades),
          JSON.stringify(data.teachingPreferences),
          data.experience ?? null,
          data.availabilityNotes ?? null
        ]
      );
      return reply.send({ application: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/tutor/application/submit', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    try {
      const res = await pool.query(
        `update tutor_applications
         set status = 'submitted', submitted_at = coalesce(submitted_at, now()), updated_at = now()
         where tutor_id = $1 and status in ('draft', 'changes_requested', 'rejected', 'submitted')
         returning *`,
        [tutorId]
      );
      if (Number(res.rowCount || 0) === 0) return reply.code(404).send({ error: 'application_not_found' });
      return reply.send({ application: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/documents', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const res = await pool.query(
      `select id, document_type, original_filename, mime_type, file_size_bytes, uploaded_at,
              verification_status, verified_at, notes
       from tutor_documents where tutor_id = $1 order by uploaded_at desc`,
      [tutorId]
    );
    return reply.send({ documents: res.rows });
  });

  app.post('/tutor/documents', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const parsed = TutorDocumentUploadSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const fileBuffer = Buffer.from(parsed.data.contentBase64, 'base64');
    if (fileBuffer.length === 0 || fileBuffer.length > allowedDocumentBytes) {
      return reply.code(400).send({ error: 'invalid_file_size' });
    }
    const ext = parsed.data.mimeType === 'application/pdf' ? 'pdf' : parsed.data.mimeType === 'image/png' ? 'png' : 'jpg';
    try {
      await fs.mkdir(documentDir, { recursive: true });
      const idRes = await pool.query(`select gen_random_uuid() as id`);
      const id = idRes.rows[0].id as string;
      const storageKey = `tutor-documents/${tutorId}/${id}.${ext}`;
      await fs.mkdir(path.join(documentDir, tutorId), { recursive: true });
      await fs.writeFile(path.join(documentDir, tutorId, `${id}.${ext}`), fileBuffer, { flag: 'wx' });
      const res = await pool.query(
        `insert into tutor_documents
         (id, tutor_id, document_type, storage_key, original_filename, mime_type, file_size_bytes)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, document_type, original_filename, mime_type, file_size_bytes, uploaded_at, verification_status`,
        [id, tutorId, parsed.data.documentType, storageKey, parsed.data.originalFilename, parsed.data.mimeType, fileBuffer.length]
      );
      return reply.code(201).send({ document: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/availability', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const res = await pool.query(
      `select id, day_of_week, start_time, end_time, mode, notes, active
       from tutor_availability_slots
       where tutor_id = $1 and active = true
       order by day_of_week asc, start_time asc`,
      [tutorId]
    );
    return reply.send({ slots: res.rows });
  });

  app.patch('/tutor/availability', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const parsed = TutorAvailabilitySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`delete from tutor_availability_slots where tutor_id = $1`, [tutorId]);
      for (const slot of parsed.data.slots) {
        await client.query(
          `insert into tutor_availability_slots (tutor_id, day_of_week, start_time, end_time, mode, notes)
           values ($1, $2, $3::time, $4::time, $5, $6)`,
          [tutorId, slot.dayOfWeek, slot.startTime, slot.endTime, slot.mode, slot.notes ?? null]
        );
      }
      await client.query('commit');
      return reply.send({ ok: true });
    } catch (err: any) {
      await client.query('rollback').catch(() => undefined);
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    } finally {
      client.release();
    }
  });

  app.get('/tutor/assignments', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const { page, pageSize, offset, limit } = parsePagination(req.query as any, { pageSize: 200 });
    try {
      const res = await pool.query(
        `select a.id, a.subject, a.start_date, a.end_date, a.rate_override, a.allowed_days_json, a.allowed_time_ranges_json, a.active,
                s.id as student_id, s.full_name, s.grade
         from assignments a
         join students s on s.id = a.student_id
         where a.tutor_id = $1
         order by a.start_date desc
         limit $2 offset $3`,
        [tutorId, limit, offset]
      );

      const totalRes = await pool.query(
        `select count(*)
         from assignments a
         where a.tutor_id = $1`,
        [tutorId]
      );

      return reply.send({
        assignments: res.rows,
        items: res.rows,
        total: Number(totalRes.rows[0]?.count || 0),
        page,
        pageSize
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/students', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const { page, pageSize, offset, limit } = parsePagination(req.query as any, { pageSize: 200 });
    try {
      const res = await pool.query(
        `select s.id, s.full_name, s.grade, s.school, s.subjects_json, s.partner_affiliation, s.active,
                string_agg(distinct a.subject, ', ' order by a.subject) as subjects,
                max(sess.date) as latest_session_date,
                max(sess.status) filter (where sess.date = latest.latest_date) as latest_attendance_status,
                count(distinct la.id) filter (where la.status = 'assigned')::int as open_assignments,
                latest_score.risk_score,
                latest_score.momentum_score,
                baseline.percentage as baseline_percentage,
                baseline.subject as baseline_subject
         from assignments a
         join students s on s.id = a.student_id
         left join users u on u.student_id = s.id
         left join lateral (
           select max(date) as latest_date from sessions where tutor_id = a.tutor_id and student_id = s.id
         ) latest on true
         left join lateral (
           select risk_score, momentum_score
           from student_score_snapshots sss
           where sss.user_id = u.id
           order by score_date desc
           limit 1
         ) latest_score on true
         left join lateral (
           select percentage, subject
           from baseline_assessments ba
           where ba.student_id = s.id
           order by completed_at desc
           limit 1
         ) baseline on true
         left join sessions sess on sess.tutor_id = a.tutor_id and sess.student_id = s.id
         left join learning_assignments la on la.tutor_id = a.tutor_id and la.student_id = s.id
         where a.tutor_id = $1 and a.active = true and s.active = true
         group by s.id, s.full_name, s.grade, s.school, s.subjects_json, s.partner_affiliation, s.active,
                  latest_score.risk_score, latest_score.momentum_score, baseline.percentage, baseline.subject
         order by s.full_name asc
         limit $2 offset $3`,
        [tutorId, limit, offset]
      );

      const totalRes = await pool.query(
        `select count(distinct s.id) as count
         from assignments a
         join students s on s.id = a.student_id
         where a.tutor_id = $1 and a.active = true and s.active = true`,
        [tutorId]
      );

      return reply.send({
        students: res.rows,
        items: res.rows,
        total: Number(totalRes.rows[0]?.count || 0),
        page,
        pageSize
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/sessions', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const parsed = TutorSessionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { from, to, status } = parsed.data;
    const { page, pageSize, offset, limit } = parsePagination(req.query as any, { pageSize: 200 });

    const params: any[] = [tutorId];
    const filters: string[] = ['s.tutor_id = $1'];

    if (from) {
      params.push(from);
      filters.push(`s.date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      filters.push(`s.date <= $${params.length}::date`);
    }
    if (status) {
      params.push(status);
      filters.push(`s.status = $${params.length}`);
    }

    try {
      const res = await pool.query(
        `select s.id, s.assignment_id, s.student_id, s.date, s.start_time, s.end_time, s.duration_minutes, s.mode, s.location,
                s.notes, s.status, s.created_at, s.submitted_at, s.approved_at,
                st.full_name as student_name
         from sessions s
         join students st on st.id = s.student_id
         where ${filters.join(' and ')}
         order by s.date desc, s.start_time desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, limit, offset]
      );

      const totalRes = await pool.query(
        `select count(*)
         from sessions s
         where ${filters.join(' and ')}`,
        params
      );

      return reply.send({
        sessions: res.rows,
        items: res.rows,
        total: Number(totalRes.rows[0]?.count || 0),
        page,
        pageSize
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/tutor/sessions', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    if (!(await ensureTutorActive(tutorId, reply))) return reply;
    const parsed = CreateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const { assignmentId, studentId, date, startTime, endTime, mode, location, notes, idempotencyKey } = parsed.data;

    try {
      const assignmentRes = await pool.query(
        `select id, tutor_id, student_id, start_date, end_date, allowed_days_json, allowed_time_ranges_json, active
         from assignments
         where id = $1`,
        [assignmentId]
      );

      if (Number(assignmentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'assignment_not_found' });
      const assignment = assignmentRes.rows[0];
      if (!requireTutorSelfScope(req, reply, assignment.tutor_id)) return reply;
      if (assignment.student_id !== studentId) return reply.code(400).send({ error: 'student_mismatch' });
      if (!assignment.active) return reply.code(409).send({ error: 'assignment_inactive' });

      if (await isDateLocked(date)) return reply.code(409).send({ error: 'pay_period_locked' });

      const allowedDays = normalizeJson(assignment.allowed_days_json, []);
      const allowedTimeRanges = normalizeJson(assignment.allowed_time_ranges_json, []);

      const okWindow = isWithinAssignmentWindow(date, startTime, endTime, {
        startDate: new Date(assignment.start_date).toISOString().slice(0, 10),
        endDate: assignment.end_date ? new Date(assignment.end_date).toISOString().slice(0, 10) : null,
        allowedDays,
        allowedTimeRanges
      });

      if (!okWindow) return reply.code(400).send({ error: 'outside_assignment_window' });

      const minutes = durationMinutes(startTime, endTime);
      if (minutes <= 0) return reply.code(400).send({ error: 'invalid_duration_minutes' });

      const overlap = await pool.query(
        `select 1 from sessions
         where tutor_id = $1 and date = $2::date
         and not (end_time <= $3::time or start_time >= $4::time)
         limit 1`,
        [tutorId, date, startTime, endTime]
      );

      if (Number(overlap.rowCount || 0) > 0) return reply.code(409).send({ error: 'overlapping_session' });

      if (idempotencyKey) {
        const existingRes = await pool.query(
          `select * from sessions where tutor_id = $1 and sync_key = $2 limit 1`,
          [tutorId, idempotencyKey]
        );
        if (Number(existingRes.rowCount || 0) > 0) {
          return reply.send({ session: existingRes.rows[0], deduped: true });
        }
      }

      const res = await pool.query(
        `insert into sessions
         (tutor_id, student_id, assignment_id, date, start_time, end_time, duration_minutes, mode, location, notes, status, sync_key)
         values ($1, $2, $3, $4::date, $5::time, $6::time, $7, $8, $9, $10, 'DRAFT', $11)
         returning *`,
        [tutorId, studentId, assignmentId, date, startTime, endTime, minutes, mode, location ?? null, notes ?? null, idempotencyKey ?? null]
      );

      return reply.code(201).send({ session: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.patch('/tutor/sessions/:id', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    if (!(await ensureTutorActive(tutorId, reply))) return reply;
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const sessionId = params.data.id;

    const parsed = UpdateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    try {
      const currentRes = await pool.query(
        `select * from sessions where id = $1 and tutor_id = $2`,
        [sessionId, tutorId]
      );

      if (Number(currentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'session_not_found' });
      const current = currentRes.rows[0];
      if (current.status !== 'DRAFT') return reply.code(409).send({ error: 'only_draft_editable' });

      const date = parsed.data.date ?? new Date(current.date).toISOString().slice(0, 10);
      const startTime = parsed.data.startTime ?? current.start_time;
      const endTime = parsed.data.endTime ?? current.end_time;
      const minutes = durationMinutes(startTime, endTime);
      if (minutes <= 0) return reply.code(400).send({ error: 'invalid_duration_minutes' });

      if (await isDateLocked(date)) return reply.code(409).send({ error: 'pay_period_locked' });

      const assignmentRes = await pool.query(
        `select start_date, end_date, allowed_days_json, allowed_time_ranges_json, active
         from assignments where id = $1`,
        [current.assignment_id]
      );

      if (Number(assignmentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'assignment_not_found' });
      const assignment = assignmentRes.rows[0];
      if (!assignment.active) return reply.code(409).send({ error: 'assignment_inactive' });

      const okWindow = isWithinAssignmentWindow(date, startTime, endTime, {
        startDate: new Date(assignment.start_date).toISOString().slice(0, 10),
        endDate: assignment.end_date ? new Date(assignment.end_date).toISOString().slice(0, 10) : null,
        allowedDays: normalizeJson(assignment.allowed_days_json, []),
        allowedTimeRanges: normalizeJson(assignment.allowed_time_ranges_json, [])
      });

      if (!okWindow) return reply.code(400).send({ error: 'outside_assignment_window' });

      const overlap = await pool.query(
        `select 1 from sessions
         where tutor_id = $1 and date = $2::date and id <> $3
         and not (end_time <= $4::time or start_time >= $5::time)
         limit 1`,
        [tutorId, date, sessionId, startTime, endTime]
      );

      if (Number(overlap.rowCount || 0) > 0) return reply.code(409).send({ error: 'overlapping_session' });

      const beforeJson = { ...current };

      const updatedRes = await pool.query(
        `update sessions
         set date = $1::date,
             start_time = $2::time,
             end_time = $3::time,
             duration_minutes = $4,
             mode = $5,
             location = $6,
             notes = $7
         where id = $8
         returning *`,
        [
          date,
          startTime,
          endTime,
          minutes,
          parsed.data.mode ?? current.mode,
          parsed.data.location ?? current.location,
          parsed.data.notes ?? current.notes,
          sessionId
        ]
      );

      const afterJson = { ...updatedRes.rows[0] };
      await pool.query(
        `insert into session_history (session_id, changed_by_user_id, change_type, before_json, after_json)
         values ($1, $2, 'edit', $3, $4)`,
        [sessionId, req.user!.userId, beforeJson, afterJson]
      );

      return reply.send({ session: updatedRes.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.patch('/tutor/sessions/:id/report', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    if (!(await ensureTutorActive(tutorId, reply))) return reply;
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    const parsed = SessionReportSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });

    try {
      const currentRes = await pool.query(`select * from sessions where id = $1 and tutor_id = $2`, [params.data.id, tutorId]);
      if (Number(currentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'session_not_found' });
      if (currentRes.rows[0].status !== 'DRAFT') return reply.code(409).send({ error: 'only_draft_editable' });

      const res = await pool.query(
        `update sessions
         set attendance_status = $1,
             topics_covered = $2,
             learner_struggles = $3,
             homework_assigned = $4,
             tutor_private_notes = $5,
             student_summary = $6,
             notes = coalesce($6, notes)
         where id = $7 and tutor_id = $8
         returning *`,
        [
          parsed.data.attendanceStatus ?? null,
          parsed.data.topicsCovered ?? null,
          parsed.data.learnerStruggles ?? null,
          parsed.data.homeworkAssigned ?? null,
          parsed.data.tutorPrivateNotes ?? null,
          parsed.data.studentSummary ?? null,
          params.data.id,
          tutorId
        ]
      );

      await createStudentNotification(pool, {
        studentId: currentRes.rows[0].student_id,
        type: 'session_report_updated',
        title: 'Session summary updated',
        body: 'Your tutor added notes and learning feedback for the latest session.',
        link: '/dashboard/',
        entityType: 'session',
        entityId: params.data.id,
        createdByUserId: req.user!.userId,
      });

      return reply.send({ session: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.post('/tutor/sessions/:id/submit', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    if (!(await ensureTutorActive(tutorId, reply))) return reply;
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const sessionId = params.data.id;

    try {
      const currentRes = await pool.query(
        `select * from sessions where id = $1 and tutor_id = $2`,
        [sessionId, tutorId]
      );

      if (Number(currentRes.rowCount || 0) === 0) return reply.code(404).send({ error: 'session_not_found' });
      const current = currentRes.rows[0];
      if (current.status !== 'DRAFT') return reply.code(409).send({ error: 'only_draft_submittable' });

      if (await isDateLocked(toDateString(current.date))) {
        return reply.code(409).send({ error: 'pay_period_locked' });
      }

      const updatedRes = await pool.query(
        `update sessions
         set status = 'SUBMITTED', submitted_at = now()
         where id = $1
         returning *`,
        [sessionId]
      );

      await pool.query(
        `insert into session_history (session_id, changed_by_user_id, change_type, before_json, after_json)
         values ($1, $2, 'submit', $3, $4)`,
        [sessionId, req.user!.userId, current, updatedRes.rows[0]]
      );

      await createStudentNotification(pool, {
        studentId: current.student_id,
        type: 'session_report_submitted',
        title: 'Session notes submitted',
        body: 'Your tutor submitted the latest session summary for review.',
        link: '/dashboard/',
        entityType: 'session',
        entityId: sessionId,
        createdByUserId: req.user!.userId,
      });

      return reply.send({ session: updatedRes.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/learning-assignments', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const res = await pool.query(
      `select la.*, st.full_name as student_name,
              coalesce(history.submission_versions, '[]'::json) as submission_versions
       from learning_assignments la
       join students st on st.id = la.student_id
       left join lateral (
         select json_agg(
           json_build_object(
             'id', sub.id,
             'status', sub.status,
             'submitted_at', sub.submitted_at,
             'original_filename', sub.original_filename,
             'mime_type', sub.mime_type,
             'size_bytes', sub.size_bytes,
             'version_number', sub.version_number,
             'is_latest', sub.is_latest,
             'file_url', sub.file_url
           )
           order by sub.is_latest desc, sub.version_number desc, sub.submitted_at desc
         ) as submission_versions
         from assignment_submissions sub
         where sub.assignment_id = la.id
       ) history on true
       where la.tutor_id = $1
       order by coalesce(la.due_date, la.created_at::date) desc, la.created_at desc`,
      [tutorId]
    );
    return reply.send({ assignments: res.rows, items: res.rows });
  });

  app.post('/tutor/learning-assignments', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    if (!(await ensureTutorActive(tutorId, reply))) return reply;
    const parsed = LearningAssignmentCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    try {
      const assignmentRes = await pool.query(
        `select id, student_id, subject from assignments
         where tutor_id = $1 and student_id = $2 and active = true
           and ($3::uuid is null or id = $3::uuid)
         order by start_date desc
         limit 1`,
        [tutorId, parsed.data.studentId, parsed.data.assignmentId ?? null]
      );
      if (Number(assignmentRes.rowCount || 0) === 0) return reply.code(403).send({ error: 'student_not_assigned' });
      const teachingAssignment = assignmentRes.rows[0];
      const res = await pool.query(
        `insert into learning_assignments
         (tutor_id, student_id, teaching_assignment_id, subject, title, instructions, due_date, created_by_user_id)
         values ($1, $2, $3, $4, $5, $6, $7::date, $8)
         returning *`,
        [
          tutorId,
          parsed.data.studentId,
          teachingAssignment.id,
          parsed.data.subject || teachingAssignment.subject,
          parsed.data.title,
          parsed.data.instructions ?? null,
          parsed.data.dueDate ?? null,
          req.user!.userId
        ]
      );

      await createStudentNotification(pool, {
        studentId: res.rows[0].student_id,
        type: 'learning_assignment_published',
        title: 'New assignment published',
        body: `${res.rows[0].title || 'A new learning assignment'} is ready for you.`,
        link: '/dashboard/assignments/',
        entityType: 'learning_assignment',
        entityId: res.rows[0].id,
        createdByUserId: req.user!.userId,
      });

      return reply.code(201).send({ assignment: res.rows[0] });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/volunteer/events', async (_req, reply) => {
    const res = await pool.query(
      `select * from volunteer_events where status = 'planned' order by event_date asc nulls last, created_at desc`
    );
    return reply.send({ events: res.rows });
  });

  app.get('/tutor/volunteer/logs', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const res = await pool.query(
      `select vl.*, ve.title as event_title
       from volunteer_logs vl
       left join volunteer_events ve on ve.id = vl.event_id
       where vl.tutor_id = $1
       order by vl.created_at desc`,
      [tutorId]
    );
    return reply.send({ logs: res.rows });
  });

  app.post('/tutor/volunteer/logs', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const parsed = VolunteerLogSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    const status = parsed.data.hours != null ? 'submitted' : 'signed_up';
    const res = await pool.query(
      `insert into volunteer_logs
       (tutor_id, event_id, status, hours, volunteered_on, notes, evidence_document_id, submitted_at)
       values ($1, $2, $3, $4, $5::date, $6, $7, case when $3 = 'submitted' then now() else null end)
       returning *`,
      [
        tutorId,
        parsed.data.eventId ?? null,
        status,
        parsed.data.hours ?? null,
        parsed.data.volunteeredOn ?? null,
        parsed.data.notes ?? null,
        parsed.data.evidenceDocumentId ?? null
      ]
    );
    return reply.code(201).send({ log: res.rows[0] });
  });

  app.get('/tutor/performance', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const res = await pool.query(
      `select
        count(s.id) filter (where s.status = 'APPROVED')::int as sessions_completed,
        count(s.id) filter (where s.status in ('SUBMITTED','APPROVED','REJECTED'))::int as reports_submitted,
        count(s.id)::int as sessions_total,
        count(distinct a.student_id)::int as assigned_learners,
        count(distinct a.subject)::int as active_subjects,
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
    const row = res.rows[0] ?? {};
    const total = Number(row.sessions_total || 0);
    const submitted = Number(row.reports_submitted || 0);
    return reply.send({
      performance: {
        sessionsCompleted: Number(row.sessions_completed || 0),
        reportsSubmitted: submitted,
        reportSubmissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
        assignedLearners: Number(row.assigned_learners || 0),
        activeSubjects: Number(row.active_subjects || 0),
        verifiedVolunteerHours: Number(row.verified_volunteer_hours || 0),
        missingReports: Number(row.missing_reports || 0)
      }
    });
  });

  app.get('/tutor/payroll/weeks', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const parsed = DateRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { from, to } = parsed.data;
    const { page, pageSize } = parsePagination(req.query as any, { pageSize: 200 });

    const params: any[] = [tutorId];
    const filters: string[] = [`s.tutor_id = $1`, `s.status = 'APPROVED'`];

    if (from) {
      params.push(from);
      filters.push(`s.date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      filters.push(`s.date <= $${params.length}::date`);
    }

    try {
    const sessionRes = await pool.query(
      `select date_trunc('week', s.date)::date as week_start,
              sum(s.duration_minutes) as total_minutes,
              sum((s.duration_minutes / 60.0) * coalesce(a.rate_override, t.default_hourly_rate)) as total_amount
       from sessions s
       join assignments a on a.id = s.assignment_id
       join tutor_profiles t on t.id = s.tutor_id
       where ${filters.join(' and ')}
       group by 1
       order by 1 desc`,
      params
    );

    const adjParams: any[] = [tutorId];
    const adjFilters: string[] = ['a.tutor_id = $1', `a.status = 'APPROVED'`, 'a.voided_at is null'];
    if (from) {
      adjParams.push(from);
      adjFilters.push(`p.period_start_date >= $${adjParams.length}::date`);
    }
    if (to) {
      adjParams.push(to);
      adjFilters.push(`p.period_start_date <= $${adjParams.length}::date`);
    }

    const adjustmentRes = await pool.query(
      `select p.period_start_date as week_start, a.type, a.amount, a.reason
       from adjustments a
       join pay_periods p on p.id = a.pay_period_id
       where ${adjFilters.join(' and ')}`,
      adjParams
    );

    const weeks = new Map<string, {
      week_start: string;
      total_minutes: number;
      total_amount: number;
      adjustments: Array<{ type: string; amount: number; reason: string; signed_amount: number }>;
      status: string;
    }>();

    for (const row of sessionRes.rows) {
      const weekStart = toDateString(row.week_start);
      weeks.set(weekStart, {
        week_start: weekStart,
        total_minutes: Number(row.total_minutes ?? 0),
        total_amount: Number(row.total_amount ?? 0),
        adjustments: [],
        status: 'OPEN'
      });
    }

    for (const row of adjustmentRes.rows) {
      const weekStart = toDateString(row.week_start);
      const signedAmount = getSignedAmount(row.type, Number(row.amount));
      const existing = weeks.get(weekStart) ?? {
        week_start: weekStart,
        total_minutes: 0,
        total_amount: 0,
        adjustments: [],
        status: 'OPEN'
      };

      existing.adjustments.push({
        type: row.type,
        amount: Number(row.amount),
        reason: row.reason,
        signed_amount: signedAmount
      });
      existing.total_amount += signedAmount;
      weeks.set(weekStart, existing);
    }

    const weekStarts = Array.from(weeks.keys());
    if (weekStarts.length > 0) {
      const statusRes = await pool.query(
        `select period_start_date, status from pay_periods
         where period_start_date = any($1::date[])`,
        [weekStarts]
      );

      for (const row of statusRes.rows) {
        const weekStart = toDateString(row.period_start_date);
        const entry = weeks.get(weekStart);
        if (entry) entry.status = row.status;
      }
    }

    const response = Array.from(weeks.values()).sort((a, b) => b.week_start.localeCompare(a.week_start));
    const total = response.length;
    const offset = (page - 1) * pageSize;
    const paged = response.slice(offset, offset + pageSize);
    return reply.send({
      weeks: paged,
      items: paged,
      total,
      page,
      pageSize
    });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/invoices', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const parsed = DateRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { from, to } = parsed.data;
    const { page, pageSize, offset, limit } = parsePagination(req.query as any, { pageSize: 200 });

    const params: any[] = [tutorId];
    const filters: string[] = ['i.tutor_id = $1'];

    if (from) {
      params.push(from);
      filters.push(`i.period_start >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      filters.push(`i.period_end <= $${params.length}::date`);
    }

    try {
      const res = await pool.query(
        `select i.id, i.period_start, i.period_end, i.invoice_number, i.total_amount, i.status, i.created_at
         from invoices i
         where ${filters.join(' and ')}
         order by i.period_start desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, limit, offset]
      );

      const totalRes = await pool.query(
        `select count(*)
         from invoices i
         where ${filters.join(' and ')}`,
        params
      );

      return reply.send({
        invoices: res.rows,
        items: res.rows,
        total: Number(totalRes.rows[0]?.count || 0),
        page,
        pageSize
      });
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/invoices/:id', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const invoiceId = params.data.id;

    try {
      const invoiceRes = await pool.query(
        `select i.id, i.invoice_number, i.period_start, i.period_end, i.total_amount,
                t.full_name
         from invoices i
         join tutor_profiles t on t.id = i.tutor_id
         where i.id = $1 and i.tutor_id = $2`,
        [invoiceId, tutorId]
      );

      if (invoiceRes.rowCount === 0) return reply.code(404).send({ error: 'invoice_not_found' });
      const invoice = invoiceRes.rows[0];

      const linesRes = await pool.query(
        `select description, minutes, rate, amount
         from invoice_lines
         where invoice_id = $1
         order by id asc`,
        [invoiceId]
      );

      const html = renderInvoiceHtml({
        invoiceNumber: invoice.invoice_number,
        tutorName: invoice.full_name,
        periodStart: invoice.period_start.toISOString().slice(0, 10),
        periodEnd: invoice.period_end.toISOString().slice(0, 10),
        totalAmount: String(invoice.total_amount),
        lines: linesRes.rows.map((line) => ({
          description: line.description,
          minutes: line.minutes,
          rate: String(line.rate),
          amount: String(line.amount)
        }))
      });

      return reply.type('text/html').send(html);
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  app.get('/tutor/invoices/:id.pdf', async (req, reply) => {
    const tutorId = req.user!.tutorId!;
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_request', details: params.error.flatten() });
    }
    const invoiceId = params.data.id;

    try {
      const invoiceRes = await pool.query(
        `select i.id, i.invoice_number, i.period_start, i.period_end, i.total_amount,
                t.full_name
         from invoices i
         join tutor_profiles t on t.id = i.tutor_id
         where i.id = $1 and i.tutor_id = $2`,
        [invoiceId, tutorId]
      );

      if (invoiceRes.rowCount === 0) return reply.code(404).send({ error: 'invoice_not_found' });
      const invoice = invoiceRes.rows[0];

      const linesRes = await pool.query(
        `select description, minutes, rate, amount
         from invoice_lines
         where invoice_id = $1
         order by id asc`,
        [invoiceId]
      );

      const doc = buildInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        tutorName: invoice.full_name,
        periodStart: invoice.period_start.toISOString().slice(0, 10),
        periodEnd: invoice.period_end.toISOString().slice(0, 10),
        totalAmount: String(invoice.total_amount),
        lines: linesRes.rows.map((line) => ({
          description: line.description,
          minutes: line.minutes,
          rate: String(line.rate),
          amount: String(line.amount)
        }))
      });

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
      doc.pipe(reply.raw);
      doc.end();
      return reply;
    } catch (err: any) {
      getErrorMonitor().captureException(err, { correlationId: req.id, userId: req.user?.userId, role: req.user?.role });
      req.log?.error?.(err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
}
