# Cloudflare security edge

**Status:** deployment artifact committed; activation still requires a
Cloudflare account, the DigitalOcean origin hostname, and a Cloudflare deploy.

The response-header policy is defined in
[`cloudflare/src/worker.mjs`](../../cloudflare/src/worker.mjs), rather than in
an untestable dashboard Transform Rule. The Worker proxies the static
DigitalOcean application, adds real response headers, and creates a unique CSP
nonce for every HTML response. It injects that nonce in a `<meta>` element;
the React JSON-LD component reads it and attaches it to its JSON-LD script.
This keeps structured data working while `script-src` remains strict.

## Required headers

The Worker sends the following values on every proxied response:

| Header | Required value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | strict `default-src 'self'`, nonce-only `script-src`, and `frame-ancestors 'none'` |

Do not replace this Worker with a dashboard-only rule. The scheduled uptime
probe and the post-deployment probe verify these actual headers on every listed
production origin.

## Activation

1. Add `projectodysseus.live` to Cloudflare and change the registrar
   nameservers as instructed by Cloudflare.
2. Identify the non-proxied DigitalOcean App Platform hostname. It is the
   upstream value for `ORIGIN_URL`; do **not** use a public Cloudflare hostname,
   or the Worker will proxy to itself.
3. Deploy the committed worker from `cloudflare/`:

   ```sh
   npx wrangler deploy --var ORIGIN_URL:https://YOUR-DO-APP.ondigitalocean.app
   ```

4. Attach routes for all four HTTPS hostnames:

   - `projectodysseus.live/*`
   - `admin.projectodysseus.live/*`
   - `tutor.projectodysseus.live/*`
   - `student.projectodysseus.live/*`

5. In GitHub repository or `production` environment variables, set
   `PRODUCTION_ORIGINS` to the comma-separated equivalent:

   ```text
   https://projectodysseus.live,https://admin.projectodysseus.live,https://tutor.projectodysseus.live,https://student.projectodysseus.live
   ```

6. Run **Uptime Check** manually. It must pass before treating the edge setup
   as complete. It will continue to check hourly and after every production
   deployment.

Only activate HSTS after every listed host works over HTTPS. Because the policy
uses `includeSubDomains`, an HTTP-only subdomain would otherwise become
unreachable for browsers that have received the header.

## Local and DigitalOcean-only behaviour

`index.html` and generated static shells retain a deliberately limited meta
CSP for local development and direct-origin fallback. It does not claim to
enforce `frame-ancestors`, HSTS, `X-Frame-Options`, or `X-Content-Type-Options`.
The real production header comes solely from the Cloudflare Worker and is the
only policy accepted by the probe.
