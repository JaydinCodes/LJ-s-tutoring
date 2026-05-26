const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('React public route owns enquiry capture without hard-coded external endpoints', () => {
  const publicRoutes = fs.readFileSync(path.join(root, 'src', 'app', 'routes', 'PublicRoutes.tsx'), 'utf8');
  const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

  assert.ok(publicRoutes.includes('VITE_PO_FORMSPREE_ENDPOINT'), 'React enquiry form must use env-configured form endpoint');
  assert.ok(publicRoutes.includes('po_react_enquiry_last_submit'), 'React enquiry form must throttle repeat submissions');
  assert.ok(publicRoutes.includes('name="name"'), 'React enquiry form must collect name');
  assert.ok(publicRoutes.includes('name="email"'), 'React enquiry form must collect email');
  assert.ok(publicRoutes.includes('name="grade"'), 'React enquiry form must collect grade');
  assert.ok(publicRoutes.includes('name="message"'), 'React enquiry form must collect message');
  assert.ok(publicRoutes.includes('name="website"'), 'React enquiry form must keep honeypot protection');
  assert.ok(publicRoutes.includes('https://wa.me/'), 'React enquiry fallback must include WhatsApp');
  assert.ok(publicRoutes.includes('mailto:'), 'React enquiry fallback must include email');
  assert.ok(!publicRoutes.includes('https://formspree.io/f/xreebzqa'), 'React bundle must not hard-code the legacy Formspree endpoint');
  assert.ok(envExample.includes('VITE_PO_FORMSPREE_ENDPOINT='), '.env.example must document the public form endpoint');
});

test('React public route carries remaining public-site parity sections', () => {
  const publicRoutes = fs.readFileSync(path.join(root, 'src', 'app', 'routes', 'PublicRoutes.tsx'), 'utf8');

  assert.ok(publicRoutes.includes('GuideSection'), 'React public home must preserve guide/lead-magnet path');
  assert.ok(publicRoutes.includes('/guides/matric-maths-mistakes-guide'), 'React public home must link to the React guide');
  assert.ok(publicRoutes.includes('FaqSection'), 'React public home must preserve FAQ content');
  assert.ok(publicRoutes.includes('BecomeTutorSection'), 'React public home must preserve tutor application CTA');
  assert.ok(publicRoutes.includes('mailto:${contactEmail}?subject='), 'React tutor CTA must use configured contact email');
});

test('React public routes include guide pages', () => {
  const app = fs.readFileSync(path.join(root, 'src', 'app', 'App.tsx'), 'utf8');
  const publicRoutes = fs.readFileSync(path.join(root, 'src', 'app', 'routes', 'PublicRoutes.tsx'), 'utf8');

  assert.ok(app.includes('path="/guides"'), 'React app must register the guides index route');
  assert.ok(app.includes('path="/guides/matric-maths-mistakes-guide"'), 'React app must register the matric guide route');
  assert.ok(publicRoutes.includes('GuidesIndexRoute'), 'React public route file must expose the guides index');
  assert.ok(publicRoutes.includes('MatricMathsMistakesGuideRoute'), 'React public route file must expose the matric guide');
  assert.ok(publicRoutes.includes('Misreading the question'), 'React matric guide must carry legacy guide content');
  assert.ok(publicRoutes.includes('Skipping algebra steps'), 'React matric guide must carry legacy guide content');
});
