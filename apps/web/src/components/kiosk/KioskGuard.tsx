'use client'

import { useEffect } from 'react'

export function KioskGuard() {
  useEffect(() => {
    const goFullscreen = () => {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    }

    // Try immediately (works if we still hold a gesture), then re-arm on the
    // first user interaction — most browsers reject requestFullscreen without
    // an active gesture, so a bare useEffect call silently fails.
    goFullscreen()
    document.addEventListener('pointerdown', goFullscreen)

    if ('keyboard' in navigator && (navigator as any).keyboard?.lock) {
      ;(navigator as any).keyboard
        .lock(['Escape', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'F1', 'F2', 'F3', 'F4', 'F5', 'F11', 'F12'])
        .catch(() => {})
    }

    const handleContextMenu = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handleContextMenu)

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('pointerdown', goFullscreen)
      document.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if ('keyboard' in navigator && (navigator as any).keyboard?.unlock) {
        ;(navigator as any).keyboard.unlock()
      }
    }
  }, [])

  return null
}
