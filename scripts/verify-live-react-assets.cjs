/*
 * Confirms that the published portal shell and every JavaScript module it
 * references are available as real static assets. Static-site catch-all
 * documents otherwise turn a missing chunk into a 200 HTML response, which
 * browsers report only later as a misleading dynamic-import MIME error.
 */
const origins = (process.env.PRODUCTION_ORIGINS || '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (origins.length === 0) {
  throw new Error('PRODUCTION_ORIGINS must contain the production site origins.');
}

const portalOrigins = origins.filter((origin) => /:\/\/(?:admin|tutor|student)\.projectodysseus\.live$/i.test(origin));
if (portalOrigins.length === 0) {
  throw new Error('PRODUCTION_ORIGINS must include at least one portal origin.');
}

const moduleReference = /(?:import\s*\(|from\s*)["']([^"']+\.js)["']/g;
const shellModule = /<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+\.js)["']/i;
const shellStyle = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)["']/i;

function contentType(response) {
  return (response.headers.get('content-type') || '').toLowerCase();
}

async function requireAsset(url, expectedType) {
  const response = await fetch(url, { redirect: 'error', headers: { accept: expectedType } });
  if (!response.ok || !contentType(response).startsWith(expectedType)) {
    throw new Error(`${url} returned ${response.status} ${contentType(response) || '(no content type)'}`);
  }
  return response.text();
}

async function verifyPortal(origin) {
  const shell = await requireAsset(`${origin}/dashboard/student/`, 'text/html');
  const entry = shell.match(shellModule)?.[1];
  const style = shell.match(shellStyle)?.[1];
  if (!entry || !style) throw new Error(`${origin} dashboard shell does not reference its React entry and stylesheet.`);

  await requireAsset(new URL(style, origin).toString(), 'text/css');
  const pending = [new URL(entry, origin).toString()];
  const checked = new Set();

  while (pending.length > 0) {
    const moduleUrl = pending.pop();
    if (checked.has(moduleUrl)) continue;
    checked.add(moduleUrl);
    const source = await requireAsset(moduleUrl, 'text/javascript');
    for (const match of source.matchAll(moduleReference)) {
      const child = new URL(match[1], moduleUrl);
      if (child.origin === origin && child.pathname.startsWith('/react-app-dist/')) pending.push(child.toString());
    }
  }

  process.stdout.write(`Verified ${checked.size} React modules on ${origin}.\n`);
}

Promise.all(portalOrigins.map(verifyPortal)).catch((error) => {
  process.stderr.write(`Live React asset verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
