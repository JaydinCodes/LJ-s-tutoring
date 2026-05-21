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

const swPath = path.join(dist, 'sw.js');
if (fs.existsSync(swPath)) {
  const version = process.env.RELEASE_VERSION || process.env.GITHUB_SHA || String(Date.now());
  const safeVersion = `po-v-${version}`.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  const sw = fs.readFileSync(swPath, 'utf8').replace('const VERSION = "po-v-dev";', `const VERSION = "${safeVersion}";`);
  fs.writeFileSync(swPath, sw);
}

process.stdout.write('Static site copied to dist/.\n');
