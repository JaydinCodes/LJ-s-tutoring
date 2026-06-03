import type { HTMLAttributes, ReactNode } from 'react';
import { dashboardSurfaceClass } from '../dashboard/dashboardStyles';

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={`${dashboardSurfaceClass} ${className}`} {...props}>
      {children}
    </section>
  );
}
