const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function readDist(relativePath) {
  return fs.readFileSync(path.join(root, 'dist', ...relativePath.split('/')), 'utf8');
}

test('static build prerenders crawlable public content without exposing dashboard markup', () => {
  execFileSync(process.execPath, ['scripts/build-static.js'], { cwd: root, stdio: 'pipe' });

  const home = readDist('index.html');
  const about = readDist('about/index.html');
  const programs = readDist('programs/index.html');
  const guide = readDist('guides/matric-maths-mistakes-guide/index.html');
  const dashboard = readDist('dashboard/student/index.html');

  assert.match(home, /<title>Maths Tutoring Cape Town and South Africa \| Project Odysseus LMS<\/title>/);
  assert.match(home, /<meta name="description" content="[^"]+">/);
  assert.match(home, /<main data-prerendered-page="home">/);
  assert.match(home, /<h1>Project Odysseus<\/h1>/);
  assert.match(home, /Targeted CAPS support for Mathematics, Mathematical Literacy, and Physical Sciences/);
  assert.match(home, /<section id="enquiry">/);
  assert.match(about, /<main data-prerendered-page="about">/);
  assert.match(programs, /<main data-prerendered-page="programs">/);
  assert.match(guide, /<main data-prerendered-page="matric-maths-mistakes-guide">/);
  assert.doesNotMatch(dashboard, /data-prerendered-page=/);
  assert.match(dashboard, /<div id="root"><\/div>/);
});
