const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('careers page is a discovery cockpit with the required student sections', () => {
  const source = read('src', 'features', 'students', 'StudentCareersRoute.tsx');

  for (const label of ['Career Explorer', 'Subject Match', 'APS Planner', 'Opportunity Map', 'Ask Odie', 'Saved Careers']) {
    assert.ok(source.includes(label), `${label} section must be present`);
  }

  assert.ok(source.includes('filters.interest'), 'students must filter by interest');
  assert.ok(source.includes('filters.subject'), 'students must filter by subject');
  assert.ok(source.includes('filters.category'), 'students must filter by career category');
  assert.ok(source.includes('latestCareerMetric'), 'salary and growth details must be conditional on backend data');
  assert.ok(source.includes('profile.savedCareers'), 'saved careers must be visible and persisted');
});

test('Odie career chat streams with stop support and bounded memory', () => {
  const source = read('src', 'features', 'students', 'StudentCareersRoute.tsx');
  const client = read('src', 'lib', 'api', 'client.ts');

  assert.ok(source.includes("apiStreamText('/assistant/careers-chat/stream'"), 'careers page must use streaming Odie endpoint');
  assert.ok(source.includes('AbortController'), 'student must be able to stop generation');
  assert.ok(source.includes('Stop generation'), 'stop control must be rendered');
  assert.ok(source.includes('MAX_CHAT_MESSAGES = 12'), 'chat state must have a max message limit');
  assert.ok(source.includes('slice(-MAX_CHAT_MESSAGES)'), 'chat history must be trimmed');
  assert.ok(client.includes('response.body.getReader()'), 'API client must read streamed chunks');
});

test('Odie remains scoped to the careers student route', () => {
  const routeFiles = fs.readdirSync(path.join(root, 'src', 'features', 'students'))
    .filter((file) => /^Student.*Route\.tsx$/.test(file));

  for (const file of routeFiles) {
    const source = read('src', 'features', 'students', file);
    if (file === 'StudentCareersRoute.tsx') {
      assert.ok(source.includes('Ask Odie'), 'careers route owns Odie');
    } else {
      assert.ok(!source.includes('Ask Odie'), `${file} must not expose Odie chat`);
      assert.ok(!source.includes('careers-chat/stream'), `${file} must not call Odie careers streaming`);
    }
  }
});
