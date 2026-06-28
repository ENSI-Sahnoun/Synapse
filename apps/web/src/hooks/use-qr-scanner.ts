'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserQRCodeReader, IScannerControls } from '@zxing/library'

export interface QRScanResult {
  text: string
}

export function useQRScanner(onResult: (result: QRScanResult) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startScan = useCallback(async () => {
    if (!videoRef.current) return
    setError(null)
    setScanning(true)
    try {
      const reader = new BrowserQRCodeReader()
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            onResult({ text: result.getText() })
            stopScan()
          }
        }
      )
    } catch (err) {
      setError('Impossible d\'accéder à la caméra')
      setScanning(false)
    }
  }, [onResult])

  const stopScan = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
    }
  }, [])

  return { videoRef, scanning, error, startScan, stopScan }
}
