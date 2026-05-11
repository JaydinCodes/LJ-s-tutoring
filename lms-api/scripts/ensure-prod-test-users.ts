import 'dotenv/config';
import { Pool } from 'pg';
import { hashPassword, normalizeEmail } from '../src/lib/security.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (process.env.CONFIRM_PROD_TEST_USERS !== 'yes') {
  throw new Error('Set CONFIRM_PROD_TEST_USERS=yes to create or update production test users');
}

const adminEmail = requiredEmail('PROD_TEST_ADMIN_EMAIL');
const adminPassword = requiredPassword('PROD_TEST_ADMIN_PASSWORD');
const studentEmail = requiredEmail('PROD_TEST_STUDENT_EMAIL');
const tutorEmail = optionalEmail('PROD_TEST_TUTOR_EMAIL');
const tutorPassword = process.env.PROD_TEST_TUTOR_PASSWORD || null;

const pool = new Pool({ connectionString: databaseUrl });

function requiredEmail(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return normalizeEmail(value);
}

function optionalEmail(name: string) {
  const value = process.env[name]?.trim();
  return value ? normalizeEmail(value) : null;
}

function requiredPassword(name: string) {
  const value = process.env[name];
  if (!value || value.length < 10) {
    throw new Error(`${name} is required and must be at least 10 characters`);
  }
  return value;
}

async function ensureUserRole(email: string, role: 'ADMIN' | 'TUTOR' | 'STUDENT') {
  const existing = await pool.query(
    `select id, role, tutor_profile_id, student_id
     from users
     where email = $1`,
    [email]
  );

  if (Number(existing.rowCount ?? 0) === 0) return null;

  const row = existing.rows[0] as {
    id: string;
    role: 'ADMIN' | 'TUTOR' | 'STUDENT';
    tutor_profile_id: string | null;
    student_id: string | null;
  };

  if (row.role !== role) {
    throw new Error(`${email} already exists with role ${row.role}, expected ${role}`);
  }

  return row;
}

async function ensureAdmin() {
  const passwordHash = await hashPassword(adminPassword);
  const existing = await ensureUserRole(adminEmail, 'ADMIN');
  if (existing) {
    await pool.query(
      `update users
       set password_hash = $1,
           first_name = coalesce(first_name, 'Prod Test'),
           last_name = coalesce(last_name, 'Admin'),
           is_active = true,
           updated_at = now()
       where id = $2`,
      [passwordHash, existing.id]
    );
    return existing.id;
  }

  const res = await pool.query(
    `insert into users (email, role, password_hash, first_name, last_name, is_active)
     values ($1, 'ADMIN', $2, 'Prod Test', 'Admin', true)
     returning id`,
    [adminEmail, passwordHash]
  );
  return res.rows[0].id as string;
}

async function ensureStudent() {
  const existing = await ensureUserRole(studentEmail, 'STUDENT');
  if (existing?.student_id) {
    await pool.query(`update users set is_active = true, updated_at = now() where id = $1`, [existing.id]);
    return { userId: existing.id, studentId: existing.student_id };
  }

  const studentRes = await pool.query(
    `insert into students (full_name, grade, notes, is_active)
     values ($1, $2, $3, true)
     returning id`,
    [
      process.env.PROD_TEST_STUDENT_NAME || 'Prod Test Student',
      process.env.PROD_TEST_STUDENT_GRADE || '10',
      'Production test student account. Safe to delete after validation.'
    ]
  );
  const studentId = studentRes.rows[0].id as string;

  if (existing) {
    await pool.query(
      `update users
       set student_id = $1,
           first_name = coalesce(first_name, 'Prod Test'),
           last_name = coalesce(last_name, 'Student'),
           is_active = true,
           updated_at = now()
       where id = $2`,
      [studentId, existing.id]
    );
    return { userId: existing.id, studentId };
  }

  const userRes = await pool.query(
    `insert into users (email, role, student_id, first_name, last_name, is_active)
     values ($1, 'STUDENT', $2, 'Prod Test', 'Student', true)
     returning id`,
    [studentEmail, studentId]
  );
  return { userId: userRes.rows[0].id as string, studentId };
}

async function ensureTutor() {
  if (!tutorEmail) return null;

  const existing = await ensureUserRole(tutorEmail, 'TUTOR');
  if (existing?.tutor_profile_id) {
    if (tutorPassword) {
      await pool.query(
        `update users set password_hash = $1, is_active = true, updated_at = now() where id = $2`,
        [await hashPassword(tutorPassword), existing.id]
      );
    } else {
      await pool.query(`update users set is_active = true, updated_at = now() where id = $1`, [existing.id]);
    }
    return { userId: existing.id, tutorId: existing.tutor_profile_id };
  }

  const tutorRes = await pool.query(
    `insert into tutor_profiles
     (full_name, phone, default_hourly_rate, active, status, qualification_band, qualified_subjects_json)
     values ($1, null, 250, true, 'ACTIVE', 'GRADES_10_12', $2::jsonb)
     returning id`,
    ['Prod Test Tutor', JSON.stringify(['Mathematics'])]
  );
  const tutorId = tutorRes.rows[0].id as string;
  const passwordHash = tutorPassword ? await hashPassword(tutorPassword) : null;

  if (existing) {
    await pool.query(
      `update users
       set tutor_profile_id = $1,
           password_hash = coalesce($2, password_hash),
           first_name = coalesce(first_name, 'Prod Test'),
           last_name = coalesce(last_name, 'Tutor'),
           is_active = true,
           updated_at = now()
       where id = $3`,
      [tutorId, passwordHash, existing.id]
    );
    return { userId: existing.id, tutorId };
  }

  const userRes = await pool.query(
    `insert into users (email, role, tutor_profile_id, password_hash, first_name, last_name, is_active)
     values ($1, 'TUTOR', $2, $3, 'Prod Test', 'Tutor', true)
     returning id`,
    [tutorEmail, tutorId, passwordHash]
  );
  return { userId: userRes.rows[0].id as string, tutorId };
}

async function ensureDashboardFixtures(student: { userId: string; studentId: string }, tutor: { tutorId: string } | null) {
  await pool.query(
    `insert into community_profiles (user_id, nickname, privacy_settings_json)
     values ($1, $2, $3::jsonb)
     on conflict (user_id) do update set
       nickname = excluded.nickname,
       privacy_settings_json = excluded.privacy_settings_json,
       updated_at = now()`,
    [student.userId, 'ProdTestLearner', JSON.stringify({ leaderboardOptIn: false, showFullName: false })]
  );

  await pool.query(
    `insert into career_goal_selections (user_id, goal_id)
     values ($1, 'engineering-foundations')
     on conflict (user_id, goal_id) do nothing`,
    [student.userId]
  );

  await pool.query(
    `insert into study_streaks (user_id, current, longest, last_credited_date, xp)
     values ($1, 3, 5, current_date, 180)
     on conflict (user_id) do update set
       current = excluded.current,
       longest = excluded.longest,
       last_credited_date = excluded.last_credited_date,
       xp = excluded.xp,
       updated_at = now()`,
    [student.userId]
  );

  await pool.query(
    `insert into study_activity_events (user_id, type, occurred_at, metadata_json, dedupe_key)
     values ($1, 'session_attended', now(), $2::jsonb, 'prod-test-session-attended')
     on conflict (user_id, dedupe_key) where dedupe_key is not null do update set
       occurred_at = excluded.occurred_at,
       metadata_json = excluded.metadata_json`,
    [student.userId, JSON.stringify({ durationMinutes: 45, subject: 'Mathematics' })]
  );

  await pool.query(
    `insert into student_score_snapshots
     (user_id, score_date, risk_score, momentum_score, reasons_json, metrics_json, recommended_actions_json)
     values ($1, current_date, 35, 72, $2::jsonb, $3::jsonb, $4::jsonb)
     on conflict (user_id, score_date) do update set
       risk_score = excluded.risk_score,
       momentum_score = excluded.momentum_score,
       reasons_json = excluded.reasons_json,
       metrics_json = excluded.metrics_json,
       recommended_actions_json = excluded.recommended_actions_json`,
    [
      student.userId,
      JSON.stringify([{ code: 'prod_test_fixture', detail: 'Production test fixture for dashboard validation.' }]),
      JSON.stringify({ attendanceRate: 1, minutesThisWeek: 45 }),
      JSON.stringify([{ label: 'Review mathematics dashboard flow', priority: 'low' }]),
    ]
  );

  if (!tutor) return null;

  await pool.query(
    `insert into tutor_student_map (tutor_id, student_id)
     values ($1, $2)
     on conflict do nothing`,
    [tutor.tutorId, student.studentId]
  );

  const assignmentRes = await pool.query(
    `insert into assignments
     (tutor_id, student_id, subject, start_date, end_date, rate_override, allowed_days_json, allowed_time_ranges_json, active)
     values ($1, $2, 'Mathematics', current_date, null, null, $3::jsonb, $4::jsonb, true)
     returning id`,
    [tutor.tutorId, student.studentId, JSON.stringify([1, 2, 3, 4, 5]), JSON.stringify([{ start: '15:00', end: '18:00' }])]
  );

  const assignmentId = assignmentRes.rows[0].id as string;
  await pool.query(
    `insert into sessions
     (tutor_id, student_id, assignment_id, date, start_time, end_time, duration_minutes, mode, location, notes, sync_key, status)
     values ($1, $2, $3, current_date, '15:00'::time, '16:00'::time, 60, 'online', 'Google Meet', 'Production test dashboard fixture', 'prod-test-dashboard-session', 'DRAFT')
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
    [tutor.tutorId, student.studentId, assignmentId]
  );

  return assignmentId;
}

async function run() {
  const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase();
  const studentDomain = studentEmail.split('@')[1] ?? '';
  if (allowedDomain && studentDomain !== allowedDomain) {
    console.warn(`Warning: PROD_TEST_STUDENT_EMAIL domain ${studentDomain} does not match GOOGLE_ALLOWED_DOMAIN ${allowedDomain}`);
  }

  try {
    const adminId = await ensureAdmin();
    const student = await ensureStudent();
    const tutor = await ensureTutor();
    const assignmentId = await ensureDashboardFixtures(student, tutor);

    console.log('Production test users ensured:', {
      adminEmail,
      adminId,
      studentEmail,
      studentUserId: student.userId,
      studentId: student.studentId,
      tutorEmail: tutorEmail ?? null,
      tutorUserId: tutor?.userId ?? null,
      tutorId: tutor?.tutorId ?? null,
      assignmentId,
    });
    console.log('Student Google sign-in uses the exact PROD_TEST_STUDENT_EMAIL Google account.');
    console.log('Admin sign-in uses PROD_TEST_ADMIN_EMAIL + PROD_TEST_ADMIN_PASSWORD, then the emailed OTP.');
  } finally {
    await pool.end();
  }
}

run();
