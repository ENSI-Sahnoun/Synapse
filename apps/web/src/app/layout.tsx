import '@/styles/globals.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import type { Viewport } from 'next'
import { DynamicLayoutProviders } from './DynamicLayoutProviders'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewport-fit:cover is required for env(safe-area-inset-*) to resolve to
  // real values on notched phones — without it the bottom navs, toasts and
  // drawers that rely on the inset all get 0. Pinch-zoom is intentionally left
  // enabled (no maximumScale/userScalable) for WCAG 1.4.4 (Resize text).
  viewportFit: 'cover',
  themeColor: '#A2724A',
}

export const metadata = {
  title: 'Synapse',
  description: "Gestion de l'espace de coworking Synapse",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Synapse',
  },
  icons: {
    apple: '/logos/icon-192.png',
  },
  other: {
    'strix-verification': 'strix-verify-41d3a9d6ac01a22c5913250987fb9184',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <DynamicLayoutProviders>
          {children}
        </DynamicLayoutProviders>
      </body>
    </html>
  )
}
