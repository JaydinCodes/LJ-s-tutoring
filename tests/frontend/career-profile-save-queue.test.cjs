const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');

function loadQueueFactory() {
  const source = fs.readFileSync(path.join(root, 'src', 'features', 'students', 'careerProfileSaveQueue.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  Function('exports', 'module', 'require', output)(module.exports, module, require);
  return module.exports.createCareerProfileSaveQueue;
}

test('career profile saves execute sequentially even when edits are queued rapidly', async () => {
  const enqueue = loadQueueFactory()();
  const order = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

  const first = enqueue(async () => {
    order.push('first:start');
    await firstGate;
    order.push('first:end');
    return 'first';
  });
  const second = enqueue(async () => {
    order.push('second:start');
    order.push('second:end');
    return 'second';
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['first:start']);
  releaseFirst();
  assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('a rejected profile save does not block the next queued edit', async () => {
  const enqueue = loadQueueFactory()();
  await assert.rejects(enqueue(async () => { throw new Error('save failed'); }), /save failed/);
  assert.equal(await enqueue(async () => 'newest profile'), 'newest profile');
});
