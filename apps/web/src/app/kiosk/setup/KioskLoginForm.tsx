'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function KioskLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      )

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('Email ou mot de passe incorrect.')
        return
      }

      if (!data.user) {
        setError('Connexion échouée.')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (!profile || !['admin', 'employee'].includes(profile.role)) {
        await supabase.auth.signOut()
        setError("Ce compte n'a pas accès au kiosque.")
        return
      }

      router.push('/kiosk')
      router.refresh()
    } catch {
      setError('Erreur inattendue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs text-gray-400">
          Email employé
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-white"
          placeholder="employe@synapse.tn"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs text-gray-400">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-white"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-white text-black rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? 'Connexion…' : 'Activer le kiosque'}
      </button>
    </form>
  )
}
