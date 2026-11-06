import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function DeveloperConsole() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dev");

  const allowedEmail = process.env.RSBUILD_DEV_EMAIL?.trim().toLowerCase();
  if (!allowedEmail || user.email?.toLowerCase() !== allowedEmail) notFound();

  const { error: dbError } = await supabase.from("organizations").select("id").limit(1);
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "indisponível";
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "indisponível";

  const checks = [
    { label: "Sessão autenticada", ok: !authError && Boolean(user.id), detail: "Sessão validada no servidor" },
    { label: "Allowlist Dev", ok: Boolean(allowedEmail), detail: "Identidade autorizada por variável server-side" },
    { label: "Configuração Supabase", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), detail: "URL e publishable key presentes" },
    { label: "Consulta ao banco", ok: !dbError, detail: dbError ? "Consulta de leitura falhou; verifique schema e RLS" : "Consulta de leitura executada" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#f5f1e9", color: "#292827", padding: "clamp(20px, 4vw, 48px)", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
          <div><div style={{ color: "#ad573c", letterSpacing: ".18em", fontSize: 11, fontWeight: 800 }}>RSBUILD FINANCE / INTERNAL</div><h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", margin: "10px 0 4px" }}>Zona de observabilidade</h1><p style={{ color: "#77716b", margin: 0 }}>Ferramentas internas de diagnóstico. Sem exposição de segredos ou dados financeiros.</p></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><a href="/" style={{ color: "#714432", fontWeight: 700 }}>← Voltar ao Finance</a><form action={signOut}><button className="secondary-button" type="submit">Sair</button></form></div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 22 }}>
          {[["Ambiente", env], ["Branch", branch], ["Commit", commit], ["Identidade", user.email ?? "Conta autenticada"]].map(([label, value]) => <article key={label} style={{ background: "#fff", border: "1px solid #e5ddd3", borderRadius: 14, padding: 18, minWidth: 0 }}><div style={{ color: "#82786f", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>{label}</div><div style={{ fontWeight: 700, marginTop: 9, overflowWrap: "anywhere" }}>{value}</div></article>)}
        </section>

        <section style={{ background: "#fff", border: "1px solid #e5ddd3", borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 20 }}>Verificações do ambiente</h2><p style={{ color: "#82786f", margin: "6px 0 0" }}>Leituras de diagnóstico; nenhuma operação de escrita é executada.</p></div><span style={{ fontSize: 12, color: "#82786f" }}>Atualizado a cada carregamento</span></div>
          <div style={{ display: "grid", gap: 0, marginTop: 18 }}>
            {checks.map((check) => <div key={check.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "15px 0", borderTop: "1px solid #eee8e1", alignItems: "center" }}><div><strong>{check.label}</strong><div style={{ color: "#82786f", fontSize: 13, marginTop: 4 }}>{check.detail}</div></div><span style={{ color: check.ok ? "#28734d" : "#b44732", fontWeight: 800, fontSize: 12 }}>{check.ok ? "OK" : "ATENÇÃO"}</span></div>)}
          </div>
        </section>
        <p style={{ color: "#82786f", fontSize: 12, marginTop: 18 }}>Acesso restrito por RSBUILD_DEV_EMAIL no servidor. Esta área não apresenta valores de variáveis, tokens, chaves secretas ou conteúdo de registros financeiros.</p>
      </div>
    </main>
  );
}
