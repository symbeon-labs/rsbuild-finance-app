import FinanceWorkspace from "./finance-workspace";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("organization_id")
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return (
      <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section className="panel" style={{ width: "min(100%, 560px)", padding: 32 }}>
          <div className="eyebrow">RSBUILD FINANCE</div>
          <h1 style={{ marginTop: 12 }}>Acesso aguardando provisionamento</h1>
          <p>Sua conta foi autenticada, mas ainda não está vinculada a uma organização. Solicite ao administrador o provisionamento do seu acesso.</p>
          <p style={{ overflowWrap: "anywhere" }}>{user.email}</p>
          <form action={signOut}><button className="secondary-button" type="submit">Sair</button></form>
        </section>
      </main>
    );
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (!organization) {
    return <main className="app-shell"><section className="panel"><h1>Organização indisponível</h1><form action={signOut}><button className="secondary-button">Sair</button></form></section></main>;
  }

  return <FinanceWorkspace organizationId={organization.id} />;
}
