export const metadata = {
  title: 'Synapse — Kiosque',
}

// Presentational only. Auth guarding lives in kiosk/page.tsx so that the
// nested /kiosk/setup login route is NOT wrapped by a guard that would
// redirect unauthenticated visitors back to itself (infinite loop).
export default function KioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="text-white w-screen h-screen overflow-hidden fixed inset-0"
      style={{ backgroundColor: 'var(--sidebar)' }}
    >
      {children}
    </div>
  )
}
