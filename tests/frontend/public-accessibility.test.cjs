const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('FAQ accordion exposes ARIA state and respects reduced motion', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');

  assert.match(publicRoutes, /function FaqItem/);
  assert.match(publicRoutes, /aria-controls=\{answerId\}/);
  assert.match(publicRoutes, /aria-expanded=\{isOpen\}/);
  assert.match(publicRoutes, /aria-labelledby=\{questionId\}/);
  assert.match(publicRoutes, /role="region"/);
  assert.match(publicRoutes, /motion-reduce:transition-none/);
});

test('public navigation has an accessible mobile drawer and visible keyboard focus', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');
  const tailwind = read('src/styles/tailwind.css');

  assert.match(publicRoutes, /id="public-mobile-menu"/);
  assert.match(publicRoutes, /aria-controls="public-mobile-menu"/);
  assert.match(publicRoutes, /aria-expanded=\{isMenuOpen\}/);
  assert.match(publicRoutes, /Open navigation menu/);
  assert.match(publicRoutes, /event\.key === 'Escape'/);
  assert.match(publicRoutes, /md:hidden/);
  assert.match(tailwind, /:focus-visible/);
  assert.match(tailwind, /outline: 2px solid theme\('colors\.brand\.gold'\)/);
});

test('hero, tutor images, and enquiry form carry accessibility improvements', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');

  assert.match(publicRoutes, /object-cover[^"]*opacity-35/);
  assert.match(publicRoutes, /rgba\(15,23,42,0\.62\)_100%/);
  assert.match(publicRoutes, /alt=\{`\$\{tutor\.name\}, \$\{tutor\.role\} for \$\{tutor\.subject\}`\}/);
  assert.match(publicRoutes, /aria-describedby="enquiry-helper"/);
  assert.match(publicRoutes, /id="enquiry-status"/);
  assert.match(publicRoutes, /aria-live="polite"/);
  assert.match(publicRoutes, /autoComplete="name"/);
  assert.match(publicRoutes, /autoComplete="email"/);
});
