import { getActiveReservations } from '@/data/employee/reservations'
import { ReservationsClient } from './ReservationsClient'

export const dynamic = 'force-dynamic'

export default async function EmployeeReservationsPage() {
  const reservations = await getActiveReservations()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
          }}
        >
          Réservations actives
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 3 }}>
          {reservations.length} réservation{reservations.length !== 1 ? 's' : ''} en cours
        </p>
      </div>

      <ReservationsClient initialReservations={reservations} />
    </div>
  )
}
