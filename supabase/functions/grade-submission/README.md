# grade-submission (Supabase Edge Function)

AI-assisted marking (v1). Invoked by `submitAssignment`
(`src/features/assignments/assignmentMutations.ts`) right after a student's
submission is confirmed to exist, so a draft mark/feedback is waiting by the
time a tutor opens the review screen. Writes only to the separate `ai_*`
columns on `assignment_submissions` -- never `marks_awarded`/`feedback`/
`rubric_scores_json` or the release flags. A tutor/admin still explicitly
reviews and saves through the existing `mark_submission()` RPC before
anything releases to the student.

Requires the assignment to have a `memo_url` (model answer, private
`assignment-memos` bucket, never student-readable). No memo -> the row's
`ai_grading_status` is set to `skipped`, not an error.

Idempotent: claims the row (`ai_grading_status = 'in_progress'`) before the
Gemini call; a submission already `in_progress`/`completed` short-circuits
immediately. Safe to invoke from every successful-submit path, not just the
first.

## Secrets

```bash
supabase secrets set GEMINI_API_KEY="<Google AI Studio key>"
supabase secrets set GEMINI_MODEL="gemini-2.0-flash"
```

`GROQ_API_KEY` (used by `odie-careers-chat-stream`) is text-only and cannot
be reused here.

## Deploy

```bash
supabase functions deploy grade-submission --project-ref <your-project-ref>
```

## Verify

Get a signed-in student's access token for a submission on an assignment
that has a memo uploaded, then:

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
`403 submission_not_owned`; no memo on the assignment -> `{"ok":true,
"status":"skipped"}`; re-invoking an already-completed submission -> `{"ok":
true,"status":"completed","skipped":true}` with no second Gemini call.
