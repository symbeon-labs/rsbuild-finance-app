import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CapabilityLicensingPanel } from "@/app/components/executive/capability-licensing-panel";

export const dynamic = "force-dynamic";

export default async function PlatformAdministrationPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: isPlatformAdministrator, error: authorizationError } =
    await supabase.rpc("is_platform_administrator");

  if (authorizationError || isPlatformAdministrator !== true) redirect("/");

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px", display: "grid", gap: 20 }}>
      <header>
        <div className="eyebrow">SYMBEON · PLATFORM CONTROL</div>
        <h1 style={{ margin: "6px 0", color: "var(--ink)", fontSize: 26 }}>Administração da plataforma</h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
          Gestão de licenças e escopo de capacidades. Este acesso não concede membership em organizações ou workspaces.
        </p>
      </header>
      <CapabilityLicensingPanel />
    </main>
  );
}
