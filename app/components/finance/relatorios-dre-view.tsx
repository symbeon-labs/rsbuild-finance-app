"use client";
import { useEffect, useMemo, useState } from "react";
import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { DreSourceStructure } from "@/app/components/finance/dre-source-structure";
import { DRE_ACCOUNTS, runDreEngine, type DreOverride, type DreUnit } from "@/lib/dre-engine";

interface Props { records: FinancialRecord[]; organizationId: string; isLoading?: boolean; periodLabel?: string }
type Totals = { incoming: number; outgoing: number; result: number; count: number };
const money = (n: number) => n.toFixed(2).replace(".", ",");
const monthName = (key: string) => { const [y,m] = key.split("-"); return new Date(Number(y), Number(m)-1, 1).toLocaleDateString("pt-BR", {month:"long",year:"numeric"}); };
function exportCsv(rows: string[][]) {
 const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
 const blob = new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="dre-gerencial-base-caixa.csv"; a.click(); URL.revokeObjectURL(url);
}
type SavedClassification = { financial_record_id: string; account_code: string; allocations: Array<{unit:DreUnit;amountMinor:number}>; reason: string; status: string };
type ReviewDraft = { accountCode: string; unit: string; reason: string };
export function RelatoriosDreView({records,organizationId,isLoading=false,periodLabel="Período selecionado"}:Props) {
 const [saved,setSaved]=useState<Record<string,SavedClassification>>({});
 const [drafts,setDrafts]=useState<Record<string,ReviewDraft>>({});
 const [saving,setSaving]=useState<string|null>(null);
 const [saveError,setSaveError]=useState<string|null>(null);
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
   if(item.status!=="overridden")continue;
   result[recordId]={accountCode:item.account_code,unit:item.allocations?.length===1?item.allocations[0].unit:undefined,reason:item.reason};
  }
  return result;
 },[saved]);
 const [year,setYear]=useState("all");
 const years=useMemo(()=>[...new Set(records.map(r=>r.date.slice(0,4)))].sort().reverse(),[records]);
 const rows=useMemo(()=>records.filter(r=>year==="all"||r.date.startsWith(year)),[records,year]);
 const dreEngine=useMemo(()=>runDreEngine(rows,overrides),[rows,overrides]);
 const totals=useMemo<Totals>(()=>rows.reduce((a,r)=>{if(r.direction==="entrada")a.incoming+=Math.abs(r.amount);else a.outgoing+=Math.abs(r.amount);a.count++;a.result=a.incoming-a.outgoing;return a;},{incoming:0,outgoing:0,result:0,count:0}),[rows]);
 const categories=useMemo(()=>{const map=new Map<string,{direction:string;category:string;amount:number;count:number}>();rows.forEach(r=>{const category=r.category?.trim()||"Não classificado";const key=r.direction+"|"+category;const v=map.get(key)||{direction:r.direction,category,amount:0,count:0};v.amount+=Math.abs(r.amount);v.count++;map.set(key,v)});return [...map.values()].sort((a,b)=>b.amount-a.amount)},[rows]);
 const months=useMemo(()=>{const map=new Map<string,{incoming:number;outgoing:number;count:number}>();rows.forEach(r=>{const k=r.date.slice(0,7);const v=map.get(k)||{incoming:0,outgoing:0,count:0};if(r.direction==="entrada")v.incoming+=Math.abs(r.amount);else v.outgoing+=Math.abs(r.amount);v.count++;map.set(k,v)});return [...map.entries()].sort(([a],[b])=>a.localeCompare(b))},[rows]);
 const onExport=()=>exportCsv([["Natureza","Categoria","Registros","Valor BRL"],...categories.map(c=>[c.direction==="entrada"?"Entrada":"Saída",c.category,String(c.count),money(c.amount)]),[],["Resumo","Valor BRL"],["Entradas",money(totals.incoming)],["Saídas",money(totals.outgoing)],["Resultado líquido de caixa",money(totals.result)],[],["Mês","Entradas","Saídas","Resultado","Registros"],...months.map(([m,v])=>[m,money(v.incoming),money(v.outgoing),money(v.incoming-v.outgoing),String(v.count)])]);
 return <>
 <div className="page-heading"><div><div className="eyebrow">DESEMPENHO FINANCEIRO</div><h1>DRE Gerencial</h1><p>Demonstrativo preliminar calculado a partir das movimentações financeiras importadas.</p></div><button className="secondary-button" onClick={onExport} disabled={!rows.length}>Exportar CSV</button></div>
 <section className="panel" style={{marginBottom:18}}><div className="panel-heading"><div><h2>Critérios do demonstrativo</h2><p>Base de caixa · {periodLabel}</p></div><label style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>Exercício<select className="filter-select" value={year} onChange={e=>setYear(e.target.value)}><option value="all">Todo o período</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div><div className="quality-footnote">Este relatório consolida entradas e saídas bancárias pela data do movimento. Não equivale à DRE contábil por competência nem à apuração fiscal. Transferências entre contas, empréstimos, aportes, estornos e outras naturezas devem ser identificados e classificados antes de serem tratados como receita ou despesa.</div></section>
 {isLoading?<section className="panel"><div className="table-empty">Carregando movimentações financeiras…</div></section>:!rows.length?<section className="panel"><div className="table-empty"><strong>Sem movimentações financeiras para consolidar.</strong><p>Importe e valide extratos neste ambiente QA. Nenhum valor será inventado ou preenchido por dados sintéticos.</p></div></section>:<>
 <div className="metric-grid"><div className="metric-card"><span>Entradas financeiras</span><strong className="positive">{formatCurrency(totals.incoming)}</strong><small>{rows.filter(r=>r.direction==="entrada").length} registros</small></div><div className="metric-card"><span>Saídas financeiras</span><strong className="negative">{formatCurrency(totals.outgoing)}</strong><small>{rows.filter(r=>r.direction==="saída").length} registros</small></div><div className="metric-card"><span>Resultado líquido de caixa</span><strong>{formatCurrency(totals.result)}</strong><small>Entradas menos saídas</small></div><div className="metric-card"><span>Movimentações consideradas</span><strong>{totals.count}</strong><small>{rows.filter(r=>!r.category?.trim()).length} sem categoria</small></div></div>
 <section className="panel" style={{marginTop:18}}><div className="panel-heading"><div><h2>Composição por classificação</h2><p>Categoria recebida na origem; sem reclassificação automática</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Natureza</th><th>Categoria</th><th>Registros</th><th style={{textAlign:"right"}}>Total</th></tr></thead><tbody>{categories.map(c=><tr key={c.direction+c.category}><td>{c.direction==="entrada"?"Entrada":"Saída"}</td><td>{c.category}</td><td>{c.count}</td><td style={{textAlign:"right"}}>{formatCurrency(c.amount)}</td></tr>)}</tbody></table></div></section>
 <section className="panel" style={{marginTop:18}}><div className="panel-heading"><div><h2>Evolução mensal</h2><p>Consolidação por mês de movimentação</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Mês</th><th style={{textAlign:"right"}}>Entradas</th><th style={{textAlign:"right"}}>Saídas</th><th style={{textAlign:"right"}}>Resultado</th><th>Registros</th></tr></thead><tbody>{months.map(([m,v])=><tr key={m}><td style={{textTransform:"capitalize"}}>{monthName(m)}</td><td style={{textAlign:"right"}}>{formatCurrency(v.incoming)}</td><td style={{textAlign:"right"}}>{formatCurrency(v.outgoing)}</td><td style={{textAlign:"right"}}>{formatCurrency(v.incoming-v.outgoing)}</td><td>{v.count}</td></tr>)}</tbody></table></div></section></>}
 <section className="panel" style={{marginTop:18}}>
  <div className="panel-heading"><div><h2>Motor de classificação gerencial</h2><p>Regras determinísticas, rastreáveis e sem rateio presumido.</p></div><span className="status-badge">{dreEngine.summary.review} para revisão</span></div>
  <div className="metric-grid">
   <div className="metric-card"><span>Classificações aprováveis</span><strong>{dreEngine.summary.classified}</strong><small>Com unidade/rateio definido</small></div>
   <div className="metric-card"><span>Em revisão humana</span><strong>{dreEngine.summary.review}</strong><small>Não entram na DRE</small></div>
   <div className="metric-card"><span>Fora da DRE</span><strong>{dreEngine.summary.excluded}</strong><small>Transferências e estornos</small></div>
   <div className="metric-card"><span>Tratamentos especiais</span><strong>{dreEngine.summary.financing+dreEngine.summary.balanceSheet+dreEngine.summary.equity+dreEngine.summary.receivable}</strong><small>Financiamento, ativo, sócios e recebíveis</small></div>
  </div>
  <div className="quality-footnote" style={{marginTop:12}}>A sugestão automática não equivale a lançamento contábil aprovado. Só entram na prévia da DRE as classificações com regra e alocação de unidade documentadas. Categorias sem rateio de origem permanecem pendentes; o motor não inventa percentuais.</div>
  {dreEngine.pnl.length>0&&<><h3 style={{marginTop:18}}>Prévia por rubrica e unidade</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Unidade</th><th>Grupo</th><th>Rubrica</th><th>Registros</th><th style={{textAlign:"right"}}>Valor</th></tr></thead><tbody>
   {dreEngine.pnl.map((item)=><tr key={item.account.code+item.unit}><td>{item.unit}</td><td>{item.account.group}</td><td>{item.account.label}</td><td>{item.count}</td><td style={{textAlign:"right"}}>{formatCurrency(item.amountMinor/100)}</td></tr>)}
  </tbody></table></div></>}
  {saveError&&<div className="quality-footnote" role="alert" style={{marginTop:12}}>{saveError}</div>}
  <div className="quality-footnote" style={{marginTop:10}}>Classificações manuais ficam vinculadas ao lançamento, ao usuário autenticado e à versão da regra. Cada alteração gera um evento histórico; o histórico não é editável pela interface.</div>
  {dreEngine.summary.review>0&&<><h3 style={{marginTop:18}}>Fila de revisão · primeiros 30 registros</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Descrição</th><th>Rubrica</th><th>Unidade</th><th>Justificativa</th><th>Ação</th></tr></thead><tbody>
   {dreEngine.classifications.filter(item=>item.status==="review").slice(0,30).map(item=>{const record=rows.find(r=>r.id===item.recordId);const draft=drafts[item.recordId]??{accountCode:item.account?.code??"",unit:"",reason:"Classificação revisada por responsável financeiro."};return <tr key={item.recordId}>
    <td>{record?.date??"—"}</td><td>{record?.description??item.recordId}<small style={{display:"block"}}>{item.reason}</small></td>
    <td><select className="filter-select" value={draft.accountCode} onChange={e=>setDrafts(v=>({...v,[item.recordId]:{...draft,accountCode:e.target.value}}))}><option value="">Selecione</option>{DRE_ACCOUNTS.map(account=><option key={account.code} value={account.code}>{account.label}</option>)}</select></td>
    <td><select className="filter-select" value={draft.unit} onChange={e=>setDrafts(v=>({...v,[item.recordId]:{...draft,unit:e.target.value}}))}><option value="">Rateio documentado</option><option value="ALS/CSN">ALS/CSN</option><option value="P&L">P&L</option><option value="RRT">RRT</option></select></td>
    <td><input className="filter-select" style={{minWidth:190}} value={draft.reason} maxLength={2000} onChange={e=>setDrafts(v=>({...v,[item.recordId]:{...draft,reason:e.target.value}}))} aria-label="Justificativa da classificação"/></td>
    <td><button className="secondary-button" disabled={saving===item.recordId||!draft.accountCode||!draft.reason.trim()} onClick={async()=>{setSaving(item.recordId);setSaveError(null);try{const response=await fetch("/api/dre-classifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,recordId:item.recordId,accountCode:draft.accountCode,unit:draft.unit||undefined,reason:draft.reason})});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Falha ao salvar.");setSaved(v=>({...v,[item.recordId]:{financial_record_id:item.recordId,account_code:payload.classification.accountCode,allocations:payload.classification.allocations,reason:draft.reason,status:"overridden"}}));}catch(error){setSaveError(error instanceof Error?error.message:"Falha ao salvar classificação.");}finally{setSaving(null);}}}>{saving===item.recordId?"Salvando…":"Aprovar classificação"}</button></td>
   </tr>})}
  </tbody></table></div></>}
  {dreEngine.summary.review===0&&<div className="table-empty" style={{marginTop:18}}>Nenhuma classificação pendente de revisão neste período.</div>}
 </section>
 <DreSourceStructure />
 </>;
}