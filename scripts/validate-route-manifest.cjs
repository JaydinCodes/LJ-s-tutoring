const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = require(path.join(root, 'src', 'app', 'route-manifest.json'));
const appSpec = fs.readFileSync(path.join(root, '.do', 'app.yaml'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'app', 'App.tsx'), 'utf8');
const reactHelper = fs.readFileSync(path.join(root, 'src', 'app', 'routeManifest.ts'), 'utf8');

const paths = manifest.routes.map((route) => route.path);
if (new Set(paths).size !== paths.length || !paths.every((route) => route.startsWith('/'))) {
  throw new Error('Route manifest paths must be unique absolute paths.');
}
for (const asset of manifest.rootAssets) {
  if (!manifest.portalHosts.every((host) => appSpec.includes(`exact: ${host}`) && appSpec.includes(`prefix: ${asset}`))) {
    throw new Error(`Missing portal ingress preservation rule for ${asset}.`);
  }
}
for (const redirect of manifest.redirects) {
  if (!reactHelper.includes('routeRedirects') || !app.includes('routeRedirects.map')) throw new Error(`React redirect ${redirect.from} is not generated from the route manifest.`);
}
process.stdout.write('Route manifest and deployment ingress are consistent.\n');
