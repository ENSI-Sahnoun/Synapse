import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AdminStudentsPage() {
  const students = await listAllProfiles('student')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Étudiants</h1>
        <Button asChild>
          <Link href="/admin/students/new">Nouvel étudiant</Link>
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{students.length} étudiant(s)</p>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="text-left px-4 py-2">Université</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2">{s.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.university ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
