import { StudentForm } from '@/components/students/student-form'
import Link from 'next/link'

export default function NewStudentPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/employee/students" className="text-sm text-muted-foreground hover:underline">
          ← Étudiants
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Nouvel étudiant</h1>
      </div>
      <StudentForm redirectTo="/employee/students" />
    </div>
  )
}
