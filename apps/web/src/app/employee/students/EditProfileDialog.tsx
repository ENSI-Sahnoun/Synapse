'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { updateStudentAction } from '@/actions/admin/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateStudentSchema, type UpdateStudentInput } from '@/utils/zod-schemas/student'
import { useEffect } from 'react'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: {
    id: string
    full_name: string | null
    phone: string | null
    university: string | null
  }
  studyLevel: string | null
  onSaved: () => void
}

export function EditProfileDialog({ open, onOpenChange, student, studyLevel, onSaved }: EditProfileDialogProps) {
  const form = useForm<UpdateStudentInput>({
    resolver: zodResolver(updateStudentSchema) as any,
    defaultValues: {
      id: student.id,
      full_name: student.full_name ?? '',
      phone: student.phone ?? '',
      university: student.university ?? '',
      study_level: studyLevel ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        id: student.id,
        full_name: student.full_name ?? '',
        phone: student.phone ?? '',
        university: student.university ?? '',
        study_level: studyLevel ?? '',
      })
    }
  }, [open, student.id, student.full_name, student.phone, student.university, studyLevel])

  const { execute, status } = useAction(updateStudentAction, {
    onSuccess: () => {
      toast.success('Profil mis à jour')
      onOpenChange(false)
      onSaved()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le profil</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
          <input type="hidden" {...form.register('id')} />
          <div className="space-y-1">
            <Label htmlFor="full_name">Nom complet *</Label>
            <Input id="full_name" {...form.register('full_name')} />
            {form.formState.errors.full_name && (
              <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" {...form.register('phone')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="university">Université</Label>
            <Input id="university" {...form.register('university')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="study_level">Niveau d&apos;étude</Label>
            <Input id="study_level" {...form.register('study_level')} placeholder="ex: Licence 3, Master 1" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={status === 'executing'}>
              {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
