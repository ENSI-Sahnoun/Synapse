# Phase 7D: Accounting Exports + Account Category Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF export (`@react-pdf/renderer`) and Excel export (`xlsx`) to the accounting P&L view, and build the `/admin/accounting/categories` CRUD page for managing income and expense account categories.

**Architecture:** PDF and Excel exports are generated in Next.js API routes (not server actions) so the browser receives a proper file download response with `Content-Disposition: attachment`. The P&L data fetching from Phase 7C is reused. Account category management uses `adminActionClient` server actions with `revalidatePath`; the CRUD UI is a shadcn Dialog-based form so the list page never navigates away. Adding a new category immediately makes it appear in all future P&L reports — no migration needed.

**Tech Stack:** `@react-pdf/renderer`, `xlsx`, next-safe-action, Zod, shadcn/ui (Dialog, Table, Form), adminActionClient

## Global Constraints

- Export API routes: `apps/web/src/app/api/admin/accounting/export/`
- Category management: `apps/web/src/app/(app-pages)/admin/accounting/categories/page.tsx`
- Admin-only everywhere — validate role in API routes; middleware + `adminActionClient` for server actions
- French labels in all exported documents
- PDF and Excel reports mirror live `account_categories` — no hardcoded column list
- Depends on Phase 7C (`getPnl` function in `apps/web/src/data/admin/accounting.ts`)
- Migration naming: timestamps starting at `20260623500001`
- All commands run from `/home/sah/Synapse`

---

### Task 1: Install export libraries

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Install libraries**

```bash
cd /home/sah/Synapse && pnpm add @react-pdf/renderer xlsx --filter @synapse/web
```

Expected: both packages appear in `apps/web/package.json` dependencies.

- [ ] **Step 2: Verify types are available**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web tsc --noEmit
```

Expected: no type errors introduced by library installation.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(deps): add @react-pdf/renderer and xlsx for accounting exports"
```

---

### Task 2: PDF report template

**Files:**
- Create: `apps/web/src/lib/exports/pnl-pdf.tsx`

- [ ] **Step 1: Write PDF document component**

```typescript
// apps/web/src/lib/exports/pnl-pdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { PnlSummary } from '@/data/admin/accounting'

// Use built-in Helvetica — no external font needed
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 48,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: '1pt solid #ddd',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottom: '0.5pt solid #eee',
  },
  tableRowAlt: {
    backgroundColor: '#f9f9f9',
  },
  cellLeft: { flex: 3 },
  cellRight: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica' },
  footerRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderTop: '1pt solid #aaa',
    marginTop: 2,
  },
  footerLabel: { flex: 3, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  footerValue: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  profitBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 4,
  },
  profitLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
  },
})

type Props = {
  pnl: PnlSummary
  from: string
  to: string
}

export function PnlPdfDocument({ pnl, from, to }: Props) {
  const incomeRows = pnl.rows.filter((r) => r.type === 'income')
  const expenseRows = pnl.rows.filter((r) => r.type === 'expense')
  const isProfit = pnl.profit >= 0

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Document title={`Compte de résultat — ${from} à ${to}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Compte de résultat</Text>
          <Text style={styles.subtitle}>
            Synapse Meeting Space — du {formatDate(from)} au {formatDate(to)}
          </Text>
          <Text style={[styles.subtitle, { marginTop: 2 }]}>
            Généré le {formatDate(new Date().toISOString().slice(0, 10))}
          </Text>
        </View>

        {/* Income section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenus</Text>
          {incomeRows.length === 0 ? (
            <Text style={{ color: '#999' }}>Aucun revenu sur la période</Text>
          ) : (
            incomeRows.map((r, i) => (
              <View
                key={r.category_id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.cellLeft}>{r.category_name}</Text>
                <Text style={styles.cellRight}>{r.total.toFixed(3)} DT</Text>
              </View>
            ))
          )}
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total revenus</Text>
            <Text style={styles.footerValue}>{pnl.totalRevenue.toFixed(3)} DT</Text>
          </View>
        </View>

        {/* Expense section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dépenses</Text>
          {expenseRows.length === 0 ? (
            <Text style={{ color: '#999' }}>Aucune dépense sur la période</Text>
          ) : (
            expenseRows.map((r, i) => (
              <View
                key={r.category_id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.cellLeft}>{r.category_name}</Text>
                <Text style={styles.cellRight}>{r.total.toFixed(3)} DT</Text>
              </View>
            ))
          )}
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total dépenses</Text>
            <Text style={styles.footerValue}>{pnl.totalExpenses.toFixed(3)} DT</Text>
          </View>
        </View>

        {/* Profit */}
        <View
          style={[
            styles.profitBox,
            { backgroundColor: isProfit ? '#f0fdf4' : '#fef2f2' },
          ]}
        >
          <Text style={styles.profitLabel}>Résultat net</Text>
          <Text
            style={[
              styles.profitValue,
              { color: isProfit ? '#15803d' : '#b91c1c' },
            ]}
          >
            {isProfit ? '+' : ''}
            {pnl.profit.toFixed(3)} DT
          </Text>
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/exports/pnl-pdf.tsx
git commit -m "feat(admin/exports): PDF P&L document template"
```

---

### Task 3: Excel report builder

**Files:**
- Create: `apps/web/src/lib/exports/pnl-excel.ts`

- [ ] **Step 1: Write Excel builder function**

```typescript
// apps/web/src/lib/exports/pnl-excel.ts
import * as XLSX from 'xlsx'
import type { PnlSummary } from '@/data/admin/accounting'

export function buildPnlWorkbook(pnl: PnlSummary, from: string, to: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const incomeRows = pnl.rows.filter((r) => r.type === 'income')
  const expenseRows = pnl.rows.filter((r) => r.type === 'expense')

  // ---- Sheet 1: Résultat P&L ----
  const pnlData: (string | number)[][] = [
    [`Compte de résultat — du ${formatDate(from)} au ${formatDate(to)}`],
    [],
    ['REVENUS', ''],
    ['Catégorie', 'Montant (DT)'],
    ...incomeRows.map((r) => [r.category_name, r.total]),
    ['Total revenus', pnl.totalRevenue],
    [],
    ['DÉPENSES', ''],
    ['Catégorie', 'Montant (DT)'],
    ...expenseRows.map((r) => [r.category_name, r.total]),
    ['Total dépenses', pnl.totalExpenses],
    [],
    ['RÉSULTAT NET', pnl.profit],
  ]

  const ws = XLSX.utils.aoa_to_sheet(pnlData)

  // Column widths
  ws['!cols'] = [{ wch: 40 }, { wch: 18 }]

  // Style the header row (xlsx does not support rich cell styles in community version — use bold via outline cell)
  // Row 1 title merges A1:B1
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]

  XLSX.utils.book_append_sheet(wb, ws, 'Compte de résultat')

  // ---- Sheet 2: Détail revenus ----
  const incomeDetail = [
    ['Catégorie', 'Montant (DT)'],
    ...incomeRows.map((r) => [r.category_name, r.total]),
    ['TOTAL', pnl.totalRevenue],
  ]
  const wsIncome = XLSX.utils.aoa_to_sheet(incomeDetail)
  wsIncome['!cols'] = [{ wch: 40 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsIncome, 'Revenus')

  // ---- Sheet 3: Détail dépenses ----
  const expenseDetail = [
    ['Catégorie', 'Montant (DT)'],
    ...expenseRows.map((r) => [r.category_name, r.total]),
    ['TOTAL', pnl.totalExpenses],
  ]
  const wsExpense = XLSX.utils.aoa_to_sheet(expenseDetail)
  wsExpense['!cols'] = [{ wch: 40 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsExpense, 'Dépenses')

  return wb
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/exports/pnl-excel.ts
git commit -m "feat(admin/exports): Excel P&L workbook builder"
```

---

### Task 4: PDF export API route

**Files:**
- Create: `apps/web/src/app/api/admin/accounting/export/pdf/route.ts`

- [ ] **Step 1: Write PDF API route**

```typescript
// apps/web/src/app/api/admin/accounting/export/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getPnl } from '@/data/admin/accounting'
import { PnlPdfDocument } from '@/lib/exports/pnl-pdf'
import { createSupabaseServerClient } from '@/supabase-clients/server'
import React from 'react'

export async function GET(req: NextRequest) {
  // Auth guard
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Accès réservé aux admins' }, { status: 403 })

  // Parse date params
  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to)
    return NextResponse.json({ error: 'Paramètres from et to requis' }, { status: 400 })

  const pnl = await getPnl({ from, to })
  const buffer = await renderToBuffer(
    React.createElement(PnlPdfDocument, { pnl, from, to }),
  )

  const filename = `synapse-pnl-${from}-${to}.pdf`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/admin/accounting/export/pdf/route.ts
git commit -m "feat(admin/exports): PDF export API route"
```

---

### Task 5: Excel export API route

**Files:**
- Create: `apps/web/src/app/api/admin/accounting/export/excel/route.ts`

- [ ] **Step 1: Write Excel API route**

```typescript
// apps/web/src/app/api/admin/accounting/export/excel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getPnl } from '@/data/admin/accounting'
import { buildPnlWorkbook } from '@/lib/exports/pnl-excel'
import { createSupabaseServerClient } from '@/supabase-clients/server'

export async function GET(req: NextRequest) {
  // Auth guard
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Accès réservé aux admins' }, { status: 403 })

  // Parse date params
  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to)
    return NextResponse.json({ error: 'Paramètres from et to requis' }, { status: 400 })

  const pnl = await getPnl({ from, to })
  const wb = buildPnlWorkbook(pnl, from, to)
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `synapse-pnl-${from}-${to}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/admin/accounting/export/excel/route.ts
git commit -m "feat(admin/exports): Excel export API route"
```

---

### Task 6: Export buttons component

**Files:**
- Create: `apps/web/src/components/admin/accounting/export-buttons.tsx`

- [ ] **Step 1: Write client component**

```typescript
// apps/web/src/components/admin/accounting/export-buttons.tsx
'use client'

import { Button } from '@/components/ui/button'

type Props = {
  from: string
  to: string
}

export function ExportButtons({ from, to }: Props) {
  const pdfUrl = `/api/admin/accounting/export/pdf?from=${from}&to=${to}`
  const excelUrl = `/api/admin/accounting/export/excel?from=${from}&to=${to}`

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={pdfUrl} download>
          Exporter PDF
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={excelUrl} download>
          Exporter Excel
        </a>
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire into accounting page**

Edit `apps/web/src/app/(app-pages)/admin/accounting/page.tsx` to import and render `ExportButtons` next to the page title.

Find the `<div className="flex items-center justify-between">` block and update it:

```typescript
import { ExportButtons } from '@/components/admin/accounting/export-buttons'

// Inside the JSX, replace the existing header div:
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">Comptabilité</h1>
  <div className="flex gap-2">
    <ExportButtons from={from} to={to} />
    <Button variant="outline" asChild>
      <Link href="/admin/accounting/categories">Gérer les catégories</Link>
    </Button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/admin/accounting/export-buttons.tsx \
        apps/web/src/app/\(app-pages\)/admin/accounting/page.tsx
git commit -m "feat(admin/exports): export buttons wired into accounting page"
```

---

### Task 7: Account category Zod schema + server actions

**Files:**
- Create: `apps/web/src/utils/zod-schemas/account-category.ts`
- Create: `apps/web/src/actions/admin/account-categories.ts`

- [ ] **Step 1: Write Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/account-category.ts
import { z } from 'zod'

export const createAccountCategorySchema = z.object({
  type: z.enum(['income', 'expense'], { required_error: 'Type requis' }),
  name: z.string().min(2, 'Nom requis (2 caractères minimum)').max(100),
  description: z.string().max(255).optional(),
})

export type CreateAccountCategoryInput = z.infer<typeof createAccountCategorySchema>

export const updateAccountCategorySchema = createAccountCategorySchema.partial().extend({
  id: z.string().uuid(),
})

export const toggleAccountCategorySchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})

export const deleteAccountCategorySchema = z.object({
  id: z.string().uuid(),
})
```

- [ ] **Step 2: Write server actions**

```typescript
// apps/web/src/actions/admin/account-categories.ts
'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/clients/admin-action-client'
import {
  createAccountCategorySchema,
  updateAccountCategorySchema,
  toggleAccountCategorySchema,
  deleteAccountCategorySchema,
} from '@/utils/zod-schemas/account-category'

export const createAccountCategoryAction = adminActionClient
  .schema(createAccountCategorySchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { error } = await supabase.from('account_categories').insert(parsedInput)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const updateAccountCategoryAction = adminActionClient
  .schema(updateAccountCategorySchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { id, ...fields } = parsedInput
    const { error } = await supabase
      .from('account_categories')
      .update(fields)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const toggleAccountCategoryAction = adminActionClient
  .schema(toggleAccountCategorySchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { error } = await supabase
      .from('account_categories')
      .update({ is_active: parsedInput.is_active })
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    return { success: true }
  })

export const deleteAccountCategoryAction = adminActionClient
  .schema(deleteAccountCategorySchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    // Prevent deletion if category is referenced by expenses or products
    const { count: expenseCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('account_category_id', parsedInput.id)

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('account_category_id', parsedInput.id)

    if ((expenseCount ?? 0) > 0 || (productCount ?? 0) > 0) {
      throw new Error(
        'Cette catégorie est utilisée par des dépenses ou des produits. Désactivez-la plutôt que de la supprimer.',
      )
    }

    const { error } = await supabase
      .from('account_categories')
      .delete()
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    return { success: true }
  })
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/utils/zod-schemas/account-category.ts \
        apps/web/src/actions/admin/account-categories.ts
git commit -m "feat(admin/categories): account category Zod schemas and server actions"
```

---

### Task 8: Account category form dialog (Client Component)

**Files:**
- Create: `apps/web/src/components/admin/accounting/category-form-dialog.tsx`

- [ ] **Step 1: Write dialog component**

```typescript
// apps/web/src/components/admin/accounting/category-form-dialog.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createAccountCategorySchema,
  type CreateAccountCategoryInput,
} from '@/utils/zod-schemas/account-category'
import {
  createAccountCategoryAction,
  updateAccountCategoryAction,
} from '@/actions/admin/account-categories'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  existing?: AccountCategory
  trigger?: React.ReactNode
}

export function CategoryFormDialog({ existing, trigger }: Props) {
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateAccountCategoryInput>({
    resolver: zodResolver(createAccountCategorySchema),
    defaultValues: existing
      ? {
          type: existing.type,
          name: existing.name,
          description: existing.description ?? '',
        }
      : {},
  })

  const { execute: create, isPending: creating } = useAction(createAccountCategoryAction, {
    onSuccess: () => {
      toast.success('Catégorie créée')
      reset()
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: update, isPending: updating } = useAction(updateAccountCategoryAction, {
    onSuccess: () => {
      toast.success('Catégorie mise à jour')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const onSubmit = (data: CreateAccountCategoryInput) => {
    if (existing) {
      update({ id: existing.id, ...data })
    } else {
      create(data)
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">{existing ? 'Modifier' : 'Nouvelle catégorie'}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Modifier la catégorie' : 'Nouvelle catégorie de compte'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select
              defaultValue={existing?.type}
              onValueChange={(v) => setValue('type', v as 'income' | 'expense')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Revenu ou dépense ?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Revenu</SelectItem>
                <SelectItem value="expense">Dépense</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="cat-name">Nom</Label>
            <Input id="cat-name" placeholder="Ex: Loyer" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="cat-description">Description (optionnel)</Label>
            <Textarea
              id="cat-description"
              rows={2}
              placeholder="Détails supplémentaires…"
              {...register('description')}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Enregistrement…' : existing ? 'Mettre à jour' : 'Créer la catégorie'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/accounting/category-form-dialog.tsx
git commit -m "feat(admin/categories): category create/edit dialog"
```

---

### Task 9: Category list table (Client Component)

**Files:**
- Create: `apps/web/src/components/admin/accounting/category-table.tsx`

- [ ] **Step 1: Write table component**

```typescript
// apps/web/src/components/admin/accounting/category-table.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import {
  toggleAccountCategoryAction,
  deleteAccountCategoryAction,
} from '@/actions/admin/account-categories'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { CategoryFormDialog } from './category-form-dialog'
import type { AccountCategory } from '@/data/admin/accounting'

type Props = { categories: AccountCategory[] }

export function CategoryTable({ categories }: Props) {
  const { execute: toggle } = useAction(toggleAccountCategoryAction, {
    onSuccess: () => toast.success('Statut mis à jour'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: del } = useAction(deleteAccountCategoryAction, {
    onSuccess: () => toast.success('Catégorie supprimée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Nom</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-center">Actif</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((cat) => (
          <TableRow key={cat.id} className={cat.is_active ? '' : 'opacity-50'}>
            <TableCell>
              <Badge variant={cat.type === 'income' ? 'default' : 'secondary'}>
                {cat.type === 'income' ? 'Revenu' : 'Dépense'}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">{cat.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {cat.description ?? '—'}
            </TableCell>
            <TableCell className="text-center">
              <Switch
                checked={cat.is_active}
                onCheckedChange={(checked) => toggle({ id: cat.id, is_active: checked })}
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <CategoryFormDialog
                  existing={cat}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Modifier
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        'Supprimer cette catégorie ? Impossible si elle est utilisée par des dépenses ou produits.',
                      )
                    ) {
                      del({ id: cat.id })
                    }
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {categories.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              Aucune catégorie. Créez-en une pour commencer.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/accounting/category-table.tsx
git commit -m "feat(admin/categories): category list table with toggle and delete"
```

---

### Task 10: Categories management page

**Files:**
- Create: `apps/web/src/app/(app-pages)/admin/accounting/categories/page.tsx`
- Create: `apps/web/src/data/admin/account-categories.ts`

- [ ] **Step 1: Write data function**

```typescript
// apps/web/src/data/admin/account-categories.ts
import { createSupabaseServerClient } from '@/supabase-clients/server'
import type { AccountCategory } from '@/data/admin/accounting'

export async function getAllAccountCategories(): Promise<AccountCategory[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('account_categories')
    .select('*')
    .order('type')
    .order('name')
  return (data ?? []) as AccountCategory[]
}
```

- [ ] **Step 2: Write page**

```typescript
// apps/web/src/app/(app-pages)/admin/accounting/categories/page.tsx
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getAllAccountCategories } from '@/data/admin/account-categories'
import { CategoryTable } from '@/components/admin/accounting/category-table'
import { CategoryFormDialog } from '@/components/admin/accounting/category-form-dialog'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AccountCategoriesPage() {
  const categories = await getAllAccountCategories()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catégories de comptes</h1>
          <p className="text-sm text-muted-foreground">
            Les catégories définissent la structure du plan comptable. Toute nouvelle catégorie
            apparaît automatiquement dans les rapports P&amp;L.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/accounting">← Retour à la comptabilité</Link>
          </Button>
          <CategoryFormDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {categories.length} catégorie{categories.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <CategoryTable categories={categories} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/admin/account-categories.ts \
        apps/web/src/app/\(app-pages\)/admin/accounting/categories/page.tsx
git commit -m "feat(admin/categories): account categories management page"
```

---

### Task 11: Custom metrics management page

**Files:**
- Create: `apps/web/src/utils/zod-schemas/custom-metric.ts`
- Create: `apps/web/src/actions/admin/custom-metrics.ts`
- Create: `apps/web/src/app/(app-pages)/admin/settings/metrics/page.tsx`

- [ ] **Step 1: Write Zod schema**

```typescript
// apps/web/src/utils/zod-schemas/custom-metric.ts
import { z } from 'zod'

export const createCustomMetricSchema = z.object({
  name: z.string().min(2, 'Nom requis').max(100),
  unit: z.string().max(20).default(''),
  target_value: z.coerce.number().positive('La cible doit être positive').optional(),
  is_dashboard_visible: z.boolean().default(true),
})

export type CreateCustomMetricInput = z.infer<typeof createCustomMetricSchema>

export const updateCustomMetricSchema = createCustomMetricSchema.partial().extend({
  id: z.string().uuid(),
})

export const deleteCustomMetricSchema = z.object({
  id: z.string().uuid(),
})
```

- [ ] **Step 2: Write server actions**

```typescript
// apps/web/src/actions/admin/custom-metrics.ts
'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/clients/admin-action-client'
import {
  createCustomMetricSchema,
  updateCustomMetricSchema,
  deleteCustomMetricSchema,
} from '@/utils/zod-schemas/custom-metric'

export const createCustomMetricAction = adminActionClient
  .schema(createCustomMetricSchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { error } = await supabase.from('custom_metrics').insert(parsedInput)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/settings/metrics')
    revalidatePath('/admin/dashboard')
    return { success: true }
  })

export const updateCustomMetricAction = adminActionClient
  .schema(updateCustomMetricSchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { id, ...fields } = parsedInput
    const { error } = await supabase.from('custom_metrics').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/settings/metrics')
    revalidatePath('/admin/dashboard')
    return { success: true }
  })

export const deleteCustomMetricAction = adminActionClient
  .schema(deleteCustomMetricSchema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { error } = await supabase
      .from('custom_metrics')
      .delete()
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/settings/metrics')
    revalidatePath('/admin/dashboard')
    return { success: true }
  })
```

- [ ] **Step 3: Write metrics management page**

```typescript
// apps/web/src/app/(app-pages)/admin/settings/metrics/page.tsx
'use client'

// Note: this page is client-rendered so the inline form can manage local state.
// Data is loaded via a server action on mount. For RSC purity we'd split into a
// page.tsx (RSC) + client child — but here the table is small enough that
// client-only is acceptable.

import { useEffect, useState, useTransition } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createCustomMetricSchema,
  type CreateCustomMetricInput,
} from '@/utils/zod-schemas/custom-metric'
import {
  createCustomMetricAction,
  deleteCustomMetricAction,
} from '@/actions/admin/custom-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/supabase-clients/client'

type Metric = {
  id: string
  name: string
  unit: string
  target_value: number | null
  is_dashboard_visible: boolean
}

export default function CustomMetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([])

  async function loadMetrics() {
    const supabase = createSupabaseBrowserClient()
    const { data } = await supabase
      .from('custom_metrics')
      .select('*')
      .order('created_at')
    setMetrics((data as Metric[]) ?? [])
  }

  useEffect(() => {
    loadMetrics()
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCustomMetricInput>({
    resolver: zodResolver(createCustomMetricSchema),
    defaultValues: { is_dashboard_visible: true, unit: '' },
  })

  const { execute: create, isPending } = useAction(createCustomMetricAction, {
    onSuccess: () => {
      toast.success('Métrique créée')
      reset()
      loadMetrics()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: del } = useAction(deleteCustomMetricAction, {
    onSuccess: () => {
      toast.success('Métrique supprimée')
      loadMetrics()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Métriques personnalisées</h1>
      <p className="text-sm text-muted-foreground">
        Ces métriques s'affichent sur le tableau de bord admin avec une ligne cible.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle métrique</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => create(d))} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="m-name">Nom</Label>
              <Input id="m-name" placeholder="Ex: Nouveaux étudiants ce mois" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="m-unit">Unité</Label>
              <Input id="m-unit" placeholder="Ex: étudiants, DT, %" {...register('unit')} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="m-target">Valeur cible</Label>
              <Input
                id="m-target"
                type="number"
                step="0.01"
                min="0"
                placeholder="Optionnel"
                {...register('target_value')}
              />
              {errors.target_value && (
                <p className="text-xs text-destructive">{errors.target_value.message}</p>
              )}
            </div>

            <div className="flex items-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Création…' : 'Créer la métrique'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Métriques existantes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead className="text-center">Dashboard</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucune métrique définie.
                  </TableCell>
                </TableRow>
              )}
              {metrics.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.unit || '—'}</TableCell>
                  <TableCell>{m.target_value ?? '—'}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={m.is_dashboard_visible} disabled />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Supprimer cette métrique ?')) del({ id: m.id })
                      }}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/utils/zod-schemas/custom-metric.ts \
        apps/web/src/actions/admin/custom-metrics.ts \
        apps/web/src/app/\(app-pages\)/admin/settings/metrics/page.tsx
git commit -m "feat(admin/settings): custom metrics management page"
```

---

### Task 12: Verify build

- [ ] **Step 1: Type-check**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Build**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web build
```

Expected: build completes. If `@react-pdf/renderer` emits a webpack warning about dynamic requires, add to `next.config.js`:

```javascript
// next.config.js — inside the config object
webpack: (config) => {
  config.resolve.alias.canvas = false
  return config
},
```

- [ ] **Step 3: Lint**

```bash
cd /home/sah/Synapse && pnpm --filter @synapse/web lint
```

Expected: no errors.

---

## Self-review checklist

- [ ] PDF API route and Excel API route both validate admin role before responding
- [ ] `Content-Disposition: attachment` headers set correctly on both export routes
- [ ] PDF document uses only built-in Helvetica fonts — no external font URLs that could fail offline
- [ ] Excel workbook has 3 sheets: résumé P&L, Revenus detail, Dépenses detail
- [ ] `deleteAccountCategoryAction` checks for existing expense/product references before deleting
- [ ] Category toggle uses `Switch` component — no full-page reload
- [ ] `revalidatePath('/admin/accounting')` called on all category mutations so P&L reports reflect changes immediately
- [ ] All UI text is French including PDF document text and Excel sheet names
- [ ] `@react-pdf/renderer` and `xlsx` are in `apps/web/package.json` before import
- [ ] Export buttons link to API routes with correct `from`/`to` query params derived from current page filter state
