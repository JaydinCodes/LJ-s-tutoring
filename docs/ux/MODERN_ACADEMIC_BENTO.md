# Modern Academic Bento dashboard redesign

## Existing structure

The application keeps route composition in `src/app`, authentication and role guards in `src/features/auth`, shared dashboard UI in `src/components/dashboard`, and role-specific data fetching and views under `src/features/students`, `src/features/tutors`, and `src/features/admin`. Supabase repositories remain the source of truth for dashboard data, while the E2E harness supplies bounded fixtures through the existing mock layer.

## Redesign approach

- `DashboardShell` owns the recognisable Project Odysseus frame: grouped desktop navigation, the compact header, viewport-safe scrolling, and the five-item mobile navigation with an accessible More dialog.
- Tailwind theme tokens and the dashboard design-system components provide parchment, navy, Aegean blue, gold, slate, borders, radii, focus states, dark mode, reduced motion, and state surfaces.
- Student, tutor, and admin dashboards remain separate because their workflows and information density differ. They reuse shell, surface, metric, action, loading, empty, and error primitives.
- The student view prioritises the next learning action; the tutor view prioritises the next teaching session and review work; the admin view prioritises operational metrics and an actionable queue.
- Displayed metrics are derived from existing repository records. The admin session summary adds only a bounded read of the existing `sessions` table and does not change schemas, authorization, or mutations.

## Responsive and accessibility behaviour

Desktop navigation is grouped and independently scrollable inside the viewport. Below the desktop breakpoint it is removed from layout and replaced by four role-specific primary destinations plus More. The More dialog traps focus, closes with Escape, and restores focus. Touch targets are at least 44px, content stacks instead of compressing, and the shell clips accidental horizontal overflow.

Theme preference is restored at application startup. Selected controls expose their state, public tutor biographies use explicit touch- and keyboard-operable controls, and route-level loading uses the branded shell skeleton instead of a raw full-screen message. Loading, empty, error, and success treatments share the same solid-surface system.

## Student concept-art precision pass

The student home route uses the reference composition directly: a 7:5 learning-plan and session hero, followed by a 5:4:3 assignments, progress, and feedback/streak row. The learner identity pill receives the real dashboard name and grade, active student navigation uses a gold icon treatment, and sparse assignment states can include a clearly labelled suggested-practice row derived from the existing battle plan. Lightweight classical background motifs and a restrained parchment texture provide the editorial detail without obscuring live content.

## Student Smart Task Queue

The Tasks route replaces the previous status-first assignment tabs with an action-first queue. A pure selector assigns each visible assignment to exactly one group: Needs attention, Upcoming, Waiting for feedback, or Recently marked. Returned corrections lead the queue, followed by overdue and due-soon work; submitted work never re-enters an overdue group. Staff-marked submissions remain under review until the student-safe response contains released result evidence.

The desktop route automatically previews the highest-priority visible task and stores explicit selections in the URL query string so links and browser history remain meaningful. Mobile rows open the existing full assignment route, where upload, retry, correction, version history, and ambiguous-success protections remain unchanged. Empty queues do not render a detail placeholder.

Concept fields were mapped conservatively. The real model supports title, resolved subject, due timestamp, instructions, assignment attachments, submission file metadata, submission dates, released marks, and released feedback. It does not support assignment-specific estimated duration, percent-complete tracking, assignment-specific accepted formats, or a reliable assignment-to-tutor display relationship. Those values are omitted; the panel labels the existing allocated tutor relationship explicitly and shows only the application-wide validated upload formats and size limit.

## Verification coverage

Targeted unit and Playwright coverage checks grouped admin navigation overflow, mobile More behaviour, focus restoration, theme restoration after reload, primary-action visibility, public bio disclosure, route loading, Smart Task Queue priority/grouping/release rules, and horizontal overflow at 390x844, 768x1024, 1366x768, and 1440x1000. Dashboard screenshots are written to `artifacts/dashboard-redesign`; Smart Task Queue evidence is written to `artifacts/smart-task-queue`.
