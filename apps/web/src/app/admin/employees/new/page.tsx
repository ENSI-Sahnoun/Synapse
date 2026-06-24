'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createEmployeeAction } from '@/actions/admin/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import Link from 'next/link'

export default function NewEmployeePage() {
  const router = useRouter()
  const form = useForm({ defaultValues: { full_name: '', email: '', phone: '' } })

  const { execute, status } = useAction(createEmployeeAction, {
    onSuccess: () => { toast.success('Employé créé'); router.push('/admin/employees') },
    onError: ({ error }) => { toast.error(error.serverError ?? 'Erreur') },
  })

  return (
    <div className="space-y-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">← Employés</Link>
      <h1 className="text-2xl font-semibold">Nouvel employé</h1>
      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <Label>Nom complet *</Label>
          <Input {...form.register('full_name')} />
        </div>
        <div className="space-y-1">
          <Label>Email *</Label>
          <Input type="email" {...form.register('email')} />
        </div>
        <div className="space-y-1">
          <Label>Téléphone</Label>
          <Input {...form.register('phone')} />
        </div>
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Création...' : 'Créer l\'employé'}
        </Button>
      </form>
    </div>
  )
}
