import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role;
    const pathname = req.nextUrl.pathname;

    // Enforce admin-only access on admin routes
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  },
  {
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/team-dashboard/:path*',
    '/admin/:path*',
    '/reviews/:path*',
  ],
};
