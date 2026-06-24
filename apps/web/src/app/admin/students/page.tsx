import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArchiveButton } from '@/components/admin/ArchiveButton'
import { RestoreButton } from '@/components/admin/RestoreButton'
import { HardDeleteButton } from '@/components/admin/HardDeleteButton'
import { ArchivedToggle } from './ArchivedToggle'
import { Suspense } from 'react'

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const params = await searchParams
  const showArchived = params.archived === '1'
  const students = await listAllProfiles('student', showArchived)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Étudiants{showArchived ? ' — Archivés' : ''}
        </h1>
        <div className="flex gap-2">
          <Suspense><ArchivedToggle /></Suspense>
          {!showArchived && (
            <Button asChild>
              <Link href="/admin/students/new">Nouvel étudiant</Link>
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{students.length} étudiant(s)</p>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="text-left px-4 py-2">Université</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">
                  {showArchived ? 'Aucun étudiant archivé' : 'Aucun étudiant'}
                </td>
              </tr>
            )}
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/students/${s.id}`} className="hover:underline font-medium">
                    {s.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.university ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 justify-end">
                    {showArchived ? (
                      <>
                        <RestoreButton id={s.id} />
                        <HardDeleteButton id={s.id} name={s.full_name} />
                      </>
                    ) : (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/students/${s.id}/edit`}>Modifier</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/students/${s.id}`}>Abonnement</Link>
                        </Button>
                        <ArchiveButton id={s.id} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
