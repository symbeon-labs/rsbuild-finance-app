import { parseOfx, matchRecords, manualMatch, unmatchRecord, type FinancialRecord, type OmieRecord } from "@/lib/finance";

export type ValidationOutcome = { status: "passed" | "failed" | "blocked"; summary: string; checks: { name: string; passed: boolean; detail: string }[] };

const fixture = (bankId: string, org: string, acct: string) => `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL</CURDEF>
<BANKACCTFROM><BANKID>${bankId}</BANKID><ACCTID>${acct}</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261101000000</DTSTART><DTEND>20261130235959</DTEND>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261103120000</DTPOSTED><TRNAMT>1250.75</TRNAMT><FITID>FIT-${org}-001</FITID><NAME>RECEBIMENTO PEDIDO 1001</NAME></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261104120000</DTPOSTED><TRNAMT>-250.50</TRNAMT><FITID>FIT-${org}-002</FITID><NAME>PAGAMENTO FORNECEDOR 2002</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const bankRecords = (): FinancialRecord[] => [
 { id:"bank-1", date:"2026-11-03", description:"RECEBIMENTO PEDIDO 1001", amount:1250.75, direction:"entrada", category:"receita", source:"fixture", status:"pendente", sourceRecordId:"FIT-ITAU-001" },
 { id:"bank-2", date:"2026-11-04", description:"PAGAMENTO FORNECEDOR 2002", amount:250.5, direction:"saída", category:"despesa", source:"fixture", status:"pendente", sourceRecordId:"FIT-ITAU-002" },
 { id:"bank-3", date:"2026-11-05", description:"TARIFA BANCÁRIA", amount:19.9, direction:"saída", category:"tarifa", source:"fixture", status:"pendente" }
];
const erpRecords = (): OmieRecord[] => [
 { id:"erp-1", date:"2026-11-03", description:"RECEBIMENTO PEDIDO 1001", amount:1250.75, direction:"entrada", documentNumber:"1001" },
 { id:"erp-2", date:"2026-11-05", description:"PAGAMENTO FORNECEDOR 2002", amount:250.5, direction:"saída", documentNumber:"2002" },
 { id:"erp-3", date:"2026-11-05", description:"TAXA DE CARTÃO", amount:19.9, direction:"saída" }
];

export function runFinancialValidation(caseCode: string): ValidationOutcome {
 const checks: ValidationOutcome["checks"] = [];
 const check=(name:string,passed:boolean,detail:string)=>checks.push({name,passed,detail});
 if(caseCode==="A2.1-BNB-LAYOUT" || caseCode==="A2.2-INTER-LAYOUT") {
   return {status:"blocked",summary:"Fixture bancário específico ainda não foi disponibilizado; OFX genérico não comprova compatibilidade do leiaute BNB/Inter.",checks:[{name:"Amostra de leiaute",passed:false,detail:"Não executar teste de banco específico sem fixture autorizado e sanitizado."}]};
 } else if(caseCode==="A1.4-OFX-PARSER") {
   const bankId="0341";
   const org="ITAU";
   const result=parseOfx(fixture(bankId,org,"12345-6"));
   check("Dois lançamentos interpretados",result.records.length===2,`Esperados 2; encontrados ${result.records.length}.`);
   check("FITID preservado",result.records.map(r=>r.sourceRecordId).includes(`FIT-${org}-001`) && result.records.map(r=>r.sourceRecordId).includes(`FIT-${org}-002`),"Identificadores de origem devem ser preservados.");
   check("Valores e direções",result.records.some(r=>r.amount===1250.75&&r.direction==="entrada") && result.records.some(r=>r.amount===250.5&&r.direction==="saída"),"Crédito R$ 1.250,75 e débito R$ 250,50.");
   check("Instituição identificada",result.metadata?.bankName===(bankId==="0341"?"Itaú Unibanco":bankId==="0004"?"Banco do Nordeste (BNB)":"Banco Inter"),result.metadata?.bankName||"Instituição não identificada.");
   check("Sem erros de parsing",result.errors.length===0,result.errors.join("; ")||"Nenhum erro reportado.");
 } else if(caseCode==="A1.5-MATCHING-V1" || caseCode==="A2.3-EXCEPTION-QUEUE") {
   const result=matchRecords(bankRecords(),erpRecords(),"sandbox-validator");
   if(caseCode==="A1.5-MATCHING-V1") {
     check("Correspondência automática",result.matched.length===2,`Esperados 2; encontrados ${result.matched.length}.`);
     check("Sem perda de registros",result.matched.length+result.unmatchedBank.length===3 && result.matched.length+result.unmatchedOmie.length===3,"Todos os 3 registros bancários e 3 ERP permanecem contabilizados.");
     check("Divergências permanecem pendentes",result.unmatchedBank.length===1&&result.unmatchedOmie.length===1,"Uma exceção em cada origem deve permanecer sem casamento.");
   } else {
     check("Fila conserva itens sem par",result.unmatchedBank.length===1&&result.unmatchedOmie.length===1,"Um item bancário e um ERP sem par permanecem identificáveis.");
     check("Exceções não são descartadas",result.matched.length+result.unmatchedBank.length===3 && result.matched.length+result.unmatchedOmie.length===3,"Contagem reconciliada com os volumes de entrada.");
   }
 } else if(caseCode==="A1.6-RECONCILIATION-SUMMARY") {
   const bank=bankRecords(), erp=erpRecords(), result=matchRecords(bank,erp);
   const incoming=bank.filter(r=>r.direction==="entrada").reduce((s,r)=>s+r.amount,0);
   const outgoing=bank.filter(r=>r.direction==="saída").reduce((s,r)=>s+r.amount,0);
   check("Volume preservado",result.matched.length+result.unmatchedBank.length===bank.length,"Nenhum lançamento bancário desaparece na classificação.");
   check("Totais de entrada",incoming===1250.75,`Total calculado: ${incoming.toFixed(2)}.`);
   check("Totais de saída",outgoing===270.4,`Total calculado: ${outgoing.toFixed(2)}.`);
 } else if(caseCode==="A1.7-AUDIT-MANUAL") {
   return {status:"blocked",summary:"A lógica local preserva metadados de autoria, mas a aceitação A1.7 exige comprovar trilha persistida e consulta de histórico integrada.",checks:[{name:"Auditoria integrada",passed:false,detail:"Requer validação do registro persistido, autor, horário e justificativa no ambiente Sandbox."}]};
 } else if(caseCode==="A2.5-MANUAL-MATCH-JUSTIFICATION") {
   const bank=bankRecords()[0], erp=erpRecords()[0];
   const matched=manualMatch(bank,erp,"Correspondência confirmada no cenário sintético.","sandbox-validator");
   const unmatched=unmatchRecord(matched,"sandbox-validator");
   check("Tipo manual registrado",matched.matchType==="manual","Correspondência identificada como manual.");
   check("Autor e justificativa preservados",matched.matchAuthor==="sandbox-validator" && matched.matchJustification==="Correspondência confirmada no cenário sintético.","Autoria e justificativa presentes.");
   check("Data/hora registrada",!!matched.matchDate && !!matched.updatedAt,"Timestamp de decisão presente.");
   check("Desfazer retorna a pendente",unmatched.status==="pendente" && !unmatched.matchedWith,"Desconciliação remove o vínculo e retorna ao estado pendente.");
   if(caseCode==="A2.5-MANUAL-MATCH-JUSTIFICATION") {
     let rejectedBlank=false;
     try { manualMatch(bank,erp,"   ","sandbox-validator"); } catch { rejectedBlank=true; }
     check("Justificativa vazia rejeitada",rejectedBlank,"O domínio rejeita correspondência manual sem justificativa.");
   }
 } else if(caseCode==="A2.4-MANUAL-AUDIT-VIEW" || caseCode==="A2.W02-PERSISTENCE") {
   return {status:"blocked",summary:caseCode==="A2.4-MANUAL-AUDIT-VIEW"?"Validação visual/manual ainda exige revisão da tela e da trilha persistida.":"Persistência end-to-end ainda não foi comprovada pelo harness; não aprovar sem teste de nova sessão e banco.",checks:[{name:"Validação pendente",passed:false,detail:"Requer validação integrada/manual; nenhum resultado foi presumido."}]};
 } else {
   return {status:"blocked",summary:"Caso de validação não implementado neste harness.",checks:[]};
 }
 const passed=checks.every(c=>c.passed);
 return {status:passed?"passed":"failed",summary:`${checks.filter(c=>c.passed).length}/${checks.length} verificações aprovadas.`,checks};
}
