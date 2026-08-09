# grade-submission (Supabase Edge Function)

AI-assisted marking (v2). The browser submit flow queues work and kicks this
function without waiting for the draft result, so the learner's submission is
confirmed independently of the AI call. The worker claims a row with a lease,
talks to Gemini, and writes only to the separate `ai_*` columns on
`assignment_submissions` -- never `marks_awarded`/`feedback`/
`rubric_scores_json` or the release flags. A tutor/admin still explicitly
reviews and saves through the existing `mark_submission()` RPC before
anything releases to the student.

The worker drafts from the rubric, assignment context, and submission
evidence. Assignment memos are retired: any legacy private memo is retained
in Storage but is never downloaded or sent to Gemini.

Idempotent: claims the row (`ai_grading_status = 'in_progress'`) before the
Gemini call; a submission already `in_progress`/`completed` short-circuits
immediately. Safe to invoke from every successful-submit path, and safe to
replay against stale or retried queue entries because the claim token must
still match at final write time.

## Secrets

```bash
supabase secrets set GEMINI_API_KEY="<Google AI Studio key>"
supabase secrets set GEMINI_MODEL="gemini-3.5-flash-lite"
```

`GROQ_API_KEY` (used by `odie-careers-chat-stream`) is text-only and cannot
be reused here. `GEMINI_API_KEY` powers the grading worker, and
`SUPABASE_SERVICE_ROLE_KEY` is required for the trusted claim/finalise
updates.

## Deploy

```bash
supabase functions deploy grade-submission --project-ref <your-project-ref>
```

## Verify

Get a signed-in student's access token for a submission, then:

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/grade-submission" \
  -H "Authorization: Bearer <STUDENT_ACCESS_TOKEN>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "content-type: application/json" \
  -d '{"submissionId":"<uuid>"}'
```

Expect `{"ok":true,"status":"completed"}` within a few seconds, and
`ai_marks_awarded`/`ai_feedback`/`ai_rubric_scores_json`/`ai_confidence`/
`ai_graded_at` populated on the row. Guard rails: a non-owning student ->
`403 submission_not_owned`; already-completed submissions short-circuit; a
the draft is based on the rubric + submission evidence only.

## Deferred product work

AI grading currently stores a structured draft mark, feedback, rubric scores,
and confidence on the submission row; it does not create an annotated copy of
the learner's uploaded worksheet. A future marked-paper feature should render
an immutable reviewed artifact after a tutor/admin saves the final mark, store
it in a separate private bucket, and make it visible to the learner only when
the final result is released.
