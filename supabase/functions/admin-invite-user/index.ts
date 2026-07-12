// Supabase Edge Function: admin-invite-user
//
// Single-stack migration (ADR-0003), Tier-2 slice 1. Faithful port of the Fastify
// route POST /supabase/admin/users/invite (lms-api/src/routes/supabase-admin.ts).
// It invites or creates a Supabase Auth user and provisions their profile +
// student/tutor record, using the service-role key that only trusted server code
// may hold.
//
// Security: the caller must present a valid Supabase bearer token for an ADMIN
// profile that has passed MFA (AAL2). Unlike the legacy Fastify route this has NO
// dev MFA bypass — an Edge Function only runs deployed, so AAL2 is always required.
//
// Deploy + secrets: see ./README.md. Do NOT repoint the frontend to this function
// until it is deployed and verified; the Fastify route stays live until then.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  // The admin bearer + role + AAL2 check is the real security boundary; CORS can
  // be tightened to the app origins if desired.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RecordStatusSchema = z.enum(['active', 'inactive', 'pending', 'approved', 'suspended']);
const ManagedRoleSchema = z.enum(['student', 'tutor', 'admin']);

const AdminUserInviteSchema = z
  .object({
    mode: z.enum(['invite', 'create']).default('invite'),
    role: ManagedRoleSchema,
    fullName: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    phone: z.string().trim().max(40).optional(),
    password: z.string().min(10).max(200).optional(),
    student: z
      .object({
        grade: z.string().trim().max(40).optional(),
        school: z.string().trim().max(180).optional(),
        parentName: z.string().trim().max(160).optional(),
        parentContact: z.string().trim().max(120).optional(),
        ngoPartnerId: z.string().uuid().optional(),
        status: RecordStatusSchema.default('pending'),
      })
      .optional(),
    tutor: z
      .object({
        subjects: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
        grades: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
        hourlyRate: z.number().min(0).max(10000).optional(),
        status: RecordStatusSchema.default('pending'),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
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

type InviteInput = z.infer<typeof AdminUserInviteSchema>;

function optionalText(value?: string): string | null {
  return value?.trim() || null;
}

// Read the aal (authenticator assurance level) claim from the caller's JWT.
function decodeAal(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const json = JSON.parse(atob(padded)) as Record<string, unknown>;
    return typeof json.aal === 'string' ? json.aal : null;
  } catch {
    return null;
  }
}

function statusForError(message: string): number {
  if (message === 'admin_required' || message === 'admin_mfa_required') return 403;
  if (message === 'supabase_bearer_required' || message === 'supabase_bearer_invalid') return 401;
  if (message === 'duplicate_email') return 409;
  if (message === 'supabase_admin_not_configured') return 501;
  return 400;
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) {
      return json({ error: 'supabase_admin_not_configured' }, 501);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ error: 'supabase_bearer_required' }, 401);
    }

    // Service-role client for privileged reads/writes and Auth admin operations.
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    // 1) Validate the caller: must be an ADMIN profile that passed MFA (AAL2).
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ error: 'supabase_bearer_invalid' }, 401);
    }
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if ((callerProfile as { role?: string } | null)?.role !== 'admin') {
      return json({ error: 'admin_required' }, 403);
    }
    if (decodeAal(token) !== 'aal2') {
      return json({ error: 'admin_mfa_required' }, 403);
    }

    // 2) Validate the payload.
    const parsed = AdminUserInviteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    }
    const input: InviteInput = parsed.data;

    // 3) Reject duplicate email.
    const { data: duplicate } = await admin
      .from('profiles')
      .select('id')
      .eq('email', input.email)
      .maybeSingle();
    if (duplicate) {
      return json({ error: 'duplicate_email' }, 409);
    }

    // 4) Invite or create the Auth user.
    const metadata = { full_name: input.fullName, role: input.role };
    let userId: string | undefined;
    if (input.mode === 'invite') {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
        data: metadata,
        redirectTo: Deno.env.get('SUPABASE_INVITE_REDIRECT_URL') || undefined,
      });
      if (error) throw new Error(error.message);
      userId = data.user?.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: false,
        user_metadata: metadata,
      });
      if (error) throw new Error(error.message);
      userId = data.user?.id;
    }
    if (!userId) {
      return json({ error: 'supabase_auth_user_missing' }, 400);
    }

    // 5) Provision profile + operational record; roll back the Auth user on failure.
    try {
      const { data: profileRow, error: profileErr } = await admin
        .from('profiles')
        .insert({
          auth_user_id: userId,
          full_name: input.fullName,
          email: input.email,
          phone: optionalText(input.phone),
          role: input.role,
        })
        .select('id')
        .single();
      if (profileErr || !profileRow) {
        throw new Error('profile_insert_failed');
      }
      const profileId = (profileRow as { id: string }).id;

      if (input.role === 'student') {
        const s = input.student;
        const { error } = await admin.from('students').insert({
          profile_id: profileId,
          grade: optionalText(s?.grade),
          school: optionalText(s?.school),
          parent_name: optionalText(s?.parentName),
          parent_contact: optionalText(s?.parentContact),
          ngo_partner_id: s?.ngoPartnerId || null,
          status: s?.status ?? 'pending',
        });
        if (error) throw new Error(error.message);
      } else if (input.role === 'tutor') {
        const t = input.tutor;
        const { error } = await admin.from('tutors').insert({
          profile_id: profileId,
          subjects: t?.subjects ?? [],
          grades: t?.grades ?? [],
          hourly_rate: t?.hourlyRate ?? null,
          status: t?.status ?? 'pending',
        });
        if (error) throw new Error(error.message);
      }

      return json({ ok: true, mode: input.mode, role: input.role, userId, profileId });
    } catch (error) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'admin_user_invite_failed';
    return json({ error: message }, statusForError(message));
  }
});
