const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
function loadSelector() {
  const source = fs.readFileSync(path.join(root, 'src/features/learning/olaNextStepSelector.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', output)(module.exports, require, module);
  return module.exports.selectOlaNextStep;
}
const select = loadSelector();
const activity = (code, skillCode = 'G9.ALG.FACTOR.DOTS', extra = {}) => ({ code, kind: 'activity', skillCode, topicCode: 'ALGEBRAIC-EXPRESSIONS', approved: true, allQuestionsApproved: true, ...extra });
const input = (extra = {}) => ({ subject: 'Mathematics', grade: 'Grade 9', topicCode: 'ALGEBRAIC-EXPRESSIONS', skillCode: 'G9.ALG.FACTOR.DOTS', targetMastery: 'unassessed', targetEvidenceCount: 0, prerequisites: [], repeatedMisconception: false, unfinished: [], content: [activity('ACT.DOTS')], ...extra });

test('OLA offers an optional diagnostic to a brand-new learner without evidence', () => {
  const result = select(input({ content: [{ ...activity('DIAG.DOTS'), kind: 'diagnostic' }, activity('ACT.DOTS')] }));
  assert.equal(result.outcome, 'diagnostic');
  assert.ok(result.reasonCodes.includes('OPTIONAL_DIAGNOSTIC'));
});

test('OLA respects a chosen topic and resumes its unfinished work before a new decision', () => {
  const result = select(input({ unfinished: [{ activityCode: 'ACT.RESUME', topicCode: 'ALGEBRAIC-EXPRESSIONS', skillCode: 'G9.ALG.FACTOR.DOTS' }] }));
  assert.equal(result.outcome, 'resume');
  assert.equal(result.activityCode, 'ACT.RESUME');
  assert.ok(result.reasonCodes.includes('CHOSEN_TOPIC'));
});

test('OLA remediates only an evidenced weak prerequisite, never an unknown one', () => {
  const weak = select(input({ targetMastery: 'developing', targetEvidenceCount: 3, prerequisites: [{ code: 'G9.ALG.EXPAND.BINOMIAL', state: 'emerging' }], content: [activity('ACT.PRE', 'G9.ALG.EXPAND.BINOMIAL'), activity('ACT.DOTS')] }));
  assert.equal(weak.outcome, 'prerequisite');
  const unknown = select(input({ targetMastery: 'developing', targetEvidenceCount: 3, prerequisites: [{ code: 'G9.ALG.EXPAND.BINOMIAL', state: 'unassessed' }], content: [activity('ACT.PRE', 'G9.ALG.EXPAND.BINOMIAL'), activity('ACT.DOTS')] }));
  assert.equal(unknown.outcome, 'practice');
});

test('OLA prioritises repeated misconception support, then targeted practice', () => {
  const result = select(input({ targetMastery: 'emerging', targetEvidenceCount: 2, repeatedMisconception: true }));
  assert.equal(result.outcome, 'misconception');
  assert.ok(result.reasonCodes.includes('REPEATED_MISCONCEPTION'));
});

test('OLA supports secure skill retrieval and returns a safe fallback without approved content', () => {
  const retention = select(input({ targetMastery: 'secure', targetEvidenceCount: 4, content: [{ ...activity('RET.DOTS'), kind: 'retention' }] }));
  assert.equal(retention.outcome, 'retention');
  const fallback = select(input({ targetMastery: 'developing', targetEvidenceCount: 2, content: [activity('DRAFT', 'G9.ALG.FACTOR.DOTS', { approved: false })] }));
  assert.equal(fallback.outcome, 'fallback');
  assert.ok(fallback.reasonCodes.includes('NO_APPROVED_CONTENT'));
});

test('catalogue migration is approved-only, validates external resources and keeps a reviewer boundary', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261105000000_ola_v1_learning_catalogue.sql'), 'utf8');
  for (const fragment of ['create table public.learning_skill_content', 'WORKSHEET_PERMISSION_REQUIRED', 'VIDEO_URL_NOT_CURATED_YOUTUBE', 'save_learning_skill_content_draft', 'review_learning_skill_content_action', 'get_my_grade9_learning_catalogue', "content.review_status='approved'", 'Seed only a draft']) assert.ok(migration.includes(fragment), `missing ${fragment}`);
  assert.match(migration, /current_profile_role\(\)<>'student'/);
});

test('the activity runner has a bounded, idempotent evaluation retry state', () => {
  const repository = fs.readFileSync(path.join(root, 'src/features/learning/studentLearningRepository.ts'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'src/features/learning/StudentActivityRoute.tsx'), 'utf8');
  assert.match(repository, /15_000/);
  assert.match(route, /Retry same answer/);
  assert.match(route, /Keep the key: retrying an uncertain request is idempotent/);
});

test('topic experience treats video as optional and never embeds autoplay', () => {
  const route = fs.readFileSync(path.join(root, 'src/features/learning/StudentLearningTopicRoute.tsx'), 'utf8');
  assert.match(route, /skill\.content\.videoUrl \?/);
  assert.match(route, /Watch the optional reviewed lesson/);
  assert.doesNotMatch(route, /autoplay/i);
});

test('Batch 1 preserves source provenance and imports only review-gated immutable drafts', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261106000000_grade8_bridge_and_source_question_drafts.sql'), 'utf8');
  for (const fragment of ['CAPS-MATH-G8-2023-24', 'Q.G8.SRC.ORDER.001', 'Q.G9.SRC.DOTS.005', "'draft'", 'question_version_skill_links', 'question_hints', 'requires mathematical and provenance review']) assert.ok(migration.includes(fragment), `missing ${fragment}`);
  assert.doesNotMatch(migration, /'approved'\s*,\s*source\.activity_type/);
});

test('curated video candidates are review-gated, learner-safe, and rechecked after a changed link', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261107000000_curated_learning_video_resources.sql'), 'utf8');
  for (const fragment of [
    'create table public.learning_video_resources',
    "availability_status in ('unverified','available','unavailable','restricted')",
    "resource.review_status='approved' and resource.availability_status='available'",
    "'VID.G9.DOTS.001'", "'IqN8Z1-nlsY'",
    'review_learning_video_resource_action',
    'update_learning_video_resource_metadata',
    'youtube_id_changed',
    "review_status=case when v_changed_id then 'draft'",
  ]) assert.ok(migration.includes(fragment), `missing ${fragment}`);
  assert.doesNotMatch(migration, /'approved'\s*,\s*'available'/);
});

test('student video links are data-light and unavailable video data does not block the lesson', () => {
  const route = fs.readFileSync(path.join(root, 'src/features/learning/StudentLearningTopicRoute.tsx'), 'utf8');
  assert.match(route, /target="_blank"/);
  assert.match(route, /Optional video lessons are unavailable right now/);
  assert.doesNotMatch(route, /<iframe|autoplay/i);
});
