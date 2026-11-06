import Image from "next/image";
import { signIn } from "@/app/auth/actions";

type Props = { searchParams: Promise<{ error?: string; next?: string; reason?: string }> };

function MailIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function LockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M12 14v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

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
    <main className="login-page login-page--single">
      <div className="login-ambient-pattern" aria-hidden="true" />
      <section className="login-form-panel login-form-panel--single" aria-label="Acesso ao RSBUILD Finance">
        <div className="login-form-wrap">
          <div className="login-mobile-brand login-mobile-brand--single">
            <div className="login-brand-logo-wrap login-mobile-logo-wrap">
              <Image
                src="/brand/rsbuild-logo-primary.svg"
                alt="RSBUILD — Inovação Corporativa"
                width={1220}
                height={390}
                priority
                className="login-brand-logo"
                sizes="(max-width: 640px) 88vw, 690px"
              />
            </div>
          </div>

          <div className="login-form-heading">
            <span className="login-overline">RSBUILD FINANCE</span>
            <h1>Bem-vindo de volta.</h1>
            <p>Entre com suas credenciais para continuar.</p>
          </div>

          {message && <p className="login-error" role="alert">{message}</p>}

          <form action={signIn} className="login-form">
            <input type="hidden" name="next" value={params.next ?? "/"} />
            <label className="login-field">
              <span>E-mail corporativo</span>
              <span className="login-input-wrap">
                <MailIcon />
                <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nome@empresa.com.br" />
              </span>
            </label>
            <label className="login-field">
              <span>Senha</span>
              <span className="login-input-wrap">
                <LockIcon />
                <input name="password" type="password" autoComplete="current-password" required maxLength={256} placeholder="Digite sua senha" />
              </span>
            </label>
            <button className="login-submit" type="submit">
              <span>Entrar no RSBUILD Finance</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>

          <p className="login-security-note"><span aria-hidden="true">◆</span>Acesso restrito a usuários autorizados.</p>
        </div>
        <footer className="login-copyright">© {new Date().getFullYear()} RSBUILD · Todos os direitos reservados.</footer>
      </section>
    </main>
  );
}
