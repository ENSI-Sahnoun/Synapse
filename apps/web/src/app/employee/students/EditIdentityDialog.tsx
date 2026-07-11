'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { updateStudentAction } from '@/actions/admin/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ResetCredentialsForm } from '@/components/admin/ResetCredentialsForm'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateStudentSchema, type UpdateStudentInput } from '@/utils/zod-schemas/student'
import { useEffect } from 'react'

interface EditIdentityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: {
    id: string
    full_name: string | null
  }
  onSaved: () => void
}

export function EditIdentityDialog({ open, onOpenChange, student, onSaved }: EditIdentityDialogProps) {
  const form = useForm<UpdateStudentInput>({
    resolver: zodResolver(updateStudentSchema) as any,
    defaultValues: {
      id: student.id,
      full_name: student.full_name ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({ id: student.id, full_name: student.full_name ?? '' })
    }
  }, [open, student.id, student.full_name])

  const { execute, status } = useAction(updateStudentAction, {
    onSuccess: () => {
      toast.success('Nom mis à jour')
      onSaved()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le compte</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => execute({ id: data.id, full_name: data.full_name }))} className="space-y-4">
          <input type="hidden" {...form.register('id')} />
          <div className="space-y-1">
            <Label htmlFor="full_name">Nom complet *</Label>
            <Input id="full_name" {...form.register('full_name')} />
            {form.formState.errors.full_name && (
              <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={status === 'executing'}>
              {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer le nom'}
            </Button>
          </DialogFooter>
        </form>
        <ResetCredentialsForm userId={student.id} />
      </DialogContent>
    </Dialog>
  )
}
