import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DashboardShell, type DashboardSection } from './DashboardShell';
import { dashboardInsetClass, dashboardSurfaceClass } from './dashboardStyles';

type MetricTone = 'navy' | 'aegean' | 'gold' | 'marble';

const metricToneClasses: Record<MetricTone, string> = {
  navy: 'border-brand-navy/15 bg-brand-navy text-white dark:border-brand-marble/20 dark:bg-brand-navy',
  aegean: 'border-brand-aegean/25 bg-brand-aegean/10 text-brand-obsidian dark:border-brand-aegean/60 dark:bg-brand-aegean/20 dark:text-brand-parchment',
  gold: 'border-brand-gold/50 bg-brand-gold/15 text-brand-obsidian dark:border-brand-gold/60 dark:bg-brand-gold/20 dark:text-brand-parchment',
  marble: 'border-brand-marble bg-white/95 text-brand-obsidian dark:border-brand-marble/20 dark:bg-brand-obsidian dark:text-brand-parchment',
};

// Route transitions use transforms only so the document keeps its layout while pages enter.
export function RouteTransition({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="min-h-px space-y-4"
      initial={{ opacity: prefersReducedMotion ? 0.98 : 0, y: prefersReducedMotion ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.32, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Stagger wrappers keep repeated dashboard cards coordinated without animating their layout.
export function StaggerGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: prefersReducedMotion ? 0 : 0.04,
            staggerChildren: prefersReducedMotion ? 0 : 0.07,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: prefersReducedMotion ? 0.98 : 0, y: prefersReducedMotion ? 0 : 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: prefersReducedMotion ? 0.1 : 0.28, ease: 'easeOut' },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

// PageShell keeps route code focused on content while DashboardShell owns navigation.
export function PageShell({
  title,
  subtitle,
  section,
  children,
}: {
  title: string;
  subtitle: string;
  section: DashboardSection;
  children: ReactNode;
}) {
  return (
    <DashboardShell title={title} subtitle={subtitle} section={section}>
      <RouteTransition>{children}</RouteTransition>
    </DashboardShell>
  );
}

export function GreekHeroCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      className="group relative overflow-hidden rounded-[1.5rem] border border-brand-aegean/50 bg-[linear-gradient(135deg,_#0f172a_0%,_#1e3a5f_54%,_#1F6F8B_100%)] p-5 text-white shadow-xl shadow-brand-navy/20 sm:p-8"
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-brand-gold/25 bg-brand-gold/10" />
      <div className="absolute left-6 top-6 h-24 w-24 rounded-full bg-brand-marble/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 h-2 w-full bg-[repeating-linear-gradient(90deg,_#f4c518_0,_#f4c518_18px,_transparent_18px,_transparent_30px)] opacity-70" />
      {/* The shine is transform-only and disabled for reduced-motion users. */}
      <div
        className="pointer-events-none absolute inset-y-0 -left-1/3 hidden w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition duration-700 motion-safe:group-hover:translate-x-[420%] motion-safe:group-hover:opacity-50 motion-reduce:hidden sm:block"
        aria-hidden="true"
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-gold">{eyebrow}</p>
        <h2 className="greek-display mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-parchment">{description}</p>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </motion.section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tone = 'marble',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: MetricTone;
}) {
  const mutedText = tone === 'navy' ? 'text-brand-parchment' : 'text-slate-600 dark:text-brand-marble';

  return (
    <article className={`rounded-[1.5rem] border p-5 shadow-sm ${metricToneClasses[tone]}`}>
      <p className={`text-sm font-medium ${mutedText}`}>{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-2 text-sm leading-6 ${mutedText}`}>{helper}</p>
    </article>
  );
}

export function InsightCard({
  title,
  description,
  children,
  tone = 'marble',
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  tone?: MetricTone;
}) {
  return (
    <article className={`rounded-[1.5rem] border p-5 shadow-sm ${metricToneClasses[tone]}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}

export function ProgressRing({ value, label }: { value: number | null | undefined; label?: string }) {
  const prefersReducedMotion = useReducedMotion();
  const score = value == null || !Number.isFinite(Number(value)) ? 0 : Math.max(0, Math.min(100, Number(value)));
  const display = value == null || !Number.isFinite(Number(value)) ? '--' : `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}%`;

  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center" role="img" aria-label={label ? `${label}: ${display}` : display}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          pathLength="1"
          stroke="#1F6F8B"
          strokeLinecap="round"
          strokeWidth="6"
          initial={{ pathLength: prefersReducedMotion ? score / 100 : 0 }}
          animate={{ pathLength: score / 100 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.65, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center text-sm font-bold text-brand-obsidian dark:text-brand-parchment">{display}</span>
    </div>
  );
}

export function AnimatedProgressBar({
  value,
  color,
  className = 'bg-brand-aegean',
}: {
  value: number | null | undefined;
  color?: string;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const score = value == null || !Number.isFinite(Number(value)) ? 0 : Math.max(0, Math.min(100, Number(value)));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {/* Scaling the filled track animates once on mount without changing the reserved bar width. */}
      <motion.div
        className={`h-full rounded-full ${className}`}
        initial={{ scaleX: prefersReducedMotion ? 1 : 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: 'easeOut' }}
        style={{ width: `${score}%`, transformOrigin: 'left', backgroundColor: color }}
      />
    </div>
  );
}

export function TimelineCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <article className={dashboardInsetClass}>
      <div className="flex gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-brand-gold ring-4 ring-brand-gold/20" />
        <div className="min-w-0">
          <h3 className="font-semibold text-brand-obsidian dark:text-brand-parchment">{title}</h3>
          {meta ? <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-brand-marble">{meta}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </article>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-brand-aegean/50 bg-brand-parchment/70 p-6 text-center dark:border-brand-aegean/70 dark:bg-brand-navy/60">
      <h3 className="text-base font-semibold text-brand-obsidian dark:text-brand-parchment">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">{description}</p>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <section className={`${dashboardSurfaceClass} border-red-200 bg-red-50/95 dark:border-red-900 dark:bg-red-950/40`}>
      <h2 className="text-lg font-semibold text-red-950 dark:text-red-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">{description}</p>
      {onRetry ? <PremiumButton className="mt-4" onClick={onRetry}>Retry</PremiumButton> : null}
    </section>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return <div className={`${dashboardSurfaceClass} min-h-36 animate-pulse bg-brand-marble/70 dark:bg-brand-navy/80 ${className}`} aria-hidden="true" />;
}

export function PremiumButton({
  children,
  variant = 'navy',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'navy' | 'gold' | 'outline';
}) {
  const styles = {
    navy: 'bg-brand-navy text-white hover:bg-brand-deepBlue dark:bg-brand-aegean dark:hover:bg-brand-deepBlue',
    gold: 'bg-brand-gold text-brand-obsidian hover:bg-[#f7d24f]',
    outline: 'border border-brand-aegean/50 bg-white/80 text-brand-navy hover:bg-brand-parchment dark:bg-brand-obsidian dark:text-brand-parchment dark:hover:bg-brand-navy',
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
