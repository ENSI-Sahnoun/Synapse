import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CapitalHistoryEntry } from '@/data/admin/capital'

type Props = { entries: CapitalHistoryEntry[] }

export function CapitalHistoryTable({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Compte</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Montant (DT)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => (
          <TableRow key={`${e.kind}-${e.id}`}>
            <TableCell>{new Date(e.date).toLocaleDateString('fr-FR')}</TableCell>
            <TableCell>{e.kind === 'movement' ? 'Mouvement' : 'Virement'}</TableCell>
            <TableCell>{e.account}</TableCell>
            <TableCell>{e.note ?? '—'}</TableCell>
            <TableCell className="text-right">{e.amount_dt.toFixed(3)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
