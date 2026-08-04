// Supabase Edge Function: grade-submission
//
// AI-assisted marking (v1). Invoked by the frontend right after a student's
// submission is confirmed to exist (see submitAssignment in
// assignmentMutations.ts) so a draft mark/feedback is waiting by the time a
// tutor opens the review screen -- the tutor still explicitly reviews and
// saves through mark_submission() exactly as before; this function only ever
// writes to the separate ai_* columns, never marks_awarded/feedback/
// rubric_scores_json or the release flags.
//
// Grading needs a memo (model answer) to check the student's work against --
// assignments.memo_url, stored in the private assignment-memos bucket (never
// student-readable, unlike assignment-files). No memo -> ai_grading_status
// is set to 'skipped', not an error.
//
// Idempotent by design: the row is claimed (ai_grading_status set to
// 'in_progress') before the slow Gemini call, and a submission that's already
// in_progress/completed short-circuits immediately. This makes it safe for
// the caller to invoke this on every successful submit path (fast path and
// both retry/recovery paths), not just the first one.
//
// Provider: Gemini (vision-capable, unlike the existing GROQ_API_KEY model
// which is text-only). GEMINI_API_KEY/GEMINI_MODEL must be set as Edge
// Function secrets. Mistral is a documented later swap-in if handwriting OCR
// quality proves inadequate -- not built as a dual-provider abstraction here.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GradeRequestSchema = z.object({
  submissionId: z.string().uuid(),
});

interface RubricCriterion {
  id: string;
  label: string;
  maxMarks: number;
  description?: string;
}

interface GeminiCriterionResult {
  id: string;
  marksAwarded: number;
  justification: string;
}

interface GeminiGradingResult {
  criteria: GeminiCriterionResult[];
  overallFeedback: string;
  confidence: number;
}

const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          marksAwarded: { type: 'number' },
          justification: { type: 'string' },
        },
        required: ['id', 'marksAwarded', 'justification'],
      },
    },
    overallFeedback: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['criteria', 'overallFeedback', 'confidence'],
};

function statusForError(message: string): number {
  if (message === 'assistant_auth_required' || message === 'supabase_bearer_invalid') return 401;
  if (message === 'forbidden' || message === 'submission_not_owned') return 403;
  if (message === 'submission_not_found') return 404;
  if (message === 'invalid_request') return 400;
  if (message === 'supabase_admin_not_configured' || message === 'gemini_not_configured') return 501;
  return 500;
}

async function fetchAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { data: btoa(binary), mimeType };
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'supabase_admin_not_configured' }, 501);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Claimed once we have a submissionId, so the catch-all below can mark the
  // row failed instead of leaving it stuck in_progress on an unhandled error.
  let claimedSubmissionId: string | null = null;

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ error: 'assistant_auth_required' }, 401);
    }

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
    const profileId = (profileRow as { id: string }).id;
    const { data: studentRow } = await admin
      .from('students')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (!studentRow) {
      return json({ error: 'forbidden' }, 403);
    }
    const studentId = (studentRow as { id: string }).id;

    const { data: rateLimitAllowed, error: rateLimitError } = await admin.rpc(
      'check_and_record_edge_function_rate_limit',
      {
        p_subject_id: profileId,
        p_function_name: 'grade-submission',
        p_limit: 10,
        p_window_seconds: 10 * 60,
      },
    );
    if (rateLimitError) {
      console.error('rate_limit_check_failed', { functionName: 'grade-submission', code: rateLimitError.code });
      return json({ error: 'rate_limiter_unavailable' }, 503);
    }
    if (rateLimitAllowed !== true) {
      return json({ error: 'rate_limited' }, 429);
    }

    const parsed = GradeRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    }
    const { submissionId } = parsed.data;

    const { data: submission, error: submissionError } = await admin
      .from('assignment_submissions')
      .select('id, assignment_id, student_id, storage_key, text_answer, ai_grading_status')
      .eq('id', submissionId)
      .maybeSingle();
    if (submissionError || !submission) {
      return json({ error: 'submission_not_found' }, 404);
    }
    const submissionRow = submission as {
      id: string; assignment_id: string; student_id: string;
      storage_key: string | null; text_answer: string | null; ai_grading_status: string;
    };
    if (submissionRow.student_id !== studentId) {
      return json({ error: 'submission_not_owned' }, 403);
    }
    if (submissionRow.ai_grading_status === 'in_progress' || submissionRow.ai_grading_status === 'completed') {
      return json({ ok: true, status: submissionRow.ai_grading_status, skipped: true });
    }

    // Claim the job before the slow API call so a near-simultaneous second
    // invocation (see submitAssignment's multiple return paths) short-circuits
    // on the check above instead of racing this one.
    claimedSubmissionId = submissionRow.id;
    await admin.from('assignment_submissions').update({ ai_grading_status: 'in_progress' }).eq('id', submissionRow.id);

    const { data: assignment, error: assignmentError } = await admin
      .from('assignments')
      .select('id, rubric_json, memo_url')
      .eq('id', submissionRow.assignment_id)
      .maybeSingle();
    if (assignmentError || !assignment) {
      await admin.from('assignment_submissions').update({ ai_grading_status: 'failed' }).eq('id', submissionRow.id);
      return json({ error: 'assignment_not_found' }, 404);
    }
    const assignmentRow = assignment as { id: string; rubric_json: RubricCriterion[] | null; memo_url: string | null };
    if (!assignmentRow.memo_url) {
      await admin.from('assignment_submissions').update({ ai_grading_status: 'skipped' }).eq('id', submissionRow.id);
      return json({ ok: true, status: 'skipped' });
    }
    if (!geminiApiKey) {
      await admin.from('assignment_submissions').update({ ai_grading_status: 'failed' }).eq('id', submissionRow.id);
      return json({ error: 'gemini_not_configured' }, 501);
    }

    const rubric = assignmentRow.rubric_json || [];
    const totalMaxMarks = rubric.reduce((total, criterion) => total + (criterion.maxMarks || 0), 0) || 100;

    const { data: memoSigned } = await admin.storage.from('assignment-memos').createSignedUrl(assignmentRow.memo_url, 300);
    const memoFile = memoSigned?.signedUrl ? await fetchAsBase64(memoSigned.signedUrl) : null;

    let submissionFile: { data: string; mimeType: string } | null = null;
    if (submissionRow.storage_key) {
      const { data: submissionSigned } = await admin.storage
        .from('assignment-submissions')
        .createSignedUrl(submissionRow.storage_key, 300);
      submissionFile = submissionSigned?.signedUrl ? await fetchAsBase64(submissionSigned.signedUrl) : null;
    }

    const instructions = [
      'You are an assistant marking a South African CAPS-curriculum school assignment.',
      'Compare the student submission against the memo (model answer) and rubric criteria below.',
      'Score each rubric criterion out of its maxMarks, with a one-sentence justification.',
      'Then give brief overall feedback (2-3 sentences, addressed to the student) and an overall confidence 0-100',
      'reflecting how certain you are in these marks (lower confidence for illegible handwriting, ambiguous working, or a mismatch between memo and submission format).',
      '',
      `Rubric: ${JSON.stringify(rubric)}`,
      submissionRow.text_answer ? `Student's written answer: ${submissionRow.text_answer}` : '',
    ].filter(Boolean).join('\n');

    const parts: Array<Record<string, unknown>> = [{ text: instructions }];
    if (memoFile) parts.push({ text: 'Memo (model answer):' }, { inlineData: memoFile });
    if (submissionFile) parts.push({ text: "Student's submission:" }, { inlineData: submissionFile });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            temperature: 0.2,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text().catch(() => '');
      console.error('gemini_grading_failed', { status: geminiResponse.status, body: errorText.slice(0, 500) });
      await admin.from('assignment_submissions').update({ ai_grading_status: 'failed' }).eq('id', submissionRow.id);
      return json({ error: 'gemini_grading_failed' }, 502);
    }

    const geminiBody = await geminiResponse.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const resultText = geminiBody.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      await admin.from('assignment_submissions').update({ ai_grading_status: 'failed' }).eq('id', submissionRow.id);
      return json({ error: 'gemini_response_empty' }, 502);
    }

    let result: GeminiGradingResult;
    try {
      result = JSON.parse(resultText);
    } catch {
      await admin.from('assignment_submissions').update({ ai_grading_status: 'failed' }).eq('id', submissionRow.id);
      return json({ error: 'gemini_response_unparseable' }, 502);
    }

    const scoresByCategory: Record<string, number> = {};
    let earnedMarks = 0;
    for (const criterion of result.criteria || []) {
      scoresByCategory[criterion.id] = criterion.marksAwarded;
      earnedMarks += criterion.marksAwarded || 0;
    }
    const aiMarksAwarded = Math.max(0, Math.min(100, Math.round((earnedMarks / totalMaxMarks) * 100 * 100) / 100));
    const aiConfidence = Math.max(0, Math.min(100, Math.round((result.confidence ?? 0) * 100) / 100));

    await admin
      .from('assignment_submissions')
      .update({
        ai_marks_awarded: aiMarksAwarded,
        ai_feedback: result.overallFeedback || null,
        ai_rubric_scores_json: scoresByCategory,
        ai_confidence: aiConfidence,
        ai_graded_at: new Date().toISOString(),
        ai_grading_status: 'completed',
      })
      .eq('id', submissionRow.id);

    return json({ ok: true, status: 'completed' });
  } catch (error) {
    if (claimedSubmissionId) {
      await admin.from('assignment_submissions').update({ ai_grading_status: 'failed' }).eq('id', claimedSubmissionId).then(
        () => {},
        () => {},
      );
    }
    const message = error instanceof Error ? error.message : 'grade_submission_failed';
    console.error('grade_submission_unhandled_error', { message });
    return json({ error: 'grade_submission_failed' }, statusForError(message));
  }
});
