import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordSessionEvent } from "@/lib/api/audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/";
  const destination = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && destination !== "/reset-password") {
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

  const errorCode = url.searchParams.get("error_code");
  const errorDescription = url.searchParams.get("error_description");
  const target = new URL(destination === "/reset-password" ? "/forgot-password" : "/login", url.origin);
  target.searchParams.set("error", errorCode === "otp_expired" ? "expired" : "callback");
  if (errorDescription) target.searchParams.set("detail", errorDescription.slice(0, 160));
  return NextResponse.redirect(target);
}
