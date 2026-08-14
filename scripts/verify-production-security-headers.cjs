const { randomUUID } = require('node:crypto');

const requiredOrigins = (process.env.PRODUCTION_ORIGINS || '')
  .split(',')
  .map((value) => value.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function fail(origin, message) {
  throw new Error(`${origin}: ${message}`);
}

function requireDirective(origin, csp, directive, expectedValue) {
  const value = csp.match(new RegExp(`(?:^|;)\\s*${directive}\\s+([^;]+)`, 'i'))?.[1] || '';
  if (!value.includes(expectedValue)) {
    fail(origin, `Content-Security-Policy must contain ${directive} ${expectedValue}`);
  }
  return value;
}

async function verifyOrigin(origin) {
  const url = new URL(`${origin}/`);
  // Header transforms are edge-local. A unique probe URL guarantees this check
  // observes the currently deployed policy instead of an older cached shell.
  url.searchParams.set('__security_header_probe', randomUUID());
  if (url.protocol !== 'https:') {
    fail(origin, 'must use HTTPS');
  }

  let response = await fetch(url, {
    headers: { 'cache-control': 'no-cache' },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      fail(origin, `redirected with HTTP ${response.status} but no Location header`);
    }
    const redirectUrl = new URL(location, url);
    if (redirectUrl.origin !== url.origin) {
      fail(origin, `redirected outside the production origin to ${redirectUrl.origin}`);
    }
    response = await fetch(redirectUrl, {
      headers: { 'cache-control': 'no-cache' },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
  }
  if (!response.ok) {
    fail(origin, `returned HTTP ${response.status}`);
  }
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('text/html')) {
    fail(origin, 'root response must be HTML');
  }

  const xFrameOptions = response.headers.get('x-frame-options') || '';
  if (xFrameOptions.toUpperCase() !== 'DENY') {
    fail(origin, 'X-Frame-Options must be DENY');
  }
  if ((response.headers.get('x-content-type-options') || '').toLowerCase() !== 'nosniff') {
    fail(origin, 'X-Content-Type-Options must be nosniff');
  }

  const hsts = response.headers.get('strict-transport-security') || '';
  const maxAge = Number(hsts.match(/max-age=(\d+)/i)?.[1] || 0);
  if (maxAge < 31_536_000 || !/includesubdomains/i.test(hsts)) {
    fail(origin, 'Strict-Transport-Security must have max-age >= 31536000 and includeSubDomains');
  }

  const csp = response.headers.get('content-security-policy') || '';
  requireDirective(origin, csp, 'default-src', "'self'");
  const scriptSrc = requireDirective(origin, csp, 'script-src', "'self'");
  if (!/'nonce-[A-Za-z0-9_-]+'/.test(scriptSrc) || /'unsafe-inline'/.test(scriptSrc)) {
    fail(origin, 'script-src must allow a nonce and must not allow unsafe-inline');
  }
  requireDirective(origin, csp, 'object-src', "'none'");
  requireDirective(origin, csp, 'base-uri', "'self'");
  requireDirective(origin, csp, 'form-action', "'self'");
  requireDirective(origin, csp, 'frame-ancestors', "'none'");

  process.stdout.write(`Verified production security headers: ${origin}\n`);
}

async function main() {
  if (requiredOrigins.length === 0) {
    throw new Error('PRODUCTION_ORIGINS is required (comma-separated HTTPS production origins).');
  }
  await Promise.all(requiredOrigins.map(verifyOrigin));
}

main().catch((error) => {
  console.error(`Production security header probe failed: ${error.message}`);
  process.exitCode = 1;
});
