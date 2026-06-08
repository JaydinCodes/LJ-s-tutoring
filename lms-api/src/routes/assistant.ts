import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loadAssistantConfig } from '../domains/assistant/config.js';
import { createAssistantService } from '../domains/assistant/service.js';
import { createOpenRouterProvider } from '../domains/assistant/providers/openrouter.js';
import { createLmStudioProvider } from '../domains/assistant/providers/lmstudio.js';

const HistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

const ChatSchema = z.object({
  message: z.string().trim().min(1).max(20000),
  history: z.array(HistoryMessageSchema).max(24).optional().default([]),
  personaVariant: z.string().trim().min(1).max(80).optional(),
  systemPrompt: z.string().trim().min(1).max(4000).optional(),
});

const PublicChatSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  history: z.array(HistoryMessageSchema).max(8).optional().default([]),
});

const PUBLIC_ODIE_SYSTEM_PROMPT = [
  'You are Odie, a friendly AI assistant for Project Odysseus, a premium Mathematics tutoring service based in Cape Town, South Africa.',
  'You help students in Grades 8-12 and parents get quick answers about subjects, pricing, scheduling, and next steps.',
  'Facts: 1-on-1 CAPS Mathematics tutoring for Grades 8-12; not Maths Literacy; sessions run Monday-Thursday 5pm-8pm with limited weekend slots; pricing is R180-R250 per hour; there is a money-back guarantee on the first session; WhatsApp +27 67 932 7754; email projectodysseus.maths@gmail.com.',
  'Keep replies warm, concise, and practical. Do not invent information beyond these facts. For detailed learning help, suggest booking or contacting the tutors.',
].join('\n');

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

const DocumentSchema = z.object({
  documentText: z.string().trim().min(1).max(500000),
  userQuestion: z.string().trim().min(1).max(20000),
  history: z.array(HistoryMessageSchema).max(24).optional().default([]),
  personaVariant: z.string().trim().min(1).max(80).optional(),
  systemPrompt: z.string().trim().min(1).max(4000).optional(),
});

function setPrivateNoStore(reply: any) {
  reply.header('Cache-Control', 'private, no-store, max-age=0');
  reply.header('Pragma', 'no-cache');
}

export function isAssistantEnabled(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.ASSISTANT_ENABLED ?? 'true').trim().toLowerCase();
  if (!raw) return true;
  return raw !== 'false' && raw !== '0' && raw !== 'off' && raw !== 'disabled';
}

function parseAccessKeys(env: NodeJS.ProcessEnv) {
  const csvKeys = String(env.ODIE_ACCESS_KEYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const single = String(env.ODIE_ACCESS_KEY || '').trim();
  const all = single ? [...csvKeys, single] : csvKeys;
  return new Set(all);
}

function getAccessKeyFromRequest(req: any) {
  const header = req.headers?.['x-odie-access-key'];
  const keyHeader = Array.isArray(header) ? header[0] : header;
  if (keyHeader && String(keyHeader).trim()) {
    return String(keyHeader).trim();
  }

  const authHeader = req.headers?.authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (authValue && /^Bearer\s+/i.test(authValue)) {
    return authValue.replace(/^Bearer\s+/i, '').trim();
  }

  return '';
}

const ALLOWED_ROLES = new Set(['STUDENT', 'TUTOR', 'ADMIN']);

function toProviderMessages(systemPrompt: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, message: string) {
  return [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8),
    { role: 'user', content: message },
  ];
}

async function readAssistantError(response: Response) {
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

function extractOpenAiCompatibleDelta(payload: string) {
  try {
    const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

async function streamOpenRouterCareersResponse(input: {
  apiKey: string;
  model: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  requestId?: string;
  signal: AbortSignal;
  onChunk: (chunk: string) => void;
}) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'HTTP-Referer': process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001',
      'X-Title': 'Odie',
      'X-Request-Id': input.requestId ?? '',
    },
    body: JSON.stringify({
      model: input.model,
      messages: toProviderMessages(CAREERS_ODIE_SYSTEM_PROMPT, input.history, input.message),
      max_tokens: 900,
      temperature: 0.35,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(await readAssistantError(response));
  }

  if (!response.body) {
    throw new Error('openrouter_stream_unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // OpenRouter streams OpenAI-compatible SSE frames; only delta content is proxied to the browser.
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.replace(/^data:\s*/, '').trim();
        if (!payload || payload === '[DONE]') continue;
        const delta = extractOpenAiCompatibleDelta(payload);
        if (delta) input.onChunk(delta);
      }
    }
  }
}

export async function assistantRoutes(app: FastifyInstance) {
  const assistantEnabled = isAssistantEnabled(process.env);
  const config = loadAssistantConfig();
  const accessKeys = parseAccessKeys(process.env);
  // In production, a session cookie is the primary credential. The access-key
  // header is only honoured when `ODIE_ALLOW_ACCESS_KEY_FALLBACK=true` (e.g.
  // for a public landing-page preview). Dev can bypass via ODIE_DEV_NO_AUTH.
  const allowAccessKeyFallback = String(process.env.ODIE_ALLOW_ACCESS_KEY_FALLBACK || '').toLowerCase() === 'true';
  const devBypass = process.env.NODE_ENV !== 'production' && String(process.env.ODIE_DEV_NO_AUTH || '').toLowerCase() === 'true';

  // Disabled short-circuit: register handlers that always return a safe disabled response.
  if (!assistantEnabled) {
    const disabledHandler = async (_req: any, reply: any) => {
      setPrivateNoStore(reply);
      return reply.code(503).send({ error: 'assistant_disabled' });
    };
    app.get('/assistant/status', async (_req, reply) => {
      setPrivateNoStore(reply);
      return reply.send({ enabled: false });
    });
    app.post('/assistant/chat', disabledHandler);
    app.post('/assistant/document', disabledHandler);
    app.post('/assistant/public-chat', disabledHandler);
    app.post('/assistant/careers-chat', disabledHandler);
    app.post('/assistant/careers-chat/stream', disabledHandler);
    app.log.warn({ event: 'assistant.disabled' }, 'assistant.disabled');
    return;
  }

  const service = createAssistantService(
    config,
    [
      createOpenRouterProvider(config.openRouterApiKey),
      createLmStudioProvider(config.lmStudioBaseUrl, config.lmStudioModel),
    ],
    app.log.child({ module: 'assistant' }),
  );

  app.get('/assistant/status', async (_req, reply) => {
    setPrivateNoStore(reply);
    return reply.send({ enabled: true });
  });

  app.post('/assistant/public-chat', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = PublicChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const result = await service.chat({
      message: parsed.data.message,
      history: parsed.data.history,
      systemPrompt: PUBLIC_ODIE_SYSTEM_PROMPT,
      requestId: req.id,
    });

    req.log.info({
      event: 'assistant.public_chat.completed',
      provider: result.metadata.provider,
      model: result.metadata.model,
      requestId: req.id,
    }, 'assistant.public_chat.completed');

    return reply.send({ text: result.text, metadata: result.metadata });
  });

  app.post('/assistant/careers-chat', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = PublicChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const result = await service.chat({
      message: parsed.data.message,
      history: parsed.data.history,
      systemPrompt: CAREERS_ODIE_SYSTEM_PROMPT,
      requestId: req.id,
    });

    req.log.info({
      event: 'assistant.careers_chat.completed',
      provider: result.metadata.provider,
      model: result.metadata.model,
      requestId: req.id,
    }, 'assistant.careers_chat.completed');

    return reply.send({ text: result.text, metadata: result.metadata });
  });

  app.post('/assistant/careers-chat/stream', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = PublicChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    if (!config.openRouterApiKey) {
      return reply.code(503).send({ error: 'openrouter_not_configured' });
    }

    const controller = new AbortController();
    req.raw.on('close', () => controller.abort());
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Accel-Buffering': 'no',
    });

    try {
      await streamOpenRouterCareersResponse({
        apiKey: config.openRouterApiKey,
        model: config.openRouterModel,
        message: parsed.data.message,
        history: parsed.data.history,
        requestId: req.id,
        signal: controller.signal,
        onChunk: (chunk) => reply.raw.write(chunk),
      });
      reply.raw.end();
      req.log.info({
        event: 'assistant.careers_chat.stream.completed',
        provider: 'openrouter',
        model: config.openRouterModel,
        requestId: req.id,
      }, 'assistant.careers_chat.stream.completed');
    } catch (error) {
      if (!reply.raw.writableEnded) {
        if (!controller.signal.aborted) {
          reply.raw.write('\n\nOdie could not finish that response. Please try again in a moment.');
        }
        reply.raw.end();
      }
      if (!controller.signal.aborted) {
        req.log.warn({
          event: 'assistant.careers_chat.stream.failed',
          requestId: req.id,
          error: error instanceof Error ? error.message : String(error),
        }, 'assistant.careers_chat.stream.failed');
      }
    }
  });

  app.addHook('preHandler', async (req: any, reply) => {
    // Status endpoint stays publicly available so the UI can hide entry points.
    if (req.routeOptions?.url === '/assistant/status' || req.routeOptions?.url === '/assistant/public-chat' || req.routeOptions?.url === '/assistant/careers-chat' || req.routeOptions?.url === '/assistant/careers-chat/stream') return;

    if (devBypass) return;

    // Primary path: an authenticated session with a recognised role.
    // We avoid calling app.authenticate when there is no session cookie, so we
    // don't short-circuit with a 401 before we can try the access-key fallback.
    const sessionCookie = req.cookies?.session;
    if (sessionCookie) {
      try {
        const decoded: any = await (app as any).jwt.verify(sessionCookie);
        if (decoded?.role && ALLOWED_ROLES.has(decoded.role)) {
          req.user = {
            userId: decoded.userId,
            role: decoded.role,
            tutorId: decoded.tutorId,
            studentId: decoded.studentId,
          };
          return;
        }
      } catch {
        // bad/expired JWT – fall through to access-key fallback check.
      }
    }

    if (!allowAccessKeyFallback) {
      return reply.code(401).send({ error: 'assistant_auth_required' });
    }

    if (accessKeys.size === 0) {
      req.log.error({ event: 'assistant.access_key.not_configured' }, 'assistant.access_key.not_configured');
      return reply.code(503).send({ error: 'assistant_access_keys_not_configured' });
    }

    const provided = getAccessKeyFromRequest(req);
    if (!provided) {
      return reply.code(401).send({ error: 'assistant_access_key_required' });
    }

    if (!accessKeys.has(provided)) {
      return reply.code(403).send({ error: 'assistant_access_key_invalid' });
    }
  });

  app.post('/assistant/chat', async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const result = await service.chat({
      message: parsed.data.message,
      history: parsed.data.history,
      personaVariant: parsed.data.personaVariant,
      systemPrompt: parsed.data.systemPrompt,
      requestId: req.id,
    });

    req.log.info({
      event: 'assistant.chat.completed',
      provider: result.metadata.provider,
      model: result.metadata.model,
      fallbackUsed: result.metadata.fallbackUsed,
      requestId: req.id,
      userId: (req as any).user?.userId,
      role: (req as any).user?.role,
    }, 'assistant.chat.completed');

    return reply.send({ text: result.text, metadata: result.metadata });
  });

  app.post('/assistant/document', async (req, reply) => {
    setPrivateNoStore(reply);
    const parsed = DocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const result = await service.analyzeDocument({
      documentText: parsed.data.documentText,
      userQuestion: parsed.data.userQuestion,
      history: parsed.data.history,
      personaVariant: parsed.data.personaVariant,
      systemPrompt: parsed.data.systemPrompt,
      requestId: req.id,
    });

    req.log.info({
      event: 'assistant.document.completed',
      provider: result.metadata.provider,
      model: result.metadata.model,
      fallbackUsed: result.metadata.fallbackUsed,
      documentChunksUsed: result.metadata.documentChunksUsed,
      requestId: req.id,
      userId: (req as any).user?.userId,
      role: (req as any).user?.role,
    }, 'assistant.document.completed');

    return reply.send({ text: result.text, metadata: result.metadata });
  });
}
