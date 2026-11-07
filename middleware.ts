import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname.startsWith("/auth")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login?reason=configuration", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = request.nextUrl.pathname === "/login" || request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(target);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
