const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSizeIfBuilt(relativePath, maxBytes) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`[perf-budget] skipped size check for missing ${relativePath}`);
    return;
  }
  const size = fs.statSync(filePath).size;
  assert(size <= maxBytes, `${relativePath} is ${size} bytes, above budget ${maxBytes}`);
  console.log(`[perf-budget] ${relativePath}: ${size}/${maxBytes} bytes`);
}

// react-app.js/.css are content-hashed by Vite (react-app-<hash>.{js,css}, see
// vite.app.config.ts), so the filename isn't known ahead of build time.
function findHashedReactAppAsset(directory, extension) {
  if (!fs.existsSync(directory)) {
    return null;
  }
  const match = fs.readdirSync(directory).find((f) => f.startsWith('react-app-') && f.endsWith(extension));
  return match ? path.join(directory, match) : null;
}

function assertSizeIfBuiltPath(filePath, label, maxBytes) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(`[perf-budget] skipped size check for missing ${label}`);
    return;
  }
  const size = fs.statSync(filePath).size;
  assert(size <= maxBytes, `${label} is ${size} bytes, above budget ${maxBytes}`);
  console.log(`[perf-budget] ${label}: ${size}/${maxBytes} bytes`);
}

function assertCombinedSize(relativePaths, maxBytes, label) {
  const files = relativePaths.map((relativePath) => ({
    relativePath,
    filePath: path.join(root, relativePath),
  }));
  const missing = files.filter(({ filePath }) => !fs.existsSync(filePath));
  assert(missing.length === 0, `${label} is missing: ${missing.map(({ relativePath }) => relativePath).join(', ')}`);
  const size = files.reduce((total, { filePath }) => total + fs.statSync(filePath).size, 0);
  assert(size <= maxBytes, `${label} is ${size} bytes, above budget ${maxBytes}`);
  console.log(`[perf-budget] ${label}: ${size}/${maxBytes} bytes`);
}

function collectFiles(directory, predicate) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath, predicate));
    } else if (predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files;
}

function assertGeneratedJsBudget(relativeDirectory, maxTotalBytes, maxAsyncChunkBytes) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) {
    console.log(`[perf-budget] skipped generated JS check for missing ${relativeDirectory}`);
    return;
  }

  const jsFiles = collectFiles(directory, (filePath) => filePath.endsWith('.js'));
  assert(jsFiles.length > 1, `${relativeDirectory} must contain a code-split entry and async chunks`);

  const totalBytes = jsFiles.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
  const asyncChunks = jsFiles.filter((filePath) => !/^react-app-.+\.js$/.test(path.basename(filePath)));
  const largestAsyncChunk = Math.max(...asyncChunks.map((filePath) => fs.statSync(filePath).size));

  assert(totalBytes <= maxTotalBytes, `${relativeDirectory} generated JS is ${totalBytes} bytes, above total budget ${maxTotalBytes}`);
  assert(largestAsyncChunk <= maxAsyncChunkBytes, `${relativeDirectory} largest async chunk is ${largestAsyncChunk} bytes, above budget ${maxAsyncChunkBytes}`);
  console.log(`[perf-budget] generated JS: ${totalBytes}/${maxTotalBytes} bytes across ${jsFiles.length} files`);
  console.log(`[perf-budget] largest async chunk: ${largestAsyncChunk}/${maxAsyncChunkBytes} bytes`);
}

const queries = read('src', 'features', 'students', 'studentQueries.ts');
const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
const motion = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');
const docs = read('docs', 'performance', 'frontend-dashboard-budget.md');

assert(queries.includes('DEFAULT_STUDENT_STALE_TIME_MS = 60_000'), 'student queries must define a dashboard stale-time budget');
assert(queries.includes('refetchOnWindowFocus: false'), 'student queries must avoid focus-triggered dashboard refetches');
assert(queries.includes('refetchOnReconnect: false'), 'student queries must avoid reconnect-triggered dashboard refetches');
assert(queries.includes('exact: true'), 'assignment mutations must invalidate only the affected dashboard query');
// NOTE: the old Fastify API bounded result-list queries (LIMIT 24/100). The
// Supabase-native dashboard queries have no equivalent .limit() call -- a
// known, unaddressed gap at pilot scale, not checked here.
assert(shell.includes("from 'lucide-react'"), 'dashboard icons must stay tree-shakable through Lucide imports');
assert(motion.includes('useReducedMotion'), 'route/card motion must honor reduced-motion preferences');
assert(motion.includes('transformOrigin'), 'progress animation must use transform-based tracks');
assert(docs.includes('Lighthouse before'), 'Lighthouse before score must be tracked in docs');
assert(docs.includes('Lighthouse after'), 'Lighthouse after score must be tracked in docs');

const reactAppDistDir = path.join(root, 'react-app-dist');
// The clean production build is currently 1,432,503 bytes. Keep a modest,
// explicit margin for deterministic bundler/version variance while preserving
// a hard ceiling that catches a meaningful entry-bundle regression.
assertSizeIfBuiltPath(findHashedReactAppAsset(reactAppDistDir, '.js'), 'react-app-dist/react-app-<hash>.js', 1_455_000);
assertGeneratedJsBudget('react-app-dist', 2_700_000, 150_000);
assertSizeIfBuiltPath(findHashedReactAppAsset(reactAppDistDir, '.css'), 'react-app-dist/react-app-<hash>.css', 90_000);
assertSizeIfBuilt('images/odysseus-hero-fallback.webp', 150_000);
assertSizeIfBuilt('images/bg_video-optimized.mp4', 1_000_000);
assertCombinedSize([
  'images/jaydin-morrison.webp',
  'images/nicholas-dreyer.webp',
  'images/liam-newton.webp',
  'images/logan-petrus.webp',
], 500_000, 'tutor portraits');

console.log('[perf-budget] frontend performance budget checks passed');
