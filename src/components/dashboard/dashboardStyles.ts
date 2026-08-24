// Shared classes keep dashboard surfaces quiet, solid, and consistent across roles.
// Base has no background utility so callers that need a different translucent
// tint (error/skeleton states) can supply their own bg-*/opacity class without
// it silently losing to this one -- Tailwind resolves same-property utility
// conflicts by generated stylesheet order, not by className string order, so
// stacking two bg-* utilities on one element is never safe.
export const dashboardSurfaceBaseClass = 'rounded-[1.25rem] border border-slate-200 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.055)] dark:border-white/10 dark:shadow-black/25 sm:rounded-[1.5rem] sm:p-5';

export const dashboardSurfaceClass = `${dashboardSurfaceBaseClass} bg-white dark:bg-slate-900`;

export const dashboardInsetClass = 'rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60';

export const academyAppBackgroundClass = 'academy-app-bg';

export const academyStudentFlowClass = 'academy-student-flow';

export const academyMajorSurfaceClass = 'academy-major-surface';

export const academyRowClass = 'academy-row';

export const academyProgressTrackClass = 'academy-progress-track';

export const academyProgressFillClass = 'academy-progress-fill';
