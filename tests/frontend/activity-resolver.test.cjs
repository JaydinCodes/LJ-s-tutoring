const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src/features/learning/activityResolver.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} }; new Function('exports', 'require', 'module', output)(mod.exports, require, mod);
const resolve = mod.exports.resolveActivityForRecommendation;
const activity = (code, targetSkillCode, stageTypes, extra = {}) => ({ code, targetSkillCode, stageTypes, approved: true, allQuestionsApproved: true, ...extra });
test('resolver targets the prerequisite skill and rejects incomplete approval', () => {
  const selected = resolve({ recommendationType: 'prerequisite_remediation', reasonCodes: ['PREREQUISITE_NOT_SECURE'], focusSkillCode: 'G9.ALG.DISTRIBUTIVE', targetSkillCode: 'G9.EQN.BRACKETS' }, [activity('Z', 'G9.EQN.BRACKETS', ['guided_practice']), activity('A', 'G9.ALG.DISTRIBUTIVE', ['prerequisite_check', 'guided_practice'])]);
  assert.equal(selected.code, 'A');
  assert.equal(resolve({ recommendationType: 'guided_practice', reasonCodes: [], targetSkillCode: 'G9.ALG.DISTRIBUTIVE' }, [activity('draft', 'G9.ALG.DISTRIBUTIVE', ['guided_practice'], { approved: false })]), null);
});
test('resolver maps misconception and retrieval needs deterministically', () => {
  assert.equal(resolve({ recommendationType: 'contrasting_examples', reasonCodes: ['REPEATED_MISCONCEPTION'], targetSkillCode: 'G9.ALG.FACTOR.DOTS' }, [activity('dots', 'G9.ALG.FACTOR.DOTS', ['error_analysis', 'guided_practice'])]).code, 'dots');
  assert.equal(resolve({ recommendationType: 'retrieval_practice', reasonCodes: ['DELAYED_RETRIEVAL_DUE'], targetSkillCode: 'G9.GRAPH.GRADIENT' }, [activity('retrieval', 'G9.GRAPH.GRADIENT', ['retrieval_warm_up'])]).code, 'retrieval');
});
