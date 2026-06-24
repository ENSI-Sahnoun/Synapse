import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin/dashboard',
  employee: '/employee/dashboard',
  student: '/student/dashboard',
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')

  let redirectTo = new URL('/login', requestUrl.origin)

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    try {
      const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

      if (next) {
        redirectTo = new URL(decodeURIComponent(next), requestUrl.origin)
      } else if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const home = profile?.role ? ROLE_HOME[profile.role] : '/login'
        redirectTo = new URL(home, requestUrl.origin)
      }
    } catch (error) {
      console.error('Failed to exchange code for session:', error)
      redirectTo = new URL('/auth/auth-code-error', requestUrl.origin)
    }
  }

  revalidatePath('/', 'layout')
  return NextResponse.redirect(redirectTo)
}
