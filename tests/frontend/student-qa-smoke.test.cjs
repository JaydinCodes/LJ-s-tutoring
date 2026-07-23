const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student smoke routes are registered in the React router', () => {
  const app = read('src', 'app', 'App.tsx');

  for (const route of [
    '/dashboard/student',
    '/dashboard/student/assignments',
    '/dashboard/student/progress',
    '/dashboard/student/results',
    '/dashboard/student/careers',
  ]) {
    assert.ok(app.includes(`path="${route}"`), `${route} must be registered in the React router`);
  }
});

test('assignment upload validation covers client type, size, preview, and API failure states', () => {
  const upload = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const uploadTest = read('tests', 'frontend', 'student-assignment-upload.test.cjs');

  assert.ok(upload.includes("allowedMime = ['application/pdf', 'image/jpeg', 'image/png']"), 'upload must allow only PDF/JPG/PNG MIME types');
  assert.ok(upload.includes("allowedExt = ['pdf', 'jpg', 'jpeg', 'png']"), 'upload must validate file extensions before API calls');
  assert.ok(upload.includes('maxUploadBytes = 10 * 1024 * 1024'), 'upload must enforce the 10 MB client limit');
  assert.ok(upload.includes('getClientFileError(file)'), 'upload must validate the selected file before submitting');
  assert.ok(upload.includes('toast.error(nextError)'), 'upload failures must surface through toast feedback');
  assert.ok(upload.includes('URL.createObjectURL(file)'), 'image previews must be created before upload');
  assert.ok(uploadTest.includes('validates file type and size before the API call'), 'upload validation must have a regression test');
});

test('results analytics UI handles 0, 1, and many result states', () => {
  const route = read('src', 'features', 'students', 'StudentResultsRoute.tsx');

  assert.ok(route.includes('if (!chronological.length)'), '0 results must render an empty trend state');
  assert.ok(route.includes('chronological.length === 1'), '1 result must render first-mark guidance instead of a broken chart');
  assert.ok(route.includes('<polyline'), 'many results must render a trend line');
  assert.ok(route.includes('if (!subjects.length)'), '0 results must render empty subject summaries');
  assert.ok(route.includes('if (!items.length)'), 'subject/detail lists must handle empty result collections');
  assert.ok(route.includes('ClassAnalyticsSummary'), 'many-result overview must include class analytics without classmate data');
});

test('careers chat error state is graceful', () => {
  const careers = read('src', 'features', 'students', 'StudentCareersRoute.tsx');

  assert.ok(careers.includes('I cannot connect to Odie right now'), 'careers chat must show a friendly connection error');
  assert.ok(careers.includes('openrouter_not_configured'), 'OpenRouter configuration errors must be translated for the student');
  assert.ok(careers.includes('abortRef.current?.abort()'), 'students must be able to stop a long response');
});
