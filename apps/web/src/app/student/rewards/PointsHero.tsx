'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import type { NextReward } from '@/lib/rewards'

const GOLD = '#ffd873'
const GOLD_MUTED = '#bfae85'
const LABEL = '#d9c896'

function AnimatedNumber({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const spring = useSpring(reduced ? value : 0, { stiffness: 60, damping: 18 })
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('fr-FR'))
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  if (reduced) return <span>{value.toLocaleString('fr-FR')}</span>
  return <motion.span>{rounded}</motion.span>
}

export function PointsHero({
  balance,
  delta,
  next,
}: {
  balance: number
  delta: number
  next: NextReward | null
}) {
  const reduced = useReducedMotion()
  const [shimmer, setShimmer] = useState(false)
  useEffect(() => {
    if (!reduced) setShimmer(true)
  }, [reduced])

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: 'linear-gradient(140deg, #2b2419, #4a3b23)' }}
    >
      {shimmer && (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 w-1/3 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent, rgba(255,216,115,0.12), transparent)',
          }}
          initial={{ transform: 'translateX(-140%)' }}
          animate={{ transform: 'translateX(140%)' }}
          transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }}
        />
      )}

      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: LABEL }}>
        Points Synapse
      </p>
      <p className="text-4xl font-extrabold mt-1" style={{ color: GOLD, fontFamily: 'var(--font-display)' }}>
        <AnimatedNumber value={balance} /> ✦
      </p>
      {delta !== 0 && (
        <p className="text-xs mt-1 font-medium" style={{ color: GOLD_MUTED }}>
          {delta > 0 ? '+' : ''}
          {delta} pts cette semaine
        </p>
      )}

      {next && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold mb-1.5" style={{ color: LABEL }}>
            Plus que {next.missing} pts → {next.rule.name}
          </p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <motion.div
              className="h-full rounded-full origin-left"
              style={{ background: GOLD }}
              initial={{ scaleX: reduced ? next.progressPct / 100 : 0 }}
              animate={{ scaleX: next.progressPct / 100 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
