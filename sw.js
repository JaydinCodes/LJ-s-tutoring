/* sw.js - Project Odysseus PWA Service Worker
   Strategy:
   - HTML/documents: Network-first with cached React shell fallback
   - App assets: Cache-first with runtime update
   - Media/images: Stale-while-revalidate
*/

// Build script replaces VERSION and the REACT_APP_*_PATH placeholders in dist/sw.js.
const VERSION = "po-v-dev";
const CACHE_APP = `po-app-${VERSION}`;
const CACHE_MEDIA = `po-media-${VERSION}`;
const CACHE_DOCS = `po-docs-${VERSION}`;
const NAVIGATION_TIMEOUT_MS = 8_000;
const PRECACHE_TIMEOUT_MS = 15_000;

// react-app.js/.css are content-hashed (see vite.app.config.ts), so these paths
// already change on every build that changes their content -- no `?v=` needed.
const REACT_APP_JS_PATH = "/react-app-dist/react-app.js";
const REACT_APP_CSS_PATH = "/react-app-dist/react-app.css";

const PRECACHE_URLS = [
  `/?v=${VERSION}`,
  `/index.html?v=${VERSION}`,
  REACT_APP_CSS_PATH,
  REACT_APP_JS_PATH,
  `/favicon.svg?v=${VERSION}`,
];

function isHTMLRequest(request) {
  return request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");
}

function isAssetRequest(url) {
  return /\.(js|css|mjs|map|woff2?|ttf|otf)$/.test(url.pathname);
}

function isMediaRequest(url) {
  return /\.(png|jpg|jpeg|webp|avif|gif|svg|mp3|wav|ogg|mp4|webm)$/.test(url.pathname);
}

function expectedContentType(request) {
  const url = new URL(request.url);

  if (isHTMLRequest(request) || url.pathname === "/" || url.pathname.endsWith(".html")) {
    return /^text\/html\b/i;
  }
  if (/\.css$/i.test(url.pathname)) {
    return /^text\/css\b/i;
  }
  if (/\.(?:js|mjs)$/i.test(url.pathname)) {
    return /^(?:application|text)\/javascript\b|^application\/ecmascript\b/i;
  }
  if (/\.svg$/i.test(url.pathname)) {
    return /^image\/svg\+xml\b/i;
  }
  return null;
}

function isCacheableResponse(request, response) {
  if (!response || !response.ok) {
    return false;
  }

  const expected = expectedContentType(request);
  if (!expected) {
    return true;
  }

  return expected.test(response.headers.get("content-type") || "");
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const appCache = await caches.open(CACHE_APP);
    const docsCache = await caches.open(CACHE_DOCS);

    // These entries are the minimum viable app shell. A partial cache can
    // permanently pair an old shell with new chunks, so reject the install if
    // any required fetch fails or is served with the wrong MIME type.
    await Promise.all(
      PRECACHE_URLS.map(async (u) => {
        const req = new Request(new URL(u, self.location.origin), { cache: "reload" });
        const res = await fetchWithTimeout(req, PRECACHE_TIMEOUT_MS);
        if (!isCacheableResponse(req, res)) {
          const contentType = res.headers.get("content-type") || "missing";
          throw new Error(`Precache failed validation: ${u} (${res.status}, ${contentType})`);
        }
        const url = new URL(u, self.location.origin);
        if (isHTMLRequest(req) || url.pathname.endsWith("/") || url.pathname.endsWith(".html")) {
          await docsCache.put(req, res.clone());
        } else {
          await appCache.put(req, res.clone());
        }
      }),
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const keep = new Set([CACHE_APP, CACHE_MEDIA, CACHE_DOCS]);

    await Promise.all(keys.map((k) => {
      if (!keep.has(k) && k.startsWith("po-")) {
        return caches.delete(k);
      }
      return undefined;
    }));

    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isHTMLRequest(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (isAssetRequest(url)) {
    event.respondWith(cacheFirst(req, CACHE_APP));
    return;
  }

  if (isMediaRequest(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_MEDIA));
    return;
  }

  event.respondWith(cacheFirst(req, CACHE_APP));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_DOCS);

  try {
    const fresh = await fetchWithTimeout(req, NAVIGATION_TIMEOUT_MS);
    // fetch() follows redirects by default. Returning the final HTML response
    // for the original request leaves the browser URL unchanged, which made a
    // portal request for "/" render the marketing React route even though the
    // origin had redirected it to /dashboard/<role>/. Re-emit a same-origin
    // redirect so the browser updates its URL before React starts.
    if (fresh.redirected) {
      const redirectedUrl = new URL(fresh.url);
      if (redirectedUrl.origin === self.location.origin) {
        return Response.redirect(redirectedUrl.toString(), 302);
      }
    }
    if (isCacheableResponse(req, fresh)) {
      await cache.put(req, fresh.clone());
      return fresh;
    }
  } catch (error) {
    console.warn("[SW] Navigation network request failed; using cached shell.", error);
  }

  {
    const cached = await cache.match(req);
    if (cached) {
      return cached;
    }

    const shell = await cache.match(`/index.html?v=${VERSION}`) || await cache.match("/index.html");
    if (shell) {
      return shell;
    }

    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    return cached;
  }

  const res = await fetch(req);
  if (isCacheableResponse(req, res)) {
    await cache.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then(async (res) => {
      if (isCacheableResponse(req, res)) {
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("", { status: 504 });
}
