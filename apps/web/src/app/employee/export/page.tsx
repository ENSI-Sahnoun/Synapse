export const dynamic = 'force-dynamic'

const REPORTS = [
  { key: 'attendance', label: 'Présences du jour', description: "Toutes les entrées d'aujourd'hui" },
  { key: 'members', label: 'Membres actifs', description: 'Membres avec abonnement actif' },
  { key: 'ledger', label: 'Ledger de points', description: 'Historique fidélité' },
  { key: 'sales', label: 'Ventes du mois', description: 'Achats et produits du mois' },
]

export default function ExportPage() {
  return (
    <div className="p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Export de données</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REPORTS.map(r => (
          <a
            key={r.key}
            href={`/employee/export/${r.key}`}
            download
            style={{
              background: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.description}</div>
            </div>
            <span style={{ fontSize: 20, color: 'var(--accent-brand)' }}>↓</span>
          </a>
        ))}
      </div>
    </div>
  )
}
