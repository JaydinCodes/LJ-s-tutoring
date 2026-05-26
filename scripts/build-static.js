const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const copyTargets = [
  'index.html',
  'login.html',
  'privacy.html',
  'terms.html',
  'sw.js',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
  'assets',
  'student',
  'student-app-dist',
  'react-app-dist',
  'dashboard',
  'reports',
  'guides',
  'tutor',
  'admin',
  'images',
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const target of copyTargets) {
  const source = path.join(root, target);
  if (!fs.existsSync(source)) {
    continue;
  }
  const destination = path.join(dist, target);
  fs.cpSync(source, destination, { recursive: true });
}

const reactDashboardRoutes = [
  'about',
  'programs',
  'privacy',
  'terms',
  'onboarding/student',
  'onboarding/tutor',
  'dashboard/login',
  'dashboard/student',
  'dashboard/student/assignments',
  'dashboard/student/progress',
  'dashboard/student/results',
  'dashboard/student/careers',
  'dashboard/student/reports',
  'dashboard/student/community',
  'dashboard/admin',
  'dashboard/admin/students',
  'dashboard/admin/tutors',
  'dashboard/admin/assignments',
  'dashboard/admin/approvals',
  'dashboard/admin/payments',
  'dashboard/admin/reconciliation',
  'dashboard/admin/reports',
  'dashboard/admin/results',
  'dashboard/admin/audit',
  'dashboard/admin/privacy-requests',
  'dashboard/admin/retention',
  'dashboard/admin/ops-runbook',
  'dashboard/tutor',
  'dashboard/tutor/classes',
  'dashboard/tutor/submissions',
];

function reactShell(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Project Odysseus LMS</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/react-app-dist/react-app.css">
  </head>
  <body>
    <div id="root"></div>
    <script src="/react-app-dist/react-app.js"></script>
  </body>
</html>
`;
}

for (const route of reactDashboardRoutes) {
  const routeDir = path.join(dist, ...route.split('/'));
  fs.mkdirSync(routeDir, { recursive: true });
  const title = route
    .split('/')
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  fs.writeFileSync(path.join(routeDir, 'index.html'), reactShell(title));
}

const swPath = path.join(dist, 'sw.js');
if (fs.existsSync(swPath)) {
  const version = process.env.RELEASE_VERSION || process.env.GITHUB_SHA || String(Date.now());
  const safeVersion = `po-v-${version}`.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  const sw = fs.readFileSync(swPath, 'utf8').replace('const VERSION = "po-v-dev";', `const VERSION = "${safeVersion}";`);
  fs.writeFileSync(swPath, sw);
}

process.stdout.write('Static site copied to dist/.\n');
