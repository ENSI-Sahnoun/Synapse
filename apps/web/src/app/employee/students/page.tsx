import { listStudents } from '@/data/employee/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function EmployeeStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const students = await listStudents(q)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Étudiants</h1>
        <Button asChild>
          <Link href="/employee/students/new">Nouvel étudiant</Link>
        </Button>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom ou téléphone..."
          className="border rounded-md px-3 py-2 text-sm w-72"
        />
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="text-left px-4 py-2">Université</th>
              <th className="text-left px-4 py-2">Inscription</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun étudiant trouvé
                </td>
              </tr>
            )}
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{s.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.university ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/employee/students/${s.id}`} className="text-primary hover:underline text-xs">
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
