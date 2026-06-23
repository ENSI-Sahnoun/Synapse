# Phase 7C: Accounting — Expenses CRUD + P&L View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/accounting` section with manual expense entry, expense list with category + date filters, and a dynamic P&L view (Revenue − Expenses = Profit) filterable by day, month, or custom range.

**Architecture:** All accounting routes are admin-only Server Components. Expense CRUD is handled by `adminActionClient` server actions (next-safe-action). Income is read-only — auto-populated from `subscriptions.paid_amount` and `purchases.total_dt` joined to their respective `account_categories`. The P&L query groups all income and expense rows by their `account_category.name` to produce dynamic columns — no hardcoded category names. Date filtering uses URL search params (`from` + `to` dates) passed as page props and forwarded to Supabase queries.

**Tech Stack:** next-safe-action, Zod, shadcn/ui (Table, Form, Select, DatePicker), date-fns, adminActionClient

## Global Constraints

- Routes live under `apps/web/src/app/(app-pages)/admin/accounting/`
- Admin-only — add `adminActionClient` on every server action; middleware already guards `/admin/`
- French labels everywhere
- Cash only — no payment method column or UI
- P&L columns mirror live `account_categories` — no hardcoded names
- `expenses` table must exist before these routes — created in Phase 7A migration (`20260623500000`)
- All commands run from `/home/sah/Synapse`

---

### Task 1: Zod schemas + server actions for expenses

**Files:**
- Create: `apps/web/src/utils/zod-schemas/expense.ts`
- Create: `apps/web/src/actions/admin/expenses.ts`

- [ ] **Step 1: Write Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/expense.ts
import { z } from 'zod'

export const createExpenseSchema = z.object({
  account_category_id: z.string().uuid('Catégorie invalide'),
  description: z.string().min(1, 'Description requise').max(255),
  amount_dt: z.coerce.number().positive('Montant doit être positif'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)'),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
})

export const deleteExpenseSchema = z.object({
  id: z.string().uuid(),
})
```

- [ ] **Step 2: Write server actions**

```typescript
// apps/web/src/actions/admin/expenses.ts
'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/clients/admin-action-client'
import {
  createExpenseSchema,
  updateExpenseSchema,
  deleteExpenseSchema,
} from '@/utils/zod-schemas/expense'

export const createExpenseAction = adminActionClient
  .schema(createExpenseSchema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { error } = await supabase.from('expenses').insert({
      ...parsedInput,
      created_by: user.id,
    })
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const updateExpenseAction = adminActionClient
  .schema(updateExpenseSchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { id, ...fields } = parsedInput
    const { error } = await supabase
      .from('expenses')
      .update(fields)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const deleteExpenseAction = adminActionClient
  .schema(deleteExpenseSchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/utils/zod-schemas/expense.ts \
        apps/web/src/actions/admin/expenses.ts
git commit -m "feat(admin/accounting): expense Zod schemas and server actions"
```

---

### Task 2: Data layer — expenses list + P&L computation

**Files:**
- Create: `apps/web/src/data/admin/accounting.ts`

- [ ] **Step 1: Write accounting data functions**

```typescript
// apps/web/src/data/admin/accounting.ts
import { createSupabaseServerClient } from '@/supabase-clients/server'

export type ExpenseRow = {
  id: string
  description: string
  amount_dt: number
  date: string
  created_at: string
  account_category: { id: string; name: string }
}

export type PnlRow = {
  category_id: string
  category_name: string
  type: 'income' | 'expense'
  total: number
}

export type PnlSummary = {
  rows: PnlRow[]
  totalRevenue: number
  totalExpenses: number
  profit: number
}

export type AccountCategory = {
  id: string
  type: 'income' | 'expense'
  name: string
  description: string | null
  is_active: boolean
}

export async function getExpenses(filters: {
  from?: string
  to?: string
  category_id?: string
}): Promise<ExpenseRow[]> {
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('expenses')
    .select(
      `id, description, amount_dt, date, created_at,
       account_category:account_categories!inner(id, name)`,
    )
    .order('date', { ascending: false })

  if (filters.from) query = query.gte('date', filters.from)
  if (filters.to) query = query.lte('date', filters.to)
  if (filters.category_id) query = query.eq('account_category_id', filters.category_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    ...r,
    amount_dt: Number(r.amount_dt),
    account_category: r.account_category as { id: string; name: string },
  }))
}

export async function getPnl(filters: { from: string; to: string }): Promise<PnlSummary> {
  const supabase = await createSupabaseServerClient()

  // ------ Income: subscriptions ------
  // Get subscription income category id from settings
  const { data: settingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'subscription_income_category_id')
    .single()

  const subCategoryId = settingRow?.value

  const { data: subCategoryRow } = subCategoryId
    ? await supabase
        .from('account_categories')
        .select('id, name')
        .eq('id', subCategoryId)
        .single()
    : { data: null }

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount')
    .gte('created_at', filters.from + 'T00:00:00')
    .lte('created_at', filters.to + 'T23:59:59')

  const subsTotal = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0

  // ------ Income: purchases grouped by product account_category ------
  const { data: purchaseItems } = await supabase
    .from('purchase_items')
    .select(
      `quantity, unit_price_dt,
       products!inner(account_category_id,
         account_categories!inner(id, name))`,
    )
    .gte('purchases.created_at', filters.from + 'T00:00:00')
    .lte('purchases.created_at', filters.to + 'T23:59:59')

  // Group purchase income by category
  const purchaseMap = new Map<string, { name: string; total: number }>()
  purchaseItems?.forEach((pi) => {
    const prod = pi.products as {
      account_category_id: string
      account_categories: { id: string; name: string }
    }
    const catId = prod.account_category_id
    const catName = prod.account_categories.name
    const amount = Number(pi.unit_price_dt) * Number(pi.quantity)
    const existing = purchaseMap.get(catId)
    if (existing) existing.total += amount
    else purchaseMap.set(catId, { name: catName, total: amount })
  })

  // ------ Expenses ------
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount_dt, account_category_id, account_categories!inner(id, name)')
    .gte('date', filters.from)
    .lte('date', filters.to)

  const expenseMap = new Map<string, { name: string; total: number }>()
  expenses?.forEach((e) => {
    const cat = e.account_categories as { id: string; name: string }
    const existing = expenseMap.get(e.account_category_id)
    if (existing) existing.total += Number(e.amount_dt)
    else expenseMap.set(e.account_category_id, { name: cat.name, total: Number(e.amount_dt) })
  })

  // Assemble rows
  const rows: PnlRow[] = []

  if (subCategoryRow && subsTotal > 0) {
    rows.push({
      category_id: subCategoryRow.id,
      category_name: subCategoryRow.name,
      type: 'income',
      total: subsTotal,
    })
  }

  purchaseMap.forEach((v, catId) => {
    rows.push({ category_id: catId, category_name: v.name, type: 'income', total: v.total })
  })

  expenseMap.forEach((v, catId) => {
    rows.push({ category_id: catId, category_name: v.name, type: 'expense', total: v.total })
  })

  const totalRevenue = rows
    .filter((r) => r.type === 'income')
    .reduce((s, r) => s + r.total, 0)

  const totalExpenses = rows
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + r.total, 0)

  return { rows, totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses }
}

export async function getExpenseCategories(): Promise<AccountCategory[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('account_categories')
    .select('*')
    .eq('type', 'expense')
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as AccountCategory[]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/admin/accounting.ts
git commit -m "feat(admin/accounting): data layer — expenses list and P&L computation"
```

---

### Task 3: Expense entry form (Client Component)

**Files:**
- Create: `apps/web/src/components/admin/accounting/expense-form.tsx`

- [ ] **Step 1: Write form component**

```typescript
// apps/web/src/components/admin/accounting/expense-form.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createExpenseSchema, type CreateExpenseInput } from '@/utils/zod-schemas/expense'
import { createExpenseAction } from '@/actions/admin/expenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { AccountCategory } from '@/data/admin/accounting'

type Props = {
  categories: AccountCategory[]
  onSuccess?: () => void
}

export function ExpenseForm({ categories, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
    },
  })

  const { execute, isPending } = useAction(createExpenseAction, {
    onSuccess: () => {
      toast.success('Dépense enregistrée')
      reset()
      onSuccess?.()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de l\'enregistrement')
    },
  })

  const onSubmit = (data: CreateExpenseInput) => execute(data)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="account_category_id">Catégorie</Label>
          <Select onValueChange={(v) => setValue('account_category_id', v)}>
            <SelectTrigger id="account_category_id">
              <SelectValue placeholder="Choisir une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.account_category_id && (
            <p className="text-xs text-destructive">{errors.account_category_id.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register('date')} />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" placeholder="Ex: Facture électricité juin" {...register('description')} />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="amount_dt">Montant (DT)</Label>
          <Input
            id="amount_dt"
            type="number"
            step="0.001"
            min="0"
            placeholder="0.000"
            {...register('amount_dt')}
          />
          {errors.amount_dt && (
            <p className="text-xs text-destructive">{errors.amount_dt.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement…' : 'Ajouter la dépense'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/accounting/expense-form.tsx
git commit -m "feat(admin/accounting): expense entry form"
```

---

### Task 4: Expense list table (Client Component)

**Files:**
- Create: `apps/web/src/components/admin/accounting/expense-table.tsx`

- [ ] **Step 1: Write table component**

```typescript
// apps/web/src/components/admin/accounting/expense-table.tsx
'use client'

import { useTransition } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { deleteExpenseAction } from '@/actions/admin/expenses'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { ExpenseRow } from '@/data/admin/accounting'

type Props = { expenses: ExpenseRow[] }

export function ExpenseTable({ expenses }: Props) {
  const { execute } = useAction(deleteExpenseAction, {
    onSuccess: () => toast.success('Dépense supprimée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  if (expenses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune dépense pour cette période.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Montant (DT)</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(e.date).toLocaleDateString('fr-FR')}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{e.account_category.name}</Badge>
            </TableCell>
            <TableCell>{e.description}</TableCell>
            <TableCell className="text-right font-mono">
              {e.amount_dt.toFixed(3)}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm('Supprimer cette dépense ?')) execute({ id: e.id })
                }}
              >
                Supprimer
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/accounting/expense-table.tsx
git commit -m "feat(admin/accounting): expense list table with delete"
```

---

### Task 5: P&L summary table (Server Component)

**Files:**
- Create: `apps/web/src/components/admin/accounting/pnl-table.tsx`

- [ ] **Step 1: Write P&L table component**

```typescript
// apps/web/src/components/admin/accounting/pnl-table.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { PnlSummary } from '@/data/admin/accounting'

type Props = { pnl: PnlSummary }

export function PnlTable({ pnl }: Props) {
  const incomeRows = pnl.rows.filter((r) => r.type === 'income')
  const expenseRows = pnl.rows.filter((r) => r.type === 'expense')

  return (
    <div className="space-y-6">
      {/* Income */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Revenus
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Total (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incomeRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Aucun revenu sur la période
                </TableCell>
              </TableRow>
            ) : (
              incomeRows.map((r) => (
                <TableRow key={r.category_id}>
                  <TableCell>
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      {r.category_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.total.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total revenus</TableCell>
              <TableCell className="text-right font-bold font-mono">
                {pnl.totalRevenue.toFixed(3)} DT
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Expenses */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Dépenses
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Total (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenseRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Aucune dépense sur la période
                </TableCell>
              </TableRow>
            ) : (
              expenseRows.map((r) => (
                <TableRow key={r.category_id}>
                  <TableCell>
                    <Badge variant="outline" className="border-red-400 text-red-700">
                      {r.category_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.total.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total dépenses</TableCell>
              <TableCell className="text-right font-bold font-mono">
                {pnl.totalExpenses.toFixed(3)} DT
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Profit */}
      <div
        className={`rounded-lg border-2 p-4 ${
          pnl.profit >= 0 ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'
        }`}
      >
        <p className="text-sm font-medium text-muted-foreground">Résultat net</p>
        <p
          className={`text-3xl font-bold ${
            pnl.profit >= 0 ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {pnl.profit >= 0 ? '+' : ''}
          {pnl.profit.toFixed(3)} DT
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/accounting/pnl-table.tsx
git commit -m "feat(admin/accounting): P&L summary table"
```

---

### Task 6: Date range filter component

**Files:**
- Create: `apps/web/src/components/admin/accounting/date-range-filter.tsx`

- [ ] **Step 1: Write client filter component**

```typescript
// apps/web/src/components/admin/accounting/date-range-filter.tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Preset = 'today' | 'this_month' | 'last_month' | 'this_year' | 'custom'

function getPresetDates(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  switch (preset) {
    case 'today': {
      const t = fmt(now)
      return { from: t, to: t }
    }
    case 'this_month': {
      const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      const to = fmt(now)
      return { from, to }
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(first), to: fmt(last) }
    }
    case 'this_year': {
      return { from: `${now.getFullYear()}-01-01`, to: fmt(now) }
    }
    default:
      return { from: fmt(now), to: fmt(now) }
  }
}

type Props = {
  from: string
  to: string
}

export function DateRangeFilter({ from, to }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => params.set(k, v))
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const applyPreset = (preset: Preset) => {
    if (preset === 'custom') return
    const { from: f, to: t } = getPresetDates(preset)
    updateParams({ from: f, to: t })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="preset-select" className="text-xs">
          Période rapide
        </Label>
        <Select onValueChange={(v) => applyPreset(v as Preset)}>
          <SelectTrigger id="preset-select" className="w-40">
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="this_month">Ce mois</SelectItem>
            <SelectItem value="last_month">Mois dernier</SelectItem>
            <SelectItem value="this_year">Cette année</SelectItem>
            <SelectItem value="custom">Personnalisé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="from-date" className="text-xs">
          Du
        </Label>
        <Input
          id="from-date"
          type="date"
          value={from}
          onChange={(e) => updateParams({ from: e.target.value })}
          className="w-40"
        />
      </div>

      <div>
        <Label htmlFor="to-date" className="text-xs">
          Au
        </Label>
        <Input
          id="to-date"
          type="date"
          value={to}
          onChange={(e) => updateParams({ to: e.target.value })}
          className="w-40"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/accounting/date-range-filter.tsx
git commit -m "feat(admin/accounting): date range filter with presets"
```

---

### Task 7: Accounting page layout + tabs

**Files:**
- Create: `apps/web/src/app/(app-pages)/admin/accounting/page.tsx`

- [ ] **Step 1: Write accounting page**

```typescript
// apps/web/src/app/(app-pages)/admin/accounting/page.tsx
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getExpenses, getPnl, getExpenseCategories } from '@/data/admin/accounting'
import { ExpenseForm } from '@/components/admin/accounting/expense-form'
import { ExpenseTable } from '@/components/admin/accounting/expense-table'
import { PnlTable } from '@/components/admin/accounting/pnl-table'
import { DateRangeFilter } from '@/components/admin/accounting/date-range-filter'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams: { from?: string; to?: string; category_id?: string }
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

export default async function AccountingPage({ searchParams }: PageProps) {
  const defaults = defaultDateRange()
  const from = searchParams.from ?? defaults.from
  const to = searchParams.to ?? defaults.to
  const category_id = searchParams.category_id

  const [expenses, pnl, categories] = await Promise.all([
    getExpenses({ from, to, category_id }),
    getPnl({ from, to }),
    getExpenseCategories(),
  ])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comptabilité</h1>
        <Button variant="outline" asChild>
          <Link href="/admin/accounting/categories">Gérer les catégories</Link>
        </Button>
      </div>

      <DateRangeFilter from={from} to={to} />

      <Tabs defaultValue="depenses">
        <TabsList>
          <TabsTrigger value="depenses">Dépenses</TabsTrigger>
          <TabsTrigger value="pnl">Résultat P&amp;L</TabsTrigger>
        </TabsList>

        <TabsContent value="depenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle dépense</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseForm categories={categories} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Dépenses du {new Date(from).toLocaleDateString('fr-FR')} au{' '}
                {new Date(to).toLocaleDateString('fr-FR')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <ExpenseTable expenses={expenses} />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl">
          <Card>
            <CardHeader>
              <CardTitle>
                Compte de résultat — {new Date(from).toLocaleDateString('fr-FR')} →{' '}
                {new Date(to).toLocaleDateString('fr-FR')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PnlTable pnl={pnl} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(app-pages\)/admin/accounting/page.tsx
git commit -m "feat(admin/accounting): main accounting page with expense CRUD and P&L tabs"
```

---

### Task 8: Verify build

- [ ] **Step 1: Type-check**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Build**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web build
```

Expected: build completes successfully.

- [ ] **Step 3: Lint**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web lint
```

Expected: no errors.

---

## Self-review checklist

- [ ] All UI text is French including error messages
- [ ] `adminActionClient` used on all server actions — not `employeeActionClient`
- [ ] P&L income rows sourced from both `subscriptions` and `purchases` via `account_categories` join — zero hardcoded category names
- [ ] Date filter uses URL search params — page is shareable/bookmarkable
- [ ] `force-dynamic` on page — no stale ISR data
- [ ] `createExpenseAction` inserts `created_by: user.id` from action context
- [ ] Expense delete uses `confirm()` dialog before executing action
- [ ] Link to `/admin/accounting/categories` is present for category management (implemented in Phase 7D)
