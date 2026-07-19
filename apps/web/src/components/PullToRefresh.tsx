'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowClockwise } from '@phosphor-icons/react'

const PULL_TRIGGER_DISTANCE = 70
const MAX_PULL = 110

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)
  // Fires the trigger haptic once per pull, not on every touchmove.
  const crossedTrigger = useRef(false)

  // The spinner tracks the actual refresh instead of a guessed duration.
  useEffect(() => {
    if (!refreshing || isPending) return
    setRefreshing(false)
    setPullDistance(0)
  }, [refreshing, isPending])

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 0 || refreshing) return
    startY.current = e.touches[0].clientY
    pulling.current = true
    crossedTrigger.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!pulling.current || startY.current === null) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) {
      setPullDistance(0)
      return
    }
    // Diminishing returns past MAX_PULL so it doesn't feel infinite
    const next = Math.min(MAX_PULL, delta * 0.5)
    if (next >= PULL_TRIGGER_DISTANCE && !crossedTrigger.current) {
      crossedTrigger.current = true
      vibrate(10)
    } else if (next < PULL_TRIGGER_DISTANCE) {
      crossedTrigger.current = false
    }
    setPullDistance(next)
  }

  function handleTouchEnd() {
    pulling.current = false
    crossedTrigger.current = false
    if (pullDistance >= PULL_TRIGGER_DISTANCE) {
      setRefreshing(true)
      setPullDistance(PULL_TRIGGER_DISTANCE)
      startTransition(() => router.refresh())
    } else {
      setPullDistance(0)
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overscrollBehaviorY: 'contain' }}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height]"
        style={{ height: pullDistance, transitionDuration: pulling.current ? '0ms' : '200ms' }}
      >
        <ArrowClockwise
          size={20}
          className={refreshing ? 'animate-spin' : ''}
          style={{
            color: 'var(--accent-brand)',
            transform: refreshing ? undefined : `rotate(${(pullDistance / PULL_TRIGGER_DISTANCE) * 360}deg)`,
            opacity: Math.min(1, pullDistance / 40),
          }}
        />
      </div>
      {children}
    </div>
  )
}
