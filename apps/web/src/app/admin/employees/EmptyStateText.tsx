'use client'

import { motion, AnimatePresence } from 'motion/react'

export function EmptyStateText({ text, stateKey }: { text: string; stateKey: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={stateKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  )
}
