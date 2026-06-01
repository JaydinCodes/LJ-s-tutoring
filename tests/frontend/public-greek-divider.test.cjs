const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('Greek divider is a subtle reusable inline SVG without external assets', () => {
  const divider = read('src/components/ui/GreekDivider.tsx');

  assert.match(divider, /<svg/);
  assert.match(divider, /<pattern/);
  assert.match(divider, /opacity-\[0\.14\]/);
  assert.match(divider, /aria-hidden="true"/);
  assert.match(divider, /useId/);
  assert.doesNotMatch(divider, /(?:src|href)=["'][^"']+["']/);
});

test('public home route uses Greek dividers at selected major transitions', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');
  const placements = publicRoutes.match(/<GreekDivider\b/g) || [];

  assert.equal(placements.length, 4);
  assert.ok(publicRoutes.includes('<GreekDivider background="parchment" tone="gold" />'));
  assert.ok(publicRoutes.includes('<GreekDivider background="white" />'));
  assert.ok(publicRoutes.includes('<GreekDivider background="white" tone="gold" />'));
  assert.ok(publicRoutes.includes('<GreekDivider background="slate" tone="gold" />'));
});
