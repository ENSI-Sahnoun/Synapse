'use client'

import { useState } from 'react'

interface SecretCodeRevealProps {
  token: string
}

export function SecretCodeReveal({ token }: SecretCodeRevealProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="text-center">
      <button
        onClick={() => setVisible((v) => !v)}
        className="text-xs text-muted-foreground underline underline-offset-2"
      >
        {visible ? 'Masquer le code secret' : 'Afficher le code secret'}
      </button>
      {visible && (
        <p className="mt-2 text-xs font-mono break-all bg-muted rounded-lg px-3 py-2 select-all text-muted-foreground max-w-xs mx-auto">
          {token}
        </p>
      )}
    </div>
  )
}
