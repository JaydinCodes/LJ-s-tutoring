/* sw.js - Project Odysseus PWA Service Worker
   Strategy:
   - HTML/documents: Network-first with cached React shell fallback
   - App assets: Cache-first with runtime update
   - Media/images: Stale-while-revalidate
*/

// Build script replaces VERSION in dist/sw.js.
const VERSION = "po-v-dev";
const CACHE_APP = `po-app-${VERSION}`;
const CACHE_MEDIA = `po-media-${VERSION}`;
const CACHE_DOCS = `po-docs-${VERSION}`;

const PRECACHE_URLS = [
  `/?v=${VERSION}`,
  `/index.html?v=${VERSION}`,
  `/react-app-dist/react-app.css?v=${VERSION}`,
  `/react-app-dist/react-app.js?v=${VERSION}`,
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

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const appCache = await caches.open(CACHE_APP);
    const docsCache = await caches.open(CACHE_DOCS);

    const precache = await Promise.allSettled(
      PRECACHE_URLS.map(async (u) => {
        const req = new Request(u, { cache: "reload" });
        const res = await fetch(req);
        if (!res.ok) {
          throw new Error(`Precache failed: ${u} (${res.status})`);
        }
        const url = new URL(u, self.location.origin);
        if (isHTMLRequest(req) || url.pathname.endsWith("/") || url.pathname.endsWith(".html")) {
          await docsCache.put(req, res);
        } else {
          await appCache.put(req, res);
        }
      }),
    );

    const failed = precache.filter((p) => p.status === "rejected");
    if (failed.length) {
      console.warn("[SW] Some precache entries failed:", failed);
    }

    self.skipWaiting();
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
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
      return fresh;
    }
    const cached = await cache.match(req);
    if (cached) {
      return cached;
    }
    return fresh;
  } catch {
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
  if (res && res.ok) {
    cache.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("", { status: 504 });
}
