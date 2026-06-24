import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AdminEmployeesPage() {
  const employees = await listAllProfiles('employee')
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employés</h1>
        <Button asChild><Link href="/admin/employees/new">Nouvel employé</Link></Button>
      </div>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr><td colSpan={2} className="text-center py-8 text-muted-foreground">Aucun employé</td></tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-4 py-2">{e.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
