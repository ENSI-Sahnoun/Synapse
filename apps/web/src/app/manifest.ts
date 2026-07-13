import type { MetadataRoute } from 'next'
import { createSupabaseClient } from '@/supabase-clients/server'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin/dashboard',
  employee: '/employee/dashboard',
  student: '/student/dashboard',
  kiosk: '/kiosk',
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const userId = await getCachedLoggedInUserIdOrNull()
  let role: string | null = null

  if (userId) {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    role = data?.role ?? null
  }

  const isKiosk = role === 'kiosk'

  return {
    name: 'Synapse',
    short_name: 'Synapse',
    description: 'Espace Synapse — votre abonnement et réservations',
    start_url: (role ? ROLE_HOME[role] : undefined) ?? '/student/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF7F0',
    theme_color: '#A2724A',
    orientation: isKiosk ? 'landscape-primary' : 'portrait-primary',
    id: '/',
    icons: [
      { src: '/logos/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/logos/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logos/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
