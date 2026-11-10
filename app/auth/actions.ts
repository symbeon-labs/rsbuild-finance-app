"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!email || !password || password.length > 256) redirect("/login?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");

  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(destination);
}

export async function selectOrganization(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
    redirect("/?error=organization");
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) redirect("/?error=organization");

  const cookieStore = await cookies();
  cookieStore.set("rsbuild_active_organization", organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });
  redirect("/");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("rsbuild_active_organization");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
