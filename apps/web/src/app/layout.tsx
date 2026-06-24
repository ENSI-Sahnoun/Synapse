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
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head />
      <body style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <DynamicLayoutProviders>
          {children}
        </DynamicLayoutProviders>
      </body>
    </html>
  )
}
