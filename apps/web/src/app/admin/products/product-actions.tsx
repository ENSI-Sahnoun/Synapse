'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { archiveProductAction, restoreProductAction, deleteProductAction } from '@/actions/admin/products'

export function ArchiveProductButton({ id }: { id: string }) {
  const router = useRouter()
  const { execute, status } = useAction(archiveProductAction, {
    onSuccess: () => { toast.success('Produit archivé'); router.refresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })
  return (
    <Button variant="outline" size="sm" disabled={status === 'executing'} onClick={() => execute({ id })}>
      Archiver
    </Button>
  )
}

export function RestoreProductButton({ id }: { id: string }) {
  const router = useRouter()
  const { execute, status } = useAction(restoreProductAction, {
    onSuccess: () => { toast.success('Produit restauré'); router.refresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })
  return (
    <Button variant="outline" size="sm" disabled={status === 'executing'} onClick={() => execute({ id })}>
      Restaurer
    </Button>
  )
}

export function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter()
  const { execute, status } = useAction(deleteProductAction, {
    onSuccess: () => { toast.success('Produit supprimé'); router.refresh() },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={status === 'executing'}
      onClick={() => { if (confirm('Supprimer définitivement ce produit ?')) execute({ id }) }}
    >
      Supprimer
    </Button>
  )
}
