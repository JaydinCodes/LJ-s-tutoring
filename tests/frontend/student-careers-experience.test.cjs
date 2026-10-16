const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8');

function loadDiscoveryModule() {
  const source = read('src', 'features', 'students', 'careerDiscovery.ts')
    .replace("import type { LucideIcon } from 'lucide-react';", '')
    .replace("import { BriefcaseBusiness, Code2, GraduationCap, HeartPulse, Landmark, Palette, Wrench } from 'lucide-react';", "const BriefcaseBusiness = () => null, Code2 = () => null, GraduationCap = () => null, HeartPulse = () => null, Landmark = () => null, Palette = () => null, Wrench = () => null;")
    .replace("import type { CareerSummary } from './studentCareersRepository';", '');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  Function('exports', 'module', 'require', output)(module.exports, module, require);
  return module.exports;
}

test('career worlds only appear when the real catalogue contains a mapped career', () => {
  const discovery = loadDiscoveryModule();
  const worlds = discovery.availableCareerWorlds([
    { id: 'dev', title: 'Developer', category: 'Technology' },
    { id: 'nurse', title: 'Nurse', category: 'Health Sciences' },
  ]);
  assert.deepEqual(worlds.map((world) => world.id), ['technology', 'health-science']);
  assert.equal(worlds.some((world) => world.id === 'public-service'), false);
});

test('career discovery is deterministic, catalogue-only, and explains text matches', () => {
  const discovery = loadDiscoveryModule();
  const careers = [
    { id: 'dev', title: 'Software Developer', category: 'Technology', description: 'Builds applications.' },
    { id: 'nurse', title: 'Registered Nurse', category: 'Health Sciences', description: 'Provides clinical care.' },
  ];
  const first = discovery.matchCareers(careers, ['Working with technology'], []);
  const second = discovery.matchCareers(careers, ['Working with technology'], []);
  assert.deepEqual(first, second);
  assert.equal(first[0].career.id, 'dev');
  assert.match(first[0].reasons[0], /working with technology/i);
  assert.equal(first.every((match) => careers.includes(match.career)), true);
});

test('Careers redesign keeps every screen URL-backed and reuses trusted pathway logic', () => {
  const route = read('src', 'features', 'students', 'StudentCareersRoute.tsx');
  const experience = read('src', 'features', 'students', 'StudentCareersExperienceComponents.tsx');
  for (const view of ["view === 'home'", "view === 'compass'", "view === 'worlds'", "view === 'career'", "view === 'pathway'"]) {
    assert.ok(route.includes(view), `${view} must be routed`);
  }
  for (const label of ['Discover with Odie', 'Search careers', 'Odie’s Career Compass', 'Explore career worlds', 'Explore my pathway', 'Your career pathway']) {
    assert.ok(experience.includes(label), `${label} must be present`);
  }
  assert.ok(route.includes('calculateGuidanceAps'));
  assert.ok(route.includes('classifyProgramme'));
  assert.ok(route.includes("streamSupabaseFunctionText('odie-careers-chat-stream'"));
  assert.ok(experience.includes('not a prediction of what you should become'));
});
