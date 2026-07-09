'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ArchivedToggle({ showArchived }: { showArchived: boolean }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(showArchived ? pathname : `${pathname}?archived=1`)}
    >
      {showArchived ? 'Afficher actifs' : 'Afficher archivés'}
    </Button>
  )
}
