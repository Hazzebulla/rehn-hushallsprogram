import { NextResponse, type NextRequest } from "next/server";
import { isApiRoute, isPublicRoute, requiresSession } from "./lib/route-access";

const SESSION_COOKIE = "rehn_vvs_session";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const pathname = request.nextUrl.pathname;

  if (requiresSession(pathname) && !hasSession) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ ok: false, message: "Inloggning krävs." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  if (isPublicRoute(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
