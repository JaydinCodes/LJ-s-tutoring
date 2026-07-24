const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('architecture docs identify the active app and Supabase-first ownership model', () => {
  const architecture = read('docs/architecture/ARCHITECTURE.md');

  assert.match(architecture, /Active app: `src\/` is the unified React/);
  assert.match(architecture, /Supabase Auth is the source of truth for browser identity/);
  assert.match(architecture, /`docs\/supabase\/schema\.sql`/);
  assert.match(architecture, /Direct Supabase browser calls are acceptable only when RLS fully protects/);
  assert.match(architecture, /Sensitive operations must use RPC or trusted backend code/);
  assert.match(architecture, /`student-app\/` is inactive reference material/);
});

test('architecture docs confirm lms-api retirement and document required diagrams', () => {
  const architecture = read('docs/architecture/ARCHITECTURE.md');

  assert.match(architecture, /`lms-api\/` \(Fastify \+ Prisma\) was fully retired/);
  assert.match(architecture, /Browser-protected routes use Supabase session\/profile state/);
  assert.match(architecture, /sequenceDiagram[\s\S]*getAuthenticatorAssuranceLevel/);
  assert.match(architecture, /sequenceDiagram[\s\S]*submit_assignment_submission/);
  assert.match(architecture, /sequenceDiagram[\s\S]*mark_assignment_submission/);
  assert.match(architecture, /POPIA/);
});
