import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/app/auth/actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=session");

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="Identidade RSBUILD">
        <div className="login-brand-glow" aria-hidden="true" />
        <div className="login-brand-pattern" aria-hidden="true" />
        <div className="login-brand-content">
          <div className="login-brand-message">
            <span className="login-overline">RSBUILD OS</span>
            <h1>Proteção para<br />sua operação.</h1>
            <p>Escolha uma nova senha para voltar a acessar seu ambiente com segurança.</p>
          </div>
          <div className="login-brand-footer"><span className="login-footer-line" /><span>RSBUILD OS · AMBIENTE CORPORATIVO</span></div>
        </div>
      </section>
      <section className="login-form-panel" aria-label="Definir nova senha">
        <div className="login-form-wrap">
          <div className="login-form-heading">
            <span className="login-overline">NOVA CREDENCIAL</span>
            <h2>Crie uma nova senha.</h2>
            <p>Use pelo menos 8 caracteres e não reutilize uma senha compartilhada.</p>
          </div>
          {params.error && <p className="auth-feedback" role="alert">{params.error === "mismatch" ? "As senhas informadas não coincidem." : params.error === "password" ? "A senha deve ter entre 8 e 256 caracteres." : "Não foi possível atualizar a senha. Solicite um novo link e tente novamente."}</p>}
          <form action={updatePassword} className="login-form">
            <label className="login-field"><span>Nova senha</span><span className="login-input-wrap"><span className="login-field-icon" aria-hidden="true">●</span><input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required /></span></label>
            <label className="login-field"><span>Confirmar nova senha</span><span className="login-input-wrap"><span className="login-field-icon" aria-hidden="true">●</span><input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={256} required /></span></label>
            <button className="login-submit" type="submit"><span>Salvar nova senha</span><span aria-hidden="true">→</span></button>
          </form>
          <Link href="/login" className="auth-back-link">← Voltar para o login</Link>
        </div>
        <footer className="login-copyright">© {new Date().getFullYear()} RSBUILD · Todos os direitos reservados.</footer>
      </section>
    </main>
  );
}
