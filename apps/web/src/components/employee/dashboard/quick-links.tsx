import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QrCode, CreditCard, ShoppingCart, ClipboardList, Users, LayoutGrid } from 'lucide-react'

const QUICK_LINKS = [
  { label: 'Scanner un QR', href: '/employee/checkin', icon: QrCode },
  { label: 'Vendre un abonnement', href: '/employee/students', icon: CreditCard },
  { label: 'Caisse (POS)', href: '/employee/pos', icon: ShoppingCart },
  { label: 'Présences', href: '/employee/attendance', icon: ClipboardList },
  { label: 'Étudiants', href: '/employee/students', icon: Users },
  { label: 'Plan des places', href: '/employee/rooms', icon: LayoutGrid },
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
              className="h-auto flex-col items-center gap-1 p-4 text-center"
              asChild
            >
              <Link href={link.href}>
                <link.icon className="size-5" />
                <span className="font-semibold">{link.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
