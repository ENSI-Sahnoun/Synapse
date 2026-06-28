'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'

export function SearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('q', e.target.value)
    } else {
      params.delete('q')
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <Input
      type="search"
      placeholder="Rechercher par nom ou téléphone…"
      defaultValue={defaultValue}
      onChange={handleChange}
      className="max-w-sm"
    />
  )
}
