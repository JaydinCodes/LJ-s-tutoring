import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Sparkles, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { DashboardShell, type DashboardSection } from './DashboardShell';
import { academyProgressFillClass, academyProgressTrackClass, dashboardInsetClass, dashboardSurfaceClass } from './dashboardStyles';

type MetricTone = 'navy' | 'aegean' | 'gold' | 'marble';

const metricToneClasses: Record<MetricTone, string> = {
  navy: 'border-white/65 bg-brand-navy text-white shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/[0.08]',
  aegean: 'border-white/70 bg-white/76 text-brand-obsidian shadow-[0_18px_45px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
  gold: 'border-white/70 bg-white/76 text-brand-obsidian shadow-[0_18px_45px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
  marble: 'border-white/70 bg-white/76 text-brand-obsidian shadow-[0_18px_45px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
};

const toneAccentClasses: Record<MetricTone, string> = {
  navy: 'text-brand-gold bg-white/10 border-white/10',
  aegean: 'text-brand-aegean bg-brand-aegean/[0.07] border-brand-aegean/10 dark:bg-brand-aegean/10',
  gold: 'text-[#9a6a05] bg-brand-gold/[0.12] border-brand-gold/20 dark:text-brand-gold dark:bg-brand-gold/10',
  marble: 'text-slate-500 bg-slate-950/[0.04] border-slate-950/[0.06] dark:text-brand-marble dark:bg-white/[0.06]',
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
      className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,_rgba(31,111,139,0.38),_transparent_34%),linear-gradient(135deg,_#071326_0%,_#102b49_56%,_#0f172a_100%)] p-5 text-white shadow-[0_26px_80px_rgba(7,19,38,0.28)] sm:p-8"
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border border-white/10 bg-white/5 blur-sm" />
      <div className="absolute left-6 top-6 h-24 w-24 rounded-full bg-brand-aegean/20 blur-3xl" />
      <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold/70 to-transparent" />
      {/* The shine is transform-only and disabled for reduced-motion users. */}
      <div
        className="pointer-events-none absolute inset-y-0 -left-1/3 hidden w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition duration-700 motion-safe:group-hover:translate-x-[420%] motion-safe:group-hover:opacity-50 motion-reduce:hidden sm:block"
        aria-hidden="true"
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-gold/90">{eyebrow}</p>
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
  icon: Icon,
  tone = 'marble',
}: {
  label: string;
  value: string;
  helper: string;
  icon?: LucideIcon;
  tone?: MetricTone;
}) {
  const mutedText = tone === 'navy' ? 'text-brand-parchment' : 'text-slate-600 dark:text-brand-marble';

  return (
    <article className={`rounded-[1.6rem] border p-5 backdrop-blur-2xl ${metricToneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-medium ${mutedText}`}>{label}</p>
        {Icon ? (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[1.15rem] border ${toneAccentClasses[tone]}`}>
            <Icon className="h-5 w-5 text-current" aria-hidden="true" strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <p className="mt-3 break-words text-3xl font-semibold tracking-tight">{value}</p>
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
    <article className={`rounded-[1.6rem] border p-5 backdrop-blur-2xl ${metricToneClasses[tone]}`}>
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
    <div className={academyProgressTrackClass}>
      {/* Scaling the filled track animates once on mount without changing the reserved bar width. */}
      <motion.div
        className={`${academyProgressFillClass} ${className}`}
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
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-gold ring-4 ring-brand-gold/15" />
        <div className="min-w-0">
          <h3 className="font-semibold text-brand-obsidian dark:text-brand-parchment">{title}</h3>
          {meta ? <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-brand-marble">{meta}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/70 p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/45 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto grid h-11 w-11 place-items-center rounded-[1.1rem] border border-brand-aegean/10 bg-brand-aegean/[0.06] text-brand-aegean dark:border-brand-gold/20 dark:bg-brand-gold/10 dark:text-brand-gold">
        <Icon className="h-5 w-5 text-current" aria-hidden="true" strokeWidth={2} />
      </div>
      <h3 className="relative mt-4 text-base font-semibold text-brand-obsidian dark:text-brand-parchment">{title}</h3>
      <p className="relative mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-brand-marble">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          className="relative mt-4 inline-flex items-center justify-center rounded-full border border-slate-950/10 bg-white/75 px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment dark:hover:bg-white/[0.09]"
          to={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
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
    <section className={`${dashboardSurfaceClass} border-red-200/70 bg-red-50/80 dark:border-red-900/60 dark:bg-red-950/30`}>
      <h2 className="text-lg font-semibold text-red-950 dark:text-red-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">{description}</p>
      {onRetry ? <PremiumButton className="mt-4" onClick={onRetry}>Retry</PremiumButton> : null}
    </section>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return <div className={`${dashboardSurfaceClass} min-h-36 animate-pulse bg-white/55 dark:bg-white/[0.05] ${className}`} aria-hidden="true" />;
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
    navy: 'academy-btn-primary',
    gold: 'academy-btn-gold',
    outline: 'academy-btn-outline',
  }[variant];

  return (
    <button
      className={`academy-btn ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
