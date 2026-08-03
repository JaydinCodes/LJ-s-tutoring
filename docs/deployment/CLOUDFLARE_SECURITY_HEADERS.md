# Cloudflare security headers (clickjacking / response-header gap)

**Status:** planned, not yet applied. This is a DNS/dashboard change outside
this repository; nothing here executes automatically.

## Why this exists

DigitalOcean App Platform's `static_sites` component has no supported way to
set response headers (see the long comment above `ingress:` in
[.do/app.yaml](../../.do/app.yaml)). The build already ships a
`<meta http-equiv="Content-Security-Policy">` tag with `frame-ancestors 'none'`
(`index.html`, `scripts/build-static.js`), but browsers only honor
`frame-ancestors` and `X-Frame-Options` as real HTTP response headers — the
`<meta>` form is silently ignored for both, and there is no `<meta>` equivalent
for `Strict-Transport-Security` or `X-Content-Type-Options` at all. Until a
layer in front of DigitalOcean can inject headers, the site has no working
clickjacking protection and no enforced HSTS.

Decision (2026-08-03): add Cloudflare in front of the existing DigitalOcean
app as a proxy, rather than migrating hosting. DigitalOcean keeps serving the
app unchanged; Cloudflare adds the missing response headers at the edge.

## One-time setup (do this in the Cloudflare + registrar dashboards)

1. Create a free Cloudflare account and add `projectodysseus.live` as a site.
2. At your domain registrar, change the nameservers to the two Cloudflare
   nameservers it assigns (this is the only registrar-side step; it can take
   up to 24h to propagate, though it's usually much faster).
3. In Cloudflare DNS, recreate the same records the domain currently has
   pointing at DigitalOcean (check current values in your registrar/DO
   dashboard before switching nameservers, so nothing is lost):
   - `projectodysseus.live` → DO app's default ingress hostname
   - `admin.projectodysseus.live`, `tutor.projectodysseus.live`,
     `student.projectodysseus.live` → same
   - Set every one of these records to **Proxied** (orange cloud), not
     **DNS only** — the header rule below only applies to proxied traffic.
4. Cloudflare dashboard → **Rules → Transform Rules → Modify Response
   Header** → create rule:
   - **When incoming requests match:** Hostname is one of
     `projectodysseus.live`, `admin.projectodysseus.live`,
     `tutor.projectodysseus.live`, `student.projectodysseus.live`
   - **Then set headers:**

     | Header | Value |
     |---|---|
     | `X-Frame-Options` | `DENY` |
     | `X-Content-Type-Options` | `nosniff` |
     | `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
     | `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |

     The `Content-Security-Policy` value must stay byte-for-byte identical to
     the one in `index.html` / `scripts/build-static.js` (search both for
     `Content-Security-Policy` if either changes). Keep the existing `<meta>`
     tag in place as defense-in-depth for any request that ever bypasses
     Cloudflare — it costs nothing and covers the directives `<meta>` does
     support.
5. Only add `Strict-Transport-Security` once every subdomain actually serves
   over HTTPS (`includeSubDomains` breaks any subdomain still on plain HTTP).
   Confirm all four domains redirect to HTTPS in DigitalOcean before turning
   this on.

## Verification after setup

- `curl -sI https://projectodysseus.live/` (and the three subdomains) should
  show all four headers above.
- Load the site in an `<iframe>` on an unrelated origin — it must fail to
  render (clickjacking protection working).
- Confirm normal login/dashboard flows still work through the proxy before
  calling this done; Cloudflare in front of a site can occasionally alter
  caching behavior for static assets.

## Related, not done here

`docs/release/NOT_FOUND_HOSTING.md` also documents that DigitalOcean's
static-site catchall cannot return a true HTTP 404 for unknown routes. A
Cloudflare Worker (not a Transform Rule) could fix that at the same time by
checking the request path against the known route list and rewriting the
status code — that's a separate, larger change and is intentionally out of
scope here.
