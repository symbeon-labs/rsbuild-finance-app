import test from "node:test";
import assert from "node:assert/strict";
import { runDreEngine } from "../lib/dre-engine";
import type { FinancialRecord } from "../lib/finance";
const record=(id:string,description:string,direction:"entrada"|"saída",amount:number):FinancialRecord=>({id,date:"2026-11-15",description,direction,amount,category:"Não classificado",source:"QA",status:"pendente"});
test("does not infer revenue from generic PIX or bank transfer",()=>{
 const r=runDreEngine([record("1","PIX recebido","entrada",100),record("2","Transferência entre contas","entrada",200)]);
 assert.equal(r.summary.review,1);assert.equal(r.summary.classified,0);assert.equal(r.classifications[1].account?.code,"TRANSFER");
});
test("classifies explicit sale as revenue suggestion, not a final accounting assertion",()=>{
 const r=runDreEngine([record("1","Venda WhatsApp - cliente","entrada",123.45)]);
 assert.equal(r.classifications[0].account?.code,"REV_SALES");
 assert.equal(r.classifications[0].status,"review");
 assert.equal(r.pnl.length,0);
});
test("keeps financing and asset purchases outside operating expenses",()=>{
 const r=runDreEngine([record("1","Parcela financiamento caminhão","saída",1000),record("2","Compra equipamento","saída",500)]);
 assert.equal(r.summary.financing,1);assert.equal(r.summary.balanceSheet,1);assert.equal(r.pnl.length,0);
});
test("manual override enters P&L and allocates exact integer cents",()=>{
 const r=runDreEngine([record("1","PIX saída fornecedor","saída",100.01)],{"1":{accountCode:"COGS_MERCH",unit:"RRT",reason:"Nota fiscal validada e centro de custo RRT confirmado"}});
 const allocations=r.classifications[0].allocations;
 assert.equal(allocations.reduce((s,a)=>s+a.amountMinor,0),10001);
 assert.equal(r.summary.pnl,1);
});
test("ambiguous transaction stays in review",()=>{
 const r=runDreEngine([record("1","Pagamento diversos","saída",75)]);
 assert.equal(r.summary.review,1);assert.equal(r.classifications[0].allocations.length,0);
});

test("does not invent a default allocation for categories without source-backed percentages",()=>{
 const r=runDreEngine([record("1","Pagamento salário equipe","saída",1000)]);
 assert.equal(r.classifications[0].status,"review");
 assert.equal(r.classifications[0].allocations.length,0);
});
test("uses only explicit cleaning allocation from the source workbook",()=>{
 const r=runDreEngine([record("1","Compra material limpeza","saída",100)]);
 const a=r.classifications[0].allocations;
 assert.equal(r.classifications[0].status,"suggested");
 assert.deepEqual(a.map(x=>[x.unit,x.amountMinor]),[["ALS/CSN",5200],["P&L",1100],["RRT",3700]]);
});

test("manual non-P&L classification does not create operating allocations",()=>{
 const r=runDreEngine([record("1","PIX transferência","entrada",250)],{"1":{accountCode:"LOAN",reason:"Contrato de mútuo conferido"}});
 assert.equal(r.classifications[0].status,"overridden");
 assert.equal(r.classifications[0].allocations.length,0);
 assert.equal(r.pnl.length,0);
});
test("manual exclusion remains outside the operating result",()=>{
 const r=runDreEngine([record("1","Transferência entre contas","entrada",250)],{"1":{accountCode:"TRANSFER",reason:"Movimentação entre contas próprias"}});
 assert.equal(r.classifications[0].status,"excluded");
 assert.equal(r.summary.excluded,1);
 assert.equal(r.pnl.length,0);
});
test("Omie category dictionary classifies non-P&L treatments without rateio",()=>{
 const withCat=(id:string,category:string,direction:"entrada"|"saída",amount:number):FinancialRecord=>({...record(id,"Lançamento importado",direction,amount),category});
 const r=runDreEngine([
  withCat("1","Retirada Sócio","saída",500),
  withCat("2","Saída de Transferência","saída",300),
  withCat("3","Devolução venda feita cliente","saída",120)
 ]);
 assert.equal(r.classifications[0].account?.code,"OWNER_DRAW");
 assert.equal(r.classifications[0].status,"suggested");
 assert.equal(r.classifications[1].status,"excluded");
 assert.equal(r.classifications[2].account?.code,"REFUND");
 assert.equal(r.summary.equity,1);
});
test("Omie category dictionary identifies P&L account but still requires documented rateio",()=>{
 const r=runDreEngine([{...record("1","Pagamento fornecedor","saída",1000),category:"Salários"}]);
 assert.equal(r.classifications[0].account?.code,"PAYROLL");
 assert.equal(r.classifications[0].status,"review");
 assert.equal(r.classifications[0].allocations.length,0);
});
test("unknown or empty category falls back to description rules",()=>{
 const r=runDreEngine([{...record("1","Compra material limpeza","saída",100),category:"Não classificado"}]);
 assert.equal(r.classifications[0].account?.code,"CLEANING");
 assert.equal(r.classifications[0].status,"suggested");
});
