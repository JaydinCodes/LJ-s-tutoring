import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const RecordStatusSchema = z.enum(['active', 'inactive', 'pending', 'approved', 'suspended']);
const ManagedRoleSchema = z.enum(['student', 'tutor', 'admin']);

const AdminUserInviteSchema = z.object({
  mode: z.enum(['invite', 'create']).default('invite'),
  role: ManagedRoleSchema,
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(10).max(200).optional(),
  student: z.object({
    grade: z.string().trim().max(40).optional(),
    school: z.string().trim().max(180).optional(),
    parentName: z.string().trim().max(160).optional(),
    parentContact: z.string().trim().max(120).optional(),
    ngoPartnerId: z.string().uuid().optional(),
    status: RecordStatusSchema.default('pending'),
  }).optional(),
  tutor: z.object({
    subjects: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    grades: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    hourlyRate: z.number().min(0).max(10000).optional(),
    status: RecordStatusSchema.default('pending'),
  }).optional(),
}).superRefine((value, ctx) => {
  if (value.mode === 'create' && !value.password) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'password_required_for_create' });
  }
  if (value.role === 'student' && !value.student) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['student'], message: 'student_details_required' });
  }
  if (value.role === 'tutor' && !value.tutor) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tutor'], message: 'tutor_details_required' });
  }
});

type SupabaseUser = {
  id: string;
  email?: string;
  aal?: string;
};

type SupabaseAdminConfig = {
  url: string;
  serviceRoleKey: string;
  inviteRedirectUrl?: string;
};

function optionalText(value?: string) {
  return value?.trim() || null;
}

function supabaseConfig(): SupabaseAdminConfig {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRoleKey) {
    throw new Error('supabase_admin_not_configured');
  }
  return {
    url,
    serviceRoleKey,
    inviteRedirectUrl: process.env.SUPABASE_INVITE_REDIRECT_URL,
  };
}

function bearerToken(req: FastifyRequest) {
  const raw = req.headers.authorization || '';
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Error('supabase_bearer_required');
  }
  return token;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) {
    return {};
  }
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function supabaseFetch<T>(
  config: SupabaseAdminConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message) : text;
    throw new Error(message || `supabase_request_failed:${response.status}`);
  }
  return body as T;
}

async function supabaseFetchWithUserToken<T>(
  config: SupabaseAdminConfig,
  token: string,
  path: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    throw new Error('supabase_bearer_invalid');
  }
  return body as T;
}

async function requireSupabaseAdmin(req: FastifyRequest, config: SupabaseAdminConfig) {
  const token = bearerToken(req);
  const user = await supabaseFetchWithUserToken<SupabaseUser>(config, token, '/auth/v1/user');
  const profile = await supabaseFetch<Array<{ id: string; role: string }>>(
    config,
    `/rest/v1/profiles?select=id,role&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { method: 'GET', headers: { accept: 'application/json' } },
  );
  if (profile[0]?.role !== 'admin') {
    throw new Error('admin_required');
  }

  const jwtPayload = decodeJwtPayload(token);
  const aal = typeof jwtPayload.aal === 'string' ? jwtPayload.aal : user.aal;
  const devBypass = process.env.NODE_ENV !== 'production' && process.env.PO_DEV_ADMIN_MFA_BYPASS === 'true';
  if (!devBypass && aal !== 'aal2') {
    throw new Error('admin_mfa_required');
  }

  return { authUserId: user.id, profileId: profile[0].id };
}

async function findProfileByEmail(config: SupabaseAdminConfig, email: string) {
  const profiles = await supabaseFetch<Array<{ id: string; email: string }>>(
    config,
    `/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`,
    { method: 'GET', headers: { accept: 'application/json' } },
  );
  return profiles[0] ?? null;
}

async function createOrInviteAuthUser(config: SupabaseAdminConfig, input: z.infer<typeof AdminUserInviteSchema>) {
  const metadata = { full_name: input.fullName, role: input.role };
  if (input.mode === 'invite') {
    const query = config.inviteRedirectUrl ? `?redirect_to=${encodeURIComponent(config.inviteRedirectUrl)}` : '';
    const invited = await supabaseFetch<{ user?: SupabaseUser; id?: string }>(config, `/auth/v1/invite${query}`, {
      method: 'POST',
      body: JSON.stringify({ email: input.email, data: metadata }),
    });
    return invited.user ?? invited;
  }

  const created = await supabaseFetch<{ user?: SupabaseUser; id?: string }>(config, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: false,
      user_metadata: metadata,
    }),
  });
  return created.user ?? created;
}

async function deleteAuthUserBestEffort(config: SupabaseAdminConfig, userId: string) {
  try {
    await supabaseFetch(config, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  } catch {
    // Best-effort rollback only; the response to the admin still reports the original failure.
  }
}

async function insertProfile(config: SupabaseAdminConfig, input: z.infer<typeof AdminUserInviteSchema>, userId: string) {
  const rows = await supabaseFetch<Array<{ id: string }>>(config, '/rest/v1/profiles?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation', accept: 'application/json' },
    body: JSON.stringify({
      auth_user_id: userId,
      full_name: input.fullName,
      email: input.email,
      phone: optionalText(input.phone),
      role: input.role,
    }),
  });
  return rows[0];
}

async function insertOperationalRecord(config: SupabaseAdminConfig, input: z.infer<typeof AdminUserInviteSchema>, profileId: string) {
  if (input.role === 'student') {
    const student = input.student;
    await supabaseFetch(config, '/rest/v1/students', {
      method: 'POST',
      body: JSON.stringify({
        profile_id: profileId,
        grade: optionalText(student?.grade),
        school: optionalText(student?.school),
        parent_name: optionalText(student?.parentName),
        parent_contact: optionalText(student?.parentContact),
        ngo_partner_id: student?.ngoPartnerId || null,
        status: student?.status ?? 'pending',
      }),
    });
  }

  if (input.role === 'tutor') {
    const tutor = input.tutor;
    await supabaseFetch(config, '/rest/v1/tutors', {
      method: 'POST',
      body: JSON.stringify({
        profile_id: profileId,
        subjects: tutor?.subjects ?? [],
        grades: tutor?.grades ?? [],
        hourly_rate: tutor?.hourlyRate ?? null,
        status: tutor?.status ?? 'pending',
      }),
    });
  }
}

function replyForError(reply: FastifyReply, error: unknown) {
  const message = error instanceof Error ? error.message : 'admin_user_invite_failed';
  const status = message === 'admin_required' || message === 'admin_mfa_required' ? 403
    : message === 'supabase_bearer_required' || message === 'supabase_bearer_invalid' ? 401
      : message === 'duplicate_email' ? 409
        : message === 'supabase_admin_not_configured' ? 501
          : 400;
  return reply.code(status).send({ error: message });
}

export async function supabaseAdminRoutes(app: FastifyInstance) {
  app.post('/supabase/admin/users/invite', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    let config: SupabaseAdminConfig;
    try {
      config = supabaseConfig();
      await requireSupabaseAdmin(req, config);
      const parsed = AdminUserInviteSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
      }

      const duplicate = await findProfileByEmail(config, parsed.data.email);
      if (duplicate) {
        throw new Error('duplicate_email');
      }

      const user = await createOrInviteAuthUser(config, parsed.data);
      if (!user.id) {
        throw new Error('supabase_auth_user_missing');
      }

      try {
        const profile = await insertProfile(config, parsed.data, user.id);
        if (!profile?.id) {
          throw new Error('profile_insert_failed');
        }
        await insertOperationalRecord(config, parsed.data, profile.id);
        return reply.send({
          ok: true,
          mode: parsed.data.mode,
          role: parsed.data.role,
          userId: user.id,
          profileId: profile.id,
        });
      } catch (error) {
        await deleteAuthUserBestEffort(config, user.id);
        throw error;
      }
    } catch (error) {
      return replyForError(reply, error);
    }
  });
}
