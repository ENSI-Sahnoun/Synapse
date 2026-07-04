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
import type { Viewport } from 'next'
import { DynamicLayoutProviders } from './DynamicLayoutProviders'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata = {
  title: 'Synapse Management Platform',
  description: "Gestion de l'espace de coworking Synapse",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Synapse',
  },
  icons: {
    apple: '/logos/icon-192.png',
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
