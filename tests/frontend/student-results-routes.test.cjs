const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student results are split into overview, detail, and subject routes', () => {
  const app = read('src', 'app', 'App.tsx');
  const source = read('src', 'features', 'students', 'StudentResultsRoute.tsx');

  assert.ok(app.includes('path="/student/results"'), 'short results overview route must exist');
  assert.ok(app.includes('path="/student/results/:resultId"'), 'short result detail route must exist');
  assert.ok(app.includes('path="/student/results/subjects/:subject"'), 'short subject route must exist');
  assert.ok(app.includes('path="/dashboard/student/results/:resultId"'), 'dashboard detail route must remain available');
  assert.ok(app.includes('path="/dashboard/student/results/subjects/:subject"'), 'dashboard subject route must remain available');
  assert.ok(source.includes('export function StudentResultsRoute'), 'overview component must be exported');
  assert.ok(source.includes('export function StudentResultDetailRoute'), 'detail component must be exported');
  assert.ok(source.includes('export function StudentResultsSubjectRoute'), 'subject component must be exported');
});

test('results overview is premium summary-only and calculated from released results', () => {
  const source = read('src', 'features', 'students', 'StudentResultsRoute.tsx');

  for (const component of ['ResultsHero', 'MarkTrend', 'SubjectResultRows', 'WeakTopicInsight']) {
    assert.ok(source.includes(`export function ${component}`), `${component} must be exported`);
    assert.ok(source.includes(`<${component}`), `${component} must be rendered by the overview`);
  }

  assert.ok(source.includes('function releasedResults'), 'overview metrics must be based on released result rows');
  assert.ok(source.includes('const items = releasedResults(data?.items || [])'), 'overview must calculate from released results only');
  assert.ok(source.includes('Results insight'), 'overview must lead with one main insight panel');
  assert.ok(source.includes('Subject breakdown'), 'overview must use supporting subject rows');
  assert.ok(source.includes('Weakest topic recommendation'), 'overview must recommend the next weak topic');
  assert.ok(source.includes('from-brand-navy via-brand-deepBlue to-brand-aegean'), 'trend chart must use Greek premium styling');
  assert.ok(source.includes('A trend line needs at least two released marks'), 'one-result empty state must be handled');
  assert.ok(source.includes('No released marks yet'), 'zero-result empty state must be handled');
  assert.ok(!source.includes('AssessmentTable'), 'main page must not render the old full assessment table');
});

test('result detail and subject routes expose private learner results without classmate data', () => {
  const source = read('src', 'features', 'students', 'StudentResultsRoute.tsx');
  const api = read('lms-api', 'src', 'routes', 'academic.ts');

  assert.ok(source.includes('releasedResults(data?.items || []).find((item) => item.id === resultId)'), 'detail page must read one private result by id');
  assert.ok(source.includes('filter((item) => item.subject === decodedSubject)'), 'subject page must list all results for the selected subject');
  assert.ok(source.includes('keeps class context anonymous'), 'results overview copy must reinforce anonymity');
  assert.ok(api.includes('where student_id = $1'), 'student results API must scope raw result rows to the signed-in student');
  assert.ok(api.includes('CLASS_ANALYTICS_PRIVACY_THRESHOLD'), 'class analytics must keep privacy thresholding');
  assert.ok(!source.includes('classAnalytics.students'), 'frontend must not expose classmate rows');
});

test('result detail renders CAPS-style cognitive level breakdown and practice recommendations', () => {
  const source = read('src', 'features', 'students', 'StudentResultsRoute.tsx');
  const repository = read('src', 'features', 'students', 'studentResultsRepository.ts');
  const api = read('lms-api', 'src', 'routes', 'academic.ts');

  for (const level of ['Knowledge', 'Routine Procedure', 'Complex Procedure', 'Problem Solving']) {
    assert.ok(repository.includes(level), `${level} must be modeled`);
  }

  assert.ok(repository.includes('normalizeCognitiveBreakdown'), 'older cognitive payloads must be normalized safely');
  assert.ok(source.includes('function CognitiveBreakdown'), 'detail page must render cognitive levels');
  assert.ok(source.includes("score != null && score < 50"), 'weak cognitive levels must be highlighted');
  assert.ok(source.includes('function PracticeRecommendation'), 'detail page must recommend practice type');
  assert.ok(source.includes('questionTypeForLevel'), 'practice recommendation must map level to question type');
  assert.ok(source.includes('Older results may not include CAPS cognitive-level marks'), 'missing cognitive data must have a fallback empty state');
  assert.ok(api.includes('cognitive_breakdown_json'), 'backend must expose cognitive-level mark data');
});
