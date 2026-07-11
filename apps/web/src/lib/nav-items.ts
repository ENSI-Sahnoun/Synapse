export type NavRole = 'admin' | 'employee'

export interface NavRegistryItem {
  key: string
  href: string
  label: string
  icon: string
  group: 'employee' | 'admin'
}

export interface StoredNavEntry {
  key: string
  hidden: boolean
}

export interface ResolvedNavItem extends NavRegistryItem {
  hidden: boolean
}

export const EMPLOYEE_NAV_ITEMS: NavRegistryItem[] = [
  { key: '/employee/dashboard',        href: '/employee/dashboard',        label: 'Tableau de bord',  icon: 'ChartBar',      group: 'employee' },
  { key: '/employee/checkin',          href: '/employee/checkin',          label: 'Contrôle accès',   icon: 'QrCode',        group: 'employee' },
  { key: '/employee/attendance',       href: '/employee/attendance',       label: 'Présences',        icon: 'ClipboardText', group: 'employee' },
  { key: '/employee/students',         href: '/employee/students',         label: 'Étudiants',        icon: 'Users',         group: 'employee' },
  { key: '/employee/lockers',          href: '/employee/lockers',          label: 'Casiers',          icon: 'Archive',       group: 'employee' },
  { key: '/employee/shifts',           href: '/employee/shifts',           label: 'Mes horaires',     icon: 'CalendarBlank', group: 'employee' },
  { key: '/employee/rooms',            href: '/employee/rooms',            label: 'Salles',           icon: 'Buildings',     group: 'employee' },
  { key: '/employee/reservations',     href: '/employee/reservations',     label: 'Réservations',     icon: 'Armchair',      group: 'employee' },
  { key: '/employee/pos',              href: '/employee/pos',              label: 'Caisse',           icon: 'ShoppingCart',  group: 'employee' },
  { key: '/employee/loyalty-requests', href: '/employee/loyalty-requests', label: 'Récompenses',      icon: 'Gift',          group: 'employee' },
  { key: '/employee/announcements',    href: '/employee/announcements',    label: 'Annonces',         icon: 'Megaphone',     group: 'employee' },
  { key: '/employee/profile',          href: '/employee/profile',          label: 'Mon profil',       icon: 'UserCircle',    group: 'employee' },
]

export const ADMIN_NAV_ITEMS: NavRegistryItem[] = [
  // "Employé" section — same pages admins share with staff (minus profile/reports, minus shifts)
  { key: '/admin/dashboard',           href: '/admin/dashboard',           label: "Vue d'ensemble",   icon: 'ChartBar',      group: 'employee' },
  { key: '/employee/checkin',          href: '/employee/checkin',          label: 'Contrôle accès',   icon: 'QrCode',        group: 'employee' },
  { key: '/employee/attendance',       href: '/employee/attendance',       label: 'Présences',        icon: 'ClipboardText', group: 'employee' },
  { key: '/employee/students',         href: '/employee/students',         label: 'Étudiants',        icon: 'Users',         group: 'employee' },
  { key: '/employee/lockers',          href: '/employee/lockers',          label: 'Casiers',          icon: 'Archive',       group: 'employee' },
  { key: '/employee/rooms',            href: '/employee/rooms',            label: 'Salles',           icon: 'Buildings',     group: 'employee' },
  { key: '/employee/reservations',     href: '/employee/reservations',     label: 'Réservations',     icon: 'Armchair',      group: 'employee' },
  { key: '/employee/pos',              href: '/employee/pos',              label: 'Caisse',           icon: 'ShoppingCart',  group: 'employee' },
  { key: '/employee/loyalty-requests', href: '/employee/loyalty-requests', label: 'Récompenses',      icon: 'Gift',          group: 'employee' },
  { key: '/employee/announcements',    href: '/employee/announcements',    label: 'Annonces',         icon: 'Megaphone',     group: 'employee' },
  // "Administration" section
  { key: '/admin/employees',           href: '/admin/employees',           label: 'Employés',         icon: 'UserCircle',    group: 'admin' },
  { key: '/admin/subscription-plans',  href: '/admin/subscription-plans',  label: 'Formules',         icon: 'CreditCard',    group: 'admin' },
  { key: '/admin/rooms',               href: '/admin/rooms',               label: 'Disposition salles', icon: 'Buildings',   group: 'admin' },
  { key: '/admin/products',            href: '/admin/products',            label: 'Produits (POS)',   icon: 'ShoppingCart',  group: 'admin' },
  { key: '/admin/pos/sessions',        href: '/admin/pos/sessions',        label: 'Sessions caisse',  icon: 'Wallet',        group: 'admin' },
  { key: '/admin/loyalty',             href: '/admin/loyalty',             label: 'Fidélité',         icon: 'Star',          group: 'admin' },
  { key: '/admin/notifications/trigger', href: '/admin/notifications/trigger', label: 'Notifications', icon: 'Bell',        group: 'admin' },
  { key: '/admin/settings',            href: '/admin/settings',            label: 'Paramètres',       icon: 'Gear',          group: 'admin' },
]

export function registryForRole(role: NavRole): NavRegistryItem[] {
  return role === 'admin' ? ADMIN_NAV_ITEMS : EMPLOYEE_NAV_ITEMS
}

function isStoredNavEntry(value: unknown): value is StoredNavEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredNavEntry).key === 'string' &&
    typeof (value as StoredNavEntry).hidden === 'boolean'
  )
}

function parseStoredNav(storedJson: string | null): StoredNavEntry[] {
  if (!storedJson) return []
  try {
    const parsed: unknown = JSON.parse(storedJson)
    return Array.isArray(parsed) ? parsed.filter(isStoredNavEntry) : []
  } catch {
    return []
  }
}

/**
 * Merges the admin-configured order/visibility with the canonical registry.
 * Groups stay contiguous in registry-first-appearance order (employee, then
 * admin) so mobile's flat top-4/More split never interleaves the two.
 */
export function resolveNavOrder(registry: NavRegistryItem[], storedJson: string | null): ResolvedNavItem[] {
  const byKey = new Map(registry.map((item) => [item.key, item]))
  const stored = parseStoredNav(storedJson)
  const groups: Array<'employee' | 'admin'> = []
  for (const item of registry) {
    if (!groups.includes(item.group)) groups.push(item.group)
  }

  const resolved: ResolvedNavItem[] = []
  for (const group of groups) {
    const seen = new Set<string>()
    for (const entry of stored) {
      const item = byKey.get(entry.key)
      if (!item || item.group !== group || seen.has(entry.key)) continue
      seen.add(entry.key)
      resolved.push({ ...item, hidden: entry.hidden })
    }
    for (const item of registry) {
      if (item.group === group && !seen.has(item.key)) resolved.push({ ...item, hidden: false })
    }
  }
  return resolved
}

export function validateNavOrderInput(role: NavRole, items: StoredNavEntry[]): void {
  const validKeys = new Set(registryForRole(role).map((item) => item.key))
  for (const entry of items) {
    if (!validKeys.has(entry.key)) throw new Error('Élément de navigation inconnu.')
  }
  if (items.length === 0 || items.every((entry) => entry.hidden)) {
    throw new Error('Au moins un élément de navigation doit rester visible.')
  }
}
