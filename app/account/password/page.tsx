import { updatePassword } from "@/app/auth/actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const message = params.error === "invalid"
    ? "A senha deve ter pelo menos 12 caracteres e as confirmações devem coincidir."
    : params.error === "update"
      ? "Não foi possível atualizar a senha. Tente novamente."
      : "";

  return (
    <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="panel" style={{ width: "min(100%, 440px)", padding: 32 }}>
        <div className="eyebrow">RSBUILD FINANCE</div>
        <h1 style={{ marginTop: 12 }}>Defina sua senha</h1>
        <p>Crie uma senha pessoal para concluir a ativação do seu acesso.</p>
        {message && <p role="alert" style={{ color: "#dc2626" }}>{message}</p>}
        <form action={updatePassword} style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <label style={{ display: "grid", gap: 6 }}>Nova senha
            <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Confirmar senha
            <input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          </label>
          <button className="primary-button" type="submit">Salvar senha e continuar</button>
        </form>
      </section>
    </main>
  );
}
