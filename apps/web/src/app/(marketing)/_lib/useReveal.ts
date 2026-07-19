'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

// Layout effect on the client, no-op on the server (avoids the SSR warning).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Fail-open reveal-on-scroll state.
 *
 * The element is VISIBLE by default (SSR, no-JS, reduced-motion all render it),
 * so content never ships blank — the reveal only enhances. On the client, a
 * pre-paint layout effect flips it to the hidden start state, the observer
 * reveals it when it scrolls into view, and a fallback timer guarantees it can
 * never stay hidden even if the observer never fires (headless renderers,
 * background tabs, missing IntersectionObserver).
 */
export function useReveal<T extends Element = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: '-12% 0px' });
  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useIsoLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (inView) setRevealed(true);
  }, [inView]);

  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 1000);
    return () => window.clearTimeout(t);
  }, []);

  // Hidden only once we're client-side and haven't revealed yet. Never hidden
  // under reduced-motion or before hydration.
  const hidden = mounted && !revealed && !reduce;
  return { ref, hidden, reduce };
}
