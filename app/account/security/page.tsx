import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { changePassword } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; changed?: string }> };

const errors: Record<string, string> = {
  current: "A senha atual não confere. Verifique e tente novamente.",
  password: "A nova senha deve ter pelo menos 8 caracteres.",
  mismatch: "A confirmação não corresponde à nova senha.",
  same: "Escolha uma senha diferente da atual.",
  update: "Não foi possível atualizar a senha. Tente novamente."
};

export default async function AccountSecurityPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const params = await searchParams;

  return (
    <main className="app-shell" style={{ minHeight: "100vh", padding: "clamp(20px, 5vw, 56px)", display: "grid", alignContent: "start" }}>
      <section style={{ width: "min(100%, 620px)", margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--rsbuild-warm-beige, #D9CCB5)", textDecoration: "none", fontSize: 13 }}>← Voltar ao workspace</Link>
        <div className="panel" style={{ marginTop: 24, padding: "clamp(22px, 4vw, 36px)" }}>
          <div className="eyebrow">RSBUILD OS · CONTA</div>
          <h1 style={{ marginTop: 12, marginBottom: 8 }}>Segurança da conta</h1>
          <p style={{ opacity: 0.76, lineHeight: 1.6, marginTop: 0 }}>Atualize sua senha sem sair do workspace. Por segurança, precisamos confirmar sua senha atual.</p>

          {params.changed === "1" ? <div role="status" style={{ border: "1px solid rgba(73, 170, 123, .45)", background: "rgba(73, 170, 123, .10)", borderRadius: 8, padding: 14, margin: "22px 0" }}>Senha atualizada. As outras sessões da sua conta foram encerradas.</div> : null}
          {params.error && errors[params.error] ? <div role="alert" style={{ border: "1px solid rgba(210, 90, 80, .45)", background: "rgba(210, 90, 80, .10)", borderRadius: 8, padding: 14, margin: "22px 0" }}>{errors[params.error]}</div> : null}

          <form action={changePassword} style={{ display: "grid", gap: 16, marginTop: 24 }}>
            <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Senha atual
              <input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} className="input-field" style={{ width: "100%" }} />
            </label>
            <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Nova senha
              <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={256} className="input-field" style={{ width: "100%" }} />
              <span style={{ fontSize: 12, fontWeight: 400, opacity: .65 }}>Mínimo de 8 caracteres.</span>
            </label>
            <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Confirmar nova senha
              <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={256} className="input-field" style={{ width: "100%" }} />
            </label>
            <button type="submit" className="primary-button" style={{ minHeight: 44, marginTop: 4 }}>Atualizar senha</button>
          </form>

          <div style={{ borderTop: "1px solid var(--border-subtle, rgba(255,255,255,.1))", marginTop: 28, paddingTop: 20 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Não lembra sua senha atual?</h2>
            <p style={{ fontSize: 13, opacity: .72, lineHeight: 1.55, margin: "0 0 10px" }}>Use a recuperação por e-mail para criar uma nova senha com segurança.</p>
            <Link href="/forgot-password" style={{ color: "var(--rsbuild-warm-beige, #D9CCB5)", fontSize: 13, fontWeight: 600 }}>Recuperar senha por e-mail →</Link>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, opacity: .48, marginTop: 18 }}>Conta autenticada: {user.email}</p>
      </section>
    </main>
  );
}
