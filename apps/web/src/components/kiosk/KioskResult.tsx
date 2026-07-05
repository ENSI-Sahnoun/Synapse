'use client'

import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CheckinResult } from '@/utils/zod-schemas/checkin'

interface KioskResultProps {
  result: CheckinResult
  onReset: () => void
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: fr })
  } catch {
    return dateStr
  }
}

export function KioskResult({ result, onReset }: KioskResultProps) {
  useEffect(() => {
    // Give authorized students longer to read their seat / phone instruction.
    const delay = result.status === 'AUTHORIZED' ? 6000 : 2500
    const timer = setTimeout(onReset, delay)
    return () => clearTimeout(timer)
  }, [result, onReset])

  if (result.status === 'AUTHORIZED') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-[#16A34A] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="text-5xl font-bold text-[#4ADE80]">{result.studentName}</p>
          <p className="text-2xl text-[#D6C4B0] mt-2">{result.planName}</p>
        </div>
        {result.seatLabel ? (
          <div className="rounded-2xl border border-[#16A34A]/40 bg-[#16A34A]/10 px-8 py-4">
            <p className="text-sm uppercase tracking-widest text-[#A08060]">Votre place réservée</p>
            <p className="text-3xl font-bold text-white mt-1">
              {result.roomName ? `${result.roomName} · ` : ''}{result.seatLabel}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#D6C4B0]/30 bg-white/5 px-8 py-4 max-w-lg">
            <p className="text-sm uppercase tracking-widest text-[#A08060]">Choisissez votre place</p>
            <p className="text-xl text-white mt-1">
              Ouvrez l&apos;app Synapse sur votre téléphone pour réserver votre place.
            </p>
          </div>
        )}
        <div className="text-xl text-[#A08060]">
          <p>Expire le {formatDate(result.endDate)}</p>
          <p className="text-lg mt-1">
            {result.daysRemaining} jour{result.daysRemaining !== 1 ? 's' : ''} restant{result.daysRemaining !== 1 ? 's' : ''}
          </p>
        </div>
        <p className="text-[#4ADE80] text-2xl font-bold tracking-widest">BIENVENUE</p>
      </div>
    )
  }

  if (result.status === 'DENIED_EXPIRED') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-[#DC2626] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-[#FCA5A5]">{result.studentName}</p>
        <div className="text-xl text-[#A08060]">
          <p>Abonnement expiré</p>
          <p className="text-lg mt-1">depuis le {formatDate(result.endDate)}</p>
        </div>
        <p className="text-[#FCA5A5] text-2xl font-bold tracking-widest">ACCÈS REFUSÉ</p>
        <p className="text-[#8C7B6E] text-base">Veuillez contacter l&apos;accueil pour renouveler.</p>
      </div>
    )
  }

  if (result.status === 'DENIED_NO_SUB') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-[#DC2626] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-[#FCA5A5]">{result.studentName}</p>
        <p className="text-xl text-[#A08060]">Aucun abonnement actif</p>
        <p className="text-[#FCA5A5] text-2xl font-bold tracking-widest">ACCÈS REFUSÉ</p>
        <p className="text-[#8C7B6E] text-base">Veuillez contacter l&apos;accueil.</p>
      </div>
    )
  }

  if (result.status === 'DENIED_UNKNOWN') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-[#3D2314] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-3xl font-bold text-[#D6C4B0]">QR non reconnu</p>
        <p className="text-[#8C7B6E] text-base">Contactez l&apos;accueil.</p>
      </div>
    )
  }

  if (result.status === 'ALREADY_IN') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-32 h-32 rounded-full bg-[#D97706] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-[#FCD34D]">{result.studentName}</p>
        <p className="text-xl text-[#A08060]">
          Déjà présent depuis {format(parseISO(result.checkedInAt), 'HH:mm', { locale: fr })}
        </p>
      </div>
    )
  }

  return null
}
