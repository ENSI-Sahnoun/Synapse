'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowClockwise } from '@phosphor-icons/react'

const PULL_TRIGGER_DISTANCE = 70
const MAX_PULL = 110

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 0 || refreshing) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!pulling.current || startY.current === null) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) {
      setPullDistance(0)
      return
    }
    // Diminishing returns past MAX_PULL so it doesn't feel infinite
    setPullDistance(Math.min(MAX_PULL, delta * 0.5))
  }

  function handleTouchEnd() {
    pulling.current = false
    if (pullDistance >= PULL_TRIGGER_DISTANCE) {
      setRefreshing(true)
      setPullDistance(PULL_TRIGGER_DISTANCE)
      router.refresh()
      setTimeout(() => {
        setRefreshing(false)
        setPullDistance(0)
      }, 700)
    } else {
      setPullDistance(0)
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
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
