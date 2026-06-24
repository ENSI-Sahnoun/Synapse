'use client'

export function FullscreenButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.documentElement
        if (el.requestFullscreen) el.requestFullscreen()
      }}
      className="text-xs underline text-muted-foreground"
    >
      Plein écran
    </button>
  )
}
