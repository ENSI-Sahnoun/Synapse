import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArchiveButton } from '@/components/admin/ArchiveButton'
import { RestoreButton } from '@/components/admin/RestoreButton'
import { HardDeleteButton } from '@/components/admin/HardDeleteButton'
import { ArchivedToggle } from './ArchivedToggle'
import { Suspense } from 'react'

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const params = await searchParams
  const showArchived = params.archived === '1'
  const employees = await listAllProfiles('employee', showArchived)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
        <p className="font-medium">Configuration du kiosque d&apos;accès</p>
        <p className="mt-1 text-xs">
          Créez un compte employé dédié (ex. <code>kiosk@synapse.tn</code>), puis
          rendez-vous sur l&apos;appareil kiosque et connectez-vous via{' '}
          <strong>/kiosk/setup</strong>. Le kiosque restera connecté en permanence.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Employés{showArchived ? ' — Archivés' : ''}
        </h1>
        <div className="flex gap-2">
          <Suspense><ArchivedToggle /></Suspense>
          {!showArchived && (
            <Button asChild>
              <Link href="/admin/employees/new">Nouvel employé</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Téléphone</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-muted-foreground">
                  {showArchived ? 'Aucun employé archivé' : 'Aucun employé'}
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-4 py-2">{e.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.phone ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 justify-end">
                    {showArchived ? (
                      <>
                        <RestoreButton id={e.id} />
                        <HardDeleteButton id={e.id} name={e.full_name} />
                      </>
                    ) : (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/employees/${e.id}/edit`}>Modifier</Link>
                        </Button>
                        <ArchiveButton id={e.id} />
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
