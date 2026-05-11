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

import 'dotenv/config';
import argon2 from 'argon2';
import { Pool } from 'pg';

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
    console.log('  tutor already exists, skipping');
    return existing.rows[0].id as string;
  }

  // tutor_profile first (no user yet)
  const profileRes = await pool.query(
    `insert into tutor_profiles (full_name, phone, default_hourly_rate, active)
     values ('Dev Tutor', null, 350, true)
     returning id`
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
    console.log('  student already exists, skipping');
    return existing.rows[0].id as string;
  }

  const studentRes = await pool.query(
    `insert into students (full_name, grade, is_active)
     values ('Dev Student', '10', true)
     returning id`
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
