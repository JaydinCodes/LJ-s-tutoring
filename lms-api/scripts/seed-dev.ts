/**
 * seed-dev.ts
 * Seeds the local dev database with one admin, one tutor, and one student.
 *
 * Usage: npm run seed:dev
 *
 * Accounts created:
 *   admin@dev.local   / DevPass123!   (ADMIN)
 *   tutor@dev.local   / DevPass123!   (TUTOR)
 *   student@dev.local / DevPass123!   (STUDENT)
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..');
loadEnvFile(path.resolve(repoRoot, '.env.local'));
loadEnvFile(path.resolve(repoRoot, '.env'));
loadEnvFile(path.resolve(packageRoot, '.env.local'));
loadEnvFile(path.resolve(packageRoot, '.env'));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: DATABASE_URL });

const PASSWORD = 'DevPass123!';

async function hash(pw: string) {
  return argon2.hash(pw, { type: argon2.argon2id });
}

async function seedAdmin() {
  const email = 'admin@dev.local';
  const existing = await pool.query('select id from users where email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    console.log('  admin already exists, skipping');
    return existing.rows[0].id as string;
  }

  const ph = await hash(PASSWORD);
  const res = await pool.query(
    `insert into users (email, role, password_hash, first_name, last_name, is_active)
     values ($1, 'ADMIN', $2, 'Dev', 'Admin', true)
     returning id`,
    [email, ph]
  );
  return res.rows[0].id as string;
}

async function seedTutor() {
  const email = 'tutor@dev.local';
  const existing = await pool.query('select id from users where email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    await pool.query(
      `update tutor_profiles t
       set active = true,
           status = 'ACTIVE',
           approval_status = 'approved',
           qualification_band = coalesce(qualification_band, 'GRADES_10_12'),
           qualified_subjects_json = case
             when qualified_subjects_json is null or qualified_subjects_json = '[]'::jsonb then $2::jsonb
             else qualified_subjects_json
           end
       from users u
       where u.id = $1 and u.tutor_profile_id = t.id`,
      [existing.rows[0].id, JSON.stringify(['Mathematics', 'Physical Sciences'])]
    );
    console.log('  tutor already exists, skipping');
    return existing.rows[0].id as string;
  }

  // tutor_profile first (no user yet)
  const profileRes = await pool.query(
    `insert into tutor_profiles
     (full_name, phone, default_hourly_rate, active, status, approval_status, qualification_band, qualified_subjects_json)
     values ('Dev Tutor', null, 350, true, 'ACTIVE', 'approved', 'GRADES_10_12', $1::jsonb)
     returning id`
    , [JSON.stringify(['Mathematics', 'Physical Sciences'])]
  );
  const profileId = profileRes.rows[0].id as string;

  const ph = await hash(PASSWORD);
  const res = await pool.query(
    `insert into users (email, role, password_hash, tutor_profile_id, first_name, last_name, is_active)
     values ($1, 'TUTOR', $2, $3, 'Dev', 'Tutor', true)
     returning id`,
    [email, ph, profileId]
  );
  return res.rows[0].id as string;
}

async function seedStudent() {
  const email = 'student@dev.local';
  const existing = await pool.query('select id from users where email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    await pool.query(
      `update students s
       set full_name = coalesce(full_name, 'Dev Student'),
           grade = coalesce(grade, '10'),
           school = coalesce(school, 'Project Odysseus Dev School'),
           subjects_json = case
             when subjects_json is null or subjects_json = '[]'::jsonb then $2::jsonb
             else subjects_json
           end,
           is_active = true
       from users u
       where u.id = $1 and u.student_id = s.id`,
      [existing.rows[0].id, JSON.stringify(['Mathematics', 'Physical Sciences', 'English Home Language'])]
    );
    console.log('  student already exists, skipping');
    return existing.rows[0].id as string;
  }

  const studentRes = await pool.query(
    `insert into students (full_name, grade, school, subjects_json, is_active)
     values ('Dev Student', '10', 'Project Odysseus Dev School', $1::jsonb, true)
     returning id`
    , [JSON.stringify(['Mathematics', 'Physical Sciences', 'English Home Language'])]
  );
  const studentId = studentRes.rows[0].id as string;

  const ph = await hash(PASSWORD);
  const res = await pool.query(
    `insert into users (email, role, password_hash, student_id, first_name, last_name, is_active)
     values ($1, 'STUDENT', $2, $3, 'Dev', 'Student', true)
     returning id`,
    [email, ph, studentId]
  );
  return res.rows[0].id as string;
}

async function seedDashboardFixtures() {
  const users = await pool.query(
    `select email, id, tutor_profile_id, student_id
     from users
     where email in ('tutor@dev.local', 'student@dev.local')`
  );

  const tutor = users.rows.find((row) => row.email === 'tutor@dev.local');
  const studentUser = users.rows.find((row) => row.email === 'student@dev.local');
  if (!tutor?.tutor_profile_id || !studentUser?.student_id) {
    console.log('  dashboard fixtures skipped: tutor/student profile missing');
    return;
  }

  const tutorId = tutor.tutor_profile_id as string;
  const studentId = studentUser.student_id as string;
  const studentUserId = studentUser.id as string;

  await pool.query(
    `insert into tutor_student_map (tutor_id, student_id)
     values ($1, $2)
     on conflict do nothing`,
    [tutorId, studentId]
  );

  const assignmentRes = await pool.query(
    `select id from assignments
     where tutor_id = $1 and student_id = $2 and subject = 'Mathematics'
     order by start_date desc
     limit 1`,
    [tutorId, studentId]
  );

  let assignmentId = assignmentRes.rows[0]?.id as string | undefined;
  if (!assignmentId) {
    const created = await pool.query(
      `insert into assignments
       (tutor_id, student_id, subject, start_date, end_date, rate_override, allowed_days_json, allowed_time_ranges_json, active)
       values ($1, $2, 'Mathematics', current_date - interval '14 days', null, null, $3::jsonb, $4::jsonb, true)
       returning id`,
      [tutorId, studentId, JSON.stringify([1, 2, 3, 4, 5]), JSON.stringify([{ start: '15:00', end: '18:00' }])]
    );
    assignmentId = created.rows[0].id as string;
  }

  const learningAssignment = await pool.query(
    `select id from learning_assignments
     where student_id = $1 and title = 'Dev Algebra Revision Task'
     limit 1`,
    [studentId]
  );
  if (Number(learningAssignment.rowCount || 0) === 0) {
    await pool.query(
      `insert into learning_assignments
       (tutor_id, student_id, teaching_assignment_id, subject, title, description, instructions,
        due_date, status, published_at, created_by_user_id)
       values ($1, $2, $3, 'Mathematics', 'Dev Algebra Revision Task',
               'Complete the attached algebra practice and upload a PDF, JPG, or PNG answer file.',
               'Complete the attached algebra practice and upload a PDF, JPG, or PNG answer file.',
               current_date + interval '7 days', 'published', now(), $4)`,
      [tutorId, studentId, assignmentId, tutor.id]
    );
  } else {
    await pool.query(
      `update learning_assignments
       set tutor_id = $1,
           teaching_assignment_id = $2,
           subject = 'Mathematics',
           status = 'published',
           published_at = coalesce(published_at, now()),
           due_date = current_date + interval '7 days',
           updated_at = now()
       where id = $3`,
      [tutorId, assignmentId, learningAssignment.rows[0].id]
    );
  }

  await pool.query(
    `insert into sessions
     (tutor_id, student_id, assignment_id, date, start_time, end_time, duration_minutes, mode, location, notes, sync_key, status)
     values
       ($1, $2, $3, current_date, '15:00'::time, '16:00'::time, 60, 'online', 'Google Meet', 'Dev fixture: upcoming dashboard session', 'dev-today-session', 'DRAFT'),
       ($1, $2, $3, current_date - interval '2 days', '15:00'::time, '16:00'::time, 60, 'online', 'Google Meet', 'Dev fixture: approved practice session', 'dev-approved-session', 'APPROVED')
     on conflict (tutor_id, sync_key) where sync_key is not null do update set
       student_id = excluded.student_id,
       assignment_id = excluded.assignment_id,
       date = excluded.date,
       start_time = excluded.start_time,
       end_time = excluded.end_time,
       duration_minutes = excluded.duration_minutes,
       mode = excluded.mode,
       location = excluded.location,
       notes = excluded.notes,
       status = excluded.status`,
    [tutorId, studentId, assignmentId]
  );

  await pool.query(
    `insert into study_streaks (user_id, current, longest, last_credited_date, xp)
     values ($1, 4, 9, current_date, 420)
     on conflict (user_id) do update set
       current = excluded.current,
       longest = excluded.longest,
       last_credited_date = excluded.last_credited_date,
       xp = excluded.xp,
       updated_at = now()`,
    [studentUserId]
  );

  await pool.query(
    `insert into study_activity_events (user_id, type, occurred_at, metadata_json, dedupe_key)
     values
       ($1, 'session_attended', now(), $2::jsonb, 'dev-session-attended'),
       ($1, 'focus_session', now(), $3::jsonb, 'dev-focus-session')
     on conflict (user_id, dedupe_key) where dedupe_key is not null do update set
       type = excluded.type,
       occurred_at = excluded.occurred_at,
       metadata_json = excluded.metadata_json`,
    [
      studentUserId,
      JSON.stringify({ durationMinutes: 60, subject: 'Mathematics' }),
      JSON.stringify({ durationMinutes: 35, subject: 'Mathematics' }),
    ]
  );

  await pool.query(
    `insert into student_score_snapshots
     (user_id, score_date, risk_score, momentum_score, reasons_json, metrics_json, recommended_actions_json)
     values ($1, current_date, 38, 76, $2::jsonb, $3::jsonb, $4::jsonb)
     on conflict (user_id, score_date) do update set
       risk_score = excluded.risk_score,
       momentum_score = excluded.momentum_score,
       reasons_json = excluded.reasons_json,
       metrics_json = excluded.metrics_json,
       recommended_actions_json = excluded.recommended_actions_json`,
    [
      studentUserId,
      JSON.stringify([{ code: 'steady_progress', detail: 'Recent activity is consistent, with room to strengthen algebra fluency.' }]),
      JSON.stringify({ attendanceRate: 0.9, minutesThisWeek: 95 }),
      JSON.stringify([{ label: 'Review algebra foundations', priority: 'medium' }]),
    ]
  );

  await pool.query(
    `delete from baseline_assessments
     where student_id = $1 and subject = 'Mathematics' and source_type = 'diagnostic'`,
    [studentId]
  );
  await pool.query(
    `insert into baseline_assessments
     (student_id, subject, grade, score, total, percentage, level_band,
      cognitive_breakdown_json, topic_breakdown_json, recommended_next_steps_json,
      completed_at, created_by_user_id, source_type)
     values ($1, 'Mathematics', '10', 72, 100, 72, 'Developing',
             $2::jsonb, $3::jsonb, $4::jsonb, now(), $5, 'diagnostic')`,
    [
      studentId,
      JSON.stringify({ procedural: 76, conceptual: 68, problemSolving: 70 }),
      JSON.stringify({
        Algebra: { score: 62, support: 12 },
        Functions: { score: 74, support: 8 },
        Geometry: { score: 81, support: 6 },
      }),
      JSON.stringify(['Revise algebra factorisation', 'Practise two function interpretation questions', 'Ask Odie for a 5-day study plan']),
      tutor.id,
    ]
  );

  await pool.query(
    `insert into community_profiles (user_id, nickname, privacy_settings_json)
     values ($1, 'DevLearner', $2::jsonb)
     on conflict (user_id) do update set
       nickname = excluded.nickname,
       privacy_settings_json = excluded.privacy_settings_json,
       updated_at = now()`,
    [studentUserId, JSON.stringify({ leaderboardOptIn: true, showFullName: false })]
  );

  await pool.query(
    `insert into career_goal_selections (user_id, goal_id)
     values ($1, 'engineering-foundations')
     on conflict (user_id, goal_id) do nothing`,
    [studentUserId]
  );

  console.log('  dashboard fixtures ready for tutor@dev.local and student@dev.local');
}

async function run() {
  try {
    console.log('Seeding dev accounts...');
    const adminId   = await seedAdmin();
    const tutorId   = await seedTutor();
    const studentId = await seedStudent();
    await seedDashboardFixtures();

    console.log('\nDone! Test credentials (password: DevPass123!):');
    console.log(`  admin@dev.local   → id: ${adminId}`);
    console.log(`  tutor@dev.local   → id: ${tutorId}`);
    console.log(`  student@dev.local → id: ${studentId}`);
  } finally {
    await pool.end();
  }
}

run();
