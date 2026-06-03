import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold text-slate-800 dark:text-brand-parchment">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-slate-500 dark:text-brand-marble">{hint}</span> : null}
    </label>
  );
}

export const inputClassName = 'w-full rounded-2xl border border-brand-marble bg-white px-3 py-2 text-sm text-brand-obsidian outline-none transition focus:border-brand-aegean focus:ring-2 focus:ring-brand-aegean/20 dark:border-brand-marble/30 dark:bg-brand-navy dark:text-brand-parchment dark:focus:border-brand-gold dark:focus:ring-brand-gold/20';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClassName} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClassName} min-h-28 resize-y`} {...props} />;
}
