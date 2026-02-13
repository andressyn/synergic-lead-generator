import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const { pathname } = request.nextUrl;

  // Authenticated user trying to access login → redirect to dashboard
  if (pathname === "/login" && token === "authenticated") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated user trying to access protected routes → redirect to login
  const protectedPaths = ["/dashboard", "/api/search", "/api/autocomplete"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && token !== "authenticated") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/api/search/:path*",
    "/api/autocomplete/:path*",
  ],
};
