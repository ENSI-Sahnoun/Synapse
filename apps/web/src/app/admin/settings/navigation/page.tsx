import { createSupabaseClient } from '@/supabase-clients/server'
import { getResolvedNavItems } from '@/data/nav/get-resolved-nav-items'
import { NavOrderEditor } from './NavOrderEditor'

export const dynamic = 'force-dynamic'

export default async function NavigationSettingsPage() {
  const supabase = await createSupabaseClient()
  const [employeeItems, adminItems] = await Promise.all([
    getResolvedNavItems(supabase, 'employee'),
    getResolvedNavItems(supabase, 'admin'),
  ])

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Navigation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Réorganisez ou masquez les onglets affichés dans la barre de navigation, pour chaque rôle.
          S'applique à tous les comptes du rôle concerné.
        </p>
      </div>

      <NavOrderEditor
        role="employee"
        title="Navigation Employé"
        description="Onglets affichés aux comptes employé (barre du bas mobile + barre latérale)."
        initialItems={employeeItems}
      />

      <NavOrderEditor
        role="admin"
        title="Navigation Admin"
        description="Onglets affichés aux comptes admin — sections Employé et Administration réordonnées séparément."
        initialItems={adminItems}
      />
    </div>
  )
}
