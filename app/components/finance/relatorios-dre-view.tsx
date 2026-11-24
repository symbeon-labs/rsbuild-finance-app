"use client";
import { useEffect, useMemo, useState } from "react";
import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { DreSourceStructure } from "@/app/components/finance/dre-source-structure";
import { DreDataStudioImport } from "@/app/components/finance/dre-data-studio-import";
import { DRE_ACCOUNTS, partitionDreRecords, runDreEngine, type DreOverride, type DreUnit } from "@/lib/dre-engine";

interface Props { records: FinancialRecord[]; organizationId: string; isLoading?: boolean; periodLabel?: string }
type Totals = { incoming: number; outgoing: number; result: number; count: number };
const money = (n: number) => n.toFixed(2).replace(".", ",");
const monthName = (key: string) => { const [y,m] = key.split("-"); return new Date(Number(y), Number(m)-1, 1).toLocaleDateString("pt-BR", {month:"long",year:"numeric"}); };
function exportCsv(rows: string[][]) {
 const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
 const blob = new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="dre-gerencial-base-caixa.csv"; a.click(); URL.revokeObjectURL(url);
}
type SavedClassification = { financial_record_id: string; account_code: string; allocations: Array<{unit:DreUnit;amountMinor:number}>; reason: string; status: string; source: string };
type ReviewDraft = { accountCode: string; unit: string; reason: string };
export function RelatoriosDreView({records,organizationId,isLoading=false,periodLabel="Período selecionado"}:Props) {
 const [saved,setSaved]=useState<Record<string,SavedClassification>>({});
 const [drafts,setDrafts]=useState<Record<string,ReviewDraft>>({});
 const [saving,setSaving]=useState<string|null>(null);
 const [saveError,setSaveError]=useState<string|null>(null);
 const [selectedReview,setSelectedReview]=useState<string[]>([]);
 useEffect(()=>{
  let active=true;
  fetch("/api/dre-classifications?organizationId="+encodeURIComponent(organizationId),{cache:"no-store"})
   .then(async response=>{if(!response.ok)throw new Error("Não foi possível carregar as classificações salvas.");return response.json();})
   .then(payload=>{if(!active)return;const next:Record<string,SavedClassification>={};for(const item of payload.classifications??[])next[item.financial_record_id]=item;setSaved(next);})
   .catch(()=>{if(active)setSaveError("Não foi possível carregar o histórico de classificações.");});
  return ()=>{active=false;};
 },[organizationId]);
 const overrides=useMemo(()=>{
  const result:Record<string,DreOverride>={};
  for(const [recordId,item] of Object.entries(saved)){
   if(item.source!=="manual"||!["overridden","excluded"].includes(item.status))continue;
   result[recordId]={accountCode:item.account_code,unit:item.allocations?.length===1?item.allocations[0].unit:undefined,reason:item.reason};
  }
  return result;
 },[saved]);
 const [year,setYear]=useState("all");
 // OFX saldo snapshots are informational balances, not financial movements.
 const recordPartition=useMemo(()=>partitionDreRecords(records),[records]);
 const movementRecords=useMemo(()=>recordPartition.valid.filter(record=>{
  const description=record.description.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR").replace(/\s+/g," ").trim();
  return !/\bSALDO (?:TOTAL )?DISPONIVEL DIA\b|\bSALDO (?:ANTERIOR|INICIAL|DE ABERTURA)\b/.test(description);
 }),[recordPartition]);
 const years=useMemo(()=>[...new Set(movementRecords.map(r=>r.date.slice(0,4)))].sort().reverse(),[movementRecords]);
 const rows=useMemo(()=>movementRecords.filter(r=>year==="all"||r.date.startsWith(year)),[movementRecords,year]);
 const dreEngine=useMemo(()=>runDreEngine(rows,overrides),[rows,overrides]);
 const totals=useMemo<Totals>(()=>rows.reduce((a,r)=>{if(r.direction==="entrada")a.incoming+=Math.abs(r.amount);else a.outgoing+=Math.abs(r.amount);a.count++;a.result=a.incoming-a.outgoing;return a;},{incoming:0,outgoing:0,result:0,count:0}),[rows]);
 const categories=useMemo(()=>{const map=new Map<string,{direction:string;category:string;amount:number;count:number}>();rows.forEach(r=>{const category=r.category?.trim()||"Não classificado";const key=r.direction+"|"+category;const v=map.get(key)||{direction:r.direction,category,amount:0,count:0};v.amount+=Math.abs(r.amount);v.count++;map.set(key,v)});return [...map.values()].sort((a,b)=>b.amount-a.amount)},[rows]);
 const months=useMemo(()=>{const map=new Map<string,{incoming:number;outgoing:number;count:number}>();rows.forEach(r=>{const k=r.date.slice(0,7);const v=map.get(k)||{incoming:0,outgoing:0,count:0};if(r.direction==="entrada")v.incoming+=Math.abs(r.amount);else v.outgoing+=Math.abs(r.amount);v.count++;map.set(k,v)});return [...map.entries()].sort(([a],[b])=>a.localeCompare(b))},[rows]);
 const onExport=()=>exportCsv([["Natureza","Categoria","Registros","Valor BRL"],...categories.map(c=>[c.direction==="entrada"?"Entrada":"Saída",c.category,String(c.count),money(c.amount)]),[],["Resumo","Valor BRL"],["Entradas",money(totals.incoming)],["Saídas",money(totals.outgoing)],["Resultado líquido de caixa",money(totals.result)],[],["Mês","Entradas","Saídas","Resultado","Registros"],...months.map(([m,v])=>[m,money(v.incoming),money(v.outgoing),money(v.incoming-v.outgoing),String(v.count)])]);
 return <>
 <div className="page-heading dre-page-heading"><div><div className="eyebrow">DESEMPENHO FINANCEIRO</div><h1>DRE Gerencial</h1><p>Visão executiva do resultado de caixa e da qualidade da classificação financeira.</p></div><button className="secondary-button" onClick={onExport} disabled={!rows.length}>Exportar CSV</button></div>
 {recordPartition.invalidCount>0&&<div className="quality-footnote" role="alert" style={{marginBottom:14}}>Atenção: {recordPartition.invalidCount} registro(s) com data, valor, natureza ou identificador inválido foram isolados e não entraram nos cálculos da DRE. Revise a origem desses lançamentos antes de utilizá-los no fechamento.</div>}
 <section className="panel dre-criteria"><div className="panel-heading"><div><span className="dre-section-kicker">ESCOPO DO RELATÓRIO</span><h2>Critérios do demonstrativo</h2><p>Base de caixa <span className="dre-dot"/> {periodLabel}</p></div><label className="dre-period-control">Exercício<select className="filter-select" value={year} onChange={e=>setYear(e.target.value)}><option value="all">Todo o período</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div><p className="dre-method-note">Este demonstrativo consolida movimentações pela data bancária. Não substitui a DRE contábil por competência nem a apuração fiscal. Transferências, empréstimos, aportes e estornos exigem identificação e tratamento próprio antes de serem considerados receita ou despesa.</p></section>
 <DreDataStudioImport />
 {isLoading?<section className="panel"><div className="table-empty">Carregando movimentações financeiras…</div></section>:!rows.length?<section className="panel"><div className="table-empty"><strong>Sem movimentações financeiras para consolidar.</strong><p>Importe e valide extratos neste ambiente QA. Nenhum valor será inventado ou preenchido por dados sintéticos.</p></div></section>:<>
 <section className="dre-kpi-grid" aria-label="Indicadores financeiros">
  <article className="dre-kpi dre-kpi--income"><span className="dre-kpi-label">Entradas financeiras</span><strong>{formatCurrency(totals.incoming)}</strong><small>{rows.filter(r=>r.direction==="entrada").length} lançamentos no período</small></article>
  <article className="dre-kpi dre-kpi--expense"><span className="dre-kpi-label">Saídas financeiras</span><strong>{formatCurrency(totals.outgoing)}</strong><small>{rows.filter(r=>r.direction==="saída").length} lançamentos no período</small></article>
  <article className={`dre-kpi ${totals.result>=0?"dre-kpi--result-positive":"dre-kpi--result-negative"}`}><span className="dre-kpi-label">Resultado líquido de caixa</span><strong>{formatCurrency(totals.result)}</strong><small>Entradas menos saídas</small></article>
  <article className="dre-kpi dre-kpi--volume"><span className="dre-kpi-label">Movimentações consideradas</span><strong>{totals.count.toLocaleString("pt-BR")}</strong><small>{rows.filter(r=>!r.category?.trim()).length} sem categoria de origem</small></article>
 </section>
 <section className="panel" style={{marginTop:18}}><div className="panel-heading"><div><h2>Composição por classificação</h2><p>Categoria recebida na origem; sem reclassificação automática</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Natureza</th><th>Categoria</th><th>Registros</th><th style={{textAlign:"right"}}>Total</th></tr></thead><tbody>{categories.map(c=><tr key={c.direction+c.category}><td>{c.direction==="entrada"?"Entrada":"Saída"}</td><td>{c.category}</td><td>{c.count}</td><td style={{textAlign:"right"}}>{formatCurrency(c.amount)}</td></tr>)}</tbody></table></div></section>
 <section className="panel dre-panel" style={{marginTop:18}}><div className="panel-heading"><div><span className="dre-section-kicker">TENDÊNCIA</span><h2>Evolução mensal</h2><p>Entradas e saídas pela data de movimentação</p></div><span className="dre-legend"><i className="dre-legend-income"/> Entradas <i className="dre-legend-expense"/> Saídas</span></div>
  <div className="dre-month-chart" role="img" aria-label="Comparação mensal entre entradas e saídas">{months.map(([m,v])=>{const max=Math.max(v.incoming,v.outgoing,1);return <div className="dre-month-row" key={m}><span className="dre-month-label">{monthName(m).replace(" de ","/")}</span><div className="dre-month-bars"><div className="dre-bar dre-bar--income" style={{width:`${v.incoming/max*100}%`}}/><div className="dre-bar dre-bar--expense" style={{width:`${v.outgoing/max*100}%`}}/></div><strong className={v.incoming-v.outgoing>=0?"positive":"negative"}>{formatCurrency(v.incoming-v.outgoing)}</strong></div>})}</div>
  <div className="table-wrap dre-month-table"><table className="data-table"><thead><tr><th>Mês</th><th style={{textAlign:"right"}}>Entradas</th><th style={{textAlign:"right"}}>Saídas</th><th style={{textAlign:"right"}}>Resultado</th><th>Registros</th></tr></thead><tbody>{months.map(([m,v])=><tr key={m}><td style={{textTransform:"capitalize"}}>{monthName(m)}</td><td style={{textAlign:"right"}}>{formatCurrency(v.incoming)}</td><td style={{textAlign:"right"}}>{formatCurrency(v.outgoing)}</td><td className={v.incoming-v.outgoing>=0?"positive":"negative"} style={{textAlign:"right"}}>{formatCurrency(v.incoming-v.outgoing)}</td><td>{v.count}</td></tr>)}</tbody></table></div></section></>}
 <section className="panel" style={{marginTop:18}}>
  <div className="panel-heading"><div><span className="dre-section-kicker">GOVERNANÇA DOS LANÇAMENTOS</span><h2>Classificação gerencial</h2><p>Estados do motor de classificação — independentes da categoria recebida na origem.</p></div><span className="status-badge">{dreEngine.summary.review.toLocaleString("pt-BR")} pendentes</span></div>
  <div className="metric-grid">
   <div className="metric-card"><span>Classificações aprováveis</span><strong>{dreEngine.summary.classified}</strong><small>Com unidade/rateio definido</small></div>
   <div className="metric-card"><span>Em revisão humana</span><strong>{dreEngine.summary.review}</strong><small>Não entram na DRE</small></div>
   <div className="metric-card"><span>Fora da DRE</span><strong>{dreEngine.summary.excluded}</strong><small>Transferências e estornos</small></div>
   <div className="metric-card"><span>Tratamentos especiais</span><strong>{dreEngine.summary.financing+dreEngine.summary.balanceSheet+dreEngine.summary.equity+dreEngine.summary.receivable}</strong><small>Financiamento, ativo, sócios e recebíveis</small></div>
  </div>
  <div className="quality-footnote" style={{marginTop:12}}>A sugestão automática não equivale a lançamento contábil aprovado. Só entram na prévia da DRE as classificações com regra e alocação de unidade documentadas. Categorias sem rateio de origem permanecem pendentes; o motor não inventa percentuais.</div>
  {dreEngine.pnl.length>0&&<><h3 style={{marginTop:18}}>Prévia por rubrica e unidade</h3><div className="table-wrap dre-breakdown-wrap"><table className="data-table dre-breakdown-table"><thead><tr><th>Unidade</th><th>Grupo</th><th>Rubrica</th><th>Registros</th><th style={{textAlign:"right"}}>Valor</th></tr></thead><tbody>
   {dreEngine.pnl.map((item)=><tr key={item.account.code+item.unit}><td>{item.unit}</td><td>{item.account.group}</td><td>{item.account.label}</td><td>{item.count}</td><td style={{textAlign:"right"}}>{formatCurrency(item.amountMinor/100)}</td></tr>)}
  </tbody></table></div></>}
  {saveError&&<div className="quality-footnote" role="alert" style={{marginTop:12}}>{saveError}</div>}
  <div className="quality-footnote" style={{marginTop:10}}>Classificações manuais ficam vinculadas ao lançamento, ao usuário autenticado e à versão da regra. Cada alteração gera um evento histórico; o histórico não é editável pela interface.</div>
  {dreEngine.summary.review>0&&<><h3 style={{marginTop:18}}>Fila de revisão · primeiros 30 registros</h3><div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",margin:"12px 0"}}><label><input type="checkbox" checked={dreEngine.classifications.filter(i=>i.status==="review").slice(0,30).length>0&&dreEngine.classifications.filter(i=>i.status==="review").slice(0,30).every(i=>selectedReview.includes(i.recordId))} onChange={e=>setSelectedReview(e.target.checked?dreEngine.classifications.filter(i=>i.status==="review").slice(0,30).map(i=>i.recordId):[])}/> Selecionar todos os 30</label><span>{selectedReview.length} selecionado(s)</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th></th><th>Data</th><th>Descrição</th><th>Rubrica</th><th>Unidade</th><th>Justificativa</th><th>Ação</th></tr></thead><tbody>
   {dreEngine.classifications.filter(item=>item.status==="review").slice(0,30).map(item=>{const record=rows.find(r=>r.id===item.recordId);const draft=drafts[item.recordId]??{accountCode:item.account?.code??"",unit:"",reason:"Classificação revisada por responsável financeiro."};return <tr key={item.recordId}>
    <td><input type="checkbox" aria-label={`Selecionar ${record?.description??item.recordId}`} checked={selectedReview.includes(item.recordId)} onChange={e=>setSelectedReview(v=>e.target.checked?[...v,item.recordId]:v.filter(id=>id!==item.recordId))}/></td><td>{record?.date??"—"}</td><td>{record?.description??item.recordId}<small style={{display:"block"}}>{item.reason}</small></td>
    <td><select className="filter-select" value={draft.accountCode} onChange={e=>setDrafts(v=>({...v,[item.recordId]:{...draft,accountCode:e.target.value}}))}><option value="">Selecione</option>{DRE_ACCOUNTS.map(account=><option key={account.code} value={account.code}>{account.label}</option>)}</select></td>
    <td><select className="filter-select" value={draft.unit} onChange={e=>setDrafts(v=>({...v,[item.recordId]:{...draft,unit:e.target.value}}))}><option value="">Rateio documentado</option><option value="ALS/CSN">ALS/CSN</option><option value="P&L">P&L</option><option value="RRT">RRT</option></select></td>
    <td><input className="filter-select" style={{minWidth:190}} value={draft.reason} maxLength={2000} onChange={e=>setDrafts(v=>({...v,[item.recordId]:{...draft,reason:e.target.value}}))} aria-label="Justificativa da classificação"/></td>
    <td><button className="secondary-button" disabled={saving===item.recordId||!draft.accountCode||!draft.reason.trim()} onClick={async()=>{setSaving(item.recordId);setSaveError(null);try{const response=await fetch("/api/dre-classifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,recordId:item.recordId,accountCode:draft.accountCode,unit:draft.unit||undefined,reason:draft.reason})});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Falha ao salvar.");setSaved(v=>({...v,[item.recordId]:{financial_record_id:item.recordId,account_code:payload.classification.accountCode,allocations:payload.classification.allocations,reason:draft.reason,status:payload.classification.status,source:"manual"}}));}catch(error){setSaveError(error instanceof Error?error.message:"Falha ao salvar classificação.");}finally{setSaving(null);}}}>{saving===item.recordId?"Salvando…":"Aprovar classificação"}</button></td>
   </tr>})}
  </tbody></table></div></>}
  {dreEngine.summary.review===0&&<div className="table-empty" style={{marginTop:18}}>Nenhuma classificação pendente de revisão neste período.</div>}
 </section>
 <DreSourceStructure />
 </>;
}