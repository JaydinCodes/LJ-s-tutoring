import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { resetDb } from './helpers/db.js';
import { pool } from '../src/db/pool.js';
import { hashPassword } from '../src/lib/security.js';
import {
  createAdmin,
  createAssignment,
  createStudent,
  createStudentUser,
  createTutor,
  issueMagicToken,
  loginAsTestUser,
  loginWithMagicToken
} from './helpers/factories.js';

describe('Auth + RBAC', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('verifies magic link and sets session cookie', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const token = await issueMagicToken(admin.id);

    const { response, cookie } = await loginWithMagicToken(app, token);
    expect(response.statusCode).toBe(302);
    expect(cookie).toMatch(/^session=/);
    await app.close();
  });

  it('blocks magic link token reuse', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const token = await issueMagicToken(admin.id);

    const first = await app.inject({
      method: 'GET',
      url: `/auth/verify?token=${token}`
    });

    expect(first.statusCode).toBe(302);

    const second = await app.inject({
      method: 'GET',
      url: `/auth/verify?token=${token}`
    });

    expect(second.statusCode).toBe(400);
    expect(second.json().error).toBe('token_used');
    await app.close();
  });

  it('blocks admin routes without cookie', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/admin/students',
      payload: { fullName: 'A B' }
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('blocks tutors from admin endpoints', async () => {
    const app = await buildApp();
    const { user } = await createTutor({
      email: 'tutor@example.com',
      fullName: 'Tutor One',
      defaultHourlyRate: 300
    });
    const token = await issueMagicToken(user.id);
    const auth = await loginWithMagicToken(app, token);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/tutors',
      headers: auth.headers
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('requires MFA for admin password login', async () => {
    const app = await buildApp();

    const passwordHash = await hashPassword('correct-horse-battery-staple');
    const res = await pool.query(
      `insert into users (email, role, password_hash, is_active)
       values ($1, 'ADMIN', $2, true)
       returning email`,
      ['admin-mfa@example.com', passwordHash]
    );

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: res.rows[0].email, password: 'correct-horse-battery-staple' }
    });

    expect(login.statusCode).toBe(403);
    expect(login.json().error).toBe('admin_login_requires_mfa');
    await app.close();
  });

  it('blocks tutors from other tutor sessions', async () => {
    const app = await buildApp();

    const { tutor: tutorA, user: userA } = await createTutor({
      email: 'tutor-a@example.com',
      fullName: 'Tutor A',
      defaultHourlyRate: 300
    });
    const { user: userB } = await createTutor({
      email: 'tutor-b@example.com',
      fullName: 'Tutor B',
      defaultHourlyRate: 300
    });
    const student = await createStudent({ fullName: 'Student One' });
    const assignment = await createAssignment({
      tutorId: tutorA.id,
      studentId: student.id,
      subject: 'Math',
      startDate: '2026-02-01',
      allowedDays: [1, 2, 3, 4, 5],
      allowedTimeRanges: [{ start: '08:00', end: '18:00' }]
    });

    const tokenA = await issueMagicToken(userA.id);
    const authA = await loginWithMagicToken(app, tokenA);

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/tutor/sessions',
      headers: authA.headers,
      payload: {
        assignmentId: assignment.id,
        studentId: student.id,
        date: '2026-02-03',
        startTime: '09:00',
        endTime: '10:00',
        mode: 'online'
      }
    });

    const sessionId = sessionRes.json().session.id as string;

    const tokenB = await issueMagicToken(userB.id);
    const authB = await loginWithMagicToken(app, tokenB);

    const res = await app.inject({
      method: 'PATCH',
      url: `/tutor/sessions/${sessionId}`,
      headers: authB.headers,
      payload: { notes: 'Attempted update' }
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('allows admins to access admin endpoints', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const token = await issueMagicToken(admin.id);
    const auth = await loginWithMagicToken(app, token);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/sessions',
      headers: auth.headers
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('requires CSRF for state-changing requests', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const token = await issueMagicToken(admin.id);
    const auth = await loginWithMagicToken(app, token);

    const missing = await app.inject({
      method: 'POST',
      url: '/admin/students',
      headers: { cookie: auth.cookie },
      payload: { fullName: 'CSRF Test' }
    });

    expect(missing.statusCode).toBe(403);
    expect(missing.json().error).toBe('csrf_missing_or_invalid');

    const ok = await app.inject({
      method: 'POST',
      url: '/admin/students',
      headers: auth.headers,
      payload: { fullName: 'CSRF Test OK' }
    });

    expect(ok.statusCode).toBe(201);
    await app.close();
  });

  it('blocks cross-origin state-changing requests even with CSRF', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const token = await issueMagicToken(admin.id);
    const auth = await loginWithMagicToken(app, token);

    const blocked = await app.inject({
      method: 'POST',
      url: '/admin/students',
      headers: {
        ...auth.headers,
        origin: 'https://evil.example.com'
      },
      payload: { fullName: 'Origin Attack' }
    });

    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe('origin_not_allowed');
    await app.close();
  });

  it('revokes current session on logout and blocks logout-all sessions', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');

    const tokenA = await issueMagicToken(admin.id);
    const authA = await loginWithMagicToken(app, tokenA);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: authA.headers
    });
    expect(logoutRes.statusCode).toBe(200);

    const postLogoutAccess = await app.inject({
      method: 'GET',
      url: '/admin/sessions',
      headers: authA.headers
    });
    expect(postLogoutAccess.statusCode).toBe(401);

    const tokenB = await issueMagicToken(admin.id);
    const authB = await loginWithMagicToken(app, tokenB);

    const globalLogout = await app.inject({
      method: 'POST',
      url: '/auth/logout-all',
      headers: authB.headers
    });
    expect(globalLogout.statusCode).toBe(200);

    const afterGlobalLogout = await app.inject({
      method: 'GET',
      url: '/admin/sessions',
      headers: authB.headers
    });
    expect(afterGlobalLogout.statusCode).toBe(401);

    await app.close();
  });

  it('blocks unauthenticated student dashboard API access', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard'
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('allows protected dashboard access for an authenticated student session', async () => {
    const app = await buildApp();
    const auth = await loginAsTestUser(app, { email: 'student-dashboard@test.local', role: 'STUDENT' });

    const res = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: auth.headers
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().thisWeek).toBeTruthy();
    await app.close();
  });

  it('rejects expired student sessions', async () => {
    const app = await buildApp();
    const { user } = await createStudentUser({
      email: 'student-expired@example.com',
      fullName: 'Student Expired',
      grade: '10'
    });

    const expired = await app.jwt.sign({
      userId: user.id,
      role: 'STUDENT',
      studentId: user.student_id,
    }, { expiresIn: '-10s' });

    const res = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { cookie: `session=${expired}` }
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rate limits magic link requests', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');

    let status = 0;
    for (let i = 0; i < 6; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/request-link',
        payload: { email: admin.email }
      });
      status = res.statusCode;
    }

    expect(status).toBe(429);
    await app.close();
  });

  it('does not allow student dashboard sessions from magic links', async () => {
    const app = await buildApp();
    const { user } = await createStudentUser({
      email: 'student-magic-disabled@example.com',
      fullName: 'Student Magic Disabled',
      grade: '10'
    });

    const token = await issueMagicToken(user.id);
    const res = await app.inject({
      method: 'GET',
      url: `/auth/verify?token=${token}`
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('student_google_required');
    await app.close();
  });

  it('flags rapid magic link retries using a recent failure window', async () => {
    const app = await buildApp();
    const admin = await createAdmin('admin@example.com');
    const ip = '127.0.0.1';

    for (let i = 0; i < 4; i += 1) {
      await pool.query(
        `insert into auth_event_log
         (user_id, ip, user_agent, device_hash, country, success, risk_score, flags_json, created_at)
         values (null, $1, 'test-agent', $2, null, false, 0, '{}'::jsonb, now() - interval '5 minutes')`,
        [ip, `device-${i}`]
      );
    }

    const token = await issueMagicToken(admin.id);
    const res = await app.inject({
      method: 'GET',
      url: `/auth/verify?token=${token}`,
      headers: {
        'user-agent': 'test-agent',
        'accept-language': 'en'
      }
    });

    expect(res.statusCode).toBe(302);
    const events = await pool.query(
      `select risk_score, flags_json
       from auth_event_log
       where user_id = $1 and success = true
       order by created_at desc
       limit 1`,
      [admin.id]
    );
    expect(events.rows[0].risk_score).toBeGreaterThanOrEqual(40);
    expect(events.rows[0].flags_json.rapidRetries).toBe(true);
    await app.close();
  });

  it('signs tutors in with verified Google OAuth and links google_id', async () => {
    const app = await buildApp();
    const { user } = await createTutor({
      email: 'tutor@example.com',
      fullName: 'Tutor One',
      defaultHourlyRate: 300
    });

    (app as any).googleOAuth2 = {
      getAccessTokenFromAuthorizationCodeFlow: async () => ({ token: { id_token: 'test-id-token' } })
    };
    (app as any).verifyGoogleIdToken = async () => ({
      id: 'google-tutor-1',
      email: user.email,
      emailVerified: true,
      name: 'Tutor One'
    });

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=test'
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/tutor/dashboard/');
      expect(String(res.headers['set-cookie'])).toContain('session=');

      const linked = await pool.query('select google_id from users where id = $1', [user.id]);
      expect(linked.rows[0].google_id).toBe('google-tutor-1');
    } finally {
      await app.close();
    }
  });

  it('signs students in with verified Google OAuth', async () => {
    const app = await buildApp();
    const { user } = await createStudentUser({
      email: 'student@example.com',
      fullName: 'Student One',
      grade: '10'
    });

    (app as any).googleStudentOAuth2 = {
      getAccessTokenFromAuthorizationCodeFlow: async () => ({ token: { id_token: 'test-id-token' } })
    };
    (app as any).verifyGoogleIdToken = async () => ({
      id: 'google-student-1',
      email: user.email,
      emailVerified: true,
      name: 'Student One',
      picture: 'https://lh3.googleusercontent.com/a/student'
    });

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/student/callback?code=test'
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/dashboard/');
      expect(String(res.headers['set-cookie'])).toContain('session=');
      const sessionCookie = String(res.headers['set-cookie']);
      const sessionMatch = sessionCookie.match(/session=([^;]+)/);
      expect(sessionMatch?.[1]).toBeTruthy();
      const session = await app.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { cookie: `session=${sessionMatch?.[1]}` }
      });
      expect(session.json().user.profile.email).toBe(user.email);
      expect(session.json().user.profile.picture).toContain('googleusercontent.com');
    } finally {
      await app.close();
    }
  });

  it('redirects student Google callbacks with invalid ID tokens back to login', async () => {
    const app = await buildApp();
    (app as any).googleStudentOAuth2 = {
      getAccessTokenFromAuthorizationCodeFlow: async () => ({ token: { id_token: 'invalid-id-token' } })
    };
    (app as any).verifyGoogleIdToken = async () => {
      throw new Error('google_id_token_invalid');
    };

    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/student/callback?code=test'
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/dashboard/login.html?error=google_id_token_invalid');
    await app.close();
  });

  it('rejects Google OAuth profiles without a verified email', async () => {
    const app = await buildApp();
    (app as any).googleOAuth2 = {
      getAccessTokenFromAuthorizationCodeFlow: async () => ({ token: { id_token: 'test-id-token' } })
    };
    (app as any).verifyGoogleIdToken = async () => {
      throw new Error('google_email_not_verified');
    };

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=test'
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('google_email_not_verified');
    } finally {
      await app.close();
    }
  });
});
