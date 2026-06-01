import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

type CountUpStatProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
};

export function CountUpStat({
  value,
  prefix = '',
  suffix = '',
  duration = 1400,
}: CountUpStatProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const animationFrame = useRef<number>();
  const [displayValue, setDisplayValue] = useState(() => (prefersReducedMotion ? value : 0));
  const reservedCharacterWidth = prefix.length + String(value).length + suffix.length;

  useEffect(() => {
    if (prefersReducedMotion) {
      hasAnimated.current = true;
      setDisplayValue(value);
      return;
    }

    const element = ref.current;
    if (!element || hasAnimated.current) return;

    const animate = () => {
      hasAnimated.current = true;
      const startTime = performance.now();

      const update = (currentTime: number) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(value * easedProgress));

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(update);
        } else {
          setDisplayValue(value);
        }
      };

      animationFrame.current = requestAnimationFrame(update);
    };

    if (!('IntersectionObserver' in window)) {
      animate();
      return () => {
        if (animationFrame.current !== undefined) {
          cancelAnimationFrame(animationFrame.current);
        }
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        observer.disconnect();
        animate();
      },
      { threshold: 0.35 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (animationFrame.current !== undefined) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [duration, prefersReducedMotion, value]);

  return (
    <span
      ref={ref}
      aria-label={`${prefix}${value}${suffix}`}
      className="inline-block tabular-nums"
      style={{ minWidth: `${reservedCharacterWidth}ch` }}
    >
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
