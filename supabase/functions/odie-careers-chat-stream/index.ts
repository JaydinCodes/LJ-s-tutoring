// Supabase Edge Function: odie-careers-chat-stream
//
// Single-stack migration (ADR-0003). Faithful port of the Fastify route
// POST /assistant/careers-chat/stream (lms-api/src/routes/assistant.ts). This
// is the only Odie surface with a real frontend caller today
// (StudentCareersRoute.tsx's chat widget) -- the separate persisted
// "academic tutor chat" (/student/odie/chat, odie_conversations/odie_messages)
// has no frontend anywhere in this codebase and is deliberately out of scope,
// same reasoning as tutor-onboarding/academic-extras earlier in this
// migration.
//
// Stateless: the client sends its own rolling history each call (matching
// Fastify exactly) -- nothing is persisted server-side, so no new tables.
//
// Security: caller must be an authenticated Supabase user whose profile has
// role='student' and a linked students row (mirrors Fastify's
// authenticateCareersStudent). The GROQ_API_KEY never reaches the browser --
// it's read from an Edge Function secret.
//
// Provider: Groq (api.groq.com), not OpenRouter -- switched after OpenRouter's
// free-tier model proved persistently rate-limited (429) during verification.
// Groq's chat completions API is OpenAI-compatible (same streaming/SSE delta
// shape), so only the endpoint, model, and API key changed; the
// request/response handling below is otherwise identical.
//
// Deploy: this function proxies to Groq using GROQ_API_KEY and GROQ_MODEL,
// which must be set as Edge Function secrets (Project Settings -> Edge
// Functions -> Secrets, or `supabase secrets set`) -- same values already
// used by lms-api, just not auto-injected the way
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Matches Fastify's PublicChatSchema exactly (careers-chat/stream reuses it).
const HistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});
const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  history: z.array(HistoryMessageSchema).max(8).optional().default([]),
});

const CAREERS_ODIE_SYSTEM_PROMPT = [
  'You are Odie, the Project Odysseus careers assistant for South African learners.',
  'Help with career pathways, subject choices, APS planning, study plans, entry-level readiness, portfolio evidence, and practical next steps.',
  'Use a friendly but direct coaching style. Ask for grade, subjects, marks, interests, and location when needed.',
  'For South African STEM, technology, finance, and engineering pathways, prefer NSC Mathematics over Mathematical Literacy unless the learner is asking about a pathway where Mathematical Literacy is explicitly accepted.',
  'Do not pretend to be a university admissions officer, bursary committee, employer, or official representative.',
  'Label uncertain advice clearly and encourage learners to verify current requirements on official institution pages.',
  'Do not invent admission requirements, salaries, or guaranteed outcomes. When facts are uncertain, say what the learner should verify with the institution or employer.',
  'Never reveal, infer, or reference another student’s private data.',
  'Keep answers concise, structured, and action-oriented.',
].join('\n');

function extractOpenAiCompatibleDelta(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

async function readAssistantError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return response.statusText || 'request_failed';
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    return text.slice(0, 300);
  }
  return response.statusText || 'request_failed';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  const groqModel = Deno.env.get('GROQ_MODEL') || 'llama-3.1-8b-instant';
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'supabase_admin_not_configured' }, 501);
  }
  if (!groqApiKey) {
    return json({ error: 'groq_not_configured' }, 503);
  }

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'assistant_auth_required' }, 401);
  }

  // 1) Validate the caller: must be a student profile with a linked students row.
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return json({ error: 'supabase_bearer_invalid' }, 401);
  }
  const { data: profileRow } = await admin
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (!profileRow || (profileRow as { role?: string }).role !== 'student') {
    return json({ error: 'forbidden' }, 403);
  }
  const { data: studentRow } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', (profileRow as { id: string }).id)
    .maybeSingle();
  if (!studentRow) {
    return json({ error: 'student_record_missing' }, 403);
  }

  // 2) Validate the payload.
  const parsed = ChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
  }
  const { message, history } = parsed.data;

  // 3) Stream the Groq response back as plain text chunks, exactly like the
  // Fastify/OpenRouter version (only the delta content is proxied, never the
  // raw SSE frames or the API key).
  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort());

  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [
        { role: 'system', content: CAREERS_ODIE_SYSTEM_PROMPT },
        ...history.slice(-8),
        { role: 'user', content: message },
      ],
      max_tokens: 900,
      temperature: 0.35,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const message = upstream.body ? await readAssistantError(upstream) : 'groq_stream_unavailable';
    return json({ error: message }, upstream.status || 502);
  }

  const encoder = new TextEncoder();
  const upstreamReader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const stream = new ReadableStream({
    async pull(streamController) {
      const { value, done } = await upstreamReader.read();
      if (done) {
        streamController.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.replace(/^data:\s*/, '').trim();
          if (!payload || payload === '[DONE]') continue;
          const delta = extractOpenAiCompatibleDelta(payload);
          if (delta) streamController.enqueue(encoder.encode(delta));
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
});
