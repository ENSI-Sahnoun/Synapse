import * as XLSX from 'xlsx'
import type { PnlSummary } from '@/data/admin/accounting'

export function buildPnlWorkbook(pnl: PnlSummary, from: string, to: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const incomeRows = pnl.rows.filter((r) => r.type === 'income')
  const expenseRows = pnl.rows.filter((r) => r.type === 'expense')

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
  ws['!cols'] = [{ wch: 40 }, { wch: 18 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  XLSX.utils.book_append_sheet(wb, ws, 'Compte de résultat')

  const incomeDetail = [
    ['Catégorie', 'Montant (DT)'],
    ...incomeRows.map((r) => [r.category_name, r.total]),
    ['TOTAL', pnl.totalRevenue],
  ]
  const wsIncome = XLSX.utils.aoa_to_sheet(incomeDetail)
  wsIncome['!cols'] = [{ wch: 40 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsIncome, 'Revenus')

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
