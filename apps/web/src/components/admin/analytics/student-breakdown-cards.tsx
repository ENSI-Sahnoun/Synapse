import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UniversityBreakdown, StudyLevelBreakdown } from '@/data/admin/analytics/students'

type Props = { byUniversity: UniversityBreakdown[]; byStudyLevel: StudyLevelBreakdown[] }

export function StudentBreakdownCards({ byUniversity, byStudyLevel }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Par université</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {byUniversity.map((u) => (
            <p key={u.university} className="flex justify-between text-sm">
              <span>{u.university}</span>
              <span className="font-semibold">{u.count}</span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Par niveau d&apos;étude</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {byStudyLevel.map((l) => (
            <p key={l.studyLevel} className="flex justify-between text-sm">
              <span>{l.studyLevel}</span>
              <span className="font-semibold">{l.count}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
