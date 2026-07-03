import '@/styles/globals.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-serif-display/400.css'
import { DynamicLayoutProviders } from './DynamicLayoutProviders'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <DynamicLayoutProviders>
          {children}
        </DynamicLayoutProviders>
      </body>
    </html>
  )
}
