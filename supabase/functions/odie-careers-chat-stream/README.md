# odie-careers-chat-stream (Supabase Edge Function)

Single-stack migration (ADR-0003). Replaces the Fastify route
`POST /assistant/careers-chat/stream` (`lms-api/src/routes/assistant.ts`).

Stateless proxy to Groq for the careers-cockpit chat widget
(`StudentCareersRoute.tsx`). Caller must be an authenticated **student**
profile with a linked `students` row. Nothing is persisted -- the client
sends its own rolling history each call, exactly like Fastify does today.

The separate persisted "academic tutor chat" (`/student/odie/chat`,
`odie_conversations`/`odie_messages`) has no frontend anywhere in this
codebase and is out of scope here -- same reasoning as tutor-onboarding/
academic-extras earlier in this migration.

## Status: deployed, verified, frontend repointed

Provider is Groq (api.groq.com), not OpenRouter -- switched after OpenRouter's
free-tier model proved persistently rate-limited (429) during verification.
Groq's chat completions API is OpenAI-compatible, so the SSE-parsing code
didn't need to change; only the endpoint/model/key did.

## Secrets

```bash
supabase secrets set GROQ_API_KEY="<same value already in .env>"
supabase secrets set GROQ_MODEL="llama-3.1-8b-instant"
```

## Deploy

```bash
supabase functions deploy odie-careers-chat-stream --project-ref <your-project-ref>
```

## Verify

Get any signed-in student's access token, then:

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/odie-careers-chat-stream" \
  -H "Authorization: Bearer <STUDENT_ACCESS_TOKEN>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "content-type: application/json" \
  -d '{"message":"What subjects do I need for a career in engineering?","history":[]}'
```

Expect a streamed plain-text response. Guard rails: a non-student token ->
`403 forbidden`; no token -> `401 assistant_auth_required`; empty/oversized
message -> `400 invalid_request`.

## Retire the Fastify route (not yet done)

Remove the `/assistant/careers-chat` and `/assistant/careers-chat/stream`
handlers from `lms-api/src/routes/assistant.ts` once nothing else calls them.
