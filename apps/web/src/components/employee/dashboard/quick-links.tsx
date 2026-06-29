import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const QUICK_LINKS = [
  { label: 'Scanner un QR', href: '/employee/checkin', description: 'Check-in / check-out étudiant' },
  { label: 'Vendre un abonnement', href: '/employee/subscriptions/new', description: 'Nouvelle vente d\'abonnement' },
  { label: 'Caisse (POS)', href: '/employee/pos', description: 'Vente en magasin' },
  { label: 'Présences', href: '/employee/attendance', description: 'Gérer les présences du jour' },
  { label: 'Étudiants', href: '/employee/students', description: 'Rechercher ou créer un étudiant' },
  { label: 'Plan des places', href: '/employee/seats', description: 'Vue en direct des places' },
] as const

export function QuickLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accès rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-4 text-left"
              asChild
            >
              <Link href={link.href}>
                <span className="font-semibold">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
