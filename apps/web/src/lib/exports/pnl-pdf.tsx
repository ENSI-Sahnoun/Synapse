import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { PnlSummary } from '@/data/admin/accounting'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 48,
    color: '#1a1a1a',
  },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666' },
  section: { marginBottom: 16 },
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
  tableRowAlt: { backgroundColor: '#f9f9f9' },
  cellLeft: { flex: 3 },
  cellRight: { flex: 1, textAlign: 'right' },
  footerRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderTop: '1pt solid #aaa',
    marginTop: 2,
  },
  footerLabel: { flex: 3, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  footerValue: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  profitBox: { marginTop: 20, padding: 12, borderRadius: 4 },
  profitLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  profitValue: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
})

type Props = { pnl: PnlSummary; from: string; to: string }

export function PnlPdfDocument({ pnl, from, to }: Props) {
  const incomeRows = pnl.rows.filter((r) => r.type === 'income')
  const expenseRows = pnl.rows.filter((r) => r.type === 'expense')
  const isProfit = pnl.profit >= 0

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Document title={`Compte de résultat — ${from} à ${to}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Compte de résultat</Text>
          <Text style={styles.subtitle}>
            Synapse Meeting Space — du {formatDate(from)} au {formatDate(to)}
          </Text>
          <Text style={[styles.subtitle, { marginTop: 2 }]}>
            Généré le {formatDate(new Date().toISOString().slice(0, 10))}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenus</Text>
          {incomeRows.length === 0 ? (
            <Text style={{ color: '#999' }}>Aucun revenu sur la période</Text>
          ) : (
            incomeRows.map((r, i) => (
              <View key={r.category_id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dépenses</Text>
          {expenseRows.length === 0 ? (
            <Text style={{ color: '#999' }}>Aucune dépense sur la période</Text>
          ) : (
            expenseRows.map((r, i) => (
              <View key={r.category_id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
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

        <View style={[styles.profitBox, { backgroundColor: isProfit ? '#f0fdf4' : '#fef2f2' }]}>
          <Text style={styles.profitLabel}>Résultat net</Text>
          <Text style={[styles.profitValue, { color: isProfit ? '#15803d' : '#b91c1c' }]}>
            {isProfit ? '+' : ''}{pnl.profit.toFixed(3)} DT
          </Text>
        </View>
      </Page>
    </Document>
  )
}
