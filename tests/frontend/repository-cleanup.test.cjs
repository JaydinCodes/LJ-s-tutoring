const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function relativeFiles(directory) {
  return listFiles(directory)
    .map((file) => path.relative(directory, file).replaceAll('\\', '/'))
    .sort();
}

test('retired frontend sources stay out of the active repository tree and Tailwind scan', () => {
  assert.deepEqual(listFiles(path.join(root, 'student-app')), []);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'app-critical.js')), false);

  const tailwindConfig = fs.readFileSync(path.join(root, 'tailwind.config.js'), 'utf8');
  assert.doesNotMatch(tailwindConfig, /student-app/);
});

test('static assets are restricted to the production allowlist and owner-excluded Community artifact', () => {
  const expected = [
    'analytics-module.js',
    'analytics.js',
    'lib/sanitize.js',
    'portal-config.js',
    'student/community.js',
    'sw-register.js',
    'tailwind-input.css',
  ];
  assert.deepEqual(relativeFiles(path.join(root, 'assets')), expected);

  const buildStatic = fs.readFileSync(path.join(root, 'scripts', 'build-static.js'), 'utf8');
  for (const asset of expected.filter((file) => file !== 'student/community.js')) {
    const sourceToken = asset === 'lib/sanitize.js' ? "path.join('lib', 'sanitize.js')" : `'${asset}'`;
    assert.ok(buildStatic.includes(sourceToken), `${asset} must remain in the explicit copy allowlist`);
  }
  assert.doesNotMatch(buildStatic, /community\.js/);
});

test('runtime and build dependencies remain correctly classified', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  for (const packageName of ['date-fns', 'recharts', 'ws']) {
    assert.equal(manifest.dependencies[packageName], undefined, `${packageName} must not be a direct runtime dependency`);
  }

  for (const packageName of ['@vitejs/plugin-react', '@tailwindcss/typography']) {
    assert.equal(manifest.dependencies[packageName], undefined, `${packageName} must not be a runtime dependency`);
    assert.equal(typeof manifest.devDependencies[packageName], 'string', `${packageName} must remain available for builds`);
  }
});
