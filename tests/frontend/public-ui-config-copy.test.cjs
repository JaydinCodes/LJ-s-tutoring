const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('public enquiry helper copy does not expose configuration names', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');

  assert.ok(publicRoutes.includes('We reply within 24 hours, Monday to Thursday.'), 'enquiry form must explain the expected reply time');
  assert.ok(!publicRoutes.includes('Configure `VITE_PO_FORMSPREE_ENDPOINT`'), 'enquiry form must not expose its endpoint configuration name');
});

test('login and onboarding surfaces do not expose environment variable names', () => {
  const renderedSurfaces = [
    'src/features/auth/LoginRoute.tsx',
    'src/features/auth/ProtectedRoute.tsx',
    'src/features/auth/AuthProvider.tsx',
    'src/features/onboarding/OnboardingRoute.tsx',
  ];

  for (const relativePath of renderedSurfaces) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /\b(?:VITE|PUBLIC)_[A-Z0-9_]+\b/, `${relativePath} must not expose browser configuration names`);
    assert.doesNotMatch(source, /\benv(?:ironment)? vars?\b/i, `${relativePath} must not mention environment variables`);
  }
});

test('tracked files do not include local environment files', () => {
  const gitignore = read('.gitignore');
  const trackedFiles = execFileSync('git', ['ls-files', '.env', '.env.local', '.env.example'], {
    cwd: root,
    encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);

  assert.ok(gitignore.includes('.env'), '.gitignore must exclude local environment files');
  assert.deepEqual(trackedFiles, ['.env.example'], 'only .env.example may be tracked');
  assert.ok(fs.existsSync(path.join(root, '.env.example')), '.env.example must remain available for setup documentation');
});
