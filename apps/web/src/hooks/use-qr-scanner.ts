'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserQRCodeReader } from '@zxing/library'

export interface QRScanResult {
  text: string
}

export function useQRScanner(onResult: (result: QRScanResult) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserQRCodeReader | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  const stopScan = useCallback(() => {
    readerRef.current?.stopContinuousDecode()
    readerRef.current = null
    setScanning(false)
  }, [])

  const startScan = useCallback(async () => {
    if (!videoRef.current) return
    // Camera requires a secure context (HTTPS or localhost) — otherwise
    // getUserMedia/canvas readback throws SecurityError.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Caméra indisponible sur cette connexion (HTTPS requis)')
      return
    }
    setError(null)
    setScanning(true)
    try {
      const reader = new BrowserQRCodeReader()
      readerRef.current = reader
      await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: facingMode } } },
        videoRef.current,
        (result) => {
          if (result) {
            onResult({ text: result.getText() })
            stopScan()
          }
        }
      )
    } catch {
      setError("Impossible d'accéder à la caméra")
      setScanning(false)
    }
  }, [onResult, stopScan, facingMode])

  // Phones: double-click/double-tap the video flips front/back camera.
  const switchCamera = useCallback(() => {
    readerRef.current?.reset()
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }, [])

  const lastTapRef = useRef(0)
  const handleTouchEnd = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      switchCamera()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [switchCamera])

  useEffect(() => {
    return () => {
      readerRef.current?.stopContinuousDecode()
    }
  }, [])

  // Restart automatically when the camera is switched mid-scan.
  useEffect(() => {
    if (scanning) startScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  return {
    videoRef,
    scanning,
    error,
    startScan,
    stopScan,
    switchCamera,
    onDoubleClick: switchCamera,
    onTouchEnd: handleTouchEnd,
  }
}
