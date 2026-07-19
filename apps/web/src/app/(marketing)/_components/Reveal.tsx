'use client';

import { useReveal } from '../_lib/useReveal';

const CURVE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * Reveal-on-scroll wrapper. Content is visible by default and rises+fades in
 * the first time it enters view. Because visibility is never gated on the
 * animation firing (see useReveal), it can never ship blank. CSS-transition
 * based, so it runs off the main thread.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, hidden, reduce } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className}
      style={
        reduce
          ? undefined
          : {
              opacity: hidden ? 0 : 1,
              transform: hidden ? 'translateY(20px)' : 'none',
              transition: `opacity 0.6s ${CURVE} ${delay}s, transform 0.7s ${CURVE} ${delay}s`,
              willChange: 'opacity, transform',
            }
      }
    >
      {children}
    </div>
  );
}
