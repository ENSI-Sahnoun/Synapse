'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { studentSignupAction } from '@/actions/auth/student-signup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { studentSignupSchema, type StudentSignupInput } from '@/utils/zod-schemas/auth'
import Link from 'next/link'
import { useState } from 'react'

export function StudentSignup() {
  const router = useRouter()
  const [emailConfirmPending, setEmailConfirmPending] = useState(false)

  const form = useForm<StudentSignupInput>({
    resolver: zodResolver(studentSignupSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      university: '',
      study_level: '',
      password: '',
      password_confirm: '',
    },
  })

  const { execute, status } = useAction(studentSignupAction, {
    onSuccess: ({ data }) => {
      if (data?.needsEmailConfirmation) {
        setEmailConfirmPending(true)
      } else {
        toast.success('Compte créé avec succès')
        router.push('/student/dashboard')
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la création du compte')
    },
  })

  if (emailConfirmPending) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4 text-center">
        <h2 className="text-xl font-semibold">Vérifiez votre email</h2>
        <p className="text-muted-foreground text-sm">
          Un lien de confirmation a été envoyé à <strong>{form.getValues('email')}</strong>.
          Cliquez sur le lien pour activer votre compte.
        </p>
        <Link href="/login" className="text-primary text-sm underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Créer un compte</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Espace Synapse — étudiants uniquement
        </p>
      </div>

      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="full_name">Nom complet *</Label>
          <Input id="full_name" {...form.register('full_name')} />
          {form.formState.errors.full_name && (
            <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...form.register('email')} />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" {...form.register('phone')} placeholder="ex: 22 334 455" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="university">Université</Label>
          <Input id="university" {...form.register('university')} placeholder="ex: ISIMS, FSS" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="study_level">Niveau d'étude</Label>
          <Input id="study_level" {...form.register('study_level')} placeholder="ex: Licence 3" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Mot de passe *</Label>
          <Input id="password" type="password" {...form.register('password')} />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="password_confirm">Confirmer le mot de passe *</Label>
          <Input id="password_confirm" type="password" {...form.register('password_confirm')} />
          {form.formState.errors.password_confirm && (
            <p className="text-sm text-destructive">{form.formState.errors.password_confirm.message}</p>
          )}
        </div>

        <Button type="submit" disabled={status === 'executing'} className="w-full">
          {status === 'executing' ? 'Création...' : 'Créer mon compte'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Déjà inscrit ?{' '}
        <Link href="/login" className="text-primary underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
