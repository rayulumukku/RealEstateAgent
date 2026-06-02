import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";

// GET /api/me — returns the current authenticated user, or `{ user: null }`.
//
// Used by client components that previously read `localStorage.getItem(...)`
// to identify the user. Reading from a server-validated httpOnly cookie
// instead of localStorage means a tampered browser can no longer impersonate
// another user.
export async function GET() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      user: {
        id: session.sub,
        phone: session.phone,
        role: session.role,
        name: session.name,
      },
    },
    { status: 200 }
  );
}
