"use client";

import Image from "next/image";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // Sem Supabase em main: redireciona direto para workspace
    setTimeout(() => {
      window.location.href = "/";
    }, 600);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Libre+Franklin:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: #F8F6F2;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-shell {
          display: flex;
          min-height: 100vh;
          width: 100%;
        }
        /* Painel esquerdo — identidade */
        .login-brand {
          width: 420px;
          flex-shrink: 0;
          background-color: #2B2C2E;
          background-image:
            radial-gradient(circle at 20% 25%, rgba(181,88,60,0.18), transparent 55%),
            radial-gradient(circle at 80% 80%, rgba(181,88,60,0.08), transparent 50%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 44px;
          color: #fff;
        }
        .login-logo-wrap {
          background: #F5F1EB;
          border-radius: 8px;
          padding: 10px 16px;
          display: inline-flex;
          align-items: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.22);
        }
        .login-brand-copy {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .login-brand-eyebrow {
          font-family: 'Libre Franklin', sans-serif;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: 700;
          color: #B5583C;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .login-brand-h1 {
          font-family: 'Libre Franklin', sans-serif;
          font-size: 26px;
          font-weight: 800;
          line-height: 1.25;
          color: #EDE8DF;
          margin-bottom: 16px;
        }
        .login-brand-p {
          font-size: 13px;
          color: #8E887E;
          line-height: 1.65;
          max-width: 280px;
        }
        .login-brand-footer {
          font-size: 10px;
          color: #5A5650;
          font-family: 'Libre Franklin', sans-serif;
          letter-spacing: 0.5px;
        }
        /* Painel direito — formulário */
        .login-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F8F6F2;
          padding: 48px 32px;
        }
        .login-card {
          width: 100%;
          max-width: 400px;
        }
        .login-card h2 {
          font-family: 'Libre Franklin', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #2B2C2E;
          margin-bottom: 6px;
        }
        .login-card p {
          font-size: 13px;
          color: #7E7873;
          margin-bottom: 32px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 18px;
        }
        .form-group label {
          font-size: 11px;
          font-weight: 600;
          color: #3E3C3A;
          font-family: 'Libre Franklin', sans-serif;
          letter-spacing: 0.5px;
        }
        .form-group input {
          border: 1px solid #DDD7CE;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 13px;
          background: #fff;
          color: #2B2C2E;
          outline: none;
          transition: border-color 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .form-group input:focus {
          border-color: #B5583C;
          box-shadow: 0 0 0 3px rgba(181,88,60,0.08);
        }
        .login-btn {
          width: 100%;
          background: #B5583C;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 13px 20px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Libre Franklin', sans-serif;
          cursor: pointer;
          transition: background 0.15s;
          margin-top: 8px;
          letter-spacing: 0.3px;
        }
        .login-btn:hover { background: #9E4930; }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 24px 0;
          color: #BEB8B0;
          font-size: 10px;
        }
        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #E5E1D8;
        }
        .login-footer-note {
          margin-top: 28px;
          font-size: 11px;
          color: #9A948C;
          text-align: center;
          line-height: 1.6;
        }
        @media (max-width: 768px) {
          .login-brand { display: none; }
        }
      `}</style>

      <div className="login-shell">
        {/* Painel de marca */}
        <div className="login-brand">
          <div className="login-logo-wrap">
            <Image
              src="/brand/rsbuild-logo-primary.svg"
              alt="RSBUILD"
              width={150}
              height={48}
              priority
              style={{ height: 40, width: "auto" }}
            />
          </div>

          <div className="login-brand-copy">
            <div className="login-brand-eyebrow">Gestão Financeira</div>
            <h1 className="login-brand-h1">Controle total sobre seu negócio.</h1>
            <p className="login-brand-p">
              Plataforma integrada de gestão financeira, conciliação bancária e
              controle de pedidos para operações de alta performance.
            </p>
          </div>

          <div className="login-brand-footer">
            RSBUILD © {new Date().getFullYear()} · Todos os direitos reservados
          </div>
        </div>

        {/* Painel de formulário */}
        <div className="login-form-panel">
          <div className="login-card">
            <h2>Bem-vindo de volta</h2>
            <p>Entre com suas credenciais para acessar a plataforma.</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">E-MAIL</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="seu@email.com.br"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">SENHA</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Entrando…" : "Entrar na plataforma"}
              </button>
            </form>

            <div className="login-divider">RSBUILD · FINANCEIRO</div>

            <p className="login-footer-note">
              Problemas de acesso? Entre em contato com o administrador do sistema.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

