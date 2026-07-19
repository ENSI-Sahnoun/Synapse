import Link from 'next/link'
import { ShieldWarning } from '@phosphor-icons/react/dist/ssr'

/**
 * Non-dismissible reminder shown while credentials_set = false: the account
 * still relies on QR login and a placeholder email.
 */
export function SecureAccountBanner() {
  return (
    <Link
      href="/student/settings#secure"
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ background: 'var(--warning-bg)', borderBottom: '1px solid var(--warning-border)' }}
    >
      <ShieldWarning size={18} weight="fill" style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
      <p className="flex-1 text-xs leading-snug" style={{ color: 'var(--warning-text)' }}>
        <span className="font-semibold">Sécurisez votre compte.</span> Ajoutez un
        email et un mot de passe pour ne pas perdre l'accès.
      </p>
      <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--warning-text)' }}>
        Configurer →
      </span>
    </Link>
  )
}
