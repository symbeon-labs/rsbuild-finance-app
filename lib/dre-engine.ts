import type { FinancialRecord } from "@/lib/finance";

export type DreTreatment = "pnl" | "balance_sheet" | "financing" | "equity" | "receivable" | "ignore";
export type DreUnit = "ALS/CSN" | "P&L" | "RRT";
export type DreAccount = {
  code: string; label: string; group: string; treatment: DreTreatment;
  directions: Array<"entrada" | "saída">;
};
export type DreClassification = {
  recordId: string; account: DreAccount | null; confidence: number;
  status: "suggested" | "review" | "excluded" | "overridden";
  reason: string; source: "rule" | "manual" | "none";
  allocations: Array<{ unit: DreUnit; amountMinor: number }>;
};
export type DreOverride = { accountCode: string; unit?: DreUnit; treatment?: DreTreatment; reason: string };
export type DreEngineResult = {
  classifications: DreClassification[];
  summary: { total: number; classified: number; review: number; excluded: number; pnl: number; balanceSheet: number; financing: number; equity: number; receivable: number; };
  pnl: Array<{ account: DreAccount; amountMinor: number; count: number }>;
  monthly: Array<{ month: string; incomeMinor: number; expenseMinor: number; resultMinor: number; count: number }>;
};

const accounts: DreAccount[] = [
  {code:"REV_SALES",label:"Faturamento / vendas",group:"FATURAMENTO REAL",treatment:"pnl",directions:["entrada"]},
  {code:"REV_OTHER",label:"Outras receitas operacionais",group:"FATURAMENTO REAL",treatment:"pnl",directions:["entrada"]},
  {code:"COGS_MERCH",label:"Mercadorias para revenda",group:"PASSIVOS / FORNECEDORES",treatment:"pnl",directions:["saída"]},
  {code:"COGS_FREIGHT",label:"Fretes sobre compras",group:"PASSIVOS / FORNECEDORES",treatment:"pnl",directions:["saída"]},
  {code:"GAS",label:"Gás",group:"PASSIVOS",treatment:"pnl",directions:["saída"]},
  {code:"PAYROLL",label:"Folha e encargos",group:"DESPESA COM PESSOAL",treatment:"pnl",directions:["saída"]},
  {code:"BENEFITS",label:"Benefícios",group:"DESPESA COM PESSOAL",treatment:"pnl",directions:["saída"]},
  {code:"RENT",label:"Aluguel",group:"DESPESAS ADMINISTRATIVAS",treatment:"pnl",directions:["saída"]},
  {code:"UTILITIES",label:"Água, energia e gás",group:"DESPESAS ADMINISTRATIVAS",treatment:"pnl",directions:["saída"]},
  {code:"TELECOM",label:"Internet e telefonia",group:"DESPESAS ADMINISTRATIVAS",treatment:"pnl",directions:["saída"]},
  {code:"SOFTWARE",label:"Sistemas e software",group:"DESPESAS ADMINISTRATIVAS",treatment:"pnl",directions:["saída"]},
  {code:"OFFICE",label:"Material de escritório",group:"DESPESAS ADMINISTRATIVAS",treatment:"pnl",directions:["saída"]},
  {code:"CLEANING",label:"Material de limpeza",group:"DESPESAS ADMINISTRATIVAS",treatment:"pnl",directions:["saída"]},
  {code:"VEHICLE",label:"Despesas de veículos",group:"DESPESAS ADMINISTRATIVAS",treatment:"pnl",directions:["saída"]},
  {code:"MAINTENANCE",label:"Manutenção",group:"DESPESAS MANUTENÇÕES",treatment:"pnl",directions:["saída"]},
  {code:"MARKETING",label:"Marketing e gráfica",group:"DESPESAS COMERCIAIS/MARKETING",treatment:"pnl",directions:["saída"]},
  {code:"DELIVERY",label:"Frete / entrega / mototáxi",group:"DESPESAS COMERCIAIS/MARKETING",treatment:"pnl",directions:["saída"]},
  {code:"TAXES",label:"Impostos e taxas",group:"IMPOSTOS/TAXAS",treatment:"pnl",directions:["saída"]},
  {code:"BANK_FEES",label:"Tarifas bancárias",group:"DESPESAS FINANCEIRAS",treatment:"pnl",directions:["saída"]},
  {code:"FINANCING",label:"Parcelas de financiamento",group:"FINANCIAMENTOS",treatment:"financing",directions:["saída"]},
  {code:"ASSET",label:"Imobilizado / aquisição de ativo",group:"IMOBILIZADO",treatment:"balance_sheet",directions:["saída"]},
  {code:"OWNER_DRAW",label:"Retirada de sócios",group:"SÓCIOS",treatment:"equity",directions:["saída"]},
  {code:"TRANSFER",label:"Transferência entre contas",group:"FORA DA DRE",treatment:"ignore",directions:["entrada","saída"]},
  {code:"LOAN",label:"Empréstimo / aporte",group:"PASSIVO / PATRIMÔNIO",treatment:"balance_sheet",directions:["entrada","saída"]},
  {code:"RECEIVABLE",label:"Recebimento / liquidação de recebível",group:"RECEBÍVEIS",treatment:"receivable",directions:["entrada"]},
  {code:"REFUND",label:"Estorno / devolução",group:"REVISÃO / AJUSTES",treatment:"ignore",directions:["entrada","saída"]}
];

type Rule = { code: string; terms: string[]; confidence: number; reason: string };
const rules: Rule[] = [
  {code:"TRANSFER",terms:["transferencia entre contas","transferencia propria","ted entre contas","pix entre contas","resgate aplicacao","aplicacao financeira"],confidence:.99,reason:"Descrição explícita de transferência ou movimentação entre contas."},
  {code:"LOAN",terms:["emprestimo","capital de giro","aporte de capital","aporte socio"],confidence:.97,reason:"Descrição explícita de empréstimo ou aporte; não é faturamento."},
  {code:"REFUND",terms:["estorno","chargeback","devolucao","cancelamento de venda"],confidence:.96,reason:"Descrição indica estorno/devolução; exige tratamento separado."},
  {code:"OWNER_DRAW",terms:["retirada socio","pro labore","distribuicao de lucro","antecipacao socio"],confidence:.96,reason:"Descrição indica retirada ou remuneração de sócio."},
  {code:"FINANCING",terms:["parcela financiamento","financiamento caminhao","consorcio","leasing","finame"],confidence:.93,reason:"Pagamento de financiamento; principal não deve ser tratado automaticamente como despesa operacional."},
  {code:"ASSET",terms:["compra equipamento","compra maquina","aquisicao veiculo","computador","imobilizado"],confidence:.90,reason:"Descrição sugere aquisição de ativo; confirmar natureza e capitalização."},
  {code:"RECEIVABLE",terms:["liquidacao recebivel","antecipacao recebiveis","recebimento boleto","baixa recebivel"],confidence:.91,reason:"Liquidação de recebível; não duplicar com faturamento reconhecido."},
  {code:"REV_SALES",terms:["venda","faturamento","receita de vendas","venda balcão","venda whatsapp"],confidence:.88,reason:"Descrição comercial explícita em entrada; confirmar documento fiscal e competência."},
  {code:"COGS_MERCH",terms:["fornecedor mercadoria","compra mercadoria","mercadoria revenda","distribuidora alimentos","insumos producao"],confidence:.86,reason:"Descrição sugere aquisição de mercadorias/insumos."},
  {code:"COGS_FREIGHT",terms:["frete sobre compra","frete fornecedor","frete mercadoria"],confidence:.91,reason:"Frete vinculado à aquisição de mercadoria."},
  {code:"PAYROLL",terms:["folha pagamento","salario","salário","fgts","inss","rescisao","ferias funcionario","13 salario"],confidence:.93,reason:"Descrição associada à folha ou encargos trabalhistas."},
  {code:"BENEFITS",terms:["vale transporte","vale refeicao","vale alimentação","flash beneficios","plano odontologico","unimed"],confidence:.90,reason:"Descrição associada a benefício de pessoal."},
  {code:"RENT",terms:["aluguel","locacao imovel"],confidence:.96,reason:"Despesa de aluguel identificada."},
  {code:"UTILITIES",terms:["embasa","energia eletrica","conta de luz","gas cozinha","botijao gas"],confidence:.91,reason:"Despesa de utilidade identificada."},
  {code:"TELECOM",terms:["internet","telefonia","vivo","claro","algar"],confidence:.88,reason:"Despesa de comunicação identificada."},
  {code:"SOFTWARE",terms:["omie","software","licenca sistema","assinatura sistema","hospedagem site"],confidence:.89,reason:"Despesa de sistema ou software identificada."},
  {code:"OFFICE",terms:["material escritorio","papelaria","toner","cilindro impressora"],confidence:.90,reason:"Material de escritório identificado."},
  {code:"CLEANING",terms:["material limpeza","produto limpeza","desinfetante","detergente"],confidence:.89,reason:"Material de limpeza identificado."},
  {code:"VEHICLE",terms:["combustivel","combustível","posto","pedagio","pedágio","estacionamento","rastreador","seguro veiculo","ipva"],confidence:.88,reason:"Despesa associada a veículo."},
  {code:"MAINTENANCE",terms:["manutencao","manutenção","conserto","reparo","recarga extintor","manutencao forno"],confidence:.88,reason:"Despesa de manutenção identificada."},
  {code:"MARKETING",terms:["marketing","grafica","gráfica","anuncio","publicidade","impulsionamento"],confidence:.91,reason:"Despesa de marketing ou comunicação visual."},
  {code:"DELIVERY",terms:["mototaxi","moto taxi","entrega","frete venda","frete sobre vendas"],confidence:.89,reason:"Despesa de entrega ou frete comercial."},
  {code:"TAXES",terms:["simples nacional","das","icms","gnre","iptu","alvara","alvará","tff","crq","imposto","tributo"],confidence:.92,reason:"Tributo ou taxa governamental identificada."},
  {code:"BANK_FEES",terms:["tarifa bancaria","tarifa bancária","tarifas rede","taxa maquininha","safrapay","taxa adquirencia"],confidence:.91,reason:"Tarifa financeira ou de adquirência identificada."}
];

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const accountByCode = new Map(accounts.map(a=>[a.code,a]));
function allocate(amountMinor:number, shares:Array<[DreUnit,number]>):Array<{unit:DreUnit;amountMinor:number}> {
  const total=shares.reduce((n,[,p])=>n+p,0);
  if(total!==100) throw new Error("Rateio precisa totalizar 100%.");
  let assigned=0;
  return shares.map(([unit,p],i)=>{const value=i===shares.length-1?amountMinor-assigned:Math.floor(amountMinor*p/100);assigned+=value;return {unit,amountMinor:value};});
}
const rateioFor = (code:string):Array<[DreUnit,number]> => {
  if(["VEHICLE"].includes(code)) return [["ALS/CSN",30],["P&L",20],["RRT",50]];
  if(["OFFICE","CLEANING","SOFTWARE","MAINTENANCE","MARKETING","DELIVERY","BANK_FEES","PAYROLL","BENEFITS","TAXES","UTILITIES","TELECOM","RENT","COGS_MERCH","COGS_FREIGHT","GAS"].includes(code)) return [["ALS/CSN",50],["P&L",25],["RRT",25]];
  return [["ALS/CSN",100]];
};

function classify(record:FinancialRecord, override?:DreOverride):DreClassification {
  const amountMinor=Math.round(Math.abs(record.amount)*100);
  if(override) {
    const account=accountByCode.get(override.accountCode);
    if(!account) throw new Error("Código de rubrica manual desconhecido.");
    const shares=override.unit?[[override.unit,100] as [DreUnit,number]]:rateioFor(account.code);
    return {recordId:record.id,account,confidence:1,status:"overridden",reason:override.reason,source:"manual",allocations:allocate(amountMinor,shares)};
  }
  const text=normalize(record.description||"");
  const candidates=rules.filter(r=>r.terms.some(term=>text.includes(normalize(term))) && accountByCode.get(r.code)?.directions.includes(record.direction));
  candidates.sort((a,b)=>b.confidence-a.confidence);
  const winner=candidates[0];
  if(!winner) return {recordId:record.id,account:null,confidence:0,status:"review",reason:"Sem regra determinística segura. Exige classificação humana.",source:"none",allocations:[]};
  const account=accountByCode.get(winner.code)!;
  const status=winner.confidence>=.90 && account.treatment!=="pnl" ? (account.treatment==="ignore"?"excluded":"suggested") : winner.confidence>=.90?"suggested":"review";
  return {recordId:record.id,account,confidence:winner.confidence,status,reason:winner.reason,source:"rule",allocations:status==="review"||account.treatment==="ignore"?[]:allocate(amountMinor,rateioFor(account.code))};
}

export function runDreEngine(records:FinancialRecord[], overrides:Record<string,DreOverride>={}):DreEngineResult {
  const classifications=records.map(r=>classify(r,overrides[r.id]));
  const summary={total:records.length,classified:0,review:0,excluded:0,pnl:0,balanceSheet:0,financing:0,equity:0,receivable:0};
  const grouped=new Map<string,{account:DreAccount;amountMinor:number;count:number}>();
  const months=new Map<string,{month:string;incomeMinor:number;expenseMinor:number;resultMinor:number;count:number}>();
  for(let i=0;i<records.length;i++){
    const c=classifications[i], r=records[i];
    if(c.status==="review"||!c.account){summary.review++;continue;}
    if(c.status==="excluded"){summary.excluded++;continue;}
    summary.classified++;
    const t=c.account.treatment;
    if(t==="pnl")summary.pnl++; else if(t==="balance_sheet")summary.balanceSheet++; else if(t==="financing")summary.financing++; else if(t==="equity")summary.equity++; else if(t==="receivable")summary.receivable++;
    if(t==="pnl"){
      const value=Math.round(Math.abs(r.amount)*100);
      const current=grouped.get(c.account.code)||{account:c.account,amountMinor:0,count:0};
      current.amountMinor+=value;current.count++;grouped.set(c.account.code,current);
      const month=r.date.slice(0,7), m=months.get(month)||{month,incomeMinor:0,expenseMinor:0,resultMinor:0,count:0};
      if(r.direction==="entrada")m.incomeMinor+=value;else m.expenseMinor+=value;
      m.resultMinor=m.incomeMinor-m.expenseMinor;m.count++;months.set(month,m);
    }
  }
  return {classifications,summary,pnl:[...grouped.values()].sort((a,b)=>b.amountMinor-a.amountMinor),monthly:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month))};
}
export const DRE_ACCOUNTS=accounts;
