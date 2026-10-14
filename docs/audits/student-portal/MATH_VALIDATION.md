# Mathematics Validation

## Trust boundary

Private `answer_config` is loaded and evaluated in `evaluate-learning-attempt`; it is not included in the learner bundle. `learningResponseEvaluator.ts` uses a bounded grammar and exact rational arithmetic rather than `eval`, then persists evidence through controlled server paths. This is an appropriate architecture for deterministic supported types.

## Verified matrix

| Type/case | Expected | Outcome |
|---|---:|---|
| Numeric `0.5` vs `1/2` | correct equivalence | Pass in evaluator tests |
| Fraction signs and reduction | canonical exact rational | Pass |
| Zero denominator | malformed/needs review | Pass |
| Optional tolerance | accept within configured bound only | Pass |
| Negative number | sign preserved | Pass |
| Coordinate `(2,3)` / `2;3` | ordered pair accepted | Pass |
| Coordinate `(3,2)` | incorrect | Pass |
| Linear solution `x=3` | correct where expected 3 | Pass |
| Wrong solution variable | incorrect | Pass |
| Multiple choice option mapping | exact configured option | Pass |
| Expanded polynomial equivalence | equivalent forms accepted | Pass |
| Factorised required form | expansion rejected when form required | Pass |
| DOTS `(x-5)^2` for `x²-25` | incorrect + misconception evidence | Pass in real browser |
| DOTS `(x-5)(x+5)` | correct | Pass in real browser |
| Hostile/unsupported tokens | never execute; needs review | Pass |
| Empty/malformed response | needs review, no invented mark | Pass |

The repository's 22-case instructional validation matrix also passed. The full frontend/source test run reported 450/450 passing before the added QA regression case.

## Learner archetypes

- **A — all correct:** deterministic evaluator awards configured marks; the real first and later correct DOTS answers were accepted.
- **B — all incorrect:** incorrect responses award zero rather than accidental partial credit. Full browser completion for an all-wrong learner was not fixture-tested.
- **C — repeated misconception:** configured repeated misconception evidence and confidence-aware explanations are covered by unit/data contracts; one confident DOTS misconception was verified in browser.
- **D — blank/invalid/exit:** submit is disabled for blank UI input; malformed input becomes `needs_review`; activity progress resumes from persisted state. Mid-request offline behavior remains a risk.
- **E — improves after practice:** the golden learner corrected the misconception and completed practice; the platform correctly avoided immediately labelling the skill “Strong understanding”. Delayed reassessment was not browser-verified.

## Educational correctness

- The golden DOTS questions are appropriate Grade 9 algebra and test factorisation, not recognition alone.
- The contrast between `(a-b)^2` and `(a-b)(a+b)` is educationally meaningful.
- Confidence does not change mathematical correctness or mastery, which is correct.
- Assisted success is not treated as secure independent evidence.
- A single answer produces “possible/likely” misconception evidence rather than a categorical learner diagnosis.
- Secure/retained states are based on repeated and delayed evidence in the decision engine, not activity clicks.

## Limits and risks

- Real-browser validation covers one narrow factorisation activity.
- The parser intentionally supports a limited grammar; trigonometry, scientific notation, units, inequalities, roots, simultaneous equations and symbolic functions are not established as supported.
- Multi-character variable notation such as `xy` is parsed as one identifier, not necessarily implicit `x*y`; authoring must restrict variables or the grammar must be expanded.
- Equivalent answers that require domain restrictions are outside the current polynomial equivalence model.
- No independent subject-matter content review was performed for a broad approved CAPS catalogue because such a catalogue was not exposed by the fixture.
- Mathematical Literacy and Physical Sciences assessment behavior is therefore provisional.

## Required next regression coverage

1. Add one approved golden activity per supported answer type.
2. Add counterexamples for variable ambiguity, tolerance boundaries, sign errors and coordinate order.
3. Add authoring validation that rejects unsupported notation before approval.
4. Add delayed-retrieval browser evidence: completion alone must not yield retained mastery.
5. Add reviewed CAPS metadata (grade, topic, cognitive demand and calculator policy) to content QA.

