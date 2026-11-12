// ==============================================================
// LINKEDIN AUTOPILOT - ROUTE PROTECTION & AUTH MIDDLEWARE
// BY GT INNOX LLP
// ==============================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. PERFORMANCE OPTIMIZATION: Immediate fast-path bypass for API routes & static assets
  const isPublicOrApi =
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/icon') ||
    path.startsWith('/favicon') ||
    path.includes('.');

  if (isPublicOrApi) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // Fast-path: Check session from cookie first
  let user = null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    user = session.user;
  } else {
    const { data: { user: remoteUser } } = await supabase.auth.getUser();
    user = remoteUser;
  }

  const isAuthPage = path.startsWith('/login') || path.startsWith('/register');

  // 2. If not logged in and trying to access protected pages, redirect to /login
  if (!user && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. If already logged in and visiting login/register, redirect to /dashboard
  if (user && isAuthPage) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
