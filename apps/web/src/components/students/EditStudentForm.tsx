'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateStudentAction } from '@/actions/admin/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateStudentSchema, type UpdateStudentInput } from '@/utils/zod-schemas/student'

interface EditStudentFormProps {
  student: {
    id: string
    full_name: string
    phone: string | null
    university: string | null
    study_level: string | null
  }
  redirectTo: string
}

export function EditStudentForm({ student, redirectTo }: EditStudentFormProps) {
  const router = useRouter()
  const form = useForm<UpdateStudentInput>({
    resolver: zodResolver(updateStudentSchema) as any,
    defaultValues: {
      id: student.id,
      full_name: student.full_name,
      phone: student.phone ?? '',
      university: student.university ?? '',
      study_level: student.study_level ?? '',
    },
  })

  const { execute, status } = useAction(updateStudentAction, {
    onSuccess: () => {
      toast.success('Étudiant mis à jour')
      router.push(redirectTo)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-md">
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

      <div className="flex gap-2">
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(redirectTo)}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
