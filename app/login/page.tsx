"use client";

import Image from "next/image";
import { useState } from "react";

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 14v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      window.location.href = "/";
    }, 500);
  }

  return (
    <main className="login-page">

      {/* ========================================================
          PAINEL ESQUERDO (DESKTOP)
          Fundo escuro institucional com network pattern sutilmente
          animado + glow alaranjado + manifesto RSBUILD
          ======================================================== */}
      <section className="login-brand-panel" aria-label="Identidade RSBUILD">
        <div className="login-brand-glow" aria-hidden="true" />
        <div className="login-brand-pattern" aria-hidden="true" />

        <div className="login-brand-content">
          <div className="login-brand-logo-wrap">
            <Image
              src="/brand/rsbuild-logo-dark.svg"
              alt="RSBUILD — Inovação Corporativa"
              width={240}
              height={77}
              priority
              className="login-brand-logo"
            />
          </div>

          <div className="login-brand-message">
            <span className="login-overline">SISTEMA OPERACIONAL</span>
            <h1>
              Clareza para<br />
              decidir. Controle<br />
              para evoluir.
            </h1>
            <p>
              Uma visão organizada da operação da sua empresa,
              em um ambiente seguro, integrado e de alto desempenho.
            </p>
          </div>

          <div className="login-brand-footer">
            <span className="login-footer-line" />
            <span>RSBUILD OS <b>·</b> AMBIENTE CORPORATIVO</span>
          </div>
        </div>
      </section>

      {/* ========================================================
          PAINEL DE FORMULÁRIO (DIREITA NO PC / TELA CHEIA NO MOBILE)
          No mobile: ambient pattern com hexágonos nas quinas + glow alaranjado difuso
          No desktop: fundo claro limpo com o formulário refinado
          ======================================================== */}
      <section className="login-form-panel" aria-label="Acesso ao RSBUILD OS">
        {/* Camadas visuais exclusivas do mobile */}
        <div className="login-mobile-ambient-glow" aria-hidden="true" />
        <div className="login-mobile-pattern" aria-hidden="true" />

        <div className="login-form-wrap">
          {/* Logo centralizado exclusivo do mobile */}
          <div className="login-mobile-brand">
            <div className="login-brand-logo-wrap login-mobile-logo-wrap">
              <Image
                src="/brand/rsbuild-logo-primary.svg"
                alt="RSBUILD — Inovação Corporativa"
                width={1220}
                height={390}
                priority
                className="login-brand-logo"
                sizes="(max-width: 850px) 85vw, 620px"
              />
            </div>
          </div>

          <div className="login-form-heading">
            <span className="login-overline">RSBUILD OS</span>
            <h2>Bem-vindo de volta.</h2>
            <p>Entre com suas credenciais para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field">
              <span>E-mail corporativo</span>
              <span className="login-input-wrap">
                <span className="login-field-icon" aria-hidden="true">
                  <MailIcon />
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="nome@empresa.com.br"
                />
              </span>
            </label>

            <label className="login-field">
              <span>Senha</span>
              <span className="login-input-wrap">
                <span className="login-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
                </button>
              </span>
            </label>

            <button className="login-submit" type="submit" disabled={loading}>
              <span>{loading ? "Entrando…" : "Entrar no RSBUILD OS"}</span>
              <ArrowIcon />
            </button>
          </form>

          <p className="login-security-note">
            <span aria-hidden="true">◆</span>
            Acesso restrito a usuários autorizados.
          </p>
        </div>

        <footer className="login-copyright">
          © {new Date().getFullYear()} RSBUILD · Todos os direitos reservados.
        </footer>
      </section>

    </main>
  );
}
