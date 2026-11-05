import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { jwtVerify } from "jose";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);
const PUBLIC = [/^\/(fr|en|he)\/(login|setup)\/?$/];

async function isAuthenticated(req: NextRequest) {
  const token = req.cookies.get("itm_session")?.value;
  if (!token || !process.env.AUTH_SECRET) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const localeMatch = pathname.match(/^\/(fr|en|he)(\/|$)/);
  if (localeMatch && !PUBLIC.some((r) => r.test(pathname)) && !(await isAuthenticated(req))) {
    const url = req.nextUrl.clone();
    url.pathname = `/${localeMatch[1]}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
