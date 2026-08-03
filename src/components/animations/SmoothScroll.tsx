import { useEffect, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export function SmoothScroll({ children }: { children: ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;

    async function enableSmoothScroll() {
      const [{ default: Lenis }, { default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({
        lerp: 0.075,
        smoothWheel: true,
        wheelMultiplier: 0.9,
      });

      lenis.on('scroll', ScrollTrigger.update);

      const update = (time: number) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(update);
      gsap.ticker.lagSmoothing(0);

      dispose = () => {
        gsap.ticker.remove(update);
        lenis.destroy();
      };
    }

    void enableSmoothScroll().catch(() => {
      // Native browser scrolling remains available if an optional animation chunk cannot load.
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [prefersReducedMotion]);

  return children;
}
