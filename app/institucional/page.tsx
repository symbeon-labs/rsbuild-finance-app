import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "RSBUILD OS | Governança e inteligência operacional",
  description:
    "Uma camada de governança concebida para organizar, acompanhar e estruturar processos empresariais.",
  openGraph: {
    title: "RSBUILD OS | Governança e inteligência operacional",
    description:
      "Transforme processos, dados e decisões em operações mais organizadas, rastreáveis e governáveis.",
    type: "website",
  },
};

const problems = [
  {
    number: "01",
    title: "Processos manuais",
    text: "Atividades repetitivas que consomem tempo e dificultam a padronização.",
  },
  {
    number: "02",
    title: "Informações fragmentadas",
    text: "Dados distribuídos entre sistemas, planilhas, documentos e equipes.",
  },
  {
    number: "03",
    title: "Conferências demoradas",
    text: "Reconciliações e verificações que dependem de esforço manual.",
  },
  {
    number: "04",
    title: "Aprovações descentralizadas",
    text: "Responsabilidades e decisões difíceis de acompanhar ao longo do processo.",
  },
  {
    number: "05",
    title: "Dependência de conhecimento individual",
    text: "Processos críticos que permanecem concentrados na experiência de poucas pessoas.",
  },
  {
    number: "06",
    title: "Baixa visibilidade operacional",
    text: "Dificuldade para compreender o contexto e o andamento de cada atividade.",
  },
];

const stages = [
  {
    number: "01",
    title: "Conectar",
    text: "Organizar informações provenientes de sistemas e fontes operacionais, conforme as condições de integração de cada projeto.",
  },
  {
    number: "02",
    title: "Interpretar",
    text: "Contextualizar informações, identificar padrões e aplicar critérios definidos para cada processo.",
  },
  {
    number: "03",
    title: "Verificar",
    text: "Apoiar conferências e validações, destacando inconsistências e situações que exigem atenção.",
  },
  {
    number: "04",
    title: "Governar",
    text: "Estruturar responsabilidades, aprovações e registros para acompanhar a operação com mais clareza.",
  },
];

const capabilities = [
  {
    number: "01",
    code: "FIN",
    title: "Finanças & Caixa",
    text: "Organização de informações financeiras, movimentações e indicadores para ampliar a visibilidade sobre o caixa.",
    tags: ["Extratos", "Fluxo de caixa", "Indicadores", "Rastreabilidade"],
  },
  {
    number: "02",
    code: "REC",
    title: "Reconciliação & Baixas",
    text: "Conferência assistida entre movimentações, títulos e registros operacionais, com tratamento de divergências.",
    tags: ["Correspondências", "Divergências", "Encargos", "Aprovações"],
  },
  {
    number: "03",
    code: "LOG",
    title: "Logística & Expedição",
    text: "Organização e acompanhamento de informações relacionadas a pedidos, expedições e entregas.",
    tags: ["Pedidos", "Expedições", "Comprovantes", "Ocorrências"],
  },
  {
    number: "04",
    code: "GOV",
    title: "Auditoria & Governança",
    text: "Estruturação de responsabilidades, permissões e mecanismos de acompanhamento dos processos.",
    tags: ["Identidade", "Alçadas", "Eventos", "Histórico"],
  },
];

const governance = [
  {
    title: "Critérios definidos",
    text: "Regras e parâmetros orientam a análise e o encaminhamento dos processos.",
  },
  {
    title: "Limites de atuação",
    text: "A automação deve respeitar o escopo e as permissões estabelecidas.",
  },
  {
    title: "Supervisão humana",
    text: "Decisões relevantes permanecem sujeitas à responsabilidade e aprovação das pessoas.",
  },
  {
    title: "Registros e acompanhamento",
    text: "As ações e etapas precisam ser acompanháveis dentro do escopo implementado.",
  },
];

const implementation = [
  {
    number: "01",
    title: "Diagnóstico",
    text: "Compreender os processos, os sistemas utilizados e os principais pontos de atenção.",
  },
  {
    number: "02",
    title: "Definição de escopo",
    text: "Delimitar o processo prioritário, os responsáveis e os critérios de avaliação.",
  },
  {
    number: "03",
    title: "Projeto-piloto",
    text: "Avaliar a aplicação em um contexto controlado e com objetivos previamente definidos.",
  },
  {
    number: "04",
    title: "Evolução",
    text: "Analisar os resultados e estabelecer os próximos passos de adoção.",
  },
];

const mailto =
  "mailto:suporte@rsbuild.com.br?subject=Diagn%C3%B3stico%20operacional%20%7C%20RSBUILD%20OS";

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="rs-arrow"
    >
      {diagonal ? (
        <path d="M5 15 15 5M6 5h9v9" />
      ) : (
        <path d="M3.5 10h12m-5-5 5 5-5 5" />
      )}
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="rs-eyebrow">{children}</div>;
}

export default function InstitucionalPage() {
  return (
    <main className="rs-public">
      <header className="rs-header">
        <div className="rs-container rs-header-inner">
          <Link href="#inicio" className="rs-brand" aria-label="RSBUILD OS — início">
            <Image
              src="/brand/rsbuild-logo-primary.svg"
              alt="RSBUILD"
              width={166}
              height={48}
              priority
            />
            <span className="rs-brand-divider" />
            <span className="rs-brand-product">OS</span>
          </Link>

          <nav className="rs-nav" aria-label="Navegação principal">
            <Link href="#plataforma">A plataforma</Link>
            <Link href="#funcionamento">Como funciona</Link>
            <Link href="#frentes">Frentes de atuação</Link>
            <Link href="#governanca">Governança</Link>
          </nav>

          <a className="rs-button rs-button-small rs-button-dark" href={mailto}>
            Solicitar diagnóstico <ArrowIcon />
          </a>
        </div>
      </header>

      <section className="rs-hero" id="inicio">
        <div className="rs-hero-pattern" />
        <div className="rs-container rs-hero-grid">
          <div className="rs-hero-copy">
            <SectionLabel>INTELIGÊNCIA OPERACIONAL <i /> GOVERNANÇA</SectionLabel>
            <h1>
              Governança e inteligência para <em>operações empresariais.</em>
            </h1>
            <p className="rs-hero-lead">
              Transforme processos, dados e decisões em operações mais
              organizadas, rastreáveis e governáveis.
            </p>
            <div className="rs-hero-actions">
              <a className="rs-button rs-button-primary" href={mailto}>
                Solicitar diagnóstico <ArrowIcon />
              </a>
              <Link className="rs-text-link rs-text-link-light" href="#plataforma">
                Conhecer a plataforma <ArrowIcon />
              </Link>
            </div>
            <div className="rs-hero-note">
              <span className="rs-status-dot" />
              Uma plataforma em evolução, orientada à realidade de cada operação.
            </div>
          </div>

          <div className="rs-hero-visual" aria-label="Representação conceitual do fluxo operacional">
            <div className="rs-visual-topline">
              <span>RSBUILD / OPERATIONAL LAYER</span>
              <span>01 — 04</span>
            </div>
            <div className="rs-orbit rs-orbit-one" />
            <div className="rs-orbit rs-orbit-two" />
            <div className="rs-core">
              <span className="rs-core-mark">R</span>
              <strong>RSBUILD</strong>
              <small>OPERATIONAL GOVERNANCE</small>
            </div>
            <div className="rs-node rs-node-a"><span>01</span> DADOS</div>
            <div className="rs-node rs-node-b"><span>02</span> PROCESSOS</div>
            <div className="rs-node rs-node-c"><span>03</span> CRITÉRIOS</div>
            <div className="rs-node rs-node-d"><span>04</span> CONTROLE</div>
            <div className="rs-visual-caption">
              <span>ESTRUTURA CONCEITUAL</span>
              <span>INFORMAÇÃO → GOVERNANÇA</span>
            </div>
          </div>
        </div>
        <div className="rs-hero-bottom">
          <div className="rs-container rs-hero-bottom-inner">
            <span>ORGANIZAR</span><b /> <span>VERIFICAR</span><b /> <span>ACOMPANHAR</span><b /> <span>EVOLUIR</span>
          </div>
        </div>
      </section>

      <section className="rs-section rs-problem" id="desafio">
        <div className="rs-container">
          <div className="rs-section-intro rs-intro-split">
            <div>
              <SectionLabel>O DESAFIO OPERACIONAL</SectionLabel>
              <h2>Sua empresa possui sistemas. Mas consegue enxergar tudo o que acontece entre eles?</h2>
            </div>
            <p>
              A existência de sistemas não garante que os processos estejam
              integrados, que as informações tenham contexto ou que as decisões
              possam ser acompanhadas de ponta a ponta.
            </p>
          </div>

          <div className="rs-problem-grid">
            {problems.map((item) => (
              <article className="rs-problem-card" key={item.number}>
                <span className="rs-card-number">{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="rs-card-line" />
              </article>
            ))}
          </div>
          <div className="rs-problem-callout">
            <span className="rs-callout-mark">↗</span>
            <p>
              Muitas vezes, o desafio não é a ausência de tecnologia.
              <strong> É a falta de uma camada capaz de organizar e governar a operação entre os sistemas.</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="rs-section rs-platform" id="plataforma">
        <div className="rs-container rs-platform-grid">
          <div className="rs-platform-copy">
            <SectionLabel>A PLATAFORMA</SectionLabel>
            <h2>Uma camada de governança entre seus sistemas e a operação real.</h2>
            <p>
              O RSBUILD OS é uma plataforma concebida para estruturar,
              acompanhar e governar processos empresariais. Sua proposta é
              conectar dados, regras operacionais, fluxos de trabalho e
              recursos de inteligência em uma estrutura integrada.
            </p>
            <p>
              Não nasce para substituir os sistemas que sua empresa já utiliza.
              Busca ampliar a capacidade de aproveitá-los, organizando
              informações e estabelecendo mecanismos de acompanhamento,
              validação e controle.
            </p>
            <Link className="rs-text-link" href="#funcionamento">
              Entenda como funciona <ArrowIcon />
            </Link>
          </div>

          <div className="rs-layer-diagram">
            <div className="rs-layer-source">
              <span className="rs-layer-index">01</span>
              <div><strong>Seu ambiente atual</strong><small>ERP · Sistemas · Documentos · Dados</small></div>
            </div>
            <div className="rs-layer-connector"><span /></div>
            <div className="rs-layer-main">
              <div className="rs-layer-main-top"><span>CAMADA DE GOVERNANÇA</span><span>RS / OS</span></div>
              <strong>RSBUILD OS</strong>
              <p>Organização · Verificação · Acompanhamento</p>
            </div>
            <div className="rs-layer-connector"><span /></div>
            <div className="rs-layer-outcomes">
              <div><span>02</span><strong>Processos organizados</strong></div>
              <div><span>03</span><strong>Critérios e validações</strong></div>
              <div><span>04</span><strong>Decisões acompanhadas</strong></div>
            </div>
            <small className="rs-diagram-note">Representação conceitual da proposta da plataforma.</small>
          </div>
        </div>
      </section>

      <section className="rs-section rs-process" id="funcionamento">
        <div className="rs-container">
          <div className="rs-section-intro rs-intro-centered">
            <SectionLabel>MODELO OPERACIONAL</SectionLabel>
            <h2>Da informação à operação governada.</h2>
            <p>
              Uma lógica de trabalho que organiza o caminho entre receber
              informações e acompanhar os processos que dependem delas.
            </p>
          </div>
          <div className="rs-stage-grid">
            {stages.map((stage, index) => (
              <article className="rs-stage" key={stage.number}>
                <div className="rs-stage-top">
                  <span>{stage.number}</span>
                  {index < stages.length - 1 && <i />}
                </div>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rs-section rs-capabilities" id="frentes">
        <div className="rs-container">
          <div className="rs-section-intro rs-intro-split">
            <div>
              <SectionLabel>DOMÍNIOS OPERACIONAIS</SectionLabel>
              <h2>Uma estrutura modular para diferentes necessidades.</h2>
            </div>
            <p>
              O RSBUILD OS está sendo estruturado para atender diferentes
              dimensões da operação empresarial. Cada frente evolui conforme
              prioridades, maturidade e escopo de implementação.
            </p>
          </div>
          <div className="rs-capability-grid">
            {capabilities.map((item) => (
              <article className="rs-capability-card" key={item.number}>
                <div className="rs-capability-head">
                  <span className="rs-capability-code">{item.code}</span>
                  <span className="rs-capability-number">{item.number}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <div className="rs-tag-list">
                  {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="rs-capability-foot"><span>FRENTE DE EVOLUÇÃO</span><i /></div>
              </article>
            ))}
          </div>
          <p className="rs-disclaimer">
            As frentes representam domínios de aplicação. A disponibilidade de
            cada capacidade, integração ou fluxo depende do estágio de
            desenvolvimento, da configuração e do escopo contratado.
          </p>
        </div>
      </section>

      <section className="rs-section rs-governance" id="governanca">
        <div className="rs-governance-pattern" />
        <div className="rs-container rs-governance-grid">
          <div>
            <SectionLabel>INTELIGÊNCIA COM GOVERNANÇA</SectionLabel>
            <h2>Automatizar não é suficiente. É preciso saber o que está sendo executado.</h2>
            <p className="rs-governance-lead">
              A inteligência artificial amplia as possibilidades de análise e
              execução. Em operações reais, porém, velocidade precisa caminhar
              junto com critérios, limites e responsabilidade.
            </p>
            <div className="rs-governance-quote">
              “A inteligência deve ampliar a capacidade operacional das pessoas,
              não eliminar a responsabilidade sobre as decisões.”
            </div>
          </div>
          <div className="rs-governance-list">
            {governance.map((item, index) => (
              <article key={item.title}>
                <span>0{index + 1}</span>
                <div><h3>{item.title}</h3><p>{item.text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rs-section rs-ecosystem">
        <div className="rs-container rs-ecosystem-grid">
          <div>
            <SectionLabel>INTEGRAÇÃO OPERACIONAL</SectionLabel>
            <h2>Não é necessário reconstruir sua operação para começar a organizá-la.</h2>
            <p>
              A adoção pode partir de uma necessidade específica, considerando
              os sistemas, processos e condições de integração disponíveis.
              O ponto de partida é a realidade da empresa — não uma
              transformação tecnológica indiscriminada.
            </p>
          </div>
          <div className="rs-ecosystem-visual">
            <div className="rs-ecosystem-sources">
              <span>ERP</span><span>SISTEMAS</span><span>DOCUMENTOS</span><span>DADOS</span>
            </div>
            <div className="rs-ecosystem-lines"><i /><i /><i /><i /></div>
            <div className="rs-ecosystem-core">
              <span>CAMADA DE GOVERNANÇA</span><strong>RSBUILD OS</strong>
            </div>
            <div className="rs-ecosystem-lines rs-ecosystem-lines-down"><i /><i /><i /><i /></div>
            <div className="rs-ecosystem-outcomes">
              <span>PROCESSOS</span><span>VALIDAÇÕES</span><span>GOVERNANÇA</span><span>ACOMPANHAMENTO</span>
            </div>
            <small>Arquitetura ilustrativa. Integrações dependem de avaliação técnica e escopo.</small>
          </div>
        </div>
      </section>

      <section className="rs-section rs-implementation">
        <div className="rs-container">
          <div className="rs-section-intro rs-intro-centered">
            <SectionLabel>IMPLEMENTAÇÃO PROGRESSIVA</SectionLabel>
            <h2>Comece pelo problema. Estruture a solução a partir da operação.</h2>
            <p>
              Uma abordagem progressiva permite avaliar a aderência da solução
              antes de ampliar sua utilização.
            </p>
          </div>
          <div className="rs-implementation-grid">
            {implementation.map((item) => (
              <article key={item.number}>
                <span>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rs-final-cta" id="diagnostico">
        <div className="rs-final-pattern" />
        <div className="rs-container rs-final-inner">
          <SectionLabel>PRÓXIMO PASSO</SectionLabel>
          <h2>Sua operação pode estar pronta para evoluir.</h2>
          <p>
            Conte-nos sobre sua empresa, seus processos e os desafios que deseja
            resolver. Vamos avaliar onde uma camada de governança operacional
            pode gerar valor.
          </p>
          <a className="rs-button rs-button-primary rs-button-large" href={mailto}>
            Solicitar diagnóstico operacional <ArrowIcon />
          </a>
          <span className="rs-final-footnote">Uma conversa inicial para compreender a operação e avaliar possibilidades.</span>
        </div>
      </section>

      <footer className="rs-footer">
        <div className="rs-container">
          <div className="rs-footer-main">
            <div className="rs-footer-brand">
              <Image src="/brand/rsbuild-logo-primary.svg" alt="RSBUILD" width={150} height={44} />
              <p>Governança para operações que precisam evoluir.</p>
            </div>
            <div className="rs-footer-links">
              <div><strong>PLATAFORMA</strong><Link href="#plataforma">A plataforma</Link><Link href="#funcionamento">Como funciona</Link><Link href="#frentes">Frentes de atuação</Link></div>
              <div><strong>CONHEÇA</strong><Link href="#governanca">Governança</Link><Link href="#diagnostico">Diagnóstico operacional</Link><a href="https://rsbuild.com.br" target="_blank" rel="noreferrer">RSBUILD <ArrowIcon diagonal /></a></div>
            </div>
          </div>
          <div className="rs-footer-bottom">
            <span>© {new Date().getFullYear()} RSBUILD. Todos os direitos reservados.</span>
            <span>RSBUILD OS · Plataforma em evolução</span>
          </div>
          <p className="rs-footer-disclaimer">
            As funcionalidades, integrações e capacidades disponíveis variam
            conforme o estágio de desenvolvimento e o escopo de cada implementação.
          </p>
        </div>
      </footer>
    </main>
  );
}
