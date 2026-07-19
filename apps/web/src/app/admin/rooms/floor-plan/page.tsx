import { getRooms } from '@/data/admin/rooms'
import { FloorPlanEditor } from './FloorPlanEditor'

export default async function AdminFloorPlanPage() {
  const rooms = await getRooms()
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Plan de l&apos;établissement</h1>
      {/* Fixed-width Konva canvas — desktop power tool, gated below lg. */}
      <div className="hidden lg:block">
        <FloorPlanEditor initialRooms={rooms} />
      </div>
      <div className="lg:hidden rounded-xl border border-dashed p-6 text-center">
        <p className="font-medium">Éditeur non disponible sur mobile</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Le plan de l&apos;établissement nécessite un écran plus large. Ouvrez cette page sur un ordinateur.
        </p>
      </div>
    </div>
  )
}
