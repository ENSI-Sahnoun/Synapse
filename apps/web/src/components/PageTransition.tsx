'use client'

import { motion, useReducedMotion } from 'motion/react'

// Enter-fade for route changes. Lives in a template.tsx, which Next remounts on
// every navigation — so each page fades/slides in. Only opacity + a tiny Y
// translate (both GPU-composited) so it stays cheap; honours reduced-motion.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
