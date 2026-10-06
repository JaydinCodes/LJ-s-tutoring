const { spawnSync } = require('node:child_process');

const maxAttempts = 3;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = spawnSync(
    'npx',
    ['supabase', 'start'],
    {
      shell: process.platform === 'win32',
      stdio: 'inherit',
    },
  );

  if (result.status === 0) {
    process.exit(0);
  }

  if (attempt < maxAttempts) {
    console.error(`Local Supabase failed to start; retrying (${attempt}/${maxAttempts}).`);
  }
}

process.exitCode = 1;
