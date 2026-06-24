'use client'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm print:hidden"
    >
      Imprimer
    </button>
  )
}
