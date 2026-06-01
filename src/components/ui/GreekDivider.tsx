import { useId } from 'react';

type GreekDividerProps = {
  background?: 'navy' | 'parchment' | 'white' | 'slate';
  tone?: 'navy' | 'gold';
};

const backgrounds = {
  navy: 'bg-brand-navy',
  parchment: 'bg-brand-parchment',
  white: 'bg-white',
  slate: 'bg-slate-950',
};

const tones = {
  navy: 'text-brand-navy',
  gold: 'text-brand-gold',
};

export function GreekDivider({ background = 'white', tone = 'navy' }: GreekDividerProps) {
  const patternId = `greek-meander-${useId().replace(/:/g, '')}`;

  return (
    <div className={`${backgrounds[background]} overflow-hidden py-3 sm:py-4`} aria-hidden="true">
      <svg
        className={`h-4 w-full opacity-[0.14] ${tones[tone]}`}
        viewBox="0 0 1440 16"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={patternId} width="48" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M0 2h38v12H10V6h18v4H16"
              fill="none"
              stroke="currentColor"
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
