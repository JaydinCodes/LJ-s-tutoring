# Project Odysseus pitch fact sheet

**Purpose:** source-controlled pitch facts only. A claim may be used only with the classification shown here. "Qualified" means the wording below must be retained; it is not a licence to strengthen the claim. This sheet intentionally contains no market-size, learner-count, attainment, partnership, pricing, or AI-accuracy claims.

## Organisation

- **VERIFIED** — Project Odysseus provides CAPS-aligned tutoring and learning intelligence for Grade 8–12 learners. Source: `src/app/routes/PublicRoutes.tsx`.
- **VERIFIED** — Its stated model combines human tutoring with structured learning evidence, targeted practice, and progress visibility. Source: `src/app/routes/PublicRoutes.tsx`, `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md`.
- **QUALIFIED** — The project documents delivery strands for private tutoring, schools, NGOs, and community outreach. Only private tutoring is documented as the current commercial engine; do not present the other strands as active external programmes or partnerships. Source: `docs/product/BUSINESS_MODEL_CANVAS.md`, `docs/product/ROADMAP.md`.
- **DO NOT USE** — A current team size. Repository documents conflict (a two-person core-team note and a five-person operational note), and neither is a reliable pitch metric. Source: `docs/product/ROADMAP.md`, `docs/product/TUTOR_AND_VOLUNTEER_MODEL.md`.

## Tutoring offer

- **VERIFIED** — The public offer includes CAPS-aligned tutoring with human teaching, targeted practice, and learner-progress visibility. Source: `src/app/routes/PublicRoutes.tsx`.
- **VERIFIED** — In-person tutoring is documented as the main offer; occasional online Zoom or Google Meet sessions can be arranged for package holders. Source: `src/app/routes/PublicRoutes.tsx`.
- **QUALIFIED** — Private one-to-one and small-group tutoring are documented as current revenue streams. Do not imply a validated pricing model, recurring-revenue level, or scale. Source: `docs/product/BUSINESS_MODEL_CANVAS.md`.

## Subjects

- **VERIFIED** — The marketing offer names Mathematics, Mathematical Literacy, and Physical Sciences. Source: `src/app/routes/PublicRoutes.tsx`.
- **VERIFIED** — The Golden Demo and implemented evidence-learning vertical are Grade 9 Mathematics. Source: `docs/demo/GOLDEN_DEMO.md`, `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md`.
- **QUALIFIED** — The repository contains a Grades 8–12 Mathematics curriculum map. Do not say that complete platform content is delivered across all subjects or grades. Source: `docs/product/MATHS_CURRICULUM_MAP.md`, `docs/product/ROADMAP.md`.

## Grades

- **VERIFIED** — The tutoring offer is for Grade 8–12 learners. Source: `src/app/routes/PublicRoutes.tsx`.
- **VERIFIED** — Difference of Two Squares is represented in the Grade 9 Mathematics vertical. Source: `docs/architecture/GRADE9_INSTRUCTIONAL_VALIDATION.md`.

## Learners / users

- **VERIFIED** — The platform has student, tutor, parent, NGO-partner, and admin role routes, each protected by role checks; admin routes additionally require MFA. Source: `docs/architecture/ARCHITECTURE.md`.
- **VERIFIED** — The Golden Demo learner is Lethabo Mokoena, a synthetic Grade 9 learner at Project Odysseus Demo School. Source: `docs/demo/GOLDEN_DEMO.md`.
- **DO NOT USE** — Any active learner, parent, tutor, school, NGO, or cohort count. No current, pitch-ready count is verified in the repository.

## Team

- **VERIFIED** — Tutors retain professional agency: documented recommendation decisions can be accepted, modified, or rejected without erasing the original recommendation. Source: `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md`.
- **QUALIFIED** — Current tutors are described in a living operational document as a personally known family-and-friends network. This is operational context, not a pitch proof point. Source: `docs/product/TUTOR_AND_VOLUNTEER_MODEL.md`.
- **DO NOT USE** — Claims that all tutors are formally vetted today. The future/placement gate is implemented, while existing tutor verification remains an operational review requirement. Source: `docs/product/ROADMAP.md`, `docs/product/TUTOR_AND_VOLUNTEER_MODEL.md`.

## Partners

- **QUALIFIED** — Schools, NGOs, funders/sponsors, community venues, and qualified teachers/senior tutors are documented as intended partner categories. Present these as partnership pathways, not signed relationships. Source: `docs/product/BUSINESS_MODEL_CANVAS.md`.
- **DO NOT USE** — Named school, NGO, corporate, government, or university partnerships. The repository supplies no pitch-safe proof of a current external partnership.

## Current product capabilities

- **VERIFIED** — The Grade 9 learning system stores learner responses, confidence, time-on-task, hints, evaluation, skill evidence, misconception evidence, and versioned mastery evaluations. Confidence and time are contextual evidence, not mastery points. Source: `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md`.
- **VERIFIED** — The Golden Demo evaluates its factorisation responses deterministically; the known wrong response is recognised as `DOTS_AS_SQUARE_OF_DIFFERENCE` and receives a learner-friendly explanation. Source: `docs/demo/GOLDEN_DEMO.md`, `src/features/learning/misconceptionExplanations.ts`.
- **VERIFIED** — The Golden Demo has a database-backed retry flow; incorrect attempts are not overwritten, and activity progress advances only after a correct evaluated attempt. Source: `docs/demo/GOLDEN_DEMO.md`.
- **VERIFIED** — Formal school-result records are separate from learning mastery. Source: `docs/demo/GOLDEN_DEMO.md`, `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md`.
- **VERIFIED** — The learner-facing question route exposes approved prompts and hints rather than answer-key-bearing question versions. Source: `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md`.
- **QUALIFIED** — The platform includes wider operational routes (assignments, reports, tutor workflows, and administration). Do not make them central to this pitch or claim they are all externally release-ready. Source: `docs/architecture/ARCHITECTURE.md`, `docs/product/ROADMAP.md`.
- **DO NOT USE** — "AI tutor", chatbot, autonomous teaching, generic adaptive-learning, automatic diagnosis, or claims that an error code proves a learner's underlying misconception. The Golden Demo uses deterministic response-pattern evaluation; it is evidence to guide tutoring, not a definitive learner label.

## Golden Demo

- **VERIFIED** — The canonical demo is Grade 9 Mathematics, Difference of Two Squares, with Lethabo Mokoena. Source: `docs/demo/GOLDEN_DEMO.md`.
- **VERIFIED** — The sequence is: targeted activity → correct warm-up → `(x - 5)^2` with high confidence → learner-friendly contrast → retry `(x - 5)(x + 5)` → activity completion → persisted progress. Source: `docs/demo/GOLDEN_DEMO.md`, `tests/e2e-react/golden-demo-journey.spec.ts`.
- **VERIFIED** — The seeded learner begins with Difference of Two Squares as `Starting`; after the activity the system does not show `Strong understanding`. Source: `docs/demo/GOLDEN_DEMO.md`, `tests/e2e-react/golden-demo-journey.spec.ts`.

## Current traction

- **VERIFIED** — The repository contains a working local end-to-end Golden Demo fixture and a passing recorded local runtime test run dated 10 October 2026. Source: `docs/demo/GOLDEN_DEMO.md`, `work/golden-e2e-final-5.log`.
- **QUALIFIED** — This is technical validation of a local synthetic fixture, not evidence of market traction, learner outcomes, paid usage, school adoption, or production deployment.
- **DO NOT USE** — User counts, retention, completion rates, academic improvement, revenue, growth, adoption, or impact percentages.

## Pricing / revenue model where documented

- **VERIFIED** — Paid private one-to-one and small-group tutoring, funded by parents/guardians, are documented as current revenue streams. Source: `docs/product/BUSINESS_MODEL_CANVAS.md`.
- **QUALIFIED** — School contracts, school/parent-funded programmes, NGO/funder-sponsored cohorts, and institutional reporting/programme-management packages are planned expansion routes. Label them as future pathways. Source: `docs/product/BUSINESS_MODEL_CANVAS.md`.
- **DO NOT USE** — Exact fees, packages, margins, unit economics, forecasts, or affordability claims. The business canvas explicitly says these remain to be validated.

## Funding / support needs where documented

- **QUALIFIED** — The documented roadmap needs investment in content authoring/review, platform hosting and backup, safeguarding, partner onboarding, support, data-light/offline work, and community delivery. Source: `docs/product/BUSINESS_MODEL_CANVAS.md`, `docs/product/ROADMAP.md`.
- **DO NOT USE** — A funding amount, runway, valuation, committed investor, or grant claim. None is documented.

## Technology

- **VERIFIED** — The active application is React + TypeScript on a Supabase-first architecture: Auth, Postgres, RLS, Storage, and secure RPCs; trusted operations use Supabase Edge Functions. Source: `README.md`, `docs/architecture/ARCHITECTURE.md`.
- **VERIFIED** — The Grade 9 recommendation and mastery logic is deterministic, pure, persisted with versioned rule sets, and auditable. Source: `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md`.
- **DO NOT USE** — "AI-powered diagnosis" or model-accuracy claims. The documented Groq integration is a separate careers-assistant proxy, not the Golden Demo evaluator. Source: `README.md`, `docs/compliance/POPIA_DATA_MAP.md`.

## Security / privacy

- **VERIFIED** — The architecture uses role-based protected routes, Supabase RLS, private Storage, controlled RPCs for sensitive mutations, and admin MFA. Source: `docs/architecture/ARCHITECTURE.md`, `docs/supabase/PRODUCTION_RLS_REVIEW.md`.
- **VERIFIED** — The privacy data map classifies minor identity and academic records as high sensitivity and documents access, anonymisation, and retention controls. Source: `docs/compliance/POPIA_DATA_MAP.md`.
- **QUALIFIED** — Say "designed with POPIA safeguards" rather than "POPIA compliant/certified". Legal review, vendor-transfer review, and production scheduling evidence remain open. Source: `docs/compliance/POPIA_DATA_MAP.md`, `docs/compliance/SAFEGUARDING_AND_CHILD_PROTECTION.md`.

## Future roadmap

- **QUALIFIED** — More CAPS content, stronger tutor workflows, external school/NGO delivery, parent/organisation reporting, data-light/offline capability, language layers, and more subjects are roadmap work. Label them as future. Source: `docs/product/ROADMAP.md`.
- **DO NOT USE** — Presenting roadmap work as already launched, especially complete Grades 8–12 content, external cohort readiness, community delivery, offline mode, or scaled national adoption.
