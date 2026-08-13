const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('production releases deploy the Worker and invite users back to this app', () => {
  const deployment = read('.github', 'workflows', 'deploy-production.yml');
  const inviteFunction = read('supabase', 'functions', 'admin-invite-user', 'index.ts');

  assert.match(deployment, /Deploy Cloudflare security edge/);
  assert.match(deployment, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(deployment, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(deployment, /vars\.CLOUDFLARE_ORIGIN_URL/);
  assert.match(deployment, /wrangler@4 deploy --config cloudflare\/wrangler\.toml/);
  assert.match(deployment, /Verify live React module graph/);
  assert.match(deployment, /verify-live-react-assets\.cjs/);
  assert.match(inviteFunction, /Deno\.env\.get\('APP_INVITE_REDIRECT_URL'\)/);
  assert.match(inviteFunction, /Deno\.env\.get\('SUPABASE_INVITE_REDIRECT_URL'\)/);
});
