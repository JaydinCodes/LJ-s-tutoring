const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('progress page renders subject chips and topic rows instead of stats and tables', () => {
  const source = read('src', 'features', 'students', 'StudentProgressRoute.tsx');

  for (const component of ['SubjectFilterChips', 'TopicProgressList', 'TopicProgressRow']) {
    assert.ok(source.includes(`export function ${component}`), `${component} must be exported`);
    assert.ok(source.includes(`<${component}`), `${component} must be rendered by the progress route`);
  }

  assert.ok(source.includes('activeSubject'), 'progress page must keep selected subject state');
  assert.ok(source.includes('filterProgressBySubject'), 'progress rows must be filtered by subject');
  assert.ok(source.includes('progress.cognitive_level ||'), 'rows must show cognitive level labels');
  assert.ok(source.includes('formatDate(progress.recorded_at)'), 'rows must show recorded dates');
  assert.ok(source.includes('<AnimatedProgressBar'), 'rows must use animated progress bands');
  assert.ok(!source.includes('<DataTable'), 'progress page must not render the old table');
  assert.ok(!source.includes('<StatCard'), 'progress page must not render the old stat grid');
});
