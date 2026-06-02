import type { ReactNode } from 'react';
import { dashboardSurfaceClass } from '../dashboard/dashboardStyles';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`${dashboardSurfaceClass} ${className}`}>
      {children}
    </section>
  );
}
