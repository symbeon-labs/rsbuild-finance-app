"use client";

import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { Metric, EmptyState, RecordTable } from "./common";

interface VisaoGeralViewProps {
  records: FinancialRecord[];
  totals: { incoming: number; outgoing: number; balance: number };
  onNavigateToMovimentacoes: () => void;
  onOpenImport: () => void;
}

export function VisaoGeralView({
  records,
  totals,
  onNavigateToMovimentacoes,
  onOpenImport
}: VisaoGeralViewProps) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PAINEL FINANCEIRO</div>
          <h1>Visão geral</h1>
          <p>Acompanhe a movimentação e a posição financeira da empresa.</p>
        </div>
        <button className="primary-button" onClick={onOpenImport}>
          <span>＋</span> Importar movimentações
        </button>
      </div>

      <div className="metric-grid">
        <Metric
          label="Entradas no período"
          value={formatCurrency(totals.incoming)}
          tone="positive"
          detail={records.length ? "Registros importados nesta sessão" : "Aguardando dados"}
          icon="↙"
        />
        <Metric
          label="Saídas no período"
          value={formatCurrency(totals.outgoing)}
          tone="negative"
          detail={records.length ? "Registros importados nesta sessão" : "Aguardando dados"}
          icon="↗"
        />
        <Metric
          label="Resultado do período"
          value={formatCurrency(totals.balance)}
          tone="neutral"
          detail="Entradas menos saídas"
          icon="＝"
        />
        <Metric
          label="Movimentações"
          value={String(records.length)}
          tone="neutral"
          detail={records.filter((item) => item.status === "pendente").length + " pendentes de revisão"}
          icon="▤"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Movimentação financeira</h2>
              <p>Consolidação dos registros importados</p>
            </div>
            <span className="subtle-tag">BRL</span>
          </div>
          {records.length ? (
            <div className="activity-summary">
              <div>
                <span>Entradas</span>
                <strong className="positive">{formatCurrency(totals.incoming)}</strong>
              </div>
              <div>
                <span>Saídas</span>
                <strong className="negative">{formatCurrency(totals.outgoing)}</strong>
              </div>
              <div>
                <span>Saldo líquido</span>
                <strong>{formatCurrency(totals.balance)}</strong>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="⌁"
              title="Ainda não há movimentações"
              text="Importe um extrato bancário para começar a visualizar a posição financeira."
              action="Importar extrato"
              onAction={onOpenImport}
            />
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Qualidade dos dados</h2>
              <p>Situação dos registros carregados</p>
            </div>
          </div>
          <div className="quality-row">
            <span>Movimentações importadas</span>
            <strong>{records.length}</strong>
          </div>
          <div className="quality-row">
            <span>Pendentes de revisão</span>
            <strong>{records.filter((item) => item.status === "pendente").length}</strong>
          </div>
          <div className="quality-row">
            <span>Fontes identificadas</span>
            <strong>{new Set(records.map((item) => item.source)).size}</strong>
          </div>
          <div className="quality-footnote">
            A classificação e a conciliação serão habilitadas conforme a configuração das fontes.
          </div>
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>Movimentações recentes</h2>
            <p>Últimos registros adicionados</p>
          </div>
          <button className="text-button" onClick={onNavigateToMovimentacoes}>
            Ver todas <span>→</span>
          </button>
        </div>
        {records.length ? (
          <RecordTable records={[...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)} />
        ) : (
          <div className="table-empty">Os registros aparecerão aqui após a primeira importação.</div>
        )}
      </section>
    </>
  );
}

