"use client";
import { useMemo, useState } from "react";
import type { FinancialRecord } from "@/lib/finance";

type Props = { records: FinancialRecord[]; onOpenReconciliation: (recordIds: string[]) => void; canOpenReconciliation: boolean };
const money = (value:number) => value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function OperacoesLoteView({records,onOpenReconciliation,canOpenReconciliation}:Props) {
 const [status,setStatus]=useState("pendente");
 const [direction,setDirection]=useState("todos");
 const [query,setQuery]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const filtered=useMemo(()=>records.filter(r=>(status==="todos"||r.status===status)&&(direction==="todos"||r.direction===direction)&&(!query.trim()||[r.description,r.bankName,r.source,r.importBatchId].some(v=>String(v??"").toLowerCase().includes(query.trim().toLowerCase())))),[records,status,direction,query]);
 const chosen=useMemo(()=>records.filter(r=>selected.includes(r.id)),[records,selected]);
 const incoming=chosen.filter(r=>r.direction==="entrada").reduce((n,r)=>n+r.amount,0);
 const outgoing=chosen.filter(r=>r.direction==="saída").reduce((n,r)=>n+r.amount,0);
 const all=filtered.length>0&&filtered.every(r=>selected.includes(r.id));
 const visibleSelectedCount=filtered.filter(r=>selected.includes(r.id)).length;
 const hasFilters=Boolean(query.trim()||status!=="pendente"||direction!=="todos");
 const clearFilters=()=>{setQuery("");setStatus("pendente");setDirection("todos");};
 const toggleAll=()=>setSelected(old=>all?old.filter(id=>!filtered.some(r=>r.id===id)):Array.from(new Set([...old,...filtered.map(r=>r.id)])));
 return <div className="bulk-operations-page">
  <header className="page-heading"><div><div className="eyebrow">GOVERNANÇA FINANCEIRA · OPERAÇÕES</div><h1>Centro de Operações em Lote</h1><p>Selecione movimentações, confira o impacto e encaminhe conjuntos para conciliação.</p></div></header>
  <section className="stats-grid"><article className="stat-card"><span>Movimentações</span><strong>{records.length}</strong></article><article className="stat-card"><span>Pendentes</span><strong>{records.filter(r=>r.status==="pendente").length}</strong></article><article className="stat-card"><span>Selecionadas</span><strong>{chosen.length}</strong></article></section>
  <section className="panel" style={{padding:18,display:"grid",gap:14}}><div className="panel-heading"><div><h2>Composição do lote</h2><p>A seleção é uma prévia. Nenhum registro é alterado nesta etapa.</p></div><span className="bulk-selection-total">{selected.length} selecionado(s)</span></div>
   <div className="bulk-filter-panel"><div className="bulk-filters"><label>Buscar<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Descrição, banco ou lote" aria-label="Buscar movimentações do lote"/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="pendente">Pendentes</option><option value="conciliado">Conciliados</option><option value="todos">Todos</option></select></label><label>Direção<select value={direction} onChange={e=>setDirection(e.target.value)}><option value="todos">Entradas e saídas</option><option value="entrada">Entradas</option><option value="saída">Saídas</option></select></label></div>{hasFilters&&<button type="button" className="text-button" onClick={clearFilters}>Restaurar filtros padrão</button>}</div>
   <div className="bulk-selection-bar"><div className="bulk-selection-status"><strong aria-live="polite">{visibleSelectedCount} de {filtered.length}</strong><span>registros visíveis selecionados</span><small>{selected.length} selecionado(s) no total, incluindo itens fora dos filtros atuais</small></div><div className="bulk-selection-actions"><button type="button" className="secondary-button" onClick={toggleAll} disabled={!filtered.length}>{all?"Desmarcar visíveis":"Selecionar visíveis"}</button><button type="button" className="text-button" onClick={()=>setSelected([])} disabled={!selected.length}>Limpar seleção</button></div></div>
   <div className="bulk-table-wrap" role="region" aria-label="Movimentações filtradas para o lote" tabIndex={0}><table className="data-table"><thead><tr><th></th><th>Data</th><th>Movimentação</th><th>Origem</th><th>Direção</th><th>Valor</th><th>Status</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><input type="checkbox" aria-label={`Selecionar ${r.description}`} checked={selected.includes(r.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))}/></td><td>{r.date}</td><td>{r.description}</td><td>{r.bankName||r.source||"Origem não identificada"}</td><td>{r.direction}</td><td>{money(r.amount)}</td><td>{r.status}</td></tr>)}{!filtered.length&&<tr><td colSpan={7} style={{textAlign:"center",padding:28}}>Nenhuma movimentação corresponde aos filtros.</td></tr>}</tbody></table></div>
  </section>
  <section className="panel" style={{padding:18,display:"grid",gap:14}}><div><h2>Prévia e governança</h2><p>O status financeiro não será alterado pelo Centro de Operações.</p></div><div className="stats-grid"><article className="stat-card"><span>Entradas</span><strong>{money(incoming)}</strong></article><article className="stat-card"><span>Saídas</span><strong>{money(outgoing)}</strong></article><article className="stat-card"><span>Saldo líquido</span><strong>{money(incoming-outgoing)}</strong></article></div><div className="bulk-selection-bar"><small>O encaminhamento abre o módulo de conciliação. A aprovação em lote de decisões exige evidência e trilha de auditoria.</small><button className="primary-button" onClick={()=>onOpenReconciliation(chosen.map(record=>record.id))} disabled={!chosen.length||!canOpenReconciliation}>Abrir Conciliação ({chosen.length})</button></div></section>
 </div>;
}