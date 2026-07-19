'use client'

import { RouteError } from '@/components/RouteError'

export default function StudentError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="cette page" />
}
