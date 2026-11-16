<p align="center">
  <img src="public/brand/rsbuild-s-white.svg" alt="RSBUILD OS" width="96" />
</p>

<h1 align="center">RSBUILD OS</h1>

<p align="center">
  <strong>Central Integrada de Operações para Holdings e Distribuidoras</strong><br/>
  Inteligência financeira · Automação logística · Governança corporativa
</p>

<p align="center">
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15.5-black?logo=nextdotjs&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" />
  <img alt="Tests" src="https://img.shields.io/badge/Tests-71%20passing-brightgreen" />
  <img alt="License" src="https://img.shields.io/badge/License-Proprietary-red" />
</p>

---

## Visão Geral

O **RSBUILD OS** é uma plataforma corporativa SaaS multi-tenant construída para resolver os desafios críticos de **holdings que gerenciam múltiplas operações e subsidiárias** — da visibilidade financeira em tempo real à blindagem de processos contra erros e fraudes no ERP.

A plataforma opera consolidando a gestão financeira, conciliação e esteira operacional de múltiplas unidades de negócio (indústria, distribuição e logística B2B), garantindo segregação total de dados e integridade contábil.

### O Problema que Resolvemos

| Desafio | Antes | Com o RSBUILD OS |
|:--------|:------|:------------------|
| **Visibilidade financeira** | Planilhas isoladas, sem torre de controle | Dashboard unificado com fluxo de caixa diário por empresa |
| **Fraude e erro no ERP** | Operadores com acesso irrestrito ao Omie | RBAC com 4 níveis de alçada + trilha de auditoria completa |
| **Conciliação bancária** | Centenas de PIX, boletos e cartões reconciliados manualmente | Motor algorítmico de correspondência assistida com exportação para baixa em lote |
| **Processos logísticos** | Pedidos via WhatsApp, canhotos perdidos | Parser NLP de pedidos + protocolo digital de provas de entrega |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Browser / PWA)                     │
│   Next.js 15 App Router · React 19 · TypeScript Strict · Tailwind  │
│   Workspace Dinâmico · Sidebar · Topbar c/ Seletor de Tenant       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS / SSR Auth Cookies
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Vercel Edge)                          │
│   SSR Auth Middleware · Org Guard (RBAC) · Rate Limiter             │
│   Finance Engine · Reconciliation Engine · Delivery Engine          │
│   Orders Parser · Permissions Matrix · Audit Trail                  │
└───────┬──────────────────┬──────────────────┬──────────────────────┘
        │ SQL / RLS        │ REST API         │ Webhooks
        ▼                  ▼                  ▼
  ┌───────────┐     ┌───────────┐     ┌──────────────┐
  │ Supabase  │     │ Omie ERP  │     │  WhatsApp    │
  │ PostgreSQL│     │ (Títulos, │     │  Business    │
  │ Multi-    │     │  Baixas,  │     │  (Pedidos,   │
  │ tenant    │     │  Alçadas) │     │   Canhotos)  │
  └───────────┘     └───────────┘     └──────────────┘
```

### Stack Tecnológica

| Camada | Tecnologia |
|:-------|:-----------|
| **Frontend** | Next.js 15.5, React 19, TypeScript Strict |
| **Estilização** | Tailwind CSS v4 com paleta corporativa e indicadores semânticos |
| **Backend** | API Routes (Edge Runtime), SSR com `@supabase/ssr` |
| **Banco de Dados** | Supabase PostgreSQL com RLS habilitado em todas as tabelas |
| **Autenticação** | JWT em cookies HttpOnly (imune a XSS) |
| **Segurança** | Org Guard (origin + UUID + membership), Rate Limiter, Audit Trail |
| **Deploy** | Vercel (auto-deploy `main` → produção) |
| **Testes** | Node.js Native Test Runner — 71 testes, 100% nos motores críticos |

---

## Módulos

### 💼 Financeiro & Controladoria

- **Ingestão Multibanco** — Parser inteligente de extratos OFX (v100/102, Windows-1252) e CSV brasileiro (`;` como separador, vírgula decimal). Identificação automática de instituições (Itaú, BNB, Inter, XP).
- **Movimentações** — Visualização consolidada com filtros por período, conta e categoria. Presets contábeis e seletor customizado de datas.
- **Visão Geral** — KPIs de entradas, saídas, resultado líquido e indicadores de cobertura.
- **Importações** — Rastreabilidade completa: hash de arquivo, lotes, deduplicação, validação e trilha de auditoria.
- **Relatórios DRE** — Demonstrativo de resultado gerencial por empresa.

### 🔄 Conciliação & Baixas ERP

- **Motor de Correspondência** — Matching algorítmico entre lançamentos bancários e títulos a receber do Omie.
- **Cálculo Automático** — Juros, multas e deduções de títulos em atraso.
- **Baixa em Lote** — Geração de planilha oficial para o ERP (`lote_baixas_omie_*.csv`).
- **Reconciliation Decisions** — Persistência auditável de aprovações e justificativas.

### 📦 Logística & Canhotos

- **Parser NLP de Pedidos** — Interpreta mensagens de WhatsApp e converte em pedidos estruturados para o ERP.
- **Protocolo Digital de Canhotos** — Upload e rastreio de provas de entrega para blindagem jurídica.
- **Métricas de Entrega** — Cobertura, risco de protesto e geração de CSV de blindagem.

### 🛡️ Auditoria & RS Guardião

- **Trilha de Auditoria** — Registro de todos os eventos (importação, conciliação, aprovação, exclusão) com organização, ator e metadados.
- **RS Guardião** — Solução de Governança Cognitiva & Auditoria Pericial com Human-in-the-Loop (HITL). Diagnóstico da saúde operacional com pontuação por dimensão.
- **Audit Trail View** — Consulta imutável de todos os eventos de governança.

### 🏢 Torre de Controle Executiva

- **Holding Overview** — Cockpit com visão consolidada de todas as empresas da holding.
- **Torre de Controle** — Dashboard operacional em tempo real para a diretoria.
- **Sprint Zone** — Portfólio de projetos de tecnologia com sprints e entregas.

---

## Multi-Tenancy & RBAC

O sistema opera com **isolamento completo por organização** usando Row Level Security (RLS) no PostgreSQL. Cada dado pertence a exatamente um tenant, e as queries são automaticamente filtradas.

### Níveis de Alçada

| Papel | Badge | Alçada |
|:------|:------|:-------|
| **Owner** | 👑 Proprietário / Holding | Irrestrita — gestão total de workspaces, convites, aprovações |
| **Admin** | 🏛 Diretoria / Gestão | Aprova baixas, conciliações com divergência, crédito |
| **Operator** | ⚡ Operador | Importa arquivos, sugere conciliações, registra canhotos |
| **Viewer** | 👁 Consulta / Auditoria | Somente leitura — conferência contábil e pericial |

### White-Label

Cada organização pode customizar:
- Razão social e logotipo
- Cor de acento da marca (terracotta por padrão)
- Módulos habilitados por contrato

---

## Estrutura do Projeto

```
rsbuild-finance-app/
├── app/
│   ├── api/                    # 13 Route Handlers (REST API)
│   │   ├── audit-events/       # Trilha de auditoria
│   │   ├── erp-movements/      # Movimentações ERP
│   │   ├── imports/            # Importação de extratos
│   │   ├── orders/             # Pedidos WhatsApp
│   │   ├── projects/           # Portfólio de sprints
│   │   ├── proofs/             # Canhotos de entrega
│   │   ├── reconciliation-decisions/
│   │   ├── settlements/        # Baixas ERP
│   │   └── titles/             # Títulos financeiros
│   ├── components/
│   │   ├── admin/              # Painel admin, branding, auditoria
│   │   ├── auth/               # Onboarding
│   │   ├── executive/          # Torre de Controle, Holding Overview
│   │   ├── finance/            # Visão geral, movimentações, DRE, baixas
│   │   ├── logistics/          # Canhotos, pedidos
│   │   ├── projects/           # Portfólio de projetos
│   │   └── shell/              # Sidebar, Topbar, Workspace Modal
│   ├── types/                  # Tipos do workspace e organização
│   └── enterprise-workspace.tsx # Componente raiz do workspace
├── lib/
│   ├── api/                    # Org Guard, Audit, Rate Limiter
│   ├── supabase/               # Clients SSR/browser
│   ├── finance.ts              # Motor financeiro (OFX/CSV parser)
│   ├── reconciliation.ts       # Motor de conciliação
│   ├── delivery.ts             # Motor de canhotos
│   ├── orders.ts               # Parser de pedidos WhatsApp
│   ├── permissions.ts          # Matriz RBAC (4 níveis)
│   └── finance-persistence.ts  # Persistência financeira (centavos)
├── supabase/
│   └── migrations/             # 16 migrations versionadas (RLS em tudo)
├── tests/                      # 71 testes (8 suítes)
├── docs/                       # 20 documentos de arquitetura e QA
└── public/brand/               # Assets de marca (logo, favicon)
```

---

## Desenvolvimento

### Pré-requisitos

- **Node.js** ≥ 22
- **npm** (incluso com o Node.js)
- Projeto **Supabase** configurado (com as migrations aplicadas)

### Setup

```bash
# Clone o repositório
git clone https://github.com/symbeon-labs/rsbuild-finance-app.git
cd rsbuild-finance-app

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais Supabase

# Rode o servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

### Comandos

| Comando | Descrição |
|:--------|:----------|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Build de produção otimizado |
| `npm run start` | Serve o build de produção |
| `npm run typecheck` | Verificação TypeScript (`tsc --noEmit`) |
| `npm test` | Roda os 71 testes unitários e de integração |

### Validação Completa

```bash
npm run typecheck  # 0 erros TypeScript
npm test           # 71/71 testes passando
npm run build      # Build de produção — sucesso
```

---

## Segurança

| Camada | Implementação |
|:-------|:-------------|
| **Autenticação** | Supabase Auth com JWT em cookies HttpOnly (zero XSS) |
| **Autorização** | Org Guard: origin check → UUID validation → membership → role gate |
| **Isolamento** | RLS habilitado em 100% das tabelas PostgreSQL |
| **Rate Limiting** | Sliding window (120 req/min por usuário+rota) |
| **Auditoria** | Todos os eventos persistidos com ator, timestamp e metadados |
| **Dados financeiros** | Aritmética em centavos (inteiros) — zero erro de ponto flutuante |
| **Importação** | Hash SHA-256 para deduplicação, validação transacional |

---

## Testes

8 suítes de testes cobrindo 100% dos motores críticos:

| Suíte | Escopo |
|:------|:-------|
| `finance-import.test.ts` | Parser OFX/CSV, normalização, saldos |
| `finance-persistence.test.ts` | Conversão reais/centavos, persistência |
| `reconciliation.test.ts` | Motor de matching, juros, baixa em lote |
| `delivery.test.ts` | Canhotos, métricas, risco de protesto |
| `orders.test.ts` | Parser NLP de pedidos WhatsApp |
| `permissions.test.ts` | Matriz RBAC, alçadas, segregação |
| `internal-transfers.test.ts` | Transferências entre contas |
| `workspace.test.ts` | Multi-tenant, roteamento, módulos |

---

## Documentação

| Documento | Descrição |
|:----------|:----------|
| [Arquitetura e Decisões](docs/ARQUITETURA_INFRAESTRUTURA_E_DECISOES.md) | Topologia, stack, decisões técnicas |
| [RS Guardião](docs/AGENTE_RS_SKILL.md) | Governança Cognitiva & Auditoria Pericial |
| [Roadmap](docs/ROADMAP.md) | Evolução do produto em etapas |
| [Contrato de Integração](docs/INTEGRATION_CONTRACT.md) | Contratos de API e payloads |
| [Modelo de Domínio F01](docs/F01_DOMAIN_MODEL.md) | Entidades e regras de negócio |
| [Modelo Lógico de Dados](docs/F01_LOGICAL_DATA_MODEL.md) | Esquema relacional |
| [Modelo Físico de Dados](docs/F01_PHYSICAL_DATA_MODEL.md) | Migrations e índices |
| [Matriz de Capacidades](docs/D02_CAPABILITY_MATRIX.md) | Diagnóstico técnico completo |
| [Tenant Onboarding](docs/TENANT_ONBOARDING.md) | Provisionamento de novos clientes |
| [Portfólio de Projetos](docs/PROJECT_PORTFOLIO_ARCHITECTURE.md) | Arquitetura da Sprint Zone |
| [Brand Assets](docs/BRAND_ASSETS.md) | Identidade visual e paleta |
| [QA — Homologação](docs/qa/FINAL_FINANCE_HOMOLOGATION.md) | Relatório de homologação financeira |

---

## Roadmap

| Etapa | Status | Descrição |
|:------|:-------|:----------|
| **01 — Visibilidade Financeira** | ✅ Produção | Importação, movimentações, KPIs |
| **02 — Gestão Financeira** | ✅ Produção | Conciliação, baixas, títulos, DRE |
| **03 — Integração Operacional** | 🔧 Em progresso | Conector ERP Omie bidirecional |
| **04 — Governança Avançada** | 📋 Planejado | RS Guardião — alertas preditivos |
| **05 — Foundry** | 📋 Planejado | Conectores multi-ERP e automações |

---

## Licença

Software proprietário. Todos os direitos reservados.

Desenvolvido por **[Symbeon Labs](https://github.com/symbeon-labs)** para a holding **RSBUILD**.

---

<p align="center">
  <sub>Engenharia & Arquitetura por <strong>Symbeon Labs</strong> · 2026</sub>
</p>
