const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const workerUrl = pathToFileURL(
  path.resolve(__dirname, '../../cloudflare/src/worker.mjs'),
).href;

async function loadWorker() {
  return import(`${workerUrl}?test=${Date.now()}-${Math.random()}`);
}

test('Cloudflare Worker marks CSP-nonce-bearing HTML as non-cacheable', async () => {
  const originalFetch = global.fetch;
  const originalHtmlRewriter = global.HTMLRewriter;

  global.fetch = async () => new Response('<!doctype html><head></head><body>ok</body>', {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  global.HTMLRewriter = class {
    on() { return this; }
    transform(response) { return response; }
  };

  try {
    const { default: worker } = await loadWorker();
    const response = await worker.fetch(
      new Request('https://projectodysseus.live/'),
      { ORIGIN_URL: 'https://origin.example.test' },
    );

    assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
  } finally {
    global.fetch = originalFetch;
    global.HTMLRewriter = originalHtmlRewriter;
  }
});
