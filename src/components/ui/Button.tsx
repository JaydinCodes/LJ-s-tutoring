import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; children: ReactNode }) {
  const styles = {
    primary: 'academy-btn-primary',
    secondary: 'academy-btn-outline',
    ghost: 'text-slate-600 hover:bg-white/70 dark:text-academy-marble dark:hover:bg-white/[0.08]',
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
