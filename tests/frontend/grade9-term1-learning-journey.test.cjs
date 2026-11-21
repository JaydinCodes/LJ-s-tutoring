const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20261110120000_grade9_term1_learning_journey.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');

function selectJourneyAction() {
  const source = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'learningJourneyDecision.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', output)(module.exports, require, module);
  return module.exports.selectLearningJourneyAction;
}

const choose = selectJourneyAction();
const candidate = (kind, extra = {}) => ({
  kind,
  route: `/learning/${kind}`,
  title: kind,
  description: `${kind} is ready`,
  ...extra,
});

test('the learner journey applies the published precedence and never presents a mastered topic as an action', () => {
  const result = choose([
    candidate('mastered'),
    candidate('endline'),
    candidate('practice'),
    candidate('prerequisite_support'),
    candidate('mastery_challenge'),
    candidate('baseline'),
    candidate('retention'),
    candidate('unfinished_activity'),
    candidate('unfinished_assessment'),
  ]);
  assert.equal(result.kind, 'unfinished_assessment');

  assert.equal(choose([candidate('mastered'), candidate('mastery_challenge'), candidate('baseline')]).kind, 'baseline');
  assert.equal(choose([candidate('practice'), candidate('misconception_support'), candidate('prerequisite_support')]).kind, 'prerequisite_support');
  assert.equal(choose([candidate('mastered')]).kind, 'unavailable');
});

test('the server-owned journey contract derives from existing assessment, activity, retention, OLA and topic-mastery records', () => {
  for (const fragment of [
    'create table public.student_learning_journey_context',
    'create or replace function public.get_my_grade9_term1_learning_journey()',
    'create or replace function public.set_my_grade9_term1_learning_context(',
    'create or replace function public.get_grade9_term1_learning_journey_readiness()',
    'public.learning_assessment_sessions',
    'public.learner_activity_progress',
    'public.get_my_due_learning_retention_step()',
    'public.get_my_available_learning_assessments()',
    'public.get_my_next_learning_step()',
    'public.topic_mastery_evaluations',
    'public.current_profile_role() <> \'student\'',
    "'FORMAL_SESSION_IN_PROGRESS'",
    "'LEARNING_ACTIVITY_IN_PROGRESS'",
    "'RETRIEVAL_DUE'",
    "'NO_APPROVED_CONTENT'",
  ]) assert.ok(migration.includes(fragment), `missing ${fragment}`);

  const precedenceFix = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261111120000_grade9_term1_selected_topic_baseline_precedence.sql'), 'utf8');
  assert.match(precedenceFix, /a learner's explicit Grade 9 topic choice/);
  assert.match(precedenceFix, /v_journey #>> '\{primary,action\}' is distinct from 'start_baseline'/);
  assert.match(precedenceFix, /candidate->>'assessmentType' = 'topic_baseline'/);
  assert.match(migration, /where item->>'assessmentType' = 'mastery_challenge'/);
  assert.match(migration, /elsif v_ola <> 'null'::jsonb/);
  assert.match(migration, /where item->>'assessmentType' = 'endline'/);
  assert.match(migration, /grant execute on function public\.get_my_grade9_term1_learning_journey\(\) to authenticated/);
});

test('the dashboard retains a single dominant continue action and an evidence-based learning journey', () => {
  const route = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentLearningRoute.tsx'), 'utf8');
  const topicRoute = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentLearningTopicRoute.tsx'), 'utf8');
  const map = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'LearningMap.tsx'), 'utf8');
  const projection = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261115120000_sprint5_learning_map_projection.sql'), 'utf8');
  assert.match(route, /useGrade9Term1LearningJourney/);
  assert.match(route, /Continue learning/);
  assert.match(route, /JourneyMap/);
  assert.match(map, /Your learning path/);
  assert.match(map, /You're here/);
  assert.match(map, /Locked/);
  assert.match(map, /Not yet available/);
  assert.match(map, /Helpful Grade 8 detour/);
  assert.match(map, /practiceStatus === 'completed'/);
  assert.match(map, /Formal evidence has recorded mastery/);
  assert.doesNotMatch(map, /animate-pulse|usePrefersReducedMotion/);
  assert.match(route, /className="learning-primary"/);
  assert.doesNotMatch(route, /rounded-3xl|shadow-xl|Nothing ready yet/);
  assert.doesNotMatch(topicRoute, /Understand your starting point/);
  assert.match(topicRoute, /Make this my current topic/);
  assert.match(topicRoute, /TopicLearningMap/);
  assert.match(topicRoute, /LessonSteps/);
  assert.match(topicRoute, /See examples/);
  assert.match(topicRoute, /Move up a level/);
  assert.match(topicRoute, /This is my current topic/);
  assert.match(topicRoute, /skills completed/);
  assert.match(topicRoute, /Assessments confirm mastery/);
  assert.match(topicRoute, /WorkedExamples/);
  assert.match(topicRoute, /ConceptSteps/);
  assert.match(topicRoute, /Next example/);
  assert.doesNotMatch(topicRoute, /Intl\.Segmenter/);
  const presentation = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'studentLearningPresentation.ts'), 'utf8');
  assert.match(presentation, /Know your numbers/);
  assert.match(presentation, /Numbers are weirder than they look/);
  assert.match(presentation, /Example 3/);
  for (const fragment of [
    'create or replace function public.get_my_grade9_term1_topic_learning_map',
    'public.current_profile_role() <> \'student\'',
    'public.get_my_available_learning_assessments()',
    'public.learner_activity_progress',
    'public.skill_mastery_evaluations',
    'grant execute on function public.get_my_grade9_term1_topic_learning_map(text) to authenticated',
  ]) assert.ok(projection.includes(fragment), `missing map-projection guard: ${fragment}`);
  const adminRoute = fs.readFileSync(path.join(root, 'src', 'features', 'admin', 'AdminLearningContentRoute.tsx'), 'utf8');
  assert.match(adminRoute, /Grade 9 Term 1 learner readiness/);
  assert.match(adminRoute, /Publication blocked/);
  assert.match(adminRoute, /Approve activity/);
  assert.match(adminRoute, /approvalBlockers/);
  assert.match(adminRoute, /reviewLearningActivity/);
});
