'use client'

import { useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useQRScanner } from '@/hooks/use-qr-scanner'
import { useAction } from 'next-safe-action/hooks'
import { lookupStudentByQrAction } from '@/actions/employee/lookup-student-by-qr'
import { toast } from 'sonner'

interface StudentInfo {
  studentId: string
  fullName: string
  phone: string | null
  loyaltyBalance: number
}

interface Props {
  onStudentScanned: (student: StudentInfo) => void
}

export function QrScanDialog({ onStudentScanned }: Props) {
  const { execute: lookup, status: lookupStatus } = useAction(lookupStudentByQrAction, {
    onSuccess: ({ data }) => {
      if (data) {
        onStudentScanned(data)
        toast.success(`Étudiant identifié: ${data.fullName}`)
      }
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'QR non reconnu'),
  })

  const handleResult = useCallback(
    ({ text }: { text: string }) => {
      if (lookupStatus !== 'executing') {
        lookup({ qr_token: text })
      }
    },
    [lookup, lookupStatus]
  )

  const { videoRef, scanning, error, startScan, stopScan } = useQRScanner(handleResult)

  // Start the camera as soon as the panel is shown; stop it on unmount.
  useEffect(() => {
    startScan()
    return () => stopScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" />
        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white text-sm">Caméra inactive</p>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!scanning && (
        <Button onClick={startScan} className="w-full">
          Démarrer le scan
        </Button>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Pointez la caméra vers le QR code de l&apos;étudiant.
      </p>
    </div>
  )
}
