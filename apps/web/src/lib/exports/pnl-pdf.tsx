import path from 'node:path'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { PnlSummary } from '@/data/admin/accounting'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logos', 'synapse-logo-nobg.png')

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 48,
    color: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottom: '1pt solid #000',
  },
  logo: { width: 48, height: 48 },
  headerRight: { alignItems: 'flex-end' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#333' },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: '1pt solid #000',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottom: '0.5pt solid #ccc',
  },
  cellLeft: { flex: 3 },
  cellRight: { flex: 1, textAlign: 'right' },
  footerRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderTop: '1pt solid #000',
    marginTop: 2,
  },
  footerLabel: { flex: 3, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  footerValue: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  profitBox: {
    marginTop: 20,
    padding: 12,
    borderTop: '2pt solid #000',
    borderBottom: '2pt solid #000',
  },
  profitLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  profitValue: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
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
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.title}>Compte de résultat</Text>
            <Text style={styles.subtitle}>
              Synapse — du {formatDate(from)} au {formatDate(to)}
            </Text>
            <Text style={[styles.subtitle, { marginTop: 2 }]}>
              Généré le {formatDate(new Date().toISOString().slice(0, 10))}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenus</Text>
          {incomeRows.length === 0 ? (
            <Text style={{ color: '#666' }}>Aucun revenu sur la période</Text>
          ) : (
            incomeRows.map((r) => (
              <View key={r.category_id} style={styles.tableRow}>
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
            <Text style={{ color: '#666' }}>Aucune dépense sur la période</Text>
          ) : (
            expenseRows.map((r) => (
              <View key={r.category_id} style={styles.tableRow}>
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

        <View style={styles.profitBox}>
          <Text style={styles.profitLabel}>Résultat net</Text>
          <Text style={styles.profitValue}>
            {isProfit ? '+' : ''}{pnl.profit.toFixed(3)} DT
          </Text>
        </View>
      </Page>
    </Document>
  )
}
