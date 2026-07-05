'use client'

import * as React from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { cn } from '@/lib/utils'

// Base placeholder block. Keeps `animate-pulse` as the always-on fallback and
// layers a shimmer gradient sweep on top — the sweep is a plain CSS animation
// (see globals.css `@keyframes skeleton-shimmer`) so it works even for the
// (rare) non-client render of this component, and is skipped outright under
// prefers-reduced-motion via the `motion-safe:` variant.
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative animate-pulse overflow-hidden rounded-md bg-muted',
        className,
      )}
      {...props}
    >
      <div className="motion-safe:animate-skeleton-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  )
}

const groupVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

const itemVariantsReduced: Variants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0, transition: { duration: 0 } },
}

// Wraps a set of Skeleton blocks (or any children) and staggers their
// entrance so a loading state reads as intentional UI rather than a single
// flash. Under prefers-reduced-motion everything renders instantly with no
// transform, matching the base Skeleton's reduced-motion behavior.
function SkeletonGroup({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      variants={groupVariants}
      initial="hidden"
      animate="show"
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={reduced ? itemVariantsReduced : itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

export { Skeleton, SkeletonGroup }
