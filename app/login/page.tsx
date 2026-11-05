import Image from "next/image";
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
    <main className="login-page">
      <section className="login-brand-panel" aria-label="Identidade RSBUILD">
        <div className="login-brand-pattern" aria-hidden="true" />
        <div className="login-brand-content">
          <div className="login-brand-logo-wrap">
            <Image
              src="/brand/rsbuild-logo-primary.webp"
              alt="RSBUILD — Inovação Corporativa"
              width={240}
              height={87}
              priority
              className="login-brand-logo"
            />
          </div>

          <div className="login-brand-message">
            <span className="login-overline">GESTÃO FINANCEIRA</span>
            <h1>Clareza para<br />decidir. Controle<br />para evoluir.</h1>
            <p>Uma visão organizada da operação financeira da sua empresa, em um ambiente seguro e integrado.</p>
          </div>

          <div className="login-brand-footer">
            <span className="login-footer-line" />
            <span>RSBUILD FINANCE <b>·</b> AMBIENTE CORPORATIVO</span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <div className="login-brand-logo-wrap login-mobile-logo-wrap">
            <Image
              src="/brand/rsbuild-logo-primary.webp"
              alt="RSBUILD — Inovação Corporativa"
              width={240}
              height={87}
              priority
              className="login-brand-logo"
            />
            </div>
          </div>

          <div className="login-form-heading">
            <span className="login-overline">RSBUILD FINANCE</span>
            <h2>Bem-vindo de volta.</h2>
            <p>Entre com suas credenciais para continuar.</p>
          </div>

          {message && <p className="login-error" role="alert">{message}</p>}

          <form action={signIn} className="login-form">
            <input type="hidden" name="next" value={params.next ?? "/"} />

            <label className="login-field">
              <span>E-mail corporativo</span>
              <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nome@empresa.com.br" />
            </label>

            <label className="login-field">
              <span>Senha</span>
              <input name="password" type="password" autoComplete="current-password" required maxLength={256} placeholder="Digite sua senha" />
            </label>

            <button className="login-submit" type="submit">
              <span>Entrar no RSBUILD Finance</span>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>

          <p className="login-security-note">
            <span aria-hidden="true">◆</span>
            Acesso restrito a usuários autorizados.
          </p>
        </div>

        <footer className="login-copyright">© {new Date().getFullYear()} RSBUILD · Todos os direitos reservados.</footer>
      </section>
    </main>
  );
}
