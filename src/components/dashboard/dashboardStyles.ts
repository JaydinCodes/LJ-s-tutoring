// Shared classes keep dashboard surfaces quiet, glassy, and consistent across roles.
// Base has no background utility so callers that need a different translucent
// tint (error/skeleton states) can supply their own bg-*/opacity class without
// it silently losing to this one -- Tailwind resolves same-property utility
// conflicts by generated stylesheet order, not by className string order, so
// stacking two bg-* utilities on one element is never safe.
export const dashboardSurfaceBaseClass = 'rounded-[1.25rem] border border-white/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur-2xl dark:border-white/10 dark:shadow-black/25 sm:rounded-[1.5rem] sm:p-5';

export const dashboardSurfaceClass = `${dashboardSurfaceBaseClass} bg-white/[0.78] dark:bg-white/[0.06]`;

export const dashboardInsetClass = 'rounded-2xl border border-white/70 bg-white/[0.58] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]';

export const academyAppBackgroundClass = 'academy-app-bg';

export const academyStudentFlowClass = 'academy-student-flow';

export const academyMajorSurfaceClass = 'academy-major-surface';

export const academyRowClass = 'academy-row';

export const academyProgressTrackClass = 'academy-progress-track';

export const academyProgressFillClass = 'academy-progress-fill';
