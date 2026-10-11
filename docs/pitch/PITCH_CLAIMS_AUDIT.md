# Pitch claims audit

| Claim | Status | Evidence | Can use in pitch? |
| --- | --- | --- | --- |
| Project Odysseus offers CAPS-aligned tutoring for Grades 8–12 in Mathematics, Mathematical Literacy, and Physical Sciences. | VERIFIED | `src/app/routes/PublicRoutes.tsx` | Yes |
| Project Odysseus combines human tutoring with structured learning evidence and targeted next steps. | VERIFIED | `src/app/routes/PublicRoutes.tsx`; `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md` | Yes |
| The Golden Demo evaluates Grade 9 Difference of Two Squares responses deterministically. | VERIFIED | `docs/demo/GOLDEN_DEMO.md`; `tests/e2e-react/golden-demo-journey.spec.ts` | Yes |
| `(x - 5)^2` is recognised in the demo as a difference-of-squares error pattern and receives learner-friendly feedback. | VERIFIED | `docs/demo/GOLDEN_DEMO.md`; `src/features/learning/misconceptionExplanations.ts` | Yes |
| A retry does not overwrite the original incorrect response. | VERIFIED | `docs/demo/GOLDEN_DEMO.md` | Yes |
| School results and learning mastery/progress are distinct records. | VERIFIED | `docs/demo/GOLDEN_DEMO.md`; `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md` | Yes |
| One corrected answer does not automatically establish strong understanding/mastery. | VERIFIED | `docs/demo/GOLDEN_DEMO.md`; `tests/e2e-react/golden-demo-journey.spec.ts` | Yes |
| Tutors remain responsible for teaching and can accept, modify, or reject recommendations. | VERIFIED | `docs/architecture/GRADE9_EVIDENCE_LEARNING_SYSTEM.md` | Yes |
| The platform has role-based access, RLS, private storage, controlled sensitive mutations, and admin MFA. | VERIFIED | `docs/architecture/ARCHITECTURE.md`; `docs/supabase/PRODUCTION_RLS_REVIEW.md` | Yes, use precise wording |
| The platform is POPIA compliant or certified. | QUALIFIED | Controls are documented, but legal/vendor/production review remains open in `docs/compliance/POPIA_DATA_MAP.md`. | Only say “designed with POPIA safeguards.” |
| Paid private 1:1 and small-group tutoring are the documented current commercial engine. | VERIFIED | `docs/product/BUSINESS_MODEL_CANVAS.md` | Yes |
| School contracts, sponsored NGO cohorts, and institutional reporting are current revenue streams. | FUTURE | `docs/product/BUSINESS_MODEL_CANVAS.md` labels them planned expansion. | No; label as future pathways |
| Community outreach is active and production-safe. | REMOVE | `docs/product/ROADMAP.md` explicitly defers Community for safety/isolation work. | No |
| The platform serves a named number of learners or schools. | REMOVE | No verified current count. | No |
| Learners improve marks by a stated percentage. | REMOVE | No outcome study or verified percentage. | No |
| The system proves learner mastery or diagnoses misconceptions with AI accuracy. | REMOVE | Evidence system is deterministic; docs explicitly limit external validity and do not claim proof. | No |
| The platform is an AI tutor, chatbot, replacement for teachers, or autonomous LMS. | REMOVE | Contradicts the human-tutoring/evidence model. | No |
| Project Odysseus has active named partner relationships. | REMOVE | Partner categories are documented; named current partnerships are not. | No |
| The platform can scale nationally today. | FUTURE | Scale/partner delivery requires roadmap work and external validation. | Only as an aspiration, never as current fact |
| More CAPS content, stronger tutor workflows, school partnerships, reporting, offline/data-light capability, and more subjects are next-stage work. | FUTURE | `docs/product/ROADMAP.md` | Yes, explicitly labelled Roadmap |
| A local synthetic Golden Demo completed a recorded end-to-end runtime test run. | VERIFIED | `work/golden-e2e-final-5.log`, 10 October 2026 | Yes, only as technical validation—not traction |
| Project Odysseus has proven learning impact in real learner cohorts. | REMOVE | No supervised real-learner pilot outcome evidence. | No |

## Required language choices

- Say **“recognises evidence consistent with a response pattern”**, not **“diagnoses the learner.”**
- Say **“learning progress is accumulated evidence about specific skills”**, not **“mastery score”** unless discussing the internal, governed state precisely.
- Say **“designed with POPIA safeguards”**, not **“POPIA compliant/certified.”**
- Say **“planned / future pathway”** for schools, NGOs, sponsors, content breadth, data-light/offline, and scale unless separately evidenced at presentation time.
