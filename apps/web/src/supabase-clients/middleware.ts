import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type UserRole = 'admin' | 'employee' | 'student'

const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  employee: '/employee/dashboard',
  student: '/student/dashboard',
}

async function getUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<UserRole | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return (data?.role as UserRole) ?? null
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not add logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/update-password')

  // Redirect logged-in users away from auth pages
  if (isPublicPath && user) {
    const role = await getUserRole(supabase, user.id)
    if (role) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role]
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Unauthenticated user on protected route
  if (!isPublicPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user) return supabaseResponse

  const role = await getUserRole(supabase, user.id)

  // Role-based access enforcement
  if (pathname.startsWith('/admin') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = role ? ROLE_HOME[role] : '/login'
    return NextResponse.redirect(url)
  }

  if (
    pathname.startsWith('/employee') &&
    role !== 'admin' &&
    role !== 'employee'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = role ? ROLE_HOME[role] : '/login'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/student') && role !== 'student') {
    const url = request.nextUrl.clone()
    url.pathname = role ? ROLE_HOME[role] : '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
