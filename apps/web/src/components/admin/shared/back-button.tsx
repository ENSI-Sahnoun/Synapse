import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackButton({ href = '/admin/dashboard', label = 'Tableau de bord' }: { href?: string; label?: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <ArrowLeft />
        {label}
      </Link>
    </Button>
  )
}
