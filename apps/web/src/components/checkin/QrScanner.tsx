'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

interface QrScannerProps {
  onScan: (token: string) => void
  ready: boolean
}

export function QrScanner({ onScan, ready }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const lastScannedRef = useRef<string | null>(null)

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return

    try {
      readerRef.current = new BrowserMultiFormatReader()
      const devices = await readerRef.current.listVideoInputDevices()

      if (devices.length === 0) {
        setError("Aucune caméra détectée sur cet appareil.")
        return
      }

      // Selfie / front-facing camera preferred for the kiosk.
      const device =
        devices.find((d) => /front|user|face|selfie/i.test(d.label)) ??
        devices[0]

      setCameraActive(true)

      readerRef.current.decodeFromVideoDevice(
        device.deviceId,
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
  }, [onScan])

  useEffect(() => {
    startScanner()
    return () => {
      readerRef.current?.reset()
    }
  }, [startScanner])

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
    <div className="relative w-full max-w-sm mx-auto aspect-square rounded-xl overflow-hidden bg-black">
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
