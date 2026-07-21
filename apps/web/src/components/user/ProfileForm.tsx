'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Camera, CircleNotch } from '@phosphor-icons/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/supabase-clients/client'
import { updateMyProfileAction } from '@/actions/user/profile'

type Props = {
  userId: string
  fullName: string
  phone: string | null
  avatarUrl: string | null
  roleLabel?: string
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export function ProfileForm({ userId, fullName, phone, avatarUrl, roleLabel }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Le fichier doit être une image')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image trop volumineuse (5 Mo max)')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setPreview(data.publicUrl)
      toast.success('Photo téléchargée')
    } catch {
      toast.error('Erreur de téléchargement')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(formData: FormData) {
    formData.set('avatar_url', preview ?? '')
    startTransition(async () => {
      const result = await updateMyProfileAction(formData)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? 'Profil mis à jour')
    })
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Changer la photo de profil"
          className="relative rounded-full outline-none focus-visible:ring-2"
          style={{ ['--tw-ring-color' as string]: 'var(--border-focus)' }}
        >
          <Avatar className="h-20 w-20 ring-4" style={{ boxShadow: '0 0 0 4px var(--synapse-cream-200)' }}>
            <AvatarImage src={preview ?? undefined} alt={fullName} />
            <AvatarFallback className="text-lg font-bold text-white" style={{ background: 'var(--accent-brand)' }}>
              {initialsOf(fullName)}
            </AvatarFallback>
          </Avatar>
          <span
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border-2"
            style={{ width: 28, height: 28, background: 'var(--accent-brand)', borderColor: 'var(--surface)' }}
          >
            {uploading ? (
              <CircleNotch size={13} weight="bold" className="animate-spin text-white" />
            ) : (
              <Camera size={13} weight="fill" className="text-white" />
            )}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
          />
        </button>
        {roleLabel && <Badge variant="secondary">{roleLabel}</Badge>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="full_name">Nom</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" name="phone" defaultValue={phone ?? ''} placeholder="ex: 20 123 456" />
      </div>

      <Button type="submit" disabled={pending || uploading} className="w-full">
        {pending ? 'Enregistrement...' : 'Enregistrer'}
      </Button>
    </form>
  )
}
