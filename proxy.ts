import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "rehn_vvs_session";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const pathname = request.nextUrl.pathname;
  const publicPaths = new Set(["/", "/login", "/huscheck"]);

  if (!publicPaths.has(pathname) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
