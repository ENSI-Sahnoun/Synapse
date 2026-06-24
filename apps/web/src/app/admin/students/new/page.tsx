import { StudentForm } from '@/components/students/student-form'
import Link from 'next/link'

export default function AdminNewStudentPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">← Étudiants</Link>
      <h1 className="text-2xl font-semibold">Nouvel étudiant</h1>
      <StudentForm redirectTo="/admin/students" />
    </div>
  )
}
