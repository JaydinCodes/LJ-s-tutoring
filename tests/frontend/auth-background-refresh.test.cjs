const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const authProviderPath = path.resolve(
  __dirname,
  '..',
  '..',
  'src',
  'features',
  'auth',
  'AuthProvider.tsx',
);

test('settled auth checks stay in the background and preserve mounted route state', () => {
  const source = fs.readFileSync(authProviderPath, 'utf8');

  assert.match(source, /if \(!hasResolvedInitialAuth\.current\) \{[\s\S]*loading: true/);
  assert.match(source, /if \(hasResolvedInitialAuth\.current\) \{[\s\S]*setState\(\(current\) => \(\{[\s\S]*\.\.\.current,[\s\S]*loading: false/);
  assert.doesNotMatch(
    source,
    /onAuthStateChange\(\(\) => \{[\s\S]*setTimeout\(\(\) => void refresh\(\), 0\)/,
    'auth events must not blindly force every route back through blocking access UI',
  );
});

test('auth events update the session without remounting forms and sign-out clears access immediately', () => {
  const source = fs.readFileSync(authProviderPath, 'utf8');

  assert.match(source, /onAuthStateChange\(\(event, session\) =>/);
  assert.match(source, /if \(event === 'SIGNED_OUT'\) \{[\s\S]*status: 'unauthenticated'/);
  assert.match(source, /if \(session\) \{[\s\S]*\.\.\.current,[\s\S]*session,/);
  assert.match(source, /if \(event !== 'INITIAL_SESSION'\) \{[\s\S]*scheduleBackgroundRefresh\(\)/);
  assert.match(source, /if \(refreshId !== latestRefreshId\.current\) \{/);
  assert.match(source, /const identityChanged =[\s\S]*activeAuthUserId\.current !== session\.user\.id/);
  assert.match(source, /if \(identityChanged\) \{[\s\S]*profile: null,[\s\S]*status: 'loading'/);
});
