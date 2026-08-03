# Not-found hosting contract

The React wildcard route now renders a branded not-found page with `data-page-status="not-found"` instead of redirecting unknown URLs to the home page.

React runs after the HTTP response and cannot change its status code. The current static-host catch-all may therefore return the application shell with HTTP `200` before the client renders this page. Production hosting should return the same shell with HTTP `404` for unknown paths, while retaining explicit rewrites for the known application routes and their direct-load shells. Monitoring can use the page marker to distinguish the rendered not-found state until that edge rule is configured.

DigitalOcean App Platform's current static-site/app-spec boundary also does not
provide the repository a supported way to attach arbitrary outbound response
headers such as HSTS to this component. `secure_header` is an inbound request
matcher, not response-header injection. A true HTTP 404 and required response
security headers therefore need a platform feature or an edge/service component;
they cannot be honestly marked complete by React or `.do/app.yaml` alone.
