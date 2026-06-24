'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { adminResetEmailAction, adminResetPasswordAction } from '@/actions/admin/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ResetCredentialsFormProps {
  userId: string
}

export function ResetCredentialsForm({ userId }: ResetCredentialsFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { execute: resetEmail, status: emailStatus } = useAction(adminResetEmailAction, {
    onSuccess: () => { toast.success('Email mis à jour'); setEmail('') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: resetPassword, status: passwordStatus } = useAction(adminResetPasswordAction, {
    onSuccess: () => { toast.success('Mot de passe mis à jour'); setPassword('') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Accès au compte</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-md">
        <div className="space-y-2">
          <Label>Nouvel email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nouveau@email.com"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!email || emailStatus === 'executing'}
            onClick={() => resetEmail({ id: userId, email })}
          >
            {emailStatus === 'executing' ? '…' : "Changer l'email"}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Nouveau mot de passe</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 caractères"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={password.length < 8 || passwordStatus === 'executing'}
            onClick={() => resetPassword({ id: userId, password })}
          >
            {passwordStatus === 'executing' ? '…' : 'Changer le mot de passe'}
          </Button>
        </div>
      </div>
    </div>
  )
}
