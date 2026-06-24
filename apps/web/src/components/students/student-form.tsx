'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createStudentAction } from '@/actions/employee/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createStudentSchema, type CreateStudentInput } from '@/utils/zod-schemas/student'

interface StudentFormProps {
  redirectTo: string
}

export function StudentForm({ redirectTo }: StudentFormProps) {
  const router = useRouter()
  const form = useForm<CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: { full_name: '', phone: '', email: '', university: '', study_level: '' },
  })

  const { execute, status } = useAction(createStudentAction, {
    onSuccess: () => {
      toast.success('Étudiant créé avec succès')
      router.push(redirectTo)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la création')
    },
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-md">
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
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...form.register('email')} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="university">Université</Label>
        <Input id="university" {...form.register('university')} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="study_level">Niveau d'étude</Label>
        <Input id="study_level" {...form.register('study_level')} placeholder="ex: Licence 3, Master 1" />
      </div>

      <Button type="submit" disabled={status === 'executing'}>
        {status === 'executing' ? 'Création...' : 'Créer l\'étudiant'}
      </Button>
    </form>
  )
}
