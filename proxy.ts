import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "rehn_vvs_session";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const pathname = request.nextUrl.pathname;
  const publicPaths = new Set(["/", "/login", "/huscheck"]);

  const isPublicPath = publicPaths.has(pathname) || pathname.startsWith("/rapport/") || pathname.startsWith("/husrapport/start/") || pathname.startsWith("/demo/");

  if (!isPublicPath && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  if (pathname.startsWith("/rapport/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
