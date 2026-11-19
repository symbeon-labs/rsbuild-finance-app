/** Modelo estrutural de DRE 2026.xlsx. Sem valores financeiros do cliente. */
export const DRE_SOURCE_MODEL = {
  sourceWorkbook: "DRE 2026.xlsx",
  sourceSheets: ["DRE ALS", "DRE P&L", "DRE RRT", "RATEIO FIXO", "RATEIO MENSAL", "ANUAL"],
  units: [
    { id: "als_csn", name: "ALS / CSN", sheet: "DRE ALS", groups: [
      ["PASSIVOS", ["Mercadoria P/ Revenda (Pagos)", "Fretes sobre compras (Pagos)"]],
      ["DESPESA COM PESSOAL", ["Assistência médica e benefícios", "Encargos FGTS/INSS/GRRF", "Folha e férias", "Gratificações", "Prestação de serviços", "Sindicatos", "Uniforme / EPI"]],
      ["DESPESAS ADMINISTRATIVAS", ["Aluguel", "Cartões empresariais", "Comunicação", "Água e energia", "Honorários", "Materiais e limpeza", "Sistemas Omie", "Segurança e seguros", "Serviços TI", "Despesas de veículos", "Viagens / cursos"]],
      ["DESPESAS MANUTENÇÕES", ["Extintores", "Ar condicionado", "Manutenção diversa", "Manutenção predial", "Manutenção veicular"]],
      ["DESPESAS COMERCIAIS/MARKETING", ["Bonificação", "Fretes entre lojas", "Marketing / gráfica", "Prestação de serviço", "Sacolas"]],
      ["IMPOSTOS/TAXAS", ["Alvará", "COFINS", "CSLL", "ICMS", "IPTU", "IRPJ", "PIS", "Retenções", "Simples Nacional", "TFF"]],
      ["DESPESAS FINANCEIRAS", ["Tarifas Itaú", "Tarifas Omie", "Tarifas Rede", "Tarifas Safrapay", "Tarifas Safra"]],
      ["FINANCIAMENTOS", ["Caminhão 30%", "Energia Solar / RRT"]],
      ["NOTAS TERCEIROS", ["Cartão empresarial", "Fagundes", "Honorários compartilhados", "Meire-Blue", "Notas no CNPJ ALS"]]
    ]},
    { id: "pl", name: "P&L", sheet: "DRE P&L", groups: [
      ["PASSIVOS", ["Mercadoria P/ Revenda (Pagos)", "Fretes sobre compras (Pagos)"]],
      ["DESPESA COM PESSOAL", ["Benefícios", "Encargos", "Folha, férias e rescisões", "Gratificação", "Prestação de serviços", "Taxa assistencial", "Uniforme / EPI"]],
      ["DESPESAS ADMINISTRATIVAS", ["Aluguel", "Caixinha Calçada", "Comunicação", "Água e energia", "Honorários", "Materiais", "Sistemas Omie", "Segurança e seguros", "Serviços TI", "Despesas de veículos", "Viagens / cursos"]],
      ["DESPESAS MANUTENÇÕES", ["Extintores", "Ar condicionado", "Diversa", "Predial", "Veicular"]],
      ["DESPESAS COMERCIAIS/MARKETING", ["Bonificação", "Frete sobre vendas", "Marketing / gráfica", "Prestação de serviço", "Sacolas"]],
      ["IMPOSTOS/TAXAS", ["Alvará", "IPTU", "Retenção", "Simples Nacional", "Parcelamento", "TFF"]],
      ["DESPESAS FINANCEIRAS", ["Tarifas Itaú QR Code", "Tarifas Omie", "Tarifas Rede", "Tarifas Safrapay", "Tarifas Safra"]],
      ["FINANCIAMENTOS", ["Caminhão 20%"]]
    ]},
    { id: "rrt", name: "RRT", sheet: "DRE RRT", groups: [
      ["PASSIVOS", ["Mercadoria (Pagos)", "Gás", "Uso e consumo", "Fretes sobre compras (Pagos)"]],
      ["DESPESA COM PESSOAL", ["Benefícios", "Encargos", "Folha, férias e rescisões", "Gratificações", "Prestação de serviços / diárias fábrica", "Sindicatos", "Uniforme / EPI"]],
      ["DESPESAS ADMINISTRATIVAS", ["Aluguel (metade ALS)", "Comunicação", "Água e energia", "Honorários", "Materiais", "Omie", "Segurança e seguros", "Serviços TI", "Despesas de veículos", "Viagens / cursos"]],
      ["DESPESAS MANUTENÇÕES", ["Fossa", "Jardim", "Ar condicionado", "Compressor", "Diversa", "Elétrica", "Máquinas / fornos", "Passagem / hotel", "Predial", "Extintores", "Veicular"]],
      ["DESPESAS COMERCIAIS/MARKETING", ["Bonificação", "Frete DUAL", "Moto táxi entre lojas", "Frete Priscila", "Marcas e patentes", "Marketing", "Site", "Viagens interior"]],
      ["IMPOSTOS/TAXAS", ["Alvará / Vigilância", "CRQ", "DAM", "GNRE", "ICMS ST", "IPTU", "Simples Nacional", "Parcelamento", "Multa TEF", "TFF"]],
      ["DESPESAS FINANCEIRAS", ["Tarifas Itaú", "Tarifas Rede", "Tarifas Safra"]],
      ["FINANCIAMENTOS", ["Energia Solar / ALS", "Caminhão 50%", "Máquina Canole", "Forno novo", "Máquina Top"]]
    ]}
  ],
  rateioRules: [
    { name: "Veículos — IPVA, multas e seguro", source: "RATEIO FIXO", shares: { "ALS/CSN": 30, "P&L": 20, "RRT": 50 } },
    { name: "Manutenção veicular, rastreador, pedágio e combustível", source: "RATEIO MENSAL", shares: { "ALS/CSN": 30, "P&L": 20, "RRT": 50 } },
    { name: "Copa / mercado", source: "RATEIO MENSAL", shares: { "ALS/CSN": 70, "P&L": 10, "RRT": 20 } },
    { name: "Material de escritório e toner", source: "RATEIO MENSAL", shares: { "ALS/CSN": 66, "P&L": 20, "RRT": 14 } },
    { name: "Material de limpeza", source: "RATEIO MENSAL", shares: { "ALS/CSN": 52, "P&L": 11, "RRT": 37 } },
    { name: "Farmácia", source: "RATEIO MENSAL", shares: { "ALS/CSN": 82, "P&L": 0, "RRT": 18 } },
    { name: "Cursos, treinamentos, brindes e eventos", source: "RATEIO MENSAL", shares: { "ALS/CSN": 50, "P&L": 25, "RRT": 25 } },
    { name: "Outras despesas", source: "RATEIO MENSAL", shares: { "ALS/CSN": 50, "P&L": 25, "RRT": 25 } },
    { name: "Serviços de TI e gráfica / decoração", source: "RATEIO MENSAL", shares: { "ALS/CSN": 60, "P&L": 30, "RRT": 10 } },
    { name: "Bonificação sobre vendas", source: "RATEIO MENSAL", shares: { "ALS/CSN": 75, "P&L": 25 } },
    { name: "Retirada de sócios / 4 empresas", source: "RATEIO MENSAL", shares: { "P&L": 80, "CSN": 15, "RRT": 5 } }
  ],
  annual: { sheet: "ANUAL", columns: ["ALS/CSN", "P&L", "RRT", "TOTAL"] },
  rules: [
    "FATURAMENTO REAL e RECEBÍVEIS são seções distintas; não somar recebíveis ao faturamento.",
    "Lucro antes da retirada = faturamento real - total de custos/despesas.",
    "Lucro líquido = lucro antes da retirada - retirada de sócios.",
    "Financiamentos, imobilizado, notas de terceiros e retiradas permanecem em grupos próprios.",
    "Célula vazia significa ausência de informação, não zero realizado.",
    "Não importar valores do arquivo para o código ou banco de dados; mapear estrutura e reconciliar dados do QA.",
    "Este modelo gerencial não é DRE fiscal/contábil por competência."
  ]
} as const;
