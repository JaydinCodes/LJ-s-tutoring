# odie-careers-chat-stream (Supabase Edge Function)

Single-stack migration (ADR-0003). Replaces the Fastify route
`POST /assistant/careers-chat/stream` (`lms-api/src/routes/assistant.ts`).

Stateless proxy to OpenRouter for the careers-cockpit chat widget
(`StudentCareersRoute.tsx`). Caller must be an authenticated **student**
profile with a linked `students` row. Nothing is persisted -- the client
sends its own rolling history each call, exactly like Fastify does today.

The separate persisted "academic tutor chat" (`/student/odie/chat`,
`odie_conversations`/`odie_messages`) has no frontend anywhere in this
codebase and is out of scope here -- same reasoning as tutor-onboarding/
academic-extras earlier in this migration.

## 1. Set secrets (not auto-injected, unlike SUPABASE_URL/SERVICE_ROLE_KEY)

```bash
supabase secrets set OPENROUTER_API_KEY="<same value already in .env>"
supabase secrets set OPENROUTER_MODEL="google/gemma-4-31b-it:free"
```

## 2. Deploy

```bash
supabase functions deploy odie-careers-chat-stream --project-ref <your-project-ref>
```

## 3. Verify (before repointing)

Get any signed-in student's access token, then:

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/odie-careers-chat-stream" \
  -H "Authorization: Bearer <STUDENT_ACCESS_TOKEN>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "content-type: application/json" \
  -d '{"message":"What subjects do I need for a career in engineering?","history":[]}'
```

Expect a streamed plain-text response. Check the guard rails too: a
non-student token -> `403 forbidden`; no token -> `401 assistant_auth_required`.

## 4. Repoint the frontend (after verify)

In `src/features/students/StudentCareersRoute.tsx`, replace the
`apiStreamText('/assistant/careers-chat/stream', ...)` call with a direct
fetch to this function (streaming responses don't go through
`supabase.functions.invoke`, which buffers the whole body -- use `fetch`
directly with the session's access token, same as `apiStreamText` already
does today, just against the function URL instead of the Fastify API base).

## 5. Retire the Fastify route (after the frontend is on the function)

Remove the `/assistant/careers-chat` and `/assistant/careers-chat/stream`
handlers from `lms-api/src/routes/assistant.ts` once nothing calls them.
