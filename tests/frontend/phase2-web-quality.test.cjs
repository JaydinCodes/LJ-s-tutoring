const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('programs and login routes expose the required form and heading semantics', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');
  const programsRoute = publicRoutes.slice(
    publicRoutes.indexOf('export function ProgramsRoute'),
    publicRoutes.indexOf('export function GuidesIndexRoute'),
  );
  const loginRoute = read('src/features/auth/LoginRoute.tsx');

  assert.match(programsRoute, /<h1[^>]*>CAPS tutoring programmes<\/h1>/);
  assert.match(programsRoute, /<h2[^>]*>\{title\}<\/h2>/);
  assert.match(loginRoute, /autoComplete="email"[^>]*name="email"/);
  assert.match(loginRoute, /autoComplete="current-password"[^>]*name="password"/);
});

test('unknown React routes render a useful not-found page instead of redirecting home', () => {
  const app = read('src/app/App.tsx');
  const notFound = read('src/app/routes/NotFoundRoute.tsx');
  const hostingContract = read('docs/release/NOT_FOUND_HOSTING.md');

  assert.match(app, /<Route path="\*" element=\{<NotFoundRoute \/>\} \/>/);
  assert.doesNotMatch(app, /<Route path="\*" element=\{<Navigate/);
  assert.match(notFound, /data-page-status="not-found"/);
  assert.match(notFound, /<h1[^>]*>Page not found<\/h1>/);
  assert.match(notFound, /to="\/programs"/);
  assert.match(notFound, /captureAppMessage\('not_found_route'/);
  assert.match(notFound, /featureArea: 'routing'/);
  assert.match(notFound, /action: 'not_found'/);
  assert.match(hostingContract, /cannot change its status code/);
  assert.match(hostingContract, /HTTP `404`/);
});

test('dashboard modal surfaces trap and restore focus, close with Escape, and inert the background', () => {
  const modalHook = read('src/hooks/useModalDialog.ts');
  const dashboard = read('src/components/dashboard/DashboardShell.tsx');
  const notifications = read('src/features/students/StudentNotificationsPanel.tsx');

  assert.match(modalHook, /event\.key === 'Escape'/);
  assert.match(modalHook, /event\.key !== 'Tab'/);
  assert.match(modalHook, /previouslyFocused\?\.focus\(\)/);
  assert.match(modalHook, /setAttribute\('inert', ''\)/);
  assert.match(modalHook, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(dashboard, /aria-haspopup="dialog"/);
  assert.match(dashboard, /aria-modal="true"/);
  assert.match(dashboard, /data-modal-initial-focus/);
  assert.match(dashboard, /data-modal-background/);
  assert.match(notifications, /export function NotificationDialog/);
  assert.match(notifications, /role="dialog"/);
  assert.doesNotMatch(notifications, /export function Notification(?:Sheet|Drawer)/);
});

test('sign-out failures stay visible and retryable, and the dead legacy bell is removed', () => {
  const dashboard = read('src/components/dashboard/DashboardShell.tsx');

  assert.match(dashboard, /setSignOutError\('We could not sign you out\./);
  assert.match(dashboard, /role="alert"/);
  assert.match(dashboard, /Try again/);
  assert.match(dashboard, /disabled=\{isSigningOut\}/);
  assert.doesNotMatch(dashboard, /aria-label="Dashboard alerts"/);
});

test('public media uses optimized sources and avoids costly hero video for constrained users', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');

  for (const asset of [
    'jaydin-morrison-20260812.webp',
    'nicholas-dreyer.webp',
    'liam-newton.webp',
    'logan-petrus.webp',
    'odysseus-hero-fallback.webp',
    'bg_video-optimized.mp4',
  ]) {
    assert.ok(publicRoutes.includes(asset), `${asset} must be referenced by the public route`);
  }

  assert.match(publicRoutes, /loading="lazy"/);
  assert.match(publicRoutes, /decoding="async"/);
  assert.match(publicRoutes, /connection\?\.saveData !== true/);
  assert.match(publicRoutes, /matchMedia\('\(min-width: 640px\)'\)/);
  assert.match(publicRoutes, /heroVideoEnabled \? \(/);
});

test('public enquiries and browser policy support the configured Formspree path', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');
  const envExample = read('.env.example');
  const buildStatic = read('scripts/build-static.js');
  const dataMap = read('docs/compliance/POPIA_DATA_MAP.md');

  assert.match(publicRoutes, /__PO_FORMSPREE_ENDPOINT__/);
  assert.match(publicRoutes, /fetch\(formspreeEndpoint/);
  assert.match(envExample, /FORMSPREE_ENDPOINT/);
  assert.match(dataMap, /Formspree/);
  assert.equal(fs.existsSync(path.join(root, '.github', 'workflows', 'formspree-healthcheck.yml')), false);
  assert.match(publicRoutes, /Your enquiry is sent securely to Project Odysseus/);
  assert.match(buildStatic, /form-action 'self'/);
  assert.match(buildStatic, /https:\/\/\*\.ingest\.sentry\.io/);
  assert.match(buildStatic, /https:\/\/formspree\.io/);
});

test('AI processor disclosure matches the careers payload sent to Groq', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');
  const careersRoute = read('src/features/students/StudentCareersRoute.tsx');
  const dataMap = read('docs/compliance/POPIA_DATA_MAP.md');

  assert.match(careersRoute, /\.slice\(-8\)/);
  for (const field of ['interests', 'preferred subjects', 'saved careers', 'APS target']) {
    const pattern = new RegExp(field.toLowerCase().replaceAll(' ', '\\s+'));
    assert.match(publicRoutes.toLowerCase(), pattern);
    assert.match(dataMap.toLowerCase(), pattern);
  }
  assert.match(publicRoutes, /careers-profile details shown in Odie \(interests, preferred\s+subjects, saved careers, and APS target\).*third-party AI provider Groq/s);
  assert.match(publicRoutes, /third-party AI provider Groq/);
  assert.match(dataMap, /Current careers-chat question, up to eight preceding messages/);
});

test('public copy avoids migration language and unsupported marketing statistics', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');
  const buildStatic = read('scripts/build-static.js');
  const publicCopy = `${publicRoutes}\n${buildStatic}`;

  for (const unsupportedCopy of [
    'React LMS workflow',
    'LMS migration',
    'during the migration',
    'legacy landing page',
    '100+',
    '98%',
    'CAPS grades covered',
  ]) {
    assert.equal(publicCopy.includes(unsupportedCopy), false, `${unsupportedCopy} must not appear in public copy`);
  }
});

test('major route modules load through real production code-split boundaries', () => {
  const app = read('src/app/App.tsx');
  const viteConfig = read('vite.app.config.ts');
  const buildStatic = read('scripts/build-static.js');
  const performanceBudget = read('scripts/check-frontend-performance-budget.cjs');
  const performanceDocs = read('docs/performance/frontend-dashboard-budget.md');

  assert.match(app, /import \{ lazy, Suspense \} from 'react'/);
  assert.match(app, /lazy\(\(\) => import\('\.\/routes\/PublicRoutes'\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\.\/features\/students\/StudentDashboardRoute'\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\.\/features\/admin\/AdminDashboardRoute'\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\.\/features\/tutors\/TutorDashboardRoute'\)/);
  assert.match(app, /<Suspense fallback=\{<RouteLoadingFallback \/>\}>/);
  assert.match(viteConfig, /formats: \['es'\]/);
  assert.match(viteConfig, /preserveEntrySignatures: false/);
  assert.match(viteConfig, /entryFileNames: 'react-app-\[hash\]\.js'/);
  assert.match(viteConfig, /chunkFileNames: 'chunks\/\[name\]-\[hash\]\.js'/);
  assert.match(buildStatic, /<script type="module" src="\/react-app-dist\/\$\{reactAppJsFile\}"/);
  assert.match(performanceBudget, /assertSizeIfBuiltPath\(findHashedReactAppAsset\(reactAppDistDir, '\.js'\), 'react-app-dist\/react-app-<hash>\.js', 1_450_000\)/);
  assert.match(performanceBudget, /assertGeneratedJsBudget\('react-app-dist', 2_700_000, 150_000\)/);
  assert.match(performanceDocs, /eager entry: 1,365,990 bytes/);
  assert.match(performanceDocs, /all generated JavaScript: 2,582,900 bytes across 48 files/);
});
