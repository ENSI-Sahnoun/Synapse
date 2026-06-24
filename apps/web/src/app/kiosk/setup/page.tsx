import { KioskLoginForm } from './KioskLoginForm'

export const metadata = {
  title: 'Configuration du kiosque — Synapse',
}

export default function KioskSetupPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 bg-black text-white px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Synapse</h1>
        <p className="text-gray-400 text-sm mt-2">
          Configuration du kiosque d&apos;accès
        </p>
      </div>

      <KioskLoginForm />

      <p className="text-xs text-gray-600 text-center max-w-xs">
        Connectez-vous avec un compte employé. Cette page ne s&apos;affiche qu&apos;une
        seule fois par appareil.
      </p>
    </div>
  )
}
