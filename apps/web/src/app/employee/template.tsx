import { PageTransition } from '@/components/PageTransition'

export default function EmployeeTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
