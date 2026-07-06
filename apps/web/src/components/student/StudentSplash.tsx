'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

const LETTERS = 'Synapse'.split('')

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
          {/* Wordmark: per-letter blur/rise reveal + accent underline sweep.
              Entrance completes ~1s, well inside MIN_DISPLAY_MS. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {reducedMotion ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 40,
                  fontWeight: 700,
                  color: 'var(--accent-brand)',
                }}
              >
                Synapse
              </motion.span>
            ) : (
              <motion.span
                aria-label="Synapse"
                initial="hidden"
                animate="show"
                variants={{
                  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
                }}
                style={{
                  display: 'inline-flex',
                  fontFamily: 'var(--font-display)',
                  fontSize: 40,
                  fontWeight: 700,
                  color: 'var(--accent-brand)',
                  letterSpacing: '-0.02em',
                }}
              >
                {LETTERS.map((letter, i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    variants={{
                      hidden: {
                        opacity: 0,
                        y: 18,
                        scale: 0.92,
                        filter: 'blur(8px)',
                      },
                      show: {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                    style={{ display: 'inline-block', willChange: 'transform, filter, opacity' }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </motion.span>
            )}
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
              animate={reducedMotion ? { opacity: 1 } : { scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{
                marginTop: 10,
                height: 3,
                width: 72,
                borderRadius: 9999,
                transformOrigin: 'left',
                background:
                  'linear-gradient(90deg, transparent, var(--accent-brand), transparent)',
                boxShadow: '0 0 12px var(--accent-brand)',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
