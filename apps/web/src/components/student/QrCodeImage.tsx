'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QrCodeImageProps {
  token: string
  /** Size in pixels — default 280 */
  size?: number
}

export function QrCodeImage({ token, size = 280 }: QrCodeImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, token, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    }).catch(console.error)
  }, [token, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-xl shadow-md max-w-full h-auto"
      aria-label="Code QR Synapse"
    />
  )
}
