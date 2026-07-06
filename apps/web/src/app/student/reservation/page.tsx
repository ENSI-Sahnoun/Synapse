import { redirect } from 'next/navigation'

// The seat-reservation flow was consolidated into /student/rooms (room list →
// per-room map, with the active-reservation banner and exam-mode notice folded
// in). This path is kept only to forward old links and dispatched notifications.
export default function ReservationPage() {
  redirect('/student/rooms')
}
