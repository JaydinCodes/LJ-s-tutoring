import type { HTMLAttributes, ReactNode } from 'react';
import { dashboardSurfaceBaseClass, dashboardSurfaceClass } from '../dashboard/dashboardStyles';

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  // Set to false when className supplies its own bg-*/opacity utility (e.g. a
  // tinted error state) so it doesn't conflict with the default surface tint.
  background?: boolean;
};

export function Card({ children, className = '', background = true, ...props }: CardProps) {
  const surface = background ? dashboardSurfaceClass : dashboardSurfaceBaseClass;
  return (
    <section className={`${surface} ${className}`} {...props}>
      {children}
    </section>
  );
}
