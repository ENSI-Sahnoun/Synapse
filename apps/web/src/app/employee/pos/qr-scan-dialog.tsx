'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  const [open, setOpen] = useState(false)

  const { execute: lookup, status: lookupStatus } = useAction(lookupStudentByQrAction, {
    onSuccess: ({ data }) => {
      if (data) {
        onStudentScanned(data)
        setOpen(false)
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

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) stopScan()
    setOpen(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Scanner QR étudiant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scanner le QR de l&apos;étudiant</DialogTitle>
        </DialogHeader>
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
          <div className="flex gap-2">
            {!scanning ? (
              <Button onClick={startScan} className="flex-1">
                Démarrer le scan
              </Button>
            ) : (
              <Button variant="outline" onClick={stopScan} className="flex-1">
                Arrêter
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Pointez la caméra vers le QR code de l&apos;étudiant.
            Le scan est optionnel — ignorez pour un achat anonyme.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
