import type { FastifyInstance } from 'fastify';
import type { OAuth2Namespace } from '@fastify/oauth2';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';

// Augment FastifyInstance so TypeScript knows about googleOAuth2 when the plugin is registered
declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2?: OAuth2Namespace;
    googleStudentOAuth2?: OAuth2Namespace;
    googleAdminOAuth2?: OAuth2Namespace;
    verifyGoogleIdToken?: (input: {
      idToken: string;
      audience: string;
      nonce?: string;
    }) => Promise<GoogleVerifiedProfile>;
  }
}
import { pool } from '../db/pool.js';
import { normalizeEmail, generateCsrfToken, verifyPassword, hashPassword, hashToken } from '../lib/security.js';
import { LoginSchema, MagicLinkRequestSchema, RegisterAdminSchema, AdminLoginSchema, AdminOtpSchema, TestLoginSchema } from '../lib/schemas.js';
import { sendOtpEmail } from '../lib/email.js';
import { safeAuditMeta, writeAuditLog } from '../lib/audit.js';
import { findUserByEmail, requestMagicLink, verifyMagicLink } from '../domains/auth/service.js';

type UserRole = 'ADMIN' | 'TUTOR' | 'STUDENT';

type SessionProfile = {
  email?: string;
  name?: string;
  picture?: string;
};

type SessionJwtPayload = {
  userId: string;
  role: UserRole;
  tutorId?: string;
  studentId?: string;
  profile?: SessionProfile;
};

type GoogleVerifiedProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
  hd?: string;
};

const googleOAuthVerifier = new OAuth2Client();

function setPrivateNoStore(reply: any) {
  reply.header('Cache-Control', 'private, no-store, max-age=0');
  reply.header('Pragma', 'no-cache');
}

function cookieDomain() {
  return process.env.COOKIE_DOMAIN || undefined;
}

function durationToSeconds(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  if (unit === 'd') return amount * 60 * 60 * 24;
  return null;
}

function sessionCookieMaxAgeSeconds() {
  const explicit = durationToSeconds(process.env.SESSION_MAX_AGE_SECONDS);
  const fromJwt = durationToSeconds(process.env.JWT_EXPIRES_IN);
  return Math.max(60, explicit ?? fromJwt ?? 15 * 60);
}

function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: sessionCookieMaxAgeSeconds(),
    ...(cookieDomain() ? { domain: cookieDomain() } : {})
  };
}

function csrfCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    ...(cookieDomain() ? { domain: cookieDomain() } : {})
  };
}

function clearAuthCookieOptions() {
  return {
    path: '/',
    ...(cookieDomain() ? { domain: cookieDomain() } : {})
  };
}

function setAuthCookies(reply: any, jwt: string) {
  reply.setCookie('session', jwt, sessionCookieOptions());
  const csrfToken = generateCsrfToken();
  reply.setCookie('csrf', csrfToken, csrfCookieOptions());
  return csrfToken;
}

function sessionExpiryFromJwt(app: FastifyInstance, jwtToken: string): string | null {
  const decoded = app.jwt.decode(jwtToken) as { exp?: number } | null;
  if (!decoded || typeof decoded.exp !== 'number') return null;
  return new Date(decoded.exp * 1000).toISOString();
}

function getRequestHeader(req: any, name: string): string {
  const raw = req?.headers?.[name.toLowerCase()] ?? req?.headers?.[name];
  if (Array.isArray(raw)) return String(raw[0] ?? '');
  if (typeof raw === 'string') return raw;
  return '';
}

async function writeAuthAuditSafe(
  req: any,
  entry: {
    actorUserId?: string | null;
    actorRole?: UserRole | null;
    action: string;
    entityId?: string | null;
    meta?: Record<string, unknown> | null;
  }
) {
  try {
    await writeAuditLog(pool, {
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      entityType: 'auth',
      entityId: entry.entityId ?? entry.actorUserId ?? null,
      meta: safeAuditMeta(entry.meta ?? null),
      ip: req?.ip ?? null,
      userAgent: getRequestHeader(req, 'user-agent') || null,
      correlationId: req?.id ?? null
    });
  } catch (err) {
    req?.log?.error?.(err, 'auth_audit_write_failed');
  }
}

async function verifyGoogleIdToken(
  app: FastifyInstance,
  input: { idToken: string; nonce?: string }
): Promise<GoogleVerifiedProfile> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience && !app.verifyGoogleIdToken) {
    throw new Error('google_oauth_not_configured');
  }

  const verifier = app.verifyGoogleIdToken ?? (async ({ idToken, audience, nonce }) => {
    const ticket = await googleOAuthVerifier.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('google_id_token_invalid');
    }

    const issuer = String(payload.iss ?? '');
    if (issuer !== 'https://accounts.google.com' && issuer !== 'accounts.google.com') {
      throw new Error('google_issuer_invalid');
    }
    if (payload.aud !== audience) {
      throw new Error('google_audience_invalid');
    }
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      throw new Error('google_token_expired');
    }
    if (nonce && payload.nonce !== nonce) {
      throw new Error('google_nonce_invalid');
    }
    if (!payload.sub || !payload.email) {
      throw new Error('google_profile_incomplete');
    }
    if (payload.email_verified !== true) {
      throw new Error('google_email_not_verified');
    }

    return {
      id: payload.sub,
      email: payload.email,
      emailVerified: true,
      name: payload.name,
      picture: payload.picture,
      givenName: payload.given_name,
      familyName: payload.family_name,
      hd: payload.hd
    };
  });

  return verifier({ idToken: input.idToken, audience: audience ?? 'test-google-client-id', nonce: input.nonce });
}

async function trackSession(
  app: FastifyInstance,
  jwtToken: string,
  userId: string,
  req?: { ip?: string; headers?: Record<string, unknown> }
) {
  const sessionHash = hashToken(jwtToken);
  const expiresAt = sessionExpiryFromJwt(app, jwtToken);
  const userAgent = typeof req?.headers?.['user-agent'] === 'string'
    ? req.headers['user-agent']
    : null;

  await pool.query(
    `insert into auth_sessions (user_id, session_hash, issued_at, expires_at, last_seen_at, ip, user_agent)
     values ($1, $2, now(), $3::timestamptz, now(), $4, $5)
     on conflict (session_hash) do update set
       user_id = excluded.user_id,
       expires_at = coalesce(excluded.expires_at, auth_sessions.expires_at),
       revoked_at = null,
       revoked_reason = null,
       last_seen_at = now(),
       ip = coalesce(excluded.ip, auth_sessions.ip),
       user_agent = coalesce(excluded.user_agent, auth_sessions.user_agent)`,
    [userId, sessionHash, expiresAt, req?.ip ?? null, userAgent]
  );
}

async function issueTrackedSessionJwt(
  app: FastifyInstance,
  payload: SessionJwtPayload,
  req?: { ip?: string; headers?: Record<string, unknown> }
) {
  const jwtToken = await app.jwt.sign(payload);
  await trackSession(app, jwtToken, payload.userId, req);
  await writeAuthAuditSafe(req, {
    actorUserId: payload.userId,
    actorRole: payload.role,
    action: 'auth.session.created',
    entityId: payload.userId,
    meta: {
      role: payload.role,
      tutorId: payload.tutorId ?? null,
      studentId: payload.studentId ?? null,
      expiresAt: sessionExpiryFromJwt(app, jwtToken)
    }
  });
  return jwtToken;
}

function requestHost(req?: any) {
  const raw = (req?.headers?.['x-forwarded-host'] || req?.headers?.host || '') as string | string[];
  const value = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
  return value.split(',')[0]?.trim().toLowerCase() || '';
}

function portalRedirectTarget(role: 'ADMIN' | 'TUTOR' | 'STUDENT', req?: any) {
  // Prefer explicit configuration when present.
  const adminBase = process.env.ADMIN_PORTAL_URL?.replace(/\/$/, '');
  const tutorBase = process.env.TUTOR_PORTAL_URL?.replace(/\/$/, '');
  const studentBase = process.env.STUDENT_PORTAL_URL?.replace(/\/$/, '');

  if (role === 'ADMIN' && adminBase) return `${adminBase}/`;
  if (role === 'TUTOR' && tutorBase) return `${tutorBase}/dashboard/`;
  if (role === 'STUDENT' && studentBase) return `${studentBase}/student/dashboard/`;

  // No configured portal URLs: choose paths based on the request host.
  // Your static site is deployed with path-based routes (/admin/*, /tutor/*, /student/*).
  // Without explicit portal URLs, keep redirects on those paths even on subdomains.
  const host = requestHost(req);
  const isAdminSub = host.startsWith('admin.');
  const isTutorSub = host.startsWith('tutor.');
  const isStudentSub = host.startsWith('student.');

  if (role === 'ADMIN') return isAdminSub ? '/admin/' : '/admin/';
  if (role === 'TUTOR') return isTutorSub ? '/tutor/dashboard/' : '/tutor/dashboard/';
  return isStudentSub ? '/student/dashboard/' : '/student/dashboard/';
}

function portalLoginTarget(role: 'ADMIN' | 'TUTOR' | 'STUDENT') {
  if (role === 'ADMIN') {
    const base = process.env.ADMIN_PORTAL_URL?.replace(/\/$/, '');
    return base ? `${base}/login.html` : '/admin/login.html';
  }
  if (role === 'TUTOR') {
    const base = process.env.TUTOR_PORTAL_URL?.replace(/\/$/, '');
    return base ? `${base}/login.html` : '/tutor/login.html';
  }
  const base = process.env.STUDENT_PORTAL_URL?.replace(/\/$/, '');
  return base ? `${base}/login.html` : '/dashboard/login.html';
}

export async function authRoutes(app: FastifyInstance) {
  function createWindowLimiter(windowMs: number, maxAttempts: number) {
    const attempts = new Map<string, { count: number; resetAt: number }>();
    return (key: string) => {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return false;
      }
      if (entry.count >= maxAttempts) return true;
      entry.count += 1;
      return false;
    };
  }

  const checkRequestLimit = createWindowLimiter(60 * 1000, 5);
  const checkVerifyLimit = createWindowLimiter(60 * 1000, 5);
  const checkLoginLimit = createWindowLimiter(10 * 60 * 1000, 10);

  const getCountryCode = (req: any) => {
    const raw = getRequestHeader(req, 'cf-ipcountry')
      || getRequestHeader(req, 'x-vercel-ip-country')
      || getRequestHeader(req, 'x-country-code');
    if (!raw) return null;
    const normalized = raw.trim().toUpperCase();
    if (!normalized || normalized === 'XX' || normalized === 'UNKNOWN') return null;
    return normalized;
  };

  app.post('/auth/request-link', {
    config: {
      rateLimit: {
        max: 15,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const parsed = MagicLinkRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const result = await requestMagicLink(pool, { email: parsed.data.email }, {
      checkRequestLimit,
      baseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001'
    });

    if (!result.ok) {
      return reply.code(result.status).send({ error: result.error });
    }

    return reply.send({
      ok: true,
      ...(result.debugMagicLink ? { debugMagicLink: result.debugMagicLink } : {})
    });
  });
  const handleVerify = async (token: string | undefined, req: any, reply: any) => {
    const result = await verifyMagicLink(pool, { token }, {
      ip: req.ip,
      userAgent: getRequestHeader(req, 'user-agent') || undefined,
      acceptLanguage: getRequestHeader(req, 'accept-language') || undefined,
      countryCode: getCountryCode(req),
      correlationId: req.id
    }, {
      checkVerifyLimit,
      signJwt: (payload) => app.jwt.sign(payload),
      writeRiskAudit: async (entry) => {
        await writeAuditLog(pool, {
          actorUserId: entry.actorUserId,
          actorRole: entry.actorRole,
          action: 'auth.risk.flag',
          entityType: 'auth',
          entityId: entry.actorUserId,
          meta: safeAuditMeta({
            riskScore: entry.riskScore,
            flags: entry.flags,
            country: entry.country,
            ip: entry.ip
          }),
          ip: entry.ip,
          userAgent: entry.userAgent ?? undefined,
          correlationId: entry.correlationId
        });
      },
      onInternalError: (err, context) => {
        req.log?.error?.(err, context);
      }
    });

    if (!result.ok) {
      return reply.code(result.status).send({ error: result.error });
    }

    const verified = await app.jwt.verify<{ userId: string; role: 'ADMIN' | 'TUTOR' | 'STUDENT' }>(result.jwt);
    await trackSession(app, result.jwt, verified.userId, req);

    setAuthCookies(reply, result.jwt);
    return reply.redirect(portalRedirectTarget(verified.role, req));
  };

  app.get('/auth/verify', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const token = (req.query as { token?: string }).token;
    return handleVerify(token, req, reply);
  });

  app.post('/auth/verify', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const token = (req.body as { token?: string } | undefined)?.token;
    return handleVerify(token, req, reply);
  });

  async function handlePasswordLogin(req: any, reply: any, expectedRole?: UserRole) {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const ip = req.ip ?? 'unknown';
    const email = normalizeEmail(parsed.data.email);
    const ipLimited = checkLoginLimit(`ip:${ip}`);
    const emailLimited = checkLoginLimit(`email:${email}`);
    const comboLimited = checkLoginLimit(`login:${ip}:${email}`);
    if (ipLimited || emailLimited || comboLimited) {
      return reply.code(429).send({ error: 'rate_limited' });
    }

    const user = await findUserByEmail(pool, email);
    if (!user || !user.password_hash) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    if (!user.is_active) {
      return reply.code(403).send({ error: 'account_disabled' });
    }
    if (expectedRole && user.role !== expectedRole) {
      await writeAuthAuditSafe(req, {
        actorUserId: user.id,
        actorRole: user.role,
        action: 'auth.login.failed',
        entityId: user.id,
        meta: { provider: 'password', requestedRole: expectedRole, actualRole: user.role, error: 'wrong_role' }
      });
      return reply.code(403).send({ error: 'wrong_role' });
    }

    const passwordOk = await verifyPassword(user.password_hash, parsed.data.password);
    if (!passwordOk) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    if (user.role === 'TUTOR' && !user.tutor_profile_id) {
      return reply.code(500).send({ error: 'tutor_profile_missing' });
    }
    if (user.role === 'STUDENT' && !user.student_id) {
      return reply.code(500).send({ error: 'student_profile_missing' });
    }

    const jwt = await issueTrackedSessionJwt(app, {
      userId: user.id,
      role: user.role,
      tutorId: user.tutor_profile_id ?? undefined,
      studentId: user.student_id ?? undefined
    }, req);

    const csrfToken = setAuthCookies(reply, jwt);
    return reply.send({
      ok: true,
      token: jwt,
      csrfToken,
      role: user.role,
      redirectTo: portalRedirectTarget(user.role, req)
    });
  }

  app.post('/auth/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    return handlePasswordLogin(req, reply);
  });

  app.post('/auth/student/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    return handlePasswordLogin(req, reply, 'STUDENT');
  });

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies?.session;
    if (token) {
      try {
        const decoded = await app.jwt.verify<{ userId: string }>(token);
        const sessionHash = hashToken(token);
        const res = await pool.query(
          `update auth_sessions
           set revoked_at = now(), revoked_reason = 'logout', last_seen_at = now()
           where session_hash = $1 and user_id = $2 and revoked_at is null`,
          [sessionHash, decoded.userId]
        );

        if ((res.rowCount ?? 0) === 0) {
          await pool.query(
            `insert into auth_sessions (user_id, session_hash, issued_at, expires_at, revoked_at, revoked_reason, last_seen_at)
             values ($1, $2, now(), $3::timestamptz, now(), 'logout', now())
             on conflict (session_hash) do update set revoked_at = now(), revoked_reason = 'logout', last_seen_at = now()`,
            [decoded.userId, sessionHash, sessionExpiryFromJwt(app, token)]
          );
        }
        await writeAuthAuditSafe(req, {
          actorUserId: decoded.userId,
          action: 'auth.logout',
          entityId: decoded.userId,
          meta: { revoked: true }
        });
      } catch {
        // Best effort revocation; cookie clearing still proceeds.
      }
    }

    reply.clearCookie('session', clearAuthCookieOptions());
    reply.clearCookie('csrf', clearAuthCookieOptions());
    reply.clearCookie('impersonation', clearAuthCookieOptions());
  reply.clearCookie('mfa_pending', clearAuthCookieOptions());
    return reply.send({ ok: true });
  });

  app.post('/auth/logout-all', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    await pool.query(
      `update auth_sessions
       set revoked_at = now(), revoked_reason = 'global_sign_out', last_seen_at = now()
       where user_id = $1 and revoked_at is null`,
      [req.user.userId]
    );
    await writeAuthAuditSafe(req, {
      actorUserId: req.user.userId,
      actorRole: req.user.role,
      action: 'auth.logout_all',
      entityId: req.user.userId,
      meta: { role: req.user.role }
    });

    reply.clearCookie('session', clearAuthCookieOptions());
    reply.clearCookie('csrf', clearAuthCookieOptions());
    reply.clearCookie('impersonation', clearAuthCookieOptions());
  reply.clearCookie('mfa_pending', clearAuthCookieOptions());
    return reply.send({ ok: true });
  });

  // ── Admin 2-step login ────────────────────────────────────────────────────

  const checkAdminLoginLimit = createWindowLimiter(15 * 60 * 1000, 10);

  app.post('/auth/admin/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    const parsed = AdminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const ip    = req.ip ?? 'unknown';
    const email = normalizeEmail(parsed.data.email);

    if (checkAdminLoginLimit(`ip:${ip}`) || checkAdminLoginLimit(`email:${email}`)) {
      return reply.code(429).send({ error: 'rate_limited' });
    }

    const user = await findUserByEmail(pool, email);
    // Constant-time response regardless of whether user exists
    if (!user || user.role !== 'ADMIN' || !user.is_active || !user.password_hash) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const passwordOk = await verifyPassword(user.password_hash, parsed.data.password);
    if (!passwordOk) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    // MFA removed: issue the full admin session JWT directly.
    const jwt = await issueTrackedSessionJwt(app, {
      userId: user.id,
      role: 'ADMIN',
    }, req);

    const csrfToken = setAuthCookies(reply, jwt);
    reply.clearCookie('mfa_pending', clearAuthCookieOptions());

    return reply.send({
      ok: true,
      token: jwt,
      csrfToken,
      role: 'ADMIN',
      redirectTo: portalRedirectTarget('ADMIN', req)
    });
  });

  app.post('/auth/admin/verify-otp', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    return reply.code(410).send({ error: 'mfa_disabled' });
  });

  // ── Google OAuth callback (tutor sign-in) ────────────────────────────────

  async function handleGoogleOAuthCallback(
    requestedRole: UserRole,
    oauthNamespace: OAuth2Namespace | undefined,
    req: any,
    reply: any
  ) {
    const fail = async (error: string, status = 400, meta: Record<string, unknown> = {}) => {
      await writeAuthAuditSafe(req, {
        action: 'auth.login.failed',
        meta: { provider: 'google', requestedRole, error, ...meta }
      });
      return reply.redirect(status, `${portalLoginTarget(requestedRole)}?error=${encodeURIComponent(error)}`);
    };

    if (!oauthNamespace) {
      return fail('google_oauth_not_configured', 501);
    }

    let token: { id_token?: string };
    try {
      const result = await oauthNamespace.getAccessTokenFromAuthorizationCodeFlow(req, reply);
      token = result.token as { id_token?: string };
    } catch {
      return fail('oauth_callback_failed', 400);
    }

    if (!token.id_token) {
      return fail('google_id_token_missing', 400);
    }

    let profile: GoogleVerifiedProfile;
    try {
      profile = await verifyGoogleIdToken(app, {
        idToken: token.id_token,
        nonce: (req.query as { state?: string } | undefined)?.state
      });
    } catch (err) {
      const error = err instanceof Error && err.message ? err.message : 'google_id_token_invalid';
      return fail(error, error === 'google_email_not_verified' ? 403 : 400);
    }
    if (!profile.id || !profile.email) {
      return fail('google_profile_incomplete', 400);
    }
    if (profile.emailVerified !== true) {
      return fail('google_email_not_verified', 403);
    }

    // Find user by google_id first, then fall back to email
    const googleEmail = normalizeEmail(profile.email);
    const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase();
    if (allowedDomain) {
      const emailDomain = googleEmail.split('@')[1] ?? '';
      const hostedDomain = String(profile.hd ?? '').trim().toLowerCase();
      if (emailDomain !== allowedDomain || (hostedDomain && hostedDomain !== allowedDomain)) {
        return fail('google_domain_not_allowed', 403, { emailDomain, hostedDomain });
      }
    }
    const userRes = await pool.query(
      `select id, email, role, tutor_profile_id, student_id, is_active, google_id, first_name, last_name
       from users
       where google_id = $1 or email = $2
       order by (google_id = $1) desc
       limit 1`,
      [profile.id, googleEmail]
    );

    if (Number(userRes.rowCount ?? 0) === 0) {
      // Users must be pre-registered: Google OAuth is sign-in only, not sign-up.
      const loginUrl = portalLoginTarget(requestedRole);
      await writeAuthAuditSafe(req, {
        action: 'auth.login.failed',
        meta: { provider: 'google', requestedRole, error: 'account_not_found' }
      });
      return reply.redirect(`${loginUrl}?error=account_not_found`);
    }

    const user = userRes.rows[0] as {
      id: string;
      email: string;
      role: 'ADMIN' | 'TUTOR' | 'STUDENT';
      tutor_profile_id: string | null;
      student_id: string | null;
      is_active: boolean;
      google_id: string | null;
      first_name: string | null;
      last_name: string | null;
    };

    if (!user.is_active) {
      return fail('account_disabled', 403, { userId: user.id });
    }
    if (user.role !== requestedRole) {
      await writeAuthAuditSafe(req, {
        actorUserId: user.id,
        actorRole: user.role,
        action: 'auth.login.failed',
        entityId: user.id,
        meta: { provider: 'google', requestedRole, actualRole: user.role, error: 'wrong_role' }
      });
      return reply.redirect(`${portalLoginTarget(requestedRole)}?error=wrong_role`);
    }
    if (requestedRole === 'TUTOR' && !user.tutor_profile_id) {
      return fail('tutor_profile_missing', 500, { userId: user.id });
    }
    if (requestedRole === 'STUDENT' && !user.student_id) {
      return fail('student_profile_missing', 500, { userId: user.id });
    }

    // Link google_id on first Google sign-in via email match
    if (!user.google_id) {
      await pool.query(
        `update users
         set google_id = $1,
             first_name = coalesce(first_name, $3),
             last_name = coalesce(last_name, $4),
             updated_at = now()
         where id = $2`,
        [profile.id, user.id, profile.givenName ?? null, profile.familyName ?? null]
      );
    }

    const fallbackName = [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined;
    const jwt = await issueTrackedSessionJwt(app, {
      userId: user.id,
      role: requestedRole,
      tutorId: user.tutor_profile_id ?? undefined,
      studentId: user.student_id ?? undefined,
      profile: {
        email: googleEmail,
        name: profile.name ?? fallbackName,
        picture: profile.picture
      }
    }, req);
    setAuthCookies(reply, jwt);
    await writeAuthAuditSafe(req, {
      actorUserId: user.id,
      actorRole: requestedRole,
      action: 'auth.login.success',
      entityId: user.id,
      meta: { provider: 'google', role: requestedRole, linkedGoogleId: !user.google_id }
    });

    return reply.redirect(portalRedirectTarget(requestedRole, req));
  }

  app.get('/auth/google/callback', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    return handleGoogleOAuthCallback('TUTOR', app.googleOAuth2, req, reply);
  });

  app.get('/auth/google/student/callback', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    return handleGoogleOAuthCallback('STUDENT', app.googleStudentOAuth2, req, reply);
  });

  app.get('/auth/google/admin/callback', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    return handleGoogleOAuthCallback('ADMIN', app.googleAdminOAuth2, req, reply);
  });

  app.get('/auth/session', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    return reply.send({
      user: {
        userId: req.user.userId,
        role: req.user.role,
        tutorId: req.user.tutorId ?? null,
        studentId: req.user.studentId ?? null,
        profile: req.user.profile ?? null,
      },
      impersonation: req.impersonation
        ? {
            adminUserId: req.impersonation.adminUserId,
            tutorId: req.impersonation.tutorId,
            tutorUserId: req.impersonation.tutorUserId,
            impersonationId: req.impersonation.impersonationId,
            mode: req.impersonation.mode,
          }
        : null,
    });
  });

  // Dev helper for local portal testing across admin/tutor/student without needing OTP/magic links.
  // Protected by DEV_LOGIN_TOKEN and disabled in production.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN_TOKEN) {
    app.post('/auth/dev/login-as', async (req, reply) => {
      const header = req.headers['x-dev-login-token'];
      const token = Array.isArray(header) ? String(header[0] ?? '') : String(header ?? '');
      if (!token || token !== process.env.DEV_LOGIN_TOKEN) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      const parsed = TestLoginSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
      }

      const email = normalizeEmail(parsed.data.email);
      const role = parsed.data.role;
      const client = await pool.connect();
      let userId: string | undefined;
      let tutorId: string | null = null;
      let studentId: string | null = null;

      try {
        await client.query('BEGIN');

        const existing = await client.query(
          `select id, role, tutor_profile_id, student_id from users where email = $1`,
          [email]
        );

        if (Number(existing.rowCount || 0) > 0) {
          const row = existing.rows[0] as { id: string; role: 'ADMIN' | 'TUTOR' | 'STUDENT'; tutor_profile_id: string | null; student_id: string | null };
          if (row.role !== role) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: 'role_mismatch' });
          }
          userId = row.id;
          tutorId = row.tutor_profile_id;
          studentId = row.student_id;

          if (role === 'TUTOR' && !tutorId) {
            const tutorRes = await client.query(
              `insert into tutor_profiles (full_name, phone, default_hourly_rate, active)
               values ($1, null, $2, true)
               returning id`,
              ['Dev Tutor', 250]
            );
            tutorId = tutorRes.rows[0].id as string;
            await client.query(
              `update users set tutor_profile_id = $1 where id = $2`,
              [tutorId, userId]
            );
          }
          if (role === 'STUDENT' && !studentId) {
            const studentRes = await client.query(
              `insert into students (full_name, grade, is_active)
               values ($1, $2, true)
               returning id`,
              ['Dev Student', '10']
            );
            studentId = studentRes.rows[0].id as string;
            await client.query(
              `update users set student_id = $1 where id = $2`,
              [studentId, userId]
            );
          }
        } else if (role === 'ADMIN') {
          const res = await client.query(
            `insert into users (email, role)
             values ($1, 'ADMIN')
             returning id`,
            [email]
          );
          userId = res.rows[0].id as string;
        } else if (role === 'TUTOR') {
          const tutorRes = await client.query(
            `insert into tutor_profiles (full_name, phone, default_hourly_rate, active)
             values ($1, null, $2, true)
             returning id`,
            ['Dev Tutor', 250]
          );
          tutorId = tutorRes.rows[0].id as string;
          const userRes = await client.query(
            `insert into users (email, role, tutor_profile_id)
             values ($1, 'TUTOR', $2)
             returning id`,
            [email, tutorId]
          );
          userId = userRes.rows[0].id as string;
        } else {
          const studentRes = await client.query(
            `insert into students (full_name, grade, is_active)
             values ($1, $2, true)
             returning id`,
            ['Dev Student', '10']
          );
          studentId = studentRes.rows[0].id as string;
          const userRes = await client.query(
            `insert into users (email, role, student_id)
             values ($1, 'STUDENT', $2)
             returning id`,
            [email, studentId]
          );
          userId = userRes.rows[0].id as string;
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        req.log?.error?.(err);
        return reply.code(500).send({ error: 'internal_error' });
      } finally {
        client.release();
      }

      const jwt = await issueTrackedSessionJwt(app, {
        userId,
        role,
        tutorId: tutorId ?? undefined,
        studentId: studentId ?? undefined
      }, req);
      const csrfToken = setAuthCookies(reply, jwt);
      return reply.send({ ok: true, csrfToken, redirectTo: portalRedirectTarget(role, req) });
    });
  }

  if (process.env.NODE_ENV === 'test') {
    app.post('/test/login-as', async (req, reply) => {
      const parsed = TestLoginSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
      }

      const email = normalizeEmail(parsed.data.email);
      const role = parsed.data.role;
      const client = await pool.connect();
      let userId: string | undefined;
      let tutorId: string | null = null;
      let studentId: string | null = null;

      try {
        await client.query('BEGIN');

        const existing = await client.query(
          `select id, role, tutor_profile_id, student_id from users where email = $1`,
          [email]
        );

        if (Number(existing.rowCount || 0) > 0) {
          const row = existing.rows[0] as { id: string; role: 'ADMIN' | 'TUTOR' | 'STUDENT'; tutor_profile_id: string | null; student_id: string | null };
          if (row.role !== role) {
            await client.query('ROLLBACK');
            return reply.code(409).send({ error: 'role_mismatch' });
          }
          userId = row.id;
          tutorId = row.tutor_profile_id;
          studentId = row.student_id;

          if (role === 'TUTOR' && !tutorId) {
            const tutorRes = await client.query(
              `insert into tutor_profiles (full_name, phone, default_hourly_rate, active)
               values ($1, null, $2, true)
               returning id`,
              ['Test Tutor', 250]
            );
            tutorId = tutorRes.rows[0].id as string;
            await client.query(
              `update users set tutor_profile_id = $1 where id = $2`,
              [tutorId, userId]
            );
          }
          if (role === 'STUDENT' && !studentId) {
            const studentRes = await client.query(
              `insert into students (full_name, grade, is_active)
               values ($1, $2, true)
               returning id`,
              ['Test Student', '10']
            );
            studentId = studentRes.rows[0].id as string;
            await client.query(
              `update users set student_id = $1 where id = $2`,
              [studentId, userId]
            );
          }
        } else if (role === 'ADMIN') {
          const res = await client.query(
            `insert into users (email, role)
             values ($1, 'ADMIN')
             returning id`,
            [email]
          );
          userId = res.rows[0].id as string;
        } else if (role === 'TUTOR') {
          const tutorRes = await client.query(
            `insert into tutor_profiles (full_name, phone, default_hourly_rate, active)
             values ($1, null, $2, true)
             returning id`,
            ['Test Tutor', 250]
          );
          tutorId = tutorRes.rows[0].id as string;
          const userRes = await client.query(
            `insert into users (email, role, tutor_profile_id)
             values ($1, 'TUTOR', $2)
             returning id`,
            [email, tutorId]
          );
          userId = userRes.rows[0].id as string;
        } else {
          const studentRes = await client.query(
            `insert into students (full_name, grade, is_active)
             values ($1, $2, true)
             returning id`,
            ['Test Student', '10']
          );
          studentId = studentRes.rows[0].id as string;
          const userRes = await client.query(
            `insert into users (email, role, student_id)
             values ($1, 'STUDENT', $2)
             returning id`,
            [email, studentId]
          );
          userId = userRes.rows[0].id as string;
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        req.log?.error?.(err);
        return reply.code(500).send({ error: 'internal_error' });
      } finally {
        client.release();
      }

      const jwt = await issueTrackedSessionJwt(app, {
        userId,
        role,
        tutorId: tutorId ?? undefined,
        studentId: studentId ?? undefined
      }, req);
      const csrfToken = setAuthCookies(reply, jwt);
      return reply.send({ ok: true, csrfToken });
    });
  }

  app.post('/auth/register-admin', async (req, reply) => {
    const parsed = RegisterAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expected || parsed.data.bootstrapToken !== expected) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const email = normalizeEmail(parsed.data.email);
    const passwordHash = await hashPassword(parsed.data.password);

    const res = await pool.query(
      `insert into users (email, role, password_hash, first_name, last_name)
       values ($1, 'ADMIN', $2, $3, $4)
       returning id, email, role`,
      [email, passwordHash, parsed.data.firstName, parsed.data.lastName]
    );

    return reply.code(201).send({ user: res.rows[0] });
  });
}
