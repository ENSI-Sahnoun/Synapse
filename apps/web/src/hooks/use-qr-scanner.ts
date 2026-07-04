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
      await reader.decodeFromVideoDevice(
        null,
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
  }, [onResult, stopScan])

  useEffect(() => {
    return () => {
      readerRef.current?.stopContinuousDecode()
    }
  }, [])

  return { videoRef, scanning, error, startScan, stopScan }
}
