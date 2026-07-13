'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

interface QrScannerProps {
  onScan: (token: string) => void
  ready: boolean
  /** 'kiosk' locks the selfie/front camera with no switching. 'staff' starts on
   * the back camera and lets the user double-click/tap the video to flip it. */
  mode?: 'kiosk' | 'staff'
}

export function QrScanner({ onScan, ready, mode = 'staff' }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    mode === 'kiosk' ? 'user' : 'environment'
  )
  const lastScannedRef = useRef<string | null>(null)

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return

    try {
      readerRef.current = new BrowserMultiFormatReader()
      setCameraActive(true)

      await readerRef.current.decodeFromConstraints(
        { video: { facingMode: { ideal: facingMode } } },
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText()
            if (text !== lastScannedRef.current) {
              lastScannedRef.current = text
              onScan(text)
              setTimeout(() => {
                lastScannedRef.current = null
              }, 2000)
            }
          }
          if (err && !(err instanceof NotFoundException)) {
            console.error('Scanner error:', err)
          }
        }
      )
    } catch (e) {
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.")
      console.error('Camera access error:', e)
    }
  }, [onScan, facingMode])

  useEffect(() => {
    startScanner()
    return () => {
      // zxing throws NotFoundError if reset() runs while decodeFromConstraints
      // is still attaching the stream to a video element that's since unmounted.
      try {
        readerRef.current?.reset()
      } catch {
        // ignore — stream already gone
      }
    }
  }, [startScanner])

  const handleSwitchCamera = useCallback(() => {
    if (mode === 'kiosk') return
    try {
      readerRef.current?.reset()
    } catch {
      // ignore — stream already gone
    }
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }, [mode])

  // Mobile browsers don't reliably synthesize dblclick from double-tap, so
  // detect it manually from touchend timing as well.
  const lastTapRef = useRef(0)
  const handleTouchEnd = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      handleSwitchCamera()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [handleSwitchCamera])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive bg-destructive/5 p-6 text-center gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => { setError(null); startScanner() }}
          className="text-xs underline text-muted-foreground"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div
      className="relative w-full max-w-sm mx-auto landscape:max-h-[70vh] landscape:w-[70vh] aspect-square rounded-xl overflow-hidden bg-black"
      onDoubleClick={handleSwitchCamera}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />

      {cameraActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-2 border-white rounded-lg opacity-60" />
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <p className="text-white text-sm font-medium">Traitement...</p>
        </div>
      )}

      {!cameraActive && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white text-xs">Démarrage de la caméra...</p>
        </div>
      )}
    </div>
  )
}
