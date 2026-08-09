import manifest from './route-manifest.json';

export type AppRoute = (typeof manifest.routes)[number];
export type RouteRedirect = (typeof manifest.redirects)[number];

export const appRoutes = manifest.routes;
export const routeRedirects = manifest.redirects;

export function routePath(path: AppRoute['path']) {
  return path;
}
