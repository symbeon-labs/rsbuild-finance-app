import { signIn } from "@/app/auth/actions";

type Props = { searchParams: Promise<{ error?: string; next?: string; reason?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const message = params.reason === "configuration"
    ? "A conexão com o Supabase ainda não foi configurada."
    : params.error === "credentials"
      ? "E-mail ou senha inválidos."
      : params.error === "invalid"
        ? "Informe e-mail e senha válidos."
        : "";

  return (
    <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="panel" style={{ width: "min(100%, 420px)", padding: 32 }}>
        <div className="eyebrow">RSBUILD FINANCE</div>
        <h1 style={{ marginTop: 12 }}>Acessar sua conta</h1>
        <p>Entre para acessar os dados financeiros da sua organização.</p>
        {message && <p role="alert" style={{ color: "#dc2626" }}>{message}</p>}
        <form action={signIn} style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <input type="hidden" name="next" value={params.next ?? "/"} />
          <label style={{ display: "grid", gap: 6 }}>E-mail
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Senha
            <input name="password" type="password" autoComplete="current-password" required maxLength={256} />
          </label>
          <button className="primary-button" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}
