'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export function ProfileForm({ userId, fullName, phone, avatarUrl }: Props) {
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
    <form action={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <AvatarImage src={preview ?? undefined} alt={fullName} />
          <AvatarFallback>{initialsOf(fullName)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Téléchargement...' : 'Changer la photo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="full_name">Nom</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" name="phone" defaultValue={phone ?? ''} placeholder="ex: 20 123 456" />
      </div>

      <Button type="submit" disabled={pending || uploading}>
        {pending ? 'Enregistrement...' : 'Enregistrer'}
      </Button>
    </form>
  )
}
