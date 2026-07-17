import { getRooms } from '@/data/admin/rooms'
import { FloorPlanEditor } from './FloorPlanEditor'

export default async function AdminFloorPlanPage() {
  const rooms = await getRooms()
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Plan de l&apos;établissement</h1>
      <FloorPlanEditor initialRooms={rooms} />
    </div>
  )
}
