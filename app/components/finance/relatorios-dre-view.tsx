"use client";
import { useMemo, useState } from "react";
import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { DreSourceStructure } from "@/app/components/finance/dre-source-structure";
import { runDreEngine } from "@/lib/dre-engine";

interface Props { records: FinancialRecord[]; isLoading?: boolean; periodLabel?: string }
type Totals = { incoming: number; outgoing: number; result: number; count: number };
const money = (n: number) => n.toFixed(2).replace(".", ",");
const monthName = (key: string) => { const [y,m] = key.split("-"); return new Date(Number(y), Number(m)-1, 1).toLocaleDateString("pt-BR", {month:"long",year:"numeric"}); };
function exportCsv(rows: string[][]) {
 const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
 const blob = new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="dre-gerencial-base-caixa.csv"; a.click(); URL.revokeObjectURL(url);
}
export function RelatoriosDreView({records,isLoading=false,periodLabel="Período selecionado"}:Props) {
 const [year,setYear]=useState("all");
 const years=useMemo(()=>[...new Set(records.map(r=>r.date.slice(0,4)))].sort().reverse(),[records]);
 const rows=useMemo(()=>records.filter(r=>year==="all"||r.date.startsWith(year)),[records,year]);
 const dreEngine=useMemo(()=>runDreEngine(rows),[rows]);
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
  {dreEngine.summary.review>0&&<><h3 style={{marginTop:18}}>Fila de revisão · primeiros 30 registros</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Descrição</th><th>Sugestão</th><th>Confiança</th><th>Motivo</th></tr></thead><tbody>
   {dreEngine.classifications.filter(item=>item.status==="review").slice(0,30).map(item=>{const record=rows.find(r=>r.id===item.recordId);return <tr key={item.recordId}><td>{record?.date??"—"}</td><td>{record?.description??item.recordId}</td><td>{item.account?.label??"Sem sugestão"}</td><td>{Math.round(item.confidence*100)}%</td><td>{item.reason}</td></tr>})}
  </tbody></table></div></>}
 </section>
 <DreSourceStructure />
 </>;
}