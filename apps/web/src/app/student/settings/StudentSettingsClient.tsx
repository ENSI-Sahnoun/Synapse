'use client'

import { useState, useTransition } from 'react'
import { Bell, EnvelopeSimple, LockKey, At, CaretDown, ShieldCheck } from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import { setupCredentialsAction, updateEmailAction, updatePasswordAction, updateNotificationPrefsAction } from '@/actions/student/account'

interface Props {
  initialPush: boolean
  initialEmailDigest: boolean
  currentEmail: string
  credentialsSet: boolean
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors'
const inputStyle = { borderColor: 'var(--border-default)', fontFamily: 'var(--font-body)', background: 'white' }

export function StudentSettingsClient({ initialPush, initialEmailDigest, currentEmail, credentialsSet }: Props) {
  const [pushEnabled, setPushEnabled] = useState(initialPush)
  const [emailEnabled, setEmailEnabled] = useState(initialEmailDigest)
  const [, startTransition] = useTransition()

  const [emailOpen, setEmailOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)

  const [secured, setSecured] = useState(credentialsSet)
  const [secureMsg, setSecureMsg] = useState<string | null>(null)
  const [securing, setSecuring] = useState(false)

  async function handleSecureSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSecureMsg(null)
    setSecuring(true)
    const fd = new FormData(e.currentTarget)
    const res = await setupCredentialsAction(fd)
    setSecuring(false)
    if ('success' in res) {
      setSecureMsg(`✓ ${res.success}`)
      setSecured(true)
    } else {
      setSecureMsg(`❌ ${res.error}`)
    }
  }

  function handlePushToggle(val: boolean) {
    setPushEnabled(val)
    startTransition(async () => {
      await updateNotificationPrefsAction({ push_enabled: val, email_digest: emailEnabled })
    })
  }

  function handleEmailDigestToggle(val: boolean) {
    setEmailEnabled(val)
    startTransition(async () => {
      await updateNotificationPrefsAction({ push_enabled: pushEnabled, email_digest: val })
    })
  }

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEmailMsg(null)
    const fd = new FormData(e.currentTarget)
    const res = await updateEmailAction(fd)
    setEmailMsg('error' in res ? `❌ ${res.error}` : `✓ ${res.success}`)
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordMsg(null)
    const fd = new FormData(e.currentTarget)
    const res = await updatePasswordAction(fd)
    if ('success' in res) {
      setPasswordMsg(`✓ ${res.success}`)
      ;(e.target as HTMLFormElement).reset()
    } else {
      setPasswordMsg(`❌ ${res.error}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Secure account — shown until email + password are set */}
      {!secured && (
        <div id="secure" className="rounded-xl border overflow-hidden" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-shrink-0 flex items-center justify-center rounded-[10px]" style={{ width: 36, height: 36, background: '#FEF3C7' }}>
              <ShieldCheck size={17} style={{ color: '#D97706' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Sécuriser mon compte</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#92400E' }}>
                Ajoutez un email et un mot de passe pour ne pas perdre l'accès
              </p>
            </div>
          </div>
          <form onSubmit={handleSecureSubmit} className="px-4 pb-4 space-y-2.5 border-t" style={{ borderColor: '#FDE68A' }}>
            <div className="pt-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Votre email
              </label>
              <input name="email" type="email" required placeholder="vous@exemple.com" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Mot de passe
              </label>
              <input name="password" type="password" required minLength={8} placeholder="••••••••" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Confirmer
              </label>
              <input name="confirm" type="password" required placeholder="••••••••" className={inputCls} style={inputStyle} />
            </div>
            {secureMsg && (
              <p className="text-xs" style={{ color: secureMsg.startsWith('✓') ? 'var(--synapse-green-500)' : 'var(--destructive)' }}>
                {secureMsg}
              </p>
            )}
            <button type="submit" disabled={securing} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#D97706' }}>
              {securing ? 'Enregistrement…' : 'Sécuriser mon compte'}
            </button>
          </form>
        </div>
      )}

      {/* Notification toggles */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
        {[
          { Icon: Bell, label: 'Notifications push', sub: 'Rappels & mises à jour', iconBg: '#fef3c7', iconColor: '#d97706', value: pushEnabled, onChange: handlePushToggle },
          { Icon: EnvelopeSimple, label: 'Résumé email', sub: 'Récapitulatif hebdomadaire', iconBg: '#f0fdf4', iconColor: '#16a34a', value: emailEnabled, onChange: handleEmailDigestToggle },
        ].map(({ Icon, label, sub, iconBg, iconColor, value, onChange }, i) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i === 0 ? '1px solid var(--border-subtle)' : undefined }}>
            <div className="flex-shrink-0 flex items-center justify-center rounded-[10px]" style={{ width: 36, height: 36, background: iconBg }}>
              <Icon size={17} style={{ color: iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>
            </div>
            <Switch checked={value} onCheckedChange={onChange} />
          </div>
        ))}
      </div>

      {/* Email — collapsed by default */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => { setEmailOpen((o) => !o); setEmailMsg(null) }}
          className="w-full flex items-center gap-3 px-4 py-3"
        >
          <div className="flex-shrink-0 flex items-center justify-center rounded-[10px]" style={{ width: 36, height: 36, background: '#dbeafe' }}>
            <At size={17} style={{ color: '#2563eb' }} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold">Changer d'email</p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{currentEmail}</p>
          </div>
          <CaretDown
            size={16}
            style={{ color: 'var(--muted-foreground)', flexShrink: 0, transition: 'transform 0.2s', transform: emailOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {emailOpen && (
          <form onSubmit={handleEmailSubmit} className="px-4 pb-4 space-y-2.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="pt-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Nouvel email
              </label>
              <input name="email" type="email" required placeholder={currentEmail} className={inputCls} style={inputStyle} />
            </div>
            {emailMsg && (
              <p className="text-xs" style={{ color: emailMsg.startsWith('✓') ? 'var(--synapse-green-500)' : 'var(--destructive)' }}>
                {emailMsg}
              </p>
            )}
            <button type="submit" className="w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent-brand)' }}>
              Envoyer le lien de confirmation
            </button>
          </form>
        )}
      </div>

      {/* Password — collapsed by default */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => { setPasswordOpen((o) => !o); setPasswordMsg(null) }}
          className="w-full flex items-center gap-3 px-4 py-3"
        >
          <div className="flex-shrink-0 flex items-center justify-center rounded-[10px]" style={{ width: 36, height: 36, background: '#ede9fe' }}>
            <LockKey size={17} style={{ color: '#7c3aed' }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Changer le mot de passe</p>
          </div>
          <CaretDown
            size={16}
            style={{ color: 'var(--muted-foreground)', flexShrink: 0, transition: 'transform 0.2s', transform: passwordOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {passwordOpen && (
          <form onSubmit={handlePasswordSubmit} className="px-4 pb-4 space-y-2.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="pt-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Mot de passe actuel
              </label>
              <input name="current_password" type="password" required placeholder="••••••••" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Nouveau mot de passe
              </label>
              <input name="password" type="password" required minLength={8} placeholder="••••••••" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Confirmer
              </label>
              <input name="confirm" type="password" required placeholder="••••••••" className={inputCls} style={inputStyle} />
            </div>
            {passwordMsg && (
              <p className="text-xs" style={{ color: passwordMsg.startsWith('✓') ? 'var(--synapse-green-500)' : 'var(--destructive)' }}>
                {passwordMsg}
              </p>
            )}
            <button type="submit" className="w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent-brand)' }}>
              Mettre à jour
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
