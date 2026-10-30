import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
  if (SAFE_METHODS.has(request.method) || request.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return forbidden();

  const origin = request.headers.get("origin");
  if (origin) {
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (!host || originHost !== host) return forbidden();
  }
  return NextResponse.next();
}

const forbidden = () => NextResponse.json({ error: "This request didn't come from Tacet." }, { status: 403 });

export const config = {
  matcher: "/api/:path*",
};
