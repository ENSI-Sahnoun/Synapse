import { redirect } from 'next/navigation'

// Root redirects to login; middleware handles role-based redirect if logged in
export default function RootPage() {
  redirect('/login')
}
