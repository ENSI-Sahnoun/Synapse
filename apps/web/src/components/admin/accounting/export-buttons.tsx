'use client'

import { Button } from '@/components/ui/button'

type Props = { from: string; to: string }

export function ExportButtons({ from, to }: Props) {
  const pdfUrl = `/api/admin/accounting/export/pdf?from=${from}&to=${to}`
  const excelUrl = `/api/admin/accounting/export/excel?from=${from}&to=${to}`

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={pdfUrl} download>Exporter PDF</a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={excelUrl} download>Exporter Excel</a>
      </Button>
    </div>
  )
}
