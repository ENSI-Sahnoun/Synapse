'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

// Module scope: true for the first mount in this JS context only. A PWA cold
// start creates a fresh context (this resets); client navigations do not.
let shownThisContext = false

const MIN_DISPLAY_MS = 1500

export default function StudentSplash() {
  const [visible, setVisible] = useState(() => !shownThisContext)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (shownThisContext) return
    shownThisContext = true
    const t = setTimeout(() => setVisible(false), MIN_DISPLAY_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="student-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)',
          }}
        >
          {/* Wordmark: plain fade + rise. No filter/blur animation — WebKit's
              compositor is unreliable animating filter+transform together on
              staggered children (iOS Safari/Chrome silently drop the reveal). */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.span
              aria-label="Synapse"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 40,
                fontWeight: 700,
                color: 'var(--accent-brand)',
                letterSpacing: '-0.02em',
              }}
            >
              Synapse
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
