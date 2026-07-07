import path from 'node:path'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { AttendanceExportRow } from '@/data/admin/attendance-export'

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
  colDate: { flex: 1.4, fontFamily: 'Helvetica-Bold' },
  colType: { flex: 1 },
  colStudent: { flex: 1.6 },
  colDetail: { flex: 2.5 },
  headCell: { fontFamily: 'Helvetica-Bold', fontSize: 9, textTransform: 'uppercase' },
})

type Props = { rows: AttendanceExportRow[]; from: string; to: string }

export function AttendancePdfDocument({ rows, from, to }: Props) {
  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Document title={`Présence et réservations — ${from} à ${to}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.title}>Présence et réservations</Text>
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
          <Text style={[styles.colType, styles.headCell]}>Type</Text>
          <Text style={[styles.colStudent, styles.headCell]}>Étudiant</Text>
          <Text style={[styles.colDetail, styles.headCell]}>Détail</Text>
        </View>

        {rows.length === 0 ? (
          <Text style={{ color: '#666', marginTop: 8 }}>Aucun enregistrement sur la période</Text>
        ) : (
          rows.map((r, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDate}>{formatDateTime(r.date)}</Text>
              <Text style={styles.colType}>{r.type === 'attendance' ? 'Présence' : 'Réservation'}</Text>
              <Text style={styles.colStudent}>{r.studentName}</Text>
              <Text style={styles.colDetail}>{r.detail}</Text>
            </View>
          ))
        )}
      </Page>
    </Document>
  )
}
