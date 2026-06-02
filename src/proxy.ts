import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";

// -----------------------------------------------------------------------------
// Route protection (Next.js 16 "proxy" — formerly "middleware").
//
// Anything under /agent, /builder or /admin requires a valid session cookie.
// Unauthenticated requests are redirected to /auth/login with the original
// URL preserved as ?next=… so we can bounce back after login.
//
// Roles are enforced loosely:
//   - /admin/*      → admin | verification | operations
//   - /builder/*    → builder
//   - /agent/*      → agent
// If a user with a different role lands on a protected section we redirect
// to their own dashboard rather than showing a confusing 403.
// -----------------------------------------------------------------------------

const PROTECTED_PREFIXES = ["/agent", "/builder", "/admin"] as const;

function dashboardForRole(role: string): string {
  switch (role) {
    case "builder":
      return "/builder/dashboard";
    case "admin":
    case "verification":
    case "operations":
      return "/admin/dashboard";
    default:
      return "/agent/dashboard";
  }
}

function isAllowed(role: string, pathname: string): boolean {
  if (pathname.startsWith("/admin"))
    return role === "admin" || role === "verification" || role === "operations";
  if (pathname.startsWith("/builder")) return role === "builder";
  if (pathname.startsWith("/agent")) return role === "agent";
  return true;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (!isAllowed(session.role, pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = dashboardForRole(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match everything under the protected sections. Excludes /api, /_next,
  // /auth, /favicon, and static assets so we don't run on every request.
  matcher: ["/agent/:path*", "/builder/:path*", "/admin/:path*"],
};
