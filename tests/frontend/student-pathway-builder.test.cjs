const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

function loadPathwayModule() {
  const source = read('src', 'features', 'students', 'careerPathway.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  Function('exports', 'module', 'require', output)(module.exports, module, require);
  return module.exports;
}

const pathway = loadPathwayModule();

function programme(overrides = {}) {
  return {
    id: 'programme-1',
    institutionId: 'institution-1',
    institutionName: 'Test Institution',
    qualificationType: 'Degree',
    programmeName: 'Test Programme',
    alignedCareerIds: ['software-developer'],
    requirementConfidence: 'high',
    sourceUrl: 'https://example.test/programme',
    requirements: {
      minimumAps: 30,
      minimumEnglishPercentage: 60,
      subjectRequirements: [{ label: 'Mathematics', acceptedSubjects: ['Mathematics'], minimumPercentage: 60 }],
    },
    ...overrides,
  };
}

const completeSubjects = [
  { subject: 'English', score: 70 },
  { subject: 'Mathematics', score: 72 },
  { subject: 'Physical Sciences', score: 65 },
  { subject: 'Life Sciences', score: 61 },
  { subject: 'History', score: 58 },
  { subject: 'Geography', score: 54 },
];

test('blank marks are excluded and one normalized APS rule is deterministic', () => {
  const result = pathway.calculateGuidanceAps([
    ...completeSubjects,
    { subject: 'Accounting', score: null },
    { subject: 'Life Orientation', score: 99 },
  ]);
  assert.equal(result.current, 30);
  assert.equal(result.included.length, 6);
  assert.ok(result.excluded.includes('Accounting'));
  assert.ok(result.excluded.includes('Life Orientation'));
  assert.equal(pathway.percentageToApsPoints(170), 7, 'marks clamp at 100');
  assert.equal(pathway.percentageToApsPoints(-12), 1, 'marks clamp at 0');
  assert.equal(pathway.normalizeApsTarget(99), 60, 'saved target follows the schema maximum');
});

test('duplicate English requirements render once', () => {
  const item = programme({ requirements: { minimumAps: 30, minimumEnglishPercentage: 60, subjectRequirements: [
    { label: 'English Home Language', acceptedSubjects: ['English'], minimumPercentage: 65 },
    { label: 'English', acceptedSubjects: ['English'], minimumPercentage: 60 },
  ] } });
  const requirements = pathway.programmeRequirements(item);
  assert.equal(requirements.filter((requirement) => requirement.acceptedSubjects.includes('English')).length, 1);
});

test('missing data is not classified as failure and explanations match classifications', () => {
  const incompleteAps = pathway.calculateGuidanceAps([{ subject: 'Mathematics', score: 72 }]);
  const missing = pathway.classifyProgramme(programme(), incompleteAps, [{ subject: 'Mathematics', score: 72 }]);
  assert.equal(missing.kind, 'missing-results');
  assert.match(missing.explanation, /^Missing results/);
  assert.doesNotMatch(missing.explanation, /not currently eligible/i);

  const completeAps = pathway.calculateGuidanceAps(completeSubjects);
  const appears = pathway.classifyProgramme(programme(), completeAps, completeSubjects);
  assert.equal(appears.kind, 'appears-eligible');
  assert.match(appears.explanation, /^Appears eligible/);

  const close = pathway.classifyProgramme(programme({ requirements: { minimumAps: 32, minimumEnglishPercentage: 70, subjectRequirements: [{ label: 'Mathematics', acceptedSubjects: ['Mathematics'], minimumPercentage: 75 }] } }), completeAps, completeSubjects);
  assert.equal(close.kind, 'close');
  assert.match(close.explanation, /^Close/);

  const notEligible = pathway.classifyProgramme(programme({ requirements: { minimumAps: 38, minimumEnglishPercentage: 80, subjectRequirements: [{ label: 'Mathematics', acceptedSubjects: ['Mathematics'], minimumPercentage: 85 }] } }), completeAps, completeSubjects);
  assert.equal(notEligible.kind, 'not-currently-eligible');
  assert.match(notEligible.explanation, /^Not currently eligible/);

  const needsVerification = pathway.classifyProgramme(programme({ requirements: { subjectRequirements: [] } }), completeAps, completeSubjects);
  assert.equal(needsVerification.kind, 'requirements-to-check');
  assert.match(needsVerification.explanation, /does not contain enough structured entry requirements/);
});

test('Odie remains Careers-only, opens with a reviewable draft, and never auto-sends', () => {
  const route = read('src', 'features', 'students', 'StudentCareersRoute.tsx');
  assert.ok(route.includes('setMessage(`Please explain my pathway'));
  assert.ok(route.includes('Nothing is sent automatically.'));
  assert.equal((route.match(/await streamCareersAssistant\(/g) || []).length, 1);
  assert.match(route, /async function submit\(event: FormEvent/);
  assert.ok(route.indexOf('await streamCareersAssistant(') > route.indexOf('async function submit('));
});
