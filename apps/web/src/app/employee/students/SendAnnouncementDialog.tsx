'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { createAnnouncementAction } from '@/actions/employee/announcements'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface SendAnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: {
    id: string
    full_name: string | null
  }
}

export function SendAnnouncementDialog({ open, onOpenChange, student }: SendAnnouncementDialogProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [important, setImportant] = useState(false)

  const { execute, status } = useAction(createAnnouncementAction, {
    onSuccess: () => {
      toast.success('Annonce envoyée')
      setTitle('')
      setBody('')
      setPinned(false)
      setImportant(false)
      onOpenChange(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer une annonce</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            execute({ title, body, pinned, important, recipientId: student.id })
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>Destinataire</Label>
            <div className="text-sm font-medium">{student.full_name ?? student.id}</div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="announcement-title">Titre *</Label>
            <Input id="announcement-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="announcement-body">Contenu *</Label>
            <Textarea id="announcement-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} />
            Épingler cette annonce
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={important} onCheckedChange={(v) => setImportant(v === true)} />
            Marquer comme importante (notification 24h)
          </label>
          <DialogFooter>
            <Button type="submit" disabled={status === 'executing' || !title.trim() || !body.trim()}>
              {status === 'executing' ? 'Envoi...' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
