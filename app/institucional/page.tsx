import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "RSBUILD OS — Institucional"
};

const MODULES = [
  {
    icon: "💼",
    title: "Finanças & Caixa",
    text: "Ingestão multibanco de extratos, fluxo de caixa consolidado, DRE gerencial e rastreabilidade de importações por hash."
  },
  {
    icon: "🔄",
    title: "Reconciliação & Baixas",
    text: "Motor de correspondência assistida entre extratos e títulos do ERP, com cálculo de encargos e baixa em lote auditável."
  },
  {
    icon: "🚚",
    title: "Logística & Expedição",
    text: "Estruturação de pedidos informais e protocolo digital de canhotos para blindagem de entrega e prevenção de protesto."
  },
  {
    icon: "🛡️",
    title: "Auditoria & Governança",
    text: "Trilha imutável de eventos, registro de acessos negados, sessões e convites — compliance e suporte pericial."
  }
];

const PRINCIPLES = [
  {
    title: "Camada de governança, não substituto de ERP",
    text: "O RSBUILD OS não compete com ERPs ou sistemas de gestão. Ele se integra a eles — Omie, TOTVS, Sankhya e outros — operando a camada que o ERP não oferece: conciliação assistida, prova de entrega, alçadas e visão consolidada da holding."
  },
  {
    title: "Desenvolvimento ético de automação e IA",
    text: "Construímos ferramentas de automação e integração de inteligências artificiais às operações empresariais sob princípios éticos: a IA sugere, organiza e pré-classifica — mas decisões financeiras e operacionais exigem aprovação humana (Human-in-the-Loop). Nenhuma automação executa baixa, conciliação ou alteração de dados sem trilha e, quando aplicável, sem alçada."
  },
  {
    title: "Segurança e proteção de dados",
    text: "Isolamento total entre empresas por Row Level Security no PostgreSQL, autenticação com JWT em cookies HttpOnly, controle de origem e rate limiting em todas as APIs. Menor privilégio por papel (owner, admin, operator, viewer) e trilha append-only gravada exclusivamente no servidor."
  },
  {
    title: "Rastreabilidade como padrão",
    text: "Cada importação, alteração, decisão de conciliação, concessão de acesso e sessão é registrada com autor, organização, timestamp e metadados. O cliente pode auditar quem acessou, quem alterou e quem tentou alterar fora da sua alçada."
  }
];

export default function InstitucionalPage() {
  return (
    <main className="app-shell" style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ width: "min(920px, 100%)", margin: "0 auto", display: "grid", gap: 28 }}>

        <header style={{ textAlign: "center" }}>
          <Link href="/login" aria-label="Voltar ao acesso">
            <Image src="/brand/rsbuild-logo-primary.svg" alt="RSBUILD" width={220} height={70} priority />
          </Link>
          <div className="eyebrow" style={{ marginTop: 18 }}>CAMADA INSTITUCIONAL</div>
          <h1 style={{ margin: "10px 0 12px" }}>O que é o RSBUILD OS</h1>
          <p style={{ color: "var(--muted, #6b7280)", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
            Central integrada de operações para holdings e distribuidoras —
            governança financeira, conciliação e prova operacional sobre os
            sistemas que a empresa já utiliza.
          </p>
        </header>

        <section className="panel" style={{ padding: 28 }}>
          <h2 style={{ marginTop: 0 }}>Posicionamento no mercado</h2>
          <p style={{ lineHeight: 1.7 }}>
            O RSBUILD OS é uma <strong>camada de governança e esteira operacional</strong> que se
            posiciona <strong>entre o ERP e a operação real da empresa</strong>. Ele não substitui
            sistemas de gestão — integra-se a eles via importações estruturadas e APIs.
          </p>
          <p style={{ lineHeight: 1.7 }}>
            Enquanto o ERP registra o que foi lançado, o RSBUILD OS prova o que aconteceu:
            concilia o que entrou no banco com o que deveria ter entrado, documenta a entrega
            física com canhotos digitais, controla alçadas de aprovação e oferece à diretoria
            uma visão consolidada de todas as empresas do grupo — sem contaminar a operação
            de cada uma.
          </p>
        </section>

        <section>
          <h2 style={{ textAlign: "center" }}>Os 4 módulos operacionais</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {MODULES.map((m) => (
              <div key={m.title} className="panel" style={{ padding: 20 }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
                <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{m.title}</h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted, #6b7280)", lineHeight: 1.55 }}>{m.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" style={{ padding: 28 }}>
          <h2 style={{ marginTop: 0 }}>Filosofia de desenvolvimento</h2>
          <div style={{ display: "grid", gap: 20 }}>
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>{p.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--muted, #6b7280)", lineHeight: 1.65 }}>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <footer style={{ textAlign: "center", fontSize: 12, color: "var(--muted, #6b7280)", paddingBottom: 24 }}>
          <p style={{ margin: "0 0 12px" }}>
            Dúvidas sobre a plataforma ou sobre como ela se integra à sua operação?{" "}
            <a href="mailto:suporte@rsbuild.com.br">suporte@rsbuild.com.br</a>
          </p>
          <Link href="/login" style={{ fontWeight: 600 }}>← Voltar ao acesso</Link>
        </footer>
      </div>
    </main>
  );
}
