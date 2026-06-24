'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ArchivedToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showArchived = searchParams.get('archived') === '1'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(showArchived ? '/admin/students' : '/admin/students?archived=1')}
    >
      {showArchived ? 'Afficher actifs' : 'Afficher archivés'}
    </Button>
  )
}
