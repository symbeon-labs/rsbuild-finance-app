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
 const r=runDreEngine([record("1","PIX saída fornecedor","saída",100.01)],{"1":{accountCode:"COGS_MERCH",reason:"Nota fiscal validada"}});
 const allocations=r.classifications[0].allocations;
 assert.equal(allocations.reduce((s,a)=>s+a.amountMinor,0),10001);
 assert.equal(r.summary.pnl,1);
});
test("ambiguous transaction stays in review",()=>{
 const r=runDreEngine([record("1","Pagamento diversos","saída",75)]);
 assert.equal(r.summary.review,1);assert.equal(r.classifications[0].allocations.length,0);
});
