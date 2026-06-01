const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const buildVersion = process.env.RELEASE_VERSION || process.env.GITHUB_SHA || String(Date.now());
const safeBuildVersion = `po-v-${buildVersion}`.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);

const copyTargets = [
  'sw.js',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
  'react-app-dist',
  'images',
];

const assetCopyTargets = [
  'analytics.js',
  'analytics-module.js',
  'portal-config.js',
  'sw-register.js',
  'tailwind-input.css',
  path.join('lib', 'sanitize.js'),
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

for (const target of assetCopyTargets) {
  const source = path.join(root, 'assets', target);
  if (!fs.existsSync(source)) {
    continue;
  }
  const destination = path.join(dist, 'assets', target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

const reactDashboardRoutes = [
  '',
  'login',
  'about',
  'programs',
  'guides',
  'guides/matric-maths-mistakes-guide',
  'privacy',
  'terms',
  'admin/login',
  'student',
  'student/login',
  'tutor/login',
  'tutor/dashboard',
  'reports',
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
  'dashboard/admin/payroll',
  'dashboard/admin/reconciliation',
  'dashboard/admin/reports',
  'dashboard/admin/results',
  'dashboard/admin/audit',
  'dashboard/admin/privacy-requests',
  'dashboard/admin/retention',
  'dashboard/admin/ops-runbook',
  'dashboard/tutor',
  'dashboard/tutor/classes',
  'dashboard/tutor/sessions',
  'dashboard/tutor/submissions',
  'dashboard/tutor/reports',
  'dashboard/tutor/risk',
];

const routeMeta = {
  '': {
    title: 'Maths Tutoring Cape Town and South Africa',
    description: 'Project Odysseus provides Grade 8-12 CAPS Mathematics tutoring for Cape Town and South African learners, with a React LMS for assignments, progress, reporting, and NGO rollout.',
  },
  about: {
    title: 'About Project Odysseus',
    description: 'Learn about Project Odysseus maths tutoring and the React LMS migration supporting students, tutors, admins, parents, and NGO partners.',
  },
  programs: {
    title: 'Grade 8-12 Maths Programs',
    description: 'CAPS Mathematics tutoring programs for Grade 8-12 learners, matric exam preparation, and NGO learner rollout support.',
  },
  guides: {
    title: 'Learning Guides',
    description: 'Practical Project Odysseus maths learning guides for Grade 8-12 learners and families.',
  },
  'guides/matric-maths-mistakes-guide': {
    title: 'Matric Maths Mistakes Guide',
    description: 'A concise Grade 12 maths guide for avoiding common exam mistakes and improving revision consistency.',
  },
  privacy: {
    title: 'Privacy',
    description: 'Project Odysseus privacy information for tutoring operations, learner data, tutor workflows, and portal access.',
  },
  terms: {
    title: 'Terms',
    description: 'Project Odysseus terms for tutoring services, learning workflows, portal access, and role-based LMS features.',
  },
};

function titleFromRoute(route) {
  const title = routeMeta[route]?.title || route
    .split('/')
    .slice(route.startsWith('dashboard/') ? 1 : 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return title || 'Project Odysseus';
}

function reactShell(route) {
  const title = titleFromRoute(route);
  const meta = routeMeta[route];
  const isProtected = route.startsWith('dashboard/') || route.startsWith('onboarding/');
  const canonicalPath = route ? (route.endsWith('/') ? route : `${route}/`) : '';
  const robots = isProtected
    ? '    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">\n'
    : '    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">\n';
  const description = meta
    ? `    <meta name="description" content="${meta.description}">\n`
    : '';
  const canonical = meta
    ? `    <link rel="canonical" href="https://projectodysseus.live/${canonicalPath}">\n`
    : '';
  const publicScripts = isProtected
    ? ''
    : `    <script defer src="/assets/portal-config.js"></script>
    <script defer src="/assets/analytics.js"></script>
    <script defer src="/assets/sw-register.js"></script>
`;
  const openGraph = meta
    ? `    <meta property="og:type" content="website">
    <meta property="og:title" content="${meta.title} | Project Odysseus">
    <meta property="og:description" content="${meta.description}">
    <meta property="og:url" content="https://projectodysseus.live/${canonicalPath}">
    <meta property="og:image" content="https://projectodysseus.live/images/og-image-placeholder.svg">
    <meta name="twitter:card" content="summary_large_image">
`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Project Odysseus LMS</title>
${description}${robots}${canonical}${openGraph}    <meta name="theme-color" content="#0f172a">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/react-app-dist/react-app.css?v=${safeBuildVersion}">
${publicScripts}
  </head>
  <body>
    <div id="root"></div>
    <script src="/react-app-dist/react-app.js?v=${safeBuildVersion}"></script>
  </body>
</html>
`;
}

for (const route of reactDashboardRoutes) {
  const routeDir = route ? path.join(dist, ...route.split('/')) : dist;
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), reactShell(route));
}

const compatibilityHtmlFiles = [
  'dashboard/login.html',
];

for (const file of compatibilityHtmlFiles) {
  const filePath = path.join(dist, ...file.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, reactShell(file.replace(/\.html$/, '')));
}

const swPath = path.join(dist, 'sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8').replace('const VERSION = "po-v-dev";', `const VERSION = "${safeBuildVersion}";`);
  fs.writeFileSync(swPath, sw);
}

process.stdout.write('Static site copied to dist/.\n');
