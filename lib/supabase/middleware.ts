import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// TODO:only (admin) can access
const ROLE_PROTECTED_ROUTES: Record<string, string[]> = {
  'dashboard/users': ['admin'],
  'dashboard/blogs': ['admin'],
  'dashboard/images': ['admin'],
  'dashboard/prices': ['admin'],
  'dashboard/showcases': ['admin'],
} as const;

// TODO:only login user can access
const PROTECTED_ROUTES = ['dashboard']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean)

  if (!user) {
    const isProtectedRoute = PROTECTED_ROUTES.some(route =>
      pathSegments.includes(route)
    )

    if (isProtectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("next", request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  } else {
    const currentPath = pathSegments.join('/')

    for (const [protectedPath, allowedRoles] of Object.entries(ROLE_PROTECTED_ROUTES)) {
      if (currentPath.includes(protectedPath)) {

        const { data, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .limit(1)
          .maybeSingle();

        const userRole = data?.role || "user";

        if (!allowedRoles.includes(userRole) || error) {
          const url = request.nextUrl.clone()
          url.pathname = "/403"
          return NextResponse.redirect(url)
        }
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}