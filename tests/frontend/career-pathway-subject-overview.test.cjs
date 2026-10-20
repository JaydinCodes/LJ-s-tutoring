const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');

function loadPathwayModule() {
  const source = fs.readFileSync(path.join(root, 'src', 'features', 'students', 'careerPathway.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  Function('exports', 'module', 'require', output)(module.exports, module, require);
  return module.exports;
}

function eligibility(programme, requirements) {
  return {
    programme,
    requirements,
    kind: 'missing-results',
    label: 'Missing results',
    explanation: '',
    apsComparison: '',
    gaps: [],
  };
}

function programme(id, institutionName) {
  return { id, institutionName, programmeName: `Programme ${id}` };
}

test('subject overview retains different programme thresholds without presenting a universal minimum', () => {
  const { buildSubjectRequirementOverview } = loadPathwayModule();
  const results = buildSubjectRequirementOverview([
    eligibility(programme('one', 'University One'), [{ label: 'Mathematics', acceptedSubjects: ['Mathematics'], minimumPercentage: 50 }]),
    eligibility(programme('two', 'University Two'), [{ label: 'Mathematics', acceptedSubjects: ['Mathematics'], minimumPercentage: 70 }]),
  ], []);

  assert.equal(results.length, 1);
  assert.deepEqual(results[0].programmeRequirements.map((item) => item.minimumPercentage), [50, 70]);
  assert.deepEqual(results[0].programmeRequirements.map((item) => item.institutionName), ['University One', 'University Two']);
  assert.equal(Object.hasOwn(results[0], 'minimumPercentage'), false);
});

test('alternative subjects remain one accepted combination and do not conflate Mathematics with Mathematical Literacy', () => {
  const { buildSubjectRequirementOverview } = loadPathwayModule();
  const results = buildSubjectRequirementOverview([
    eligibility(programme('alternative', 'College One'), [{
      label: 'Mathematics or Mathematical Literacy',
      acceptedSubjects: ['Mathematics', 'Mathematical Literacy'],
      minimumPercentage: 40,
    }]),
    eligibility(programme('mathematics', 'University One'), [{
      label: 'Mathematics',
      acceptedSubjects: ['Mathematics'],
      minimumPercentage: 60,
    }]),
  ], [{ subject: 'Mathematical Literacy', score: 68 }]);

  assert.equal(results.length, 2);
  const alternatives = results.find((item) => item.acceptedSubjects.length === 2);
  assert.deepEqual(alternatives.acceptedSubjects, ['Mathematics', 'Mathematical Literacy']);
  assert.deepEqual(alternatives.availableEvidence, [{ subject: 'Mathematical Literacy', score: 68 }]);
  assert.deepEqual(results.find((item) => item.label === 'Mathematics').acceptedSubjects, ['Mathematics']);
});

test('missing requirements and missing learner results remain explicit empty states', () => {
  const { buildSubjectRequirementOverview } = loadPathwayModule();
  assert.deepEqual(buildSubjectRequirementOverview([
    eligibility(programme('unstructured', 'College One'), []),
  ], []), []);

  const [overview] = buildSubjectRequirementOverview([
    eligibility(programme('science', 'University One'), [{
      label: 'Physical Sciences',
      acceptedSubjects: ['Physical Sciences'],
      minimumPercentage: 55,
    }]),
  ], []);
  assert.deepEqual(overview.availableEvidence, []);
});
