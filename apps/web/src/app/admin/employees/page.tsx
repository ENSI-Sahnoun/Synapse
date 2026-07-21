import { listAllProfiles } from '@/data/admin/students'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArchiveButton } from '@/components/admin/ArchiveButton'
import { RestoreButton } from '@/components/admin/RestoreButton'
import { HardDeleteButton } from '@/components/admin/HardDeleteButton'
import { ArchivedToggle } from './ArchivedToggle'
import { EmptyStateText } from './EmptyStateText'
import { UserAvatar } from '@/components/user/UserAvatar'
import { Suspense } from 'react'

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const params = await searchParams
  const showArchived = params.archived === '1'
  const employees = await listAllProfiles('employee', showArchived)
  const kioskAccounts = await listAllProfiles('kiosk', showArchived)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
        <p className="font-medium">Configuration du kiosque d&apos;accès</p>
        <p className="mt-1 text-xs">
          Créez un compte kiosque dédié ci-dessous, puis connectez-vous avec ces
          identifiants sur l&apos;appareil kiosque. Ce compte n&apos;a accès qu&apos;au
          kiosque — aucun autre écran.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">
          Employés{showArchived ? ' — Archivés' : ''}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Suspense><ArchivedToggle /></Suspense>
          {!showArchived && (
            <>
              <Button asChild variant="outline">
                <Link href="/admin/employees/new-kiosk">Nouveau compte kiosque</Link>
              </Button>
              <Button asChild>
                <Link href="/admin/employees/new">Nouvel employé</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
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
                  <EmptyStateText
                    stateKey={showArchived ? 'archived' : 'active'}
                    text={showArchived ? 'Aucun employé archivé' : 'Aucun employé'}
                  />
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar fullName={e.full_name} avatarUrl={e.avatar_url} className="h-8 w-8" />
                    {e.full_name}
                  </div>
                </td>
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

      <h2 className="text-xl font-semibold pt-4">
        Comptes kiosque{showArchived ? ' — Archivés' : ''}
      </h2>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {kioskAccounts.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center py-8 text-muted-foreground">
                  <EmptyStateText
                    stateKey={showArchived ? 'kiosk-archived' : 'kiosk-active'}
                    text={showArchived ? 'Aucun compte kiosque archivé' : 'Aucun compte kiosque'}
                  />
                </td>
              </tr>
            )}
            {kioskAccounts.map((k) => (
              <tr key={k.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar fullName={k.full_name} avatarUrl={k.avatar_url} className="h-8 w-8" />
                    {k.full_name}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 justify-end">
                    {showArchived ? (
                      <>
                        <RestoreButton id={k.id} />
                        <HardDeleteButton id={k.id} name={k.full_name} />
                      </>
                    ) : (
                      <ArchiveButton id={k.id} />
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
