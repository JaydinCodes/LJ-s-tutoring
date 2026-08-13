const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// The origin is a single DigitalOcean static-site hostname. `upstreamRequest`
// below deliberately replaces the public hostname with that origin hostname,
// which means origin-side authority rules cannot tell an admin/tutor/student
// request apart from a request for the public site. Handle the portal entry
// redirects here, before that hostname is replaced.
const PORTALS = {
  'admin.projectodysseus.live': '/dashboard/admin/',
  'tutor.projectodysseus.live': '/dashboard/tutor/',
  'student.projectodysseus.live': '/dashboard/student/',
};

function createNonce() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://formspree.io https://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function isHtml(response) {
  return (response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}

function upstreamRequest(request, originUrl, pathname) {
  const upstream = new URL(request.url);
  const origin = new URL(originUrl);
  upstream.protocol = origin.protocol;
  upstream.hostname = origin.hostname;
  upstream.port = origin.port;
  if (pathname) upstream.pathname = pathname;

  return new Request(upstream, request);
}

export default {
  async fetch(request, env) {
    if (!env.ORIGIN_URL) {
      return new Response('Cloudflare edge origin is not configured.', { status: 503 });
    }

    const requestedUrl = new URL(request.url);
    const portalEntryPoint = PORTALS[requestedUrl.hostname];
    if (portalEntryPoint && requestedUrl.pathname === '/') {
      requestedUrl.pathname = portalEntryPoint;
      return Response.redirect(requestedUrl.toString(), 302);
    }

    // DigitalOcean's ingress uses the hostname to choose its dashboard shell.
    // The proxy must use the origin hostname, so route portal dashboard traffic
    // to the corresponding real static file here instead. The browser URL is
    // unchanged, allowing React Router to render nested dashboard routes.
    const portalShellPath = portalEntryPoint && requestedUrl.pathname.startsWith('/dashboard/')
      ? `${portalEntryPoint}index.html`
      : undefined;
    const originResponse = await fetch(upstreamRequest(request, env.ORIGIN_URL, portalShellPath));
    const nonce = createNonce();
    const headers = new Headers(originResponse.headers);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }
    headers.set('Content-Security-Policy', contentSecurityPolicy(nonce));

    // Every HTML response contains a fresh CSP nonce. Set this on the header
    // object before Response copies it below; mutating `headers` afterwards
    // does not alter `securedResponse.headers`.
    const html = isHtml(originResponse);
    if (html) {
      headers.set('Cache-Control', 'no-store, max-age=0');
    }

    const securedResponse = new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });

    // The nonce is present only in HTML and is consumed by the JSON-LD React
    // component. It keeps schema markup CSP-compliant without unsafe-inline.
    if (!isHtml(securedResponse)) {
      return securedResponse;
    }

    return new HTMLRewriter()
      .on('head', {
        element(element) {
          element.append(`<meta name="csp-nonce" content="${nonce}">`, { html: true });
        },
      })
      .transform(securedResponse);
  },
};
