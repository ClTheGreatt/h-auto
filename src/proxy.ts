import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Paths accessible without session authentication.
// /api/sensors uses API key authentication (x-api-key header)
// /api/auth is NextAuth's own endpoints
// /api/mobile/* uses Bearer JWT auth (verified per-route via getMobileUser)
// /api/cron/* uses Authorization: Bearer <CRON_SECRET>, verified per-route.
//   Both cron routes fail closed when CRON_SECRET is unset, so exempting the
//   prefix here does not open them. Without this exemption the middleware
//   307-redirects every scheduled invocation to /login and the handler never
//   runs — silently, because a 307 is not an error to most HTTP clients.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/sensors",
  "/api/mobile",
  "/api/cron",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPublic = PUBLIC_PATHS.some((path) =>
    nextUrl.pathname.startsWith(path)
  );

  if (isPublic) {
    if (isLoggedIn && nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};