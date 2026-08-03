const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const sourceRoot = path.join(root, 'src');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

test('active React sources do not introduce raw HTML rendering paths', () => {
  const riskySources = sourceFiles(sourceRoot)
    .filter((file) => fs.readFileSync(file, 'utf8').includes('dangerouslySetInnerHTML'))
    .map((file) => path.relative(root, file).replaceAll('\\', '/'));

  assert.deepEqual(riskySources, ['src/components/seo/StructuredData.tsx']);

  const allSources = sourceFiles(sourceRoot)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert.doesNotMatch(allSources, /\.innerHTML\s*=|insertAdjacentHTML|createContextualFragment/);
});

test('the sole JSON-LD raw HTML boundary escapes opening angle brackets', () => {
  const structuredData = fs.readFileSync(path.join(sourceRoot, 'components', 'seo', 'StructuredData.tsx'), 'utf8');

  assert.match(structuredData, /JSON\.stringify\(data\)/);
  assert.match(structuredData, /\.replace\(\/<\/g, [^)]*u003c/);
  assert.match(structuredData, /type="application\/ld\+json"/);
});
