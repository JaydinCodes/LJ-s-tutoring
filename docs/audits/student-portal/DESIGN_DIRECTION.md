# Design Direction

## Product character

Project Odysseus should feel like a rigorous, welcoming South African learning studio: editorial rather than corporate, calm rather than gamified, and explicit about evidence of understanding. The existing navy, parchment and restrained gold system is worth retaining; it already separates the product from generic blue/purple SaaS dashboards.

## Typography

- Reserve the editorial serif face for page titles, milestones and short reflective statements.
- Use the sans-serif face for instructions, mathematical controls, tables and feedback.
- Keep mathematical notation large with generous line height and KaTeX/semantic rendering when notation grows beyond plain text.
- Avoid all-caps for sentences; retain it only for short navigation/eyebrow labels.

## Spacing and layout

- Use a predictable 4/8 px spacing scale.
- Constrain learning content to a readable measure; questions should not stretch across the full desktop canvas.
- Use borders and whitespace before shadows. Not every section needs to be a floating rounded card.
- On mobile, keep the prompt, response, confidence and submit action in one uninterrupted vertical sequence.

## Navigation

- Primary learner destinations: Today, Tasks, Learning, Results, Progress.
- Secondary destinations belong under More/Support: sessions, resources, careers and settings.
- Preserve the current mobile bottom navigation, but ensure labels remain readable at 320–390 px and focus returns to the triggering control after closing More.

## Educational components

- **Next learning action:** one dominant task with time estimate and evidence-based reason.
- **Misconception feedback:** neutral title, explanation, contrasting example, retry.
- **Mastery row:** plain-language state, evidence count/date, and next check.
- **School result:** assessment name, released mark, tutor feedback and cognitive-level breakdown.
- **Learning-loop timeline:** Identified → Practised → Recheck due → Secure/Retained.
- **Empty state:** explain whether the learner is caught up, awaiting tutor action, or missing setup.

## Motion and imagery

- Use motion to show state change, progress and focus—not decoration.
- Respect reduced-motion settings, as the implementation currently does.
- Reserve classical/voyage imagery for dashboard orientation and milestones. Keep active mathematics surfaces visually quiet.

## Patterns to avoid

- Rows of generic KPI cards without a learner decision attached.
- Decorative badges, gradients, glow and glass layers.
- Mythology-themed points, battles or quests that trivialise academic struggle.
- Multiple competing primary buttons.
- Generic praise disconnected from evidence.
- Mixing school marks and mastery into one percentage.
- Internal terms such as rule codes, RPC status or “diagnostic signal” in learner copy.

## Accessibility baseline

- Minimum 44×44 px touch targets.
- Visible `:focus-visible` indicators across light/dark themes.
- Programmatic labels and error associations.
- `aria-live` feedback for answer evaluation and network errors.
- 200% zoom/reflow without horizontal scrolling.
- Text/interactive contrast meeting WCAG AA; never communicate mastery by colour alone.

