const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const htmlAssetPattern = /<(?:link|script)\b[^>]*(?:href|src)=["']([^"']+)["'][^>]*>/gi;
const jsImportPattern = /\bimport\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const checked = new Set();
const missing = [];

function walkFiles(dir, extension) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath, extension);
    }
    return entry.isFile() && fullPath.endsWith(extension) ? [fullPath] : [];
  });
}

function isLocalReference(value) {
  return (
    value &&
    !value.startsWith('#') &&
    !value.startsWith('data:') &&
    !value.startsWith('mailto:') &&
    !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)
  );
}

function stripQueryAndHash(value) {
  return value.split(/[?#]/, 1)[0];
}

function resolveDistReference(fromFile, reference) {
  const cleanReference = stripQueryAndHash(reference);
  if (!isLocalReference(cleanReference)) {
    return null;
  }

  if (cleanReference.startsWith('/')) {
    return path.join(dist, cleanReference.slice(1));
  }

  return path.resolve(path.dirname(fromFile), cleanReference);
}

function recordMissing(fromFile, reference, resolvedPath) {
  missing.push({
    from: path.relative(root, fromFile),
    reference,
    expected: path.relative(root, resolvedPath),
  });
}

function checkReference(fromFile, reference) {
  const resolvedPath = resolveDistReference(fromFile, reference);
  if (!resolvedPath) {
    return;
  }

  if (!resolvedPath.startsWith(dist)) {
    recordMissing(fromFile, reference, resolvedPath);
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    recordMissing(fromFile, reference, resolvedPath);
    return;
  }

  if (resolvedPath.endsWith('.js')) {
    checkJavaScriptFile(resolvedPath);
  }
}

function checkJavaScriptFile(filePath) {
  if (checked.has(filePath)) {
    return;
  }
  checked.add(filePath);

  if (filePath.includes(`${path.sep}student-app-dist${path.sep}`)) {
    return;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(jsImportPattern)) {
    checkReference(filePath, match[1] || match[2]);
  }
}

function checkHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  for (const match of html.matchAll(htmlAssetPattern)) {
    checkReference(filePath, match[1]);
  }
}

if (!fs.existsSync(dist)) {
  throw new Error('dist/ does not exist. Run the static build before verification.');
}

for (const htmlFile of walkFiles(dist, '.html')) {
  checkHtmlFile(htmlFile);
}

if (missing.length > 0) {
  const details = missing
    .map((item) => `- ${item.from} references ${item.reference}; expected ${item.expected}`)
    .join('\n');
  process.stderr.write(`Missing static assets:\n${details}\n`);
  process.exit(1);
}

process.stdout.write('Static asset references verified.\n');
