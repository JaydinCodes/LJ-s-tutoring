const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const publicRoutes = [
  'https://projectodysseus.live/',
  'https://projectodysseus.live/about/',
  'https://projectodysseus.live/guides/',
  'https://projectodysseus.live/guides/matric-maths-mistakes-guide/',
  'https://projectodysseus.live/privacy/',
  'https://projectodysseus.live/terms/',
];

test('sitemap exposes current public React routes without portal pages', () => {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

  for (const route of publicRoutes) {
    assert.ok(sitemap.includes(`<loc>${route}</loc>`), `${route} must be present in sitemap.xml`);
  }

  for (const privatePath of ['/login', '/dashboard', '/student', '/tutor', '/admin', '/onboarding', '/reports']) {
    assert.ok(!sitemap.includes(`projectodysseus.live${privatePath}`), `${privatePath} must not be present in sitemap.xml`);
  }

  assert.ok(!sitemap.includes('.html'), 'sitemap.xml must use canonical route URLs');
});

test('robots.txt points crawlers to the sitemap and blocks portal route families', () => {
  const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');

  assert.ok(robots.includes('Sitemap: https://projectodysseus.live/sitemap.xml'), 'robots.txt must reference sitemap.xml');

  for (const privatePath of ['/admin', '/dashboard', '/student', '/tutor', '/onboarding', '/reports', '/login', '/api']) {
    assert.ok(robots.includes(`Disallow: ${privatePath}`), `${privatePath} must be disallowed in robots.txt`);
  }
});

test('static build copies sitemap.xml and robots.txt into the release output', () => {
  const buildStatic = fs.readFileSync(path.join(root, 'scripts', 'build-static.js'), 'utf8');

  assert.ok(buildStatic.includes("'robots.txt'"), 'build-static.js must copy robots.txt');
  assert.ok(buildStatic.includes("'sitemap.xml'"), 'build-static.js must copy sitemap.xml');
});
