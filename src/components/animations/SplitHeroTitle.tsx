import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import SplitType from 'split-type';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

gsap.registerPlugin(useGSAP);

export function SplitHeroTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion || !ref.current) return;

      const split = new SplitType(ref.current, { types: 'words,chars' });

      gsap.set(ref.current, { perspective: 1000 });
      gsap.from(split.chars, {
        yPercent: 120,
        rotateX: -90,
        opacity: 0,
        transformOrigin: '50% 100%',
        duration: 1.15,
        stagger: {
          amount: 0.75,
          from: 'start',
        },
        ease: 'expo.out',
      });

      return () => split.revert();
    },
    {
      scope: ref,
      dependencies: [prefersReducedMotion],
    },
  );

  return (
    <h1 ref={ref} className={`split-title ${className}`}>
      {children}
    </h1>
  );
}
