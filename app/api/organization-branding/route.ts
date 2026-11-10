import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "rsbuild-organization-branding";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorize(organizationId: string, write = false) {
  if (!UUID.test(organizationId)) return { user: null, role: null, error: "invalid_organization" as const };
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { user: null, role: null, error: "unauthenticated" as const };
  const { data: membership } = await session.from("organization_memberships")
    .select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || (write && !["owner", "admin"].includes(membership.role))) {
    return { user: null, role: null, error: "forbidden" as const };
  }
  return { user, role: membership.role, error: null };
}

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const access = await authorize(organizationId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.error === "unauthenticated" ? 401 : 403 });
  const session = await createClient();
  const { data, error } = await session.from("organization_branding").select("banner_path,banner_position_x,banner_position_y,banner_zoom")
    .eq("organization_id", organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: "branding_read_failed" }, { status: 502 });
  let bannerUrl: string | null = null;
  if (data?.banner_path) {
    const admin = createAdminClient();
    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(data.banner_path);
    bannerUrl = publicUrl.publicUrl;
  }
  return NextResponse.json({ bannerUrl, positionX: data?.banner_position_x ?? 50, positionY: data?.banner_position_y ?? 50, zoom: data?.banner_zoom ?? 1 },
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  const organizationId = String(form.get("organizationId") ?? "");
  const access = await authorize(organizationId, true);
  if (access.error || !access.user) return NextResponse.json({ error: access.error }, { status: access.error === "unauthenticated" ? 401 : 403 });

  const file = form.get("file");
  const positionX = Number(form.get("positionX") ?? 50);
  const positionY = Number(form.get("positionY") ?? 50);
  const zoom = Number(form.get("zoom") ?? 1);
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024
      || !Number.isFinite(positionX) || positionX < 0 || positionX > 100
      || !Number.isFinite(positionY) || positionY < 0 || positionY > 100
      || !Number.isFinite(zoom) || zoom < 1 || zoom > 3) {
    return NextResponse.json({ error: "invalid_banner" }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = organizationId + "/banner-" + randomUUID() + "." + (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg");
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "banner_upload_failed" }, { status: 502 });

  const { error: saveError } = await admin.from("organization_branding").upsert({
    organization_id: organizationId, banner_path: path, banner_position_x: positionX,
    banner_position_y: positionY, banner_zoom: zoom, updated_by: access.user.id, updated_at: new Date().toISOString()
  }, { onConflict: "organization_id" });
  if (saveError) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "banner_settings_save_failed" }, { status: 502 });
  }
  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, bannerUrl: publicUrl.publicUrl, positionX, positionY, zoom },
    { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
