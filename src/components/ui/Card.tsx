import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.5rem] border border-white/70 bg-white/95 p-5 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none ${className}`}>
      {children}
    </section>
  );
}
