'use client'

import { useEffect } from 'react'

export function KioskGuard() {
  useEffect(() => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {})
    }

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
      document.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if ('keyboard' in navigator && (navigator as any).keyboard?.unlock) {
        ;(navigator as any).keyboard.unlock()
      }
    }
  }, [])

  return null
}
