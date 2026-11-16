import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordSessionEvent } from "@/lib/api/audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await recordSessionEvent({
          userId: user.id,
          userEmail: user.email ?? null,
          eventType: "session.login",
          metadata: { method: "auth_link" }
        });
      }
      return NextResponse.redirect(new URL(destination, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=invite", url.origin));
}
