import path from 'node:path'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { TransactionRow } from '@/data/admin/accounting'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logos', 'synapse-logo-nobg.png')

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 48,
    color: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: '1pt solid #000',
  },
  logo: { width: 48, height: 48 },
  headerRight: { alignItems: 'flex-end' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#333' },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1pt solid #000',
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '0.5pt solid #ccc',
  },
  colDate: { flex: 1.2, fontFamily: 'Helvetica-Bold' },
  colDesc: { flex: 3 },
  colType: { flex: 1 },
  colAmount: { flex: 1.2, textAlign: 'right' },
  headCell: { fontFamily: 'Helvetica-Bold', fontSize: 9, textTransform: 'uppercase' },
  footerRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderTop: '1pt solid #000',
    marginTop: 6,
  },
  footerLabel: { flex: 5.2, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  footerValue: { flex: 1.2, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  profitBox: {
    marginTop: 16,
    padding: 12,
    borderTop: '2pt solid #000',
    borderBottom: '2pt solid #000',
  },
  profitLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  profitValue: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
})

type Props = { transactions: TransactionRow[]; from: string; to: string }

export function TransactionsPdfDocument({ transactions, from, to }: Props) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const net = totalIncome - totalExpense

  return (
    <Document title={`Journal des transactions — ${from} à ${to}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.title}>Journal des transactions</Text>
            <Text style={styles.subtitle}>
              Synapse — du {formatDate(from)} au {formatDate(to)}
            </Text>
            <Text style={[styles.subtitle, { marginTop: 2 }]}>
              Généré le {formatDate(new Date().toISOString().slice(0, 10))}
            </Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.colDate, styles.headCell]}>Date</Text>
          <Text style={[styles.colDesc, styles.headCell]}>Description</Text>
          <Text style={[styles.colType, styles.headCell]}>Type</Text>
          <Text style={[styles.colAmount, styles.headCell]}>Montant</Text>
        </View>

        {transactions.length === 0 ? (
          <Text style={{ color: '#666', marginTop: 8 }}>Aucune transaction sur la période</Text>
        ) : (
          transactions.map((t, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDate}>{formatDate(t.date)}</Text>
              <Text style={styles.colDesc}>{t.description}</Text>
              <Text style={styles.colType}>{t.type === 'income' ? 'Revenu' : 'Dépense'}</Text>
              <Text style={styles.colAmount}>
                {t.type === 'expense' ? '-' : ''}{t.amount.toFixed(3)} DT
              </Text>
            </View>
          ))
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Total revenus</Text>
          <Text style={styles.footerValue}>{totalIncome.toFixed(3)} DT</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Total dépenses</Text>
          <Text style={styles.footerValue}>{totalExpense.toFixed(3)} DT</Text>
        </View>

        <View style={styles.profitBox}>
          <Text style={styles.profitLabel}>Résultat net</Text>
          <Text style={styles.profitValue}>
            {net >= 0 ? '+' : ''}{net.toFixed(3)} DT
          </Text>
        </View>
      </Page>
    </Document>
  )
}
