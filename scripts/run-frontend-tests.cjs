const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testDirectory = path.resolve(__dirname, '..', 'tests', 'frontend');
const testFiles = fs.readdirSync(testDirectory)
  .filter((name) => name.endsWith('.test.cjs'))
  .sort()
  .map((name) => path.join(testDirectory, name));

if (testFiles.length === 0) {
  throw new Error(`No frontend tests found in ${testDirectory}`);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
