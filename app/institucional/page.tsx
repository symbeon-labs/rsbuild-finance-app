import Link from "next/link";
import Image from "next/image";
import { DiagnosticForm } from "./diagnostic-form";
import { ArchitectureDiagram, GovernanceFlow, HeroNetwork, OperationalFlow, Reveal } from "./diagrams";
import { HeroAmbientAtmosphere } from "./hero-ambient";
import { FrentesBanner } from "./frentes-banner";

export const metadata = {
  title: "RSBUILD OS | Governança e Inteligência Operacional",
  description: "Plataforma concebida para conectar sistemas, organizar fluxos e governar processos empresariais com auditoria pericial e inteligência assistida.",
  keywords: [
    "RSBUILD OS",
    "governança operacional",
    "inteligência operacional",
    "conciliação bancária",
    "auditoria pericial",
    "holding",
    "ERP"
  ],
  authors: [{ name: "RSBUILD Inovação Corporativa" }],
  openGraph: {
    title: "RSBUILD OS | Governança e Inteligência Operacional",
    description: "Uma camada de governança entre seus sistemas e a operação real. Conecte dados, regras e decisões com rastreabilidade total.",
    url: "https://rsbuild-os.vercel.app/institucional",
    siteName: "RSBUILD OS",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "https://rsbuild-os.vercel.app/brand/rsbuild-logo-primary.webp",
        width: 1200,
        height: 630,
        alt: "RSBUILD OS — Governança e Inteligência Operacional"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "RSBUILD OS | Governança e Inteligência Operacional",
    description: "Uma camada de governança entre seus sistemas e a operação real.",
    images: ["https://rsbuild-os.vercel.app/brand/rsbuild-logo-primary.webp"]
  }
};

const PROBLEMS = [
  {
    title: "Processos manuais",
    text: "Atividades repetitivas que consomem tempo e dificultam a padronização.",
    stat: "40% do tempo de equipes financeiras é gasto em tarefas manuais repetitivas (McKinsey, 2023)"
  },
  {
    title: "Informações fragmentadas",
    text: "Dados distribuídos entre sistemas, planilhas, documentos e equipes.",
    stat: "Empresas com dados fragmentados perdem em média 30h/mês em cruzamentos manuais (Gartner)"
  },
  {
    title: "Reconciliações demoradas",
    text: "Reconciliações e verificações que dependem de esforço manual.",
    stat: "68% das empresas reportam atrasos em fechamentos por divergências não detectadas (PwC)"
  },
  {
    title: "Aprovações descentralizadas",
    text: "Responsabilidades e decisões difíceis de acompanhar ao longo do processo.",
    stat: "Sem rastro de aprovações, 42% das decisões não têm justificativa documentada (Deloitte)"
  },
  {
    title: "Dependência de conhecimento individual",
    text: "Processos críticos que permanecem concentrados na experiência de poucas pessoas.",
    stat: "75% do conhecimento tácito é perdido quando funcionários-chave saem (Harvard BR)"
  },
  {
    title: "Baixa rastreabilidade",
    text: "Dificuldade para compreender o contexto e o andamento de cada atividade.",
    stat: "Empresas sem rastreabilidade clara têm 3x mais incidentes de não-conformidade (KPMG)"
  }
];

const MODULES = [
  {
    badge: "Disponível",
    badgeClass: "ok",
    title: "Finanças & Caixa",
    text: "Organização de informações financeiras, movimentações e indicadores para ampliar a visibilidade sobre o caixa.",
    items: ["Extratos", "Fluxo de caixa", "Indicadores", "Rastreabilidade"]
  },
  {
    badge: "Disponível",
    badgeClass: "ok",
    title: "Reconciliação & Baixas",
    text: "Conferência assistida entre movimentações, títulos e registros operacionais, com tratamento de divergências.",
    items: ["Correspondências", "Divergências", "Encargos", "Aprovações"]
  },
  {
    badge: "Em validação",
    badgeClass: "review",
    title: "Logística & Expedição",
    text: "Organização e acompanhamento de informações relacionadas a pedidos, expedições e entregas.",
    items: ["Pedidos", "Expedições", "Comprovantes", "Ocorrências"]
  },
  {
    badge: "Em validação",
    badgeClass: "review",
    title: "Auditoria & Governança",
    text: "Estruturação de responsabilidades, permissões e mecanismos de acompanhamento dos processos.",
    items: ["Identidade", "Alçadas", "Eventos", "Histórico"]
  }
];

const STEPS = [
  { num: "01", title: "Conectar", text: "Organizar informações provenientes de sistemas e fontes operacionais, conforme as condições de integração de cada projeto.", icon: "connect" },
  { num: "02", title: "Interpretar", text: "Contextualizar informações, identificar padrões e aplicar critérios definidos para cada processo.", icon: "analyze" },
  { num: "03", title: "Verificar", text: "Apoiar conferências e validações, destacando inconsistências e situações que exigem atenção.", icon: "check" },
  { num: "04", title: "Governar", text: "Estruturar responsabilidades, aprovações e registros para acompanhar a operação com mais clareza.", icon: "shield" }
];

const IMPLEMENTATION = [
  { num: "01", title: "Diagnóstico", text: "Compreender os processos, os sistemas utilizados e os principais pontos de atenção.", icon: "search" },
  { num: "02", title: "Definição de escopo", text: "Delimitar o processo prioritário, os responsáveis e os critérios de avaliação.", icon: "scope" },
  { num: "03", title: "Projeto-piloto", text: "Avaliar a aplicação em um contexto controlado e com objetivos previamente definidos.", icon: "pilot" },
  { num: "04", title: "Evolução", text: "Analisar os resultados e estabelecer os próximos passos de adoção.", icon: "growth" }
];

const GOVERNANCE_ITEMS = [
  { text: "Regras e parâmetros orientam a análise e o encaminhamento dos processos.", icon: "rule" },
  { text: "A automação deve respeitar o escopo e as permissões estabelecidas.", icon: "limit" },
  { text: "Decisões relevantes permanecem sujeitas à responsabilidade e aprovação das pessoas.", icon: "human" },
  { text: "As ações e etapas precisam ser acompanháveis dentro do escopo implementado.", icon: "check" },
  { text: "Registro de todos os eventos para rastreabilidade completa.", icon: "log" }
];

function LineIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function StepIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    connect: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
    ),
    analyze: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    check: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    search: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
    ),
    scope: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    pilot: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    growth: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    rule: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M8 11h8" />
      </svg>
    ),
    limit: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M8 12h8" />
      </svg>
    ),
    human: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    log: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
      </svg>
    )
  };
  return icons[name] || icons.check;
}

export default function InstitucionalPage() {
  return (
    <div className="inst-page">
      {/* SECTION 01 — HEADER */}
      <header className="inst-header">
        <div className="inst-container inst-header-inner">
          <Link href="/institucional" className="inst-logo" aria-label="RSBUILD OS — página inicial">
            <Image src="/brand/rsbuild-logo-dark.svg" alt="RSBUILD" width={168} height={52} priority />
          </Link>
          <nav className="inst-nav" aria-label="Navegação institucional">
            <a href="#produto">O produto</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#aplicacoes">Aplicações</a>
            <a href="#governanca">Governança</a>
            <a href="https://rsbuild.com.br/" target="_blank" rel="noopener noreferrer" className="inst-nav-external">
              Site oficial RSBUILD <ExternalLinkIcon />
            </a>
          </nav>
          <a href="#diagnostico" className="inst-cta">Solicitar diagnóstico</a>
        </div>
      </header>

      {/* SECTION 02 — HERO */}
      <section className="inst-hero">
        <HeroAmbientAtmosphere />
        <div className="inst-container inst-hero-grid">
          <div>
            <span className="inst-eyebrow">Operação real. Dados rastreáveis. Decisões auditadas.</span>
            <h1>
              Sua operação<br />
              sob <em>controle total.</em>
            </h1>
            <p className="sub">
              Não é só sobre automatizar — é sobre saber exatamente o que acontece,
              quem fez, com qual autorização e o que está pendente.
              O RSBUILD OS coloca governança no centro da operação.
            </p>
            <div className="inst-hero-ctas">
              <a href="#diagnostico" className="inst-cta">Solicitar diagnóstico</a>
              <a href="#produto" className="inst-cta ghost">Conhecer a plataforma</a>
            </div>
          </div>
          <div className="inst-hero-art">
            <HeroNetwork />
          </div>
        </div>
      </section>

      {/* SECTION 03 — O PROBLEMA */}
      <section className="inst-section beige">
        <div className="inst-container">
          <span className="inst-eyebrow">O Desafio Operacional</span>
          <h2>Sua empresa possui sistemas. Mas consegue enxergar tudo o que acontece entre eles?</h2>
          <p className="lead">
            Na maioria das operações, a informação existe — mas está fragmentada entre
            ferramentas que não conversam entre si. O resultado é retrabalho,
            decisões lentas e baixa capacidade de provar o que aconteceu.
          </p>
          <div className="inst-grid-3">
            {PROBLEMS.map((p, i) => (
              <div key={p.title} className="inst-card inst-expandable-card">
                <span className="icon">
                  <LineIcon>
                    {i === 0 && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></>}
                    {i === 1 && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>}
                    {i === 2 && <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></>}
                    {i === 3 && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>}
                    {i === 4 && <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>}
                    {i === 5 && <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6M11 8v6" /></>}
                  </LineIcon>
                </span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <div className="inst-stat-box">
                  <span className="inst-stat-label">Dado de mercado</span>
                  <span className="inst-stat-text">{p.stat}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 04 — O PRODUTO */}
      <section className="inst-section" id="produto">
        <div className="inst-container">
          <span className="inst-eyebrow">A Plataforma</span>
          <h2>Uma camada de governança entre seus sistemas e a operação real.</h2>
          <p className="lead">
            O RSBUILD OS conecta dados, regras operacionais, fluxos de trabalho e
            recursos de inteligência em uma estrutura concebida para organizar,
            acompanhar e governar processos empresariais.
          </p>
          <ArchitectureDiagram />
        </div>
      </section>

      {/* SECTION 05 — COMO FUNCIONA */}
      <section className="inst-section light" id="como-funciona">
        <div className="inst-container">
          <span className="inst-eyebrow">Modelo Operacional</span>
          <h2>Da informação à operação governada.</h2>
          <OperationalFlow />
        </div>
      </section>

      {/* SECTION 06 — FRENTES DE ATUAÇÃO */}
      <section className="inst-section beige" id="aplicacoes">
        <div className="inst-container">
          <span className="inst-eyebrow">Domínios Operacionais</span>
          <h2>Uma estrutura modular para diferentes necessidades.</h2>
          <p className="lead">
            Cada empresa pode ativar apenas as frentes relevantes para sua operação,
            com o nível de maturidade de cada módulo comunicado com transparência.
          </p>
          <div className="inst-grid-4">
            {MODULES.map((m) => (
              <div key={m.title} className="inst-card">
                <span className={`inst-badge ${m.badgeClass}`}>{m.badge}</span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
                <ul>{m.items.map((it) => <li key={it}>{it}</li>)}</ul>
              </div>
            ))}
          </div>

          {/* Prova Social & Frentes Operacionais Ativas — componente interativo */}
          <Reveal>
            <FrentesBanner />
          </Reveal>
        </div>
      </section>

      {/* SECTION 07 — INTELIGÊNCIA E GOVERNANÇA */}
      <section className="inst-section deep" id="governanca">
        <div className="inst-container inst-split">
          <div>
            <span className="inst-eyebrow">Inteligência com Governança</span>
            <h2>Automatizar não é suficiente. É preciso saber o que está sendo executado.</h2>
            <p className="lead" style={{ opacity: 0.85 }}>
              O RSBUILD OS foi concebido para que recursos de inteligência ampliem
              a capacidade das pessoas — nunca substituam a responsabilidade
              sobre as decisões. Toda automação opera dentro de critérios,
              limites e supervisão definidos.
            </p>
            <Reveal className="inst-governance-list">
              {GOVERNANCE_ITEMS.map((item, i) => (
                <div
                  key={item.text}
                  className="inst-governance-item"
                  style={{
                    transitionDelay: `${0.1 + i * 0.12}s`,
                    animationDelay: `${i * 0.8}s`
                  }}
                >
                  <span className="inst-gov-icon" style={{ transitionDelay: `${0.18 + i * 0.12}s` }}>
                    <StepIcon name={item.icon} />
                  </span>
                  {item.text}
                </div>
              ))}
            </Reveal>
            <div className="inst-message">
              A inteligência deve ampliar a capacidade operacional das pessoas,
              não eliminar a responsabilidade sobre as decisões.
            </div>
          </div>
          <div style={{ minHeight: 300 }}>
            <GovernanceFlow items={GOVERNANCE_ITEMS.map(i => i.text)} />
          </div>
        </div>
      </section>

      {/* SECTION 08 — ECOSSISTEMA */}
      <section className="inst-section light">
        <div className="inst-container">
          <span className="inst-eyebrow">Integração Operacional</span>
          <h2>Não é necessário reconstruir sua operação para começar a organizá-la.</h2>
          <p className="lead">
            O RSBUILD OS foi concebido para coexistir com as estruturas
            tecnológicas que a empresa já possui. A adoção pode partir de uma
            necessidade específica, considerando os sistemas, processos e
            condições de integração disponíveis.
          </p>
          <div className="inst-grid-3 rs-integration-principles">
            <article className="inst-card">
              <span className="inst-card-icon">01</span>
              <h3>Coexistir</h3>
              <p>Preservar os sistemas e as rotinas que já sustentam a operação.</p>
            </article>
            <article className="inst-card">
              <span className="inst-card-icon">02</span>
              <h3>Conectar</h3>
              <p>Aproximar informações e fluxos conforme as integrações disponíveis.</p>
            </article>
            <article className="inst-card">
              <span className="inst-card-icon">03</span>
              <h3>Evoluir</h3>
              <p>Ampliar a organização operacional por etapas e escopos definidos.</p>
            </article>
          </div>
        </div>
      </section>

      {/* SECTION 09 — IMPLEMENTAÇÃO */}
      <section className="inst-section beige">
        <div className="inst-container">
          <span className="inst-eyebrow">Implementação Progressiva</span>
          <h2>Comece pelo problema. Estruture a solução a partir da operação.</h2>
          <Reveal className="inst-reveal-target">
            <div className="inst-steps" style={{ marginTop: 40 }}>
              {IMPLEMENTATION.map((s) => (
                <div key={s.num} className="inst-step">
                  <div className="num">{s.num}</div>
                  <div className="inst-step-icon">
                    <StepIcon name={s.icon} />
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <div style={{ marginTop: 36, textAlign: "center" }}>
            <a href="#diagnostico" className="inst-cta">Solicitar diagnóstico operacional</a>
          </div>
        </div>
      </section>

      {/* FORMULÁRIO DE DIAGNÓSTICO */}
      <section
        className="inst-section inst-diagnostic-section"
        id="diagnostico"
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: "var(--rsbuild-charcoal)",
          backgroundImage:
            "radial-gradient(circle, rgba(217, 204, 181, 0.08) 1.2px, transparent 1.2px), linear-gradient(to bottom, rgba(43, 44, 46, 0.75) 0%, rgba(43, 44, 46, 0.98) 100%)",
          backgroundSize: "32px 32px, 100% 100%",
          padding: "100px 0 96px"
        }}
      >
        <HeroAmbientAtmosphere />
        <div className="inst-container" style={{ position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <span className="inst-eyebrow" style={{ color: "var(--rsbuild-terracotta-light)" }}>Diagnóstico Operacional</span>
            <h2 style={{ color: "#F5F1EA" }}>Conte-nos sobre sua operação.</h2>
            <p className="lead" style={{ margin: "0 auto", color: "rgba(217, 204, 181, 0.85)" }}>
              Cinco etapas curtas. Solicitamos apenas o necessário para uma
              avaliação inicial — nunca credenciais, extratos ou documentos
              confidenciais.
            </p>
          </div>
          <DiagnosticForm />
        </div>
      </section>

      {/* SECTION 10 — CTA E FOOTER */}
      <section className="inst-cta-final">
        <div className="inst-container">
          <h2>Sua operação pode estar pronta para evoluir.</h2>
          <p>
            Conte-nos sobre sua empresa, seus processos e os desafios que deseja
            resolver. Vamos avaliar onde uma camada de governança operacional
            pode gerar valor.
          </p>
          <a href="#diagnostico" className="inst-cta" style={{ fontSize: 15, padding: "14px 28px" }}>
            Solicitar diagnóstico operacional
          </a>
        </div>
      </section>

      <footer className="inst-footer">
        <div className="inst-container">
          <div className="inst-footer-grid">
            <div>
              <Image src="/brand/rsbuild-logo-dark.svg" alt="RSBUILD" width={130} height={42} />
              <p className="desc" style={{ marginTop: 14 }}>
                RSBUILD OS — Governança para operações que precisam evoluir.
                Camada de inteligência e controle entre seus sistemas e a
                operação real.
              </p>
            </div>
            <div>
              <h4>O produto</h4>
              <a href="#produto">Plataforma</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#aplicacoes">Frentes de atuação</a>
            </div>
            <div>
              <h4>Contato</h4>
              <a href="#diagnostico">Solicitar diagnóstico</a>
              <a href="mailto:suporte@rsbuild.com.br">suporte@rsbuild.com.br</a>
              <a href="/login">Acesso à plataforma</a>
              <a href="https://rsbuild.com.br/" target="_blank" rel="noopener noreferrer">
                Site oficial RSBUILD <ExternalLinkIcon />
              </a>
            </div>
          </div>
          <div className="inst-footer-bottom">
            <span>© {new Date().getFullYear()} RSBUILD · Todos os direitos reservados.</span>
            <span>
              <a href="/institucional">Privacidade</a>
              <a href="/institucional">Termos de uso</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
