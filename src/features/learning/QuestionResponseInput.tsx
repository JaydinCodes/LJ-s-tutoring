import { useState } from 'react';

interface QuestionOption {
  value: string;
  label: string;
}

interface QuestionResponseInputProps {
  questionType: string;
  options?: QuestionOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function QuestionResponseInput({ questionType, options, value, onChange, disabled }: QuestionResponseInputProps) {
  // numeric, fraction, multiple_choice, coordinate, linear_equation_solution, algebraic_expression, factorised_expression

  if (questionType === 'numeric' || questionType === 'fraction' || questionType === 'coordinate' || questionType === 'linear_equation_solution') {
    return (
      <input
        type="text"
        id="activity-answer"
        className="mt-2 w-full max-w-sm rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-medium shadow-sm transition focus:border-brand-aegean focus:outline-none focus:ring-2 focus:ring-brand-aegean/20 dark:border-white/15 dark:bg-slate-950 dark:text-white"
        placeholder={`Enter ${questionType === 'fraction' ? 'a fraction (e.g. 3/4)' : questionType === 'coordinate' ? 'a coordinate (e.g. 2,3)' : 'a number'}...`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    );
  }

  if (questionType === 'multiple_choice') {
    return (
      <div className="mt-4 flex flex-col gap-3">
        {(options || []).map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
              value === option.value
                ? 'border-brand-aegean bg-brand-aegean/10 dark:border-brand-gold dark:bg-brand-gold/10'
                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="mcq-answer"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="h-5 w-5 border-slate-300 text-brand-aegean focus:ring-brand-aegean dark:border-white/20 dark:bg-slate-950 dark:checked:bg-brand-gold"
            />
            <span className="font-medium text-brand-navy dark:text-brand-parchment">{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  // Fallback for text/algebraic expressions
  return (
    <textarea
      id="activity-answer"
      className="mt-2 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-medium shadow-sm transition focus:border-brand-aegean focus:outline-none focus:ring-2 focus:ring-brand-aegean/20 dark:border-white/15 dark:bg-slate-950 dark:text-white"
      placeholder="Type your mathematical answer or expression here..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

