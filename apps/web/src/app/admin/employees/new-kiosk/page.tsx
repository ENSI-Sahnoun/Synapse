'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createKioskAccountAction } from '@/actions/admin/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import Link from 'next/link'

export default function NewKioskAccountPage() {
  const router = useRouter()
  const form = useForm({ defaultValues: { full_name: '', email: '', password: '' } })

  const { execute, status } = useAction(createKioskAccountAction, {
    onSuccess: () => { toast.success('Compte kiosque créé'); router.push('/admin/employees') },
    onError: ({ error }) => { toast.error(error.serverError ?? 'Erreur') },
  })

  return (
    <div className="space-y-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">← Employés</Link>
      <h1 className="text-2xl font-semibold">Nouveau compte kiosque</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Ce compte se connectera uniquement au kiosque d&apos;accès (aucun autre écran
        n&apos;est accessible avec ces identifiants). Choisissez le mot de passe qui
        sera saisi sur l&apos;appareil kiosque.
      </p>
      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <Label>Nom (ex. « Kiosque Entrée ») *</Label>
          <Input {...form.register('full_name')} />
        </div>
        <div className="space-y-1">
          <Label>Email *</Label>
          <Input type="email" {...form.register('email')} placeholder="kiosk@synapse.tn" />
        </div>
        <div className="space-y-1">
          <Label>Mot de passe *</Label>
          <Input type="text" {...form.register('password')} placeholder="8 caractères minimum" />
        </div>
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Création...' : 'Créer le compte kiosque'}
        </Button>
      </form>
    </div>
  )
}
