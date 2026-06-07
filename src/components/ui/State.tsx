import type { ReactNode } from 'react';
import { AlertTriangle, Lock, RefreshCw, UserRound, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

type StateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

function actionClass(primary = false) {
  return primary
    ? 'inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800'
    : 'inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50';
}

function StateActions({ primaryAction, secondaryAction }: { primaryAction?: StateAction; secondaryAction?: StateAction }) {
  const actions = [primaryAction, secondaryAction].filter(Boolean) as StateAction[];
  if (!actions.length) {
    return null;
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
      {actions.map((action, index) => {
        const className = actionClass(index === 0);
        if (action.href) {
          return <Link key={action.label} className={className} to={action.href}>{action.label}</Link>;
        }

        return <button key={action.label} className={className} type="button" onClick={action.onClick}>{action.label}</button>;
      })}
    </div>
  );
}

export function LoadingState({ title = 'Loading', description = 'Preparing the latest information...' }: { title?: string; description?: string }) {
  return (
    <Card aria-live="polite">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-aegean/10 text-brand-aegean">
          <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </Card>
  );
}

export function RetryButton({ onRetry, label = 'Retry' }: { onRetry: () => void; label?: string }) {
  return (
    <button className={actionClass(true)} type="button" onClick={onRetry}>
      {label}
    </button>
  );
}

export function InlineLoadingState({ label = 'Loading latest data...' }: { label?: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700" role="status" aria-live="polite">
      <RefreshCw className="h-4 w-4 animate-spin text-brand-aegean" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  title = 'Data unavailable',
  description,
  onRetry,
  dashboardHref = '/dashboard',
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  dashboardHref?: string;
}) {
  return (
    <Card className="border-red-200/80 bg-red-50/80">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-red-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-red-800">{description}</p>
          <StateActions
            primaryAction={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
            secondaryAction={{ label: 'Go back to dashboard', href: dashboardHref }}
          />
        </div>
      </div>
    </Card>
  );
}

export function PermissionDeniedState({
  description = 'Your account does not have access to this part of the portal.',
  dashboardHref = '/dashboard',
}: {
  description?: string;
  dashboardHref?: string;
}) {
  return (
    <EmptyState
      title="Access denied"
      description={description}
      actionLabel="Go back to dashboard"
      actionHref={dashboardHref}
      icon={Lock}
    />
  );
}

export function MissingProfileState() {
  return (
    <EmptyState
      title="Profile missing"
      description="Your account setup is incomplete. Please contact support so we can finish linking your profile."
      actionLabel="Back to sign in"
      actionHref="/dashboard/login"
      icon={UserRound}
    />
  );
}

export function EmptyDataState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: LucideIcon;
}) {
  return <EmptyState title={title} description={description} actionLabel={actionLabel} actionHref={actionHref} icon={icon} />;
}

export function InlineFeedback({ tone = 'error', children }: { tone?: 'error' | 'success'; children: ReactNode }) {
  const classes = tone === 'success'
    ? 'rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800'
    : 'rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800';

  return <p className={classes}>{children}</p>;
}
