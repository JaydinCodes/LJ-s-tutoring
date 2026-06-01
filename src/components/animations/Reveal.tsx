import { useRef, type ElementType, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const variants = {
  odyssey: {
    from: {
      autoAlpha: 0,
      y: 80,
      scale: 0.96,
      filter: 'blur(18px)',
      clipPath: 'inset(0 0 18% 0)',
    },
    to: {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      clipPath: 'inset(0 0 0% 0)',
    },
  },
  marble: {
    from: {
      autoAlpha: 0,
      y: 48,
      rotateX: -12,
      filter: 'blur(12px)',
    },
    to: {
      autoAlpha: 1,
      y: 0,
      rotateX: 0,
      filter: 'blur(0px)',
    },
  },
  oracle: {
    from: {
      autoAlpha: 0,
      x: -56,
      filter: 'blur(14px)',
    },
    to: {
      autoAlpha: 1,
      x: 0,
      filter: 'blur(0px)',
    },
  },
};

type RevealVariant = keyof typeof variants;

type RevealProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  start?: string;
  id?: string;
};

export function Reveal({
  as: Component = 'div',
  children,
  className = '',
  variant = 'odyssey',
  delay = 0,
  duration = 1,
  start = 'top 82%',
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion || !ref.current) return;

      const animation = variants[variant];

      gsap.fromTo(ref.current, animation.from, {
        ...animation.to,
        delay,
        duration,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: ref.current,
          start,
          once: true,
        },
      });
    },
    {
      scope: ref,
      dependencies: [prefersReducedMotion, variant, delay, duration, start],
    },
  );

  return (
    <Component ref={ref} className={className} id={id}>
      {children}
    </Component>
  );
}

type StaggerRevealProps = {
  children: ReactNode;
  className?: string;
  childSelector?: string;
  staggerBy?: number;
  duration?: number;
  start?: string;
};

export function StaggerReveal({
  children,
  className = '',
  childSelector = '[data-reveal-child]',
  staggerBy = 0.1,
  duration = 0.85,
  start = 'top 82%',
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion || !ref.current) return;

      const items = gsap.utils.toArray(childSelector, ref.current);

      gsap.fromTo(
        items,
        {
          autoAlpha: 0,
          y: 56,
          scale: 0.96,
          rotateX: -10,
          filter: 'blur(14px)',
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          filter: 'blur(0px)',
          duration,
          stagger: staggerBy,
          ease: 'power4.out',
          scrollTrigger: {
            trigger: ref.current,
            start,
            once: true,
          },
        },
      );
    },
    {
      scope: ref,
      dependencies: [prefersReducedMotion, childSelector, staggerBy, duration, start],
    },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
