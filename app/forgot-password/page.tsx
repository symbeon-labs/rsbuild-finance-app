import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";

type Props = { searchParams: Promise<{ sent?: string; error?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="Identidade RSBUILD">
        <div className="login-brand-glow" aria-hidden="true" />
        <div className="login-brand-pattern" aria-hidden="true" />
        <div className="login-brand-content">
          <div className="login-brand-message">
            <span className="login-overline">RSBUILD OS</span>
            <h1>Seu acesso.<br />Sob seu controle.</h1>
            <p>Recupere sua senha com segurança usando o e-mail cadastrado na plataforma.</p>
          </div>
          <div className="login-brand-footer"><span className="login-footer-line" /><span>RSBUILD OS · AMBIENTE CORPORATIVO</span></div>
        </div>
      </section>
      <section className="login-form-panel" aria-label="Recuperar senha">
        <div className="login-form-wrap">
          <div className="login-form-heading">
            <span className="login-overline">RECUPERAÇÃO DE ACESSO</span>
            <h2>Esqueceu sua senha?</h2>
            <p>Informe seu e-mail. Enviaremos um link seguro para redefinir sua senha.</p>
          </div>
          {params.sent === "1" && <p className="auth-feedback auth-feedback--success" role="status">Se o endereço estiver cadastrado, você receberá um e-mail com as instruções. Verifique também a caixa de spam.</p>}
          {params.error && <p className="auth-feedback" role="alert">{params.error === "expired" ? "Este link expirou ou já foi utilizado. Solicite uma nova recuperação." : params.error === "session" ? "Sua sessão de recuperação não está mais ativa. Solicite um novo link." : "Não foi possível enviar o link agora. Confira o endereço e tente novamente."}</p>}
          <form action={requestPasswordReset} className="login-form">
            <label className="login-field">
              <span>E-mail cadastrado</span>
              <span className="login-input-wrap">
                <span className="login-field-icon" aria-hidden="true">✉</span>
                <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nome@empresa.com.br" />
              </span>
            </label>
            <button className="login-submit" type="submit"><span>Enviar link de recuperação</span><span aria-hidden="true">→</span></button>
          </form>
          <Link href="/login" className="auth-back-link">← Voltar para o login</Link>
        </div>
        <footer className="login-copyright">© {new Date().getFullYear()} RSBUILD · Todos os direitos reservados.</footer>
      </section>
    </main>
  );
}
