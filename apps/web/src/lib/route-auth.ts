const PUBLIC_API_PREFIXES = ["/api/auth", "/api/demo", "/api/health"];

const PUBLIC_PATHS = ["/", "/login"];

export function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg")
  );
}

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  if (pathname.startsWith("/share/")) {
    return true;
  }

  if (isPublicApiPath(pathname)) {
    return true;
  }

  if (isStaticAssetPath(pathname)) {
    return true;
  }

  return false;
}

export function requiresAuthentication(pathname: string): boolean {
  if (isPublicPath(pathname)) {
    return false;
  }

  if (pathname.startsWith("/workspace")) {
    return true;
  }

  if (pathname.startsWith("/api/")) {
    return true;
  }

  return false;
}
