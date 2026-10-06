const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8');

test('dashboard separates mastery evidence from school-result context and has no cross-topic trend', () => {
  const dashboard = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');

  assert.match(dashboard, /useLearnerMasterySummary/);
  assert.match(dashboard, /Learning progress/);
  assert.match(dashboard, /Latest school result/);
  assert.match(dashboard, /findLatestSchoolResult/);
  assert.match(dashboard, /Your lowest recorded result was/);
  assert.doesNotMatch(dashboard, /Your latest recorded result was/);
  assert.doesNotMatch(dashboard, /ProgressTrendChart|summarizeProgress|recent trend|recent improvement/i);
  assert.doesNotMatch(dashboard, /\+\$?\{.*\}% learning progress/i);
});

test('dashboard renders one school-result surface in the 5 + 4 + 3 bento row', () => {
  const dashboard = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');
  const bentoGrid = dashboard.slice(dashboard.indexOf('function StudentBentoGrid'), dashboard.indexOf('function AssignmentRow'));

  assert.equal((bentoGrid.match(/title="Latest school result"/g) || []).length, 1);
  assert.match(bentoGrid, /student-bento-card xl:col-span-5/);
  assert.match(bentoGrid, /student-bento-card xl:col-span-4/);
  assert.match(bentoGrid, /grid min-w-0 gap-5 xl:col-span-3/);
});

test('learner-facing labels keep school results distinct from mastery states', () => {
  const battlePlan = read('src', 'features', 'students', 'studentBattlePlan.ts');
  const dailyInsight = read('src', 'features', 'students', 'studentDailyInsight.ts');
  const progress = read('src', 'features', 'students', 'StudentProgressRoute.tsx');

  assert.doesNotMatch(battlePlan, /% mastery|topic mastery/i);
  assert.doesNotMatch(dailyInsight, /% mastery|mastery score/i);
  for (const label of ['Not assessed yet', 'Starting', 'Making progress', 'Strong understanding', 'Remembered over time']) {
    assert.match(progress, new RegExp(label));
  }
});

test('question type backfill is conservative and learner-safe payloads remain redacted', () => {
  const migration = read('supabase', 'migrations', '20261006000100_backfill_approved_learning_question_types.sql');
  const learnerRpc = read('supabase', 'migrations', '20261006000000_core_learning_closure.sql');
  const responseInput = read('src', 'features', 'learning', 'QuestionResponseInput.tsx');

  assert.match(migration, /review_status = 'approved'/);
  assert.match(migration, /answer_config \|\| jsonb_build_object\('type', candidates\.question_type\)/);
  assert.match(migration, /nullif\(btrim\(coalesce\(version\.answer_config ->> 'type'/);
  for (const questionType of ['numeric', 'fraction', 'multiple_choice', 'coordinate', 'linear_equation_solution', 'algebraic_expression', 'factorised_expression']) {
    assert.match(migration, new RegExp(`'${questionType}'`));
  }
  assert.match(migration, /Manual-review audit/);
  assert.match(learnerRpc, /question_type text/);
  assert.match(learnerRpc, /when \(qv\.answer_config->>'type'\) = 'multiple_choice'/);
  assert.doesNotMatch(learnerRpc, /jsonb_build_object\([^)]*(?:correct_option|accepted_answers|solution|expected)/);
  assert.match(responseInput, /questionType === 'multiple_choice'/);
  assert.match(responseInput, /\(options \|\| \[\]\)\.map/);
});
