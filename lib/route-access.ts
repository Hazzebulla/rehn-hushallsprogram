export function isPublicRoute(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/rapport/")) return true;
  if (pathname.startsWith("/husrapport/start/")) return true;
  return false;
}

export function isApiRoute(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function requiresSession(pathname: string) {
  return !isPublicRoute(pathname);
}
