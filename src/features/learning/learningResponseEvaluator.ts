/**
 * Deterministic marking domain logic. This module is deliberately not imported
 * by the learner bundle: a server/worker must load a question's private
 * answer_config and call it after receiving the learner response.
 *
 * It contains no dynamic evaluation; learner text is parsed by the small
 * grammar below (numbers, variables, +, -, *, parentheses and non-negative
 * integer powers only).
 */
export type LearningQuestionType =
  | 'numeric' | 'fraction' | 'multiple_choice' | 'coordinate'
  | 'linear_equation_solution' | 'algebraic_expression' | 'factorised_expression';
export type EvaluationStatus = 'correct' | 'incorrect' | 'needs_review';
export type MisconceptionConfidence = 'possible' | 'likely';

export interface MisconceptionMatch { code: string; confidence: MisconceptionConfidence; skillCode: string | null; evidence: string; }
export interface EvaluationInput { questionVersionId: string; questionType: LearningQuestionType | string; answerConfig: unknown; learnerResponse: unknown; marksAvailable?: number; }
export interface EvaluationResult { status: EvaluationStatus; marksAwarded: number | null; marksAvailable: number; normalizedResponse: unknown; matchedRuleCode: string | null; misconceptionMatches: MisconceptionMatch[]; explanationCode: string; }

type Rational = { n: bigint; d: bigint };
type Polynomial = Map<string, Rational>;
type Ast = { k: 'n'; v: Rational } | { k: 'v'; n: string } | { k: 'b'; o: '+' | '-' | '*'; l: Ast; r: Ast } | { k: 'p'; b: Ast; e: number };
type Config = { type?: LearningQuestionType; expected?: unknown; accepted?: unknown[]; accepted_answers?: unknown[]; tolerance?: number; correct_option?: string; required_form?: string; variables?: string[]; skill_code?: string; misconception_rules?: Array<{ code: string; response?: string; expected?: string; confidence?: MisconceptionConfidence }> };

const zero = (): Rational => ({ n: 0n, d: 1n });
const gcd = (a: bigint, b: bigint): bigint => b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
function q(n: bigint, d = 1n): Rational { if (d === 0n) throw new Error('zero denominator'); const sign = d < 0n ? -1n : 1n; const g = gcd(n, d); return { n: sign * n / g, d: sign * d / g }; }
function add(a: Rational, b: Rational) { return q(a.n * b.d + b.n * a.d, a.d * b.d); }
function neg(a: Rational) { return { n: -a.n, d: a.d }; }
function mul(a: Rational, b: Rational) { return q(a.n * b.n, a.d * b.d); }
function equalQ(a: Rational, b: Rational) { return a.n === b.n && a.d === b.d; }
function canonicalNumber(value: string): Rational {
  const text = value.trim();
  const fraction = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(text);
  if (fraction) return q(BigInt(fraction[1]), BigInt(fraction[2]));
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw new Error('invalid number');
  const sign = text.startsWith('-') ? -1n : 1n; const bare = text.replace(/^[+-]/, ''); const [whole, decimal = ''] = bare.split('.');
  return q(sign * BigInt(`${whole || '0'}${decimal}`), 10n ** BigInt(decimal.length));
}
function rawAnswer(value: unknown): string | null { if (typeof value === 'string' || typeof value === 'number') return String(value).trim(); if (value && typeof value === 'object' && 'answer' in value && typeof (value as { answer: unknown }).answer !== 'object') return String((value as { answer: unknown }).answer).trim(); return null; }
function result(status: EvaluationStatus, marks: number | null, available: number, normalized: unknown, explanationCode: string, matches: MisconceptionMatch[] = []): EvaluationResult { return { status, marksAwarded: marks, marksAvailable: available, normalizedResponse: normalized, matchedRuleCode: matches[0]?.code ?? null, misconceptionMatches: matches, explanationCode }; }

function tokenize(source: string) {
  const text = source.replace(/[\u00b2]/g, '^2').replace(/[\u00b3]/g, '^3').replace(/\s+/g, ''); const tokens: string[] = [];
  for (let index = 0; index < text.length;) { const token = /^(\d+(?:\.\d*)?|\.\d+|[A-Za-z]+|[()+*\-/^])/.exec(text.slice(index)); if (!token) throw new Error('invalid token'); tokens.push(token[1]); index += token[1].length; }
  return tokens;
}
function parseExpression(source: string): Ast {
  const tokens = tokenize(source); let i = 0;
  const startsAtom = () => /^\d|^\.|^[A-Za-z]+$|^\($/.test(tokens[i] || '');
  const primary = (): Ast => { const token = tokens[i++]; if (!token) throw new Error('missing expression'); if (token === '(') { const node = sum(); if (tokens[i++] !== ')') throw new Error('missing close'); return node; } if (/^[A-Za-z]+$/.test(token)) return { k: 'v', n: token }; if (/^\d|^\./.test(token)) return { k: 'n', v: canonicalNumber(token) }; throw new Error('invalid primary'); };
  const power = (): Ast => { let node = primary(); if (tokens[i] === '^') { i++; const exponent = tokens[i++]; if (!/^\d+$/.test(exponent || '') || Number(exponent) > 12) throw new Error('invalid exponent'); node = { k: 'p', b: node, e: Number(exponent) }; } return node; };
  const product = (): Ast => { let node = power(); while (tokens[i] === '*' || startsAtom()) { if (tokens[i] === '*') i++; node = { k: 'b', o: '*', l: node, r: power() }; } return node; };
  const sum = (): Ast => { let node: Ast; if (tokens[i] === '-') { i++; node = { k: 'b', o: '-', l: { k: 'n', v: zero() }, r: product() }; } else if (tokens[i] === '+') { i++; node = product(); } else node = product(); while (tokens[i] === '+' || tokens[i] === '-') { const o = tokens[i++] as '+' | '-'; node = { k: 'b', o, l: node, r: product() }; } return node; };
  const parsed = sum(); if (i !== tokens.length) throw new Error('trailing token'); return parsed;
}
function key(parts: string[]) { return parts.filter(Boolean).sort().join('*') || '1'; }
function merge(target: Polynomial, input: Polynomial, sign = false) { for (const [term, coefficient] of input) { const next = add(target.get(term) || zero(), sign ? neg(coefficient) : coefficient); if (next.n === 0n) target.delete(term); else target.set(term, next); } return target; }
function poly(ast: Ast): Polynomial { if (ast.k === 'n') return new Map([['1', ast.v]]); if (ast.k === 'v') return new Map([[ast.n, q(1n)]]); if (ast.k === 'p') { let out = new Map([['1', q(1n)]]) as Polynomial; for (let i = 0; i < ast.e; i++) out = multiply(out, poly(ast.b)); return out; } if (ast.o === '+') return merge(poly(ast.l), poly(ast.r)); if (ast.o === '-') return merge(poly(ast.l), poly(ast.r), true); return multiply(poly(ast.l), poly(ast.r)); }
function multiply(a: Polynomial, b: Polynomial) { const out = new Map() as Polynomial; for (const [ak, av] of a) for (const [bk, bv] of b) { const exponents = new Map<string, number>(); for (const part of `${ak === '1' ? '' : ak}*${bk === '1' ? '' : bk}`.split('*').filter(Boolean)) { const [name, power = '1'] = part.split('^'); exponents.set(name, (exponents.get(name) || 0) + Number(power)); } const term = key([...exponents.entries()].map(([name, power]) => power === 1 ? name : `${name}^${power}`)); const next = add(out.get(term) || zero(), mul(av, bv)); if (next.n === 0n) out.delete(term); else out.set(term, next); } return out; }
function equalPoly(a: Polynomial, b: Polynomial) { return a.size === b.size && [...a].every(([term, value]) => b.has(term) && equalQ(value, b.get(term)!)); }
function normalizedPolynomial(input: string) { const value = poly(parseExpression(input)); return [...value.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([term, coefficient]) => `${coefficient.n}/${coefficient.d}:${term}`).join('|'); }
function factorisedStructure(input: string) { const cleaned = input.replace(/\s/g, ''); return /\)[*]?(?:\(|[A-Za-z\d])/.test(cleaned) && cleaned.includes('('); }
function matchesFor(config: Config, answer: string, normalized: unknown): MisconceptionMatch[] {
  const rules = config.misconception_rules || [];
  const configured = rules.filter((rule) => rule.response && normalizeText(rule.response) === normalizeText(answer)).map((rule) => ({ code: rule.code, confidence: rule.confidence || 'likely', skillCode: config.skill_code || null, evidence: `Response matches the configured ${rule.code} pattern.` }));
  if (configured.length) return configured;
  const response = normalizeText(answer);
  const accepted = (config.accepted || config.accepted_answers || (config.expected === undefined ? [] : [config.expected])).map((item) => normalizeText(String(item)));
  if (accepted.some((item) => /\(x-7\)\(x\+7\)/.test(item)) && response === '(x-7)^2') return [{ code: 'DOTS_AS_SQUARE_OF_DIFFERENCE', confidence: 'likely', skillCode: config.skill_code || 'G9.ALG.FACTOR.DOTS', evidence: 'The response squares a difference instead of factoring a difference of squares.' }];
  if (accepted.some((item) => /3x\+12/.test(item)) && response === '3x+4') return [{ code: 'DISTRIBUTIVE_PARTIAL_MULTIPLICATION', confidence: 'likely', skillCode: config.skill_code || 'G9.ALG.DISTRIBUTIVE', evidence: 'The bracketed constant was left undistributed.' }];
  if (config.skill_code === 'G9.GRAPH.GRADIENT' && accepted.length === 1) {
    try { const expected = canonicalNumber(accepted[0]); const observed = canonicalNumber(answer); if (equalQ(observed, q(expected.d, expected.n))) return [{ code: 'GRADIENT_RISE_OVER_RUN_REVERSED', confidence: 'possible', skillCode: config.skill_code, evidence: 'The response is the reciprocal of the configured gradient.' }]; } catch { /* malformed responses are handled by the caller */ }
  }
  return [];
}
function normalizeText(value: string) { return value.replace(/\s/g, '').replace(/[\u2212]/g, '-').toLowerCase(); }

export function evaluateLearningResponse(input: EvaluationInput): EvaluationResult {
  const config = (input.answerConfig && typeof input.answerConfig === 'object' ? input.answerConfig : {}) as Config; const available = Number.isFinite(input.marksAvailable) ? input.marksAvailable! : 1; const answer = rawAnswer(input.learnerResponse);
  if (!answer) return result('needs_review', null, available, null, 'INVALID_OR_EMPTY_RESPONSE');
  const type = config.type || input.questionType; const accepted = (config.accepted || config.accepted_answers || (config.expected === undefined ? [] : [config.expected])).map(String);
  try {
    if (type === 'multiple_choice') { const normalized = answer.trim().toUpperCase(); if (!/^[A-Z0-9_-]+$/.test(normalized) || !config.correct_option) return result('needs_review', null, available, normalized, 'INVALID_MULTIPLE_CHOICE_RESPONSE'); return result(normalized === config.correct_option.toUpperCase() ? 'correct' : 'incorrect', normalized === config.correct_option.toUpperCase() ? available : 0, available, normalized, normalized === config.correct_option.toUpperCase() ? 'MULTIPLE_CHOICE_MATCH' : 'MULTIPLE_CHOICE_MISMATCH'); }
    if (type === 'coordinate') { const match = /^\s*\(?\s*([^,;()]+)\s*[,;]\s*([^,;()]+)\s*\)?\s*$/.exec(answer); if (!match || !accepted.length) return result('needs_review', null, available, null, 'INVALID_COORDINATE_RESPONSE'); const coordinate = [canonicalNumber(match[1]), canonicalNumber(match[2])]; const expected = accepted.some((candidate) => { const item = /^\s*\(?\s*([^,;()]+)\s*[,;]\s*([^,;()]+)\s*\)?\s*$/.exec(candidate); return item && equalQ(coordinate[0], canonicalNumber(item[1])) && equalQ(coordinate[1], canonicalNumber(item[2])); }); return result(expected ? 'correct' : 'incorrect', expected ? available : 0, available, coordinate.map((part) => `${part.n}/${part.d}`), expected ? 'COORDINATE_MATCH' : 'COORDINATE_MISMATCH'); }
    if (type === 'numeric' || type === 'fraction' || type === 'linear_equation_solution') { let text = answer; if (type === 'linear_equation_solution') { const equation = /^\s*([A-Za-z]+)\s*=\s*(.+)$/.exec(answer); if (equation) { const variable = config.variables?.[0] || 'x'; if (equation[1] !== variable) return result('incorrect', 0, available, null, 'WRONG_SOLUTION_VARIABLE'); text = equation[2]; } } const normalized = canonicalNumber(text); const expected = accepted.map(canonicalNumber); const tolerance = config.tolerance; const correct = expected.some((item) => tolerance === undefined ? equalQ(normalized, item) : Math.abs(Number(normalized.n) / Number(normalized.d) - Number(item.n) / Number(item.d)) <= tolerance); const matches = correct ? [] : matchesFor(config, answer, normalized); return result(correct ? 'correct' : 'incorrect', correct ? available : 0, available, `${normalized.n}/${normalized.d}`, correct ? 'NUMERIC_MATCH' : 'NUMERIC_MISMATCH', matches); }
    if (type === 'algebraic_expression' || type === 'factorised_expression') { if (!accepted.length) return result('needs_review', null, available, null, 'MISSING_ANSWER_CONFIGURATION'); const normalized = normalizedPolynomial(answer); const equivalent = accepted.some((candidate) => equalPoly(poly(parseExpression(answer)), poly(parseExpression(candidate)))); const formOk = config.required_form !== 'factorised' || factorisedStructure(answer); const correct = equivalent && formOk; const matches = correct ? [] : matchesFor(config, answer, normalized); return result(correct ? 'correct' : 'incorrect', correct ? available : 0, available, normalized, !equivalent ? 'ALGEBRAIC_MISMATCH' : formOk ? 'ALGEBRAIC_MATCH' : 'REQUIRED_FORM_NOT_MET', matches); }
  } catch { return result('needs_review', null, available, null, 'MALFORMED_MATHEMATICAL_RESPONSE'); }
  return result('needs_review', null, available, answer, 'UNSUPPORTED_QUESTION_TYPE');
}
