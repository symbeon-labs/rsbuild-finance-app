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
  <img alt="CI" src="https://img.shields.io/badge/CI-validated-brightgreen" />
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
| **Fraude e erro no ERP** | Operadores com acessos sem travas de alçada no ERP legado | RBAC com 4 níveis de alçada + trilha de auditoria completa |
| **Conciliação bancária** | Centenas de PIX, boletos e cartões reconciliados manualmente | Motor algorítmico de correspondência assistida com exportação para baixa em lote |
| **Processos logísticos** | Pedidos informais via mensageria, canhotos físicos dispersos | Parser NLP de pedidos estruturados + protocolo digital de provas de entrega |

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
  │  BANCO DE │     │CONECTORES │     │  MENSAGERIA  │
  │   DADOS   │     │  DE ERP   │     │ CORPORATIVA  │
  │ PostgreSQL│     │ (Títulos, │     │ (Pedidos,    │
  │ Multi-    │     │  Baixas,  │     │  Canhotos,   │
  │ tenant    │     │  Alçadas) │     │  Notificação)│
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
| **Testes** | Node.js Native Test Runner + pgTAP; validação automatizada via GitHub Actions |

---

## Módulos do Sistema

O **RSBUILD OS** é estruturado sobre **4 Módulos Operacionais Fundamentais**, com ativação independente por empresa/tenant através da matriz de governança (White-Label), integrados a uma **Torre de Controle Executiva**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TORRE DE CONTROLE EXECUTIVA                           │
│     Cockpit Consolidado da Holding · Indicadores Globais · Sprint Zone      │
└──────────────┬──────────────────┬──────────────────┬────────────────────────┘
               │                  │                  │
               ▼                  ▼                  ▼
  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
  │ 💼 1. FINANÇAS &     │  │ 🔄 2. RECONCILIAÇÃO  │  │ 🚚 3. LOGÍSTICA &    │
  │    CAIXA             │  │    & BAIXAS          │  │    EXPEDIÇÃO         │
  │ Extratos Multibanco  │  │ Matching Assistido   │  │ Protocolo Canhotos   │
  │ Fluxo de Caixa / DRE │  │ Títulos a Receber/AP │  │ Pedidos Estruturados │
  │ Rastreabilidade Lotes│  │ Baixa em Lote p/ ERP │  │ Mitigação de Protesto│
  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
               │                  │                  │
               └──────────────────┼──────────────────┘
                                  ▼
                    ┌───────────────────────────┐
                    │ 🛡️ 4. AUDITORIA &         │
                    │    RS GUARDIÃO            │
                    │ Trilha Imutável de Eventos│
                    │ Governança HITL / Alçadas │
                    │ Diagnóstico de Integridade│
                    └───────────────────────────┘
```

---

### 💼 Módulo 1: Finanças & Caixa
*Status de Maturidade: Produção / Homologado*
- **Ingestão Multibanco:** Parser inteligente de extratos em `.OFX` (v100/102, Windows-1252) e `.CSV` brasileiro (separador `;`, vírgula decimal). Identificação automática de layouts bancários nacionais.
- **Movimentações & Fluxo de Caixa:** Visualização consolidada com filtros contábeis por período, conta financeira e categoria de transação.
- **Indicadores de Gestão:** Painel reativo com entradas, saídas, resultado líquido do período e cobertura operacional.
- **Rastreabilidade de Importações:** Controle rigoroso com hash SHA-256 por arquivo, lotes idempotentes, prevenção de duplicidades e auditoria de upload.
- **Relatórios Gerenciais (DRE):** Demonstrativo de resultado gerencial segregado por empresa.

### 🔄 Módulo 2: Reconciliação & Baixas
*Status de Maturidade: Produção / Homologado*
- **Motor de Correspondência (Matcher):** Algoritmo de cruzamento assistido entre lançamentos bancários e títulos a receber/pagar do ERP.
- **Cálculo de Encargos & Deduções:** Apuração automática de juros, multas e abatimentos para títulos liquidados fora do prazo.
- **Esteira de Baixas em Lote:** Geração de arquivos padronizados e payloads estruturados para baixa em lote no sistema de gestão.
- **Decisões Persistidas:** Registro auditável de aprovações, justificativas e vinculações de liquidação.

### 🚚 Módulo 3: Logística & Expedição
*Status de Maturidade: Operacional / Em Expansão de Integração*
- **Parser NLP de Pedidos:** Interpretação de pedidos informais recebidos via mensageria corporativa e estruturação para entrada no ERP.
- **Protocolo Digital de Canhotos:** Captura, custódia e conferência de comprovantes físicos de entrega para blindagem jurídica.
- **Métricas & Prevenção de Protesto:** Indicadores de cobertura de entrega e geração de relatórios de conformidade para proteção contábil.

### 🛡️ Módulo 4: Auditoria & RS Guardião
*Status de Maturidade: Operacional / Em Expansão Analítica*
- **Trilha de Auditoria (Audit Trail):** Registro pericial imutável de todos os eventos (importações, conciliações, aprovações, exclusões, sessões) com identificação de ator, organização e timestamps — append-only, gravada apenas server-side.
- **Rastreabilidade de Sessões:** Eventos `session.login`/`session.logout` por organização em todos os fluxos de autenticação (senha, link de convite, logout explícito), complementados por `last_sign_in_at` do provedor de identidade.
- **Detecção de Acesso Negado:** Tentativas de acesso sem membership ou com alçada insuficiente são registradas (`access.denied`) antes do retorno 403 — o cliente enxerga quem tentou o quê sem autorização.
- **RS Guardião (Governança Cognitiva):** Motor de diagnóstico da saúde operacional e conformidade com Human-in-the-Loop (HITL), avaliando integridade fiscal e processos.
- **Painel de Governança Pericial:** Visualização centralizada dos registros de auditoria para compliance e suporte contábil.

### 🗂️ Camada Transversal: Cadastro de Relacionamentos
*Status de Maturidade: Implementado na V1 · Homologação funcional pendente*
- **Cadastro por organização:** registro de clientes, fornecedores, transportadoras, parceiros comerciais, prestadores de serviço, distribuidores e outras relações.
- **Dados cadastrais:** CPF/CNPJ, razão social/nome, nome fantasia, inscrição estadual, e-mail, telefone e endereço.
- **Classificações múltiplas:** uma relação pode assumir mais de um papel no mesmo tenant.
- **Pesquisa e ciclo de vida:** pesquisa, filtros e estados ativo, inativo ou arquivado, sem exclusão destrutiva na interface.
- **Validação documental:** CPF, CNPJ numérico e CNPJ alfanumérico com validação de dígitos verificadores.
- **Histórico:** autoria, horário e campos alterados registrados em eventos de auditoria.
- **Segurança multi-tenant:** leitura limitada aos membros da organização; escrita restrita a owner/admin/operator, com RLS e autorização server-side.

> **Estado de implantação:** o código da V1 foi integrado à branch principal após CI, testes de banco, verificações de sandbox e Preview aprovados. A migration da V1 ainda requer aplicação controlada no Supabase e a interface requer homologação funcional autenticada, separadamente em Mundo do Sabor QA e Hub Açaí QA. A aprovação automatizada não equivale a liberação para produção.

### 🏢 Camada Transversal: Torre de Controle Executiva
*Status de Maturidade: Produção / Homologado*
- **Holding Overview:** Painel consolidado multi-empresa com saldos, volumes transacionados e alertas em visão única para a diretoria.
- **Observabilidade Cross-Tenant em Tempo Real:** Métricas operacionais agregadas das empresas integradas (títulos pendentes, baixas, pedidos, eventos de auditoria, acessos negados) consumidas via API server-side — a holding observa sem membership nos tenants e sem expor dados operacionais brutos.
- **Central de Acessos & Identidades:** Diretório consolidado de membros, convites e permissões por projeto em todas as organizações, com último login e gestão de grants (`viewer`/`contributor`) por pessoa e por organização cliente.
- **Sprint Zone:** Módulo exclusivo para governança de projetos de tecnologia e acompanhamento de entregas evolutivas da plataforma.

---

## Multi-Tenancy & RBAC

O sistema opera com **isolamento completo por organização** usando Row Level Security (RLS) no PostgreSQL. Cada dado pertence a exatamente um tenant, e as queries são automaticamente filtradas.

A organização **RSBUILD** atua como camada de governança: seu workspace (`ControlTowerWorkspace`) agrega observabilidade e identidades de todos os tenants via APIs server-side com service role — leitura controlada que **não afrouxa o RLS** dos clientes e não exige membership da holding nas operacionais. O workspace de cada tenant (`OperationalWorkspace`) permanece isolado e dono de seus dados.

### Níveis de Alçada

| Papel | Badge | Alçada |
|:------|:------|:-------|
| **Owner** | 👑 Proprietário / Holding | Irrestrita — gestão total de workspaces, convites, aprovações |
| **Admin** | 🏛 Diretoria / Gestão | Aprova baixas, conciliações com divergência, crédito |
| **Operator** | ⚡ Operador | Importa arquivos, sugere conciliações, registra canhotos |
| **Viewer** | 👁 Consulta / Auditoria | Somente leitura — conferência contábil e pericial |

### Acesso por Projeto

Independente do papel organizacional, projetos do portfólio RSBUILD podem conceder acesso granular:

| Grant | Escopo |
|:------|:-------|
| **Pessoal** (`project_memberships`) | Uma pessoa específica acessa o projeto como `viewer` ou `contributor` |
| **Organizacional** (`project_organization_access`) | Todos os membros da organização cliente do projeto acessam com `viewer` ou `contributor` |

A gestão de grants é restrita a `owner`/`admin` da RSBUILD e cada concessão/revogação é registrada na trilha de auditoria.

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
│   ├── api/                    # 20 Route Handlers (REST API)
│   │   ├── access-directory/   # Diretório central de acessos (RSBUILD)
│   │   ├── audit-events/       # Trilha de auditoria por tenant
│   │   ├── erp-movements/      # Movimentações ERP
│   │   ├── imports/            # Importação de extratos
│   │   ├── observability/      # Métricas cross-tenant (RSBUILD)
│   │   ├── orders/             # Pedidos estruturados via mensageria
│   │   ├── organization-branding/      # White-label por tenant
│   │   ├── organization-invitations/   # Convites de equipe
│   │   ├── project-access/     # Grants de projeto (pessoa/org)
│   │   ├── projects/           # Portfólio + sprints/tarefas/deliverables
│   │   ├── proofs/             # Canhotos de entrega
│   │   ├── reconciliation-decisions/
│   │   ├── settlements/        # Baixas ERP
│   │   └── titles/             # Títulos financeiros
│   ├── components/
│   │   ├── admin/              # Painel admin, branding, auditoria, acessos
│   │   ├── auth/               # Onboarding
│   │   ├── executive/          # Torre de Controle, Holding Overview
│   │   ├── finance/            # Visão geral, movimentações, DRE, baixas
│   │   ├── logistics/          # Canhotos, pedidos
│   │   ├── relationships/      # Cadastro e histórico de relacionamentos\n│   │   ├── projects/           # Portfólio de projetos
│   │   └── shell/              # Sidebar, Topbar, Workspace Modal
│   ├── types/                  # Tipos do workspace e organização
│   ├── workspaces/
│   │   ├── control-tower-workspace.tsx   # Workspace RSBUILD (governança)
│   │   └── operational-workspace.tsx    # Workspaces dos tenants operacionais
│   └── enterprise-workspace.tsx # Workspace legado/unificado
├── lib/
│   ├── api/                    # Org Guard, Audit, Rate Limiter
│   ├── supabase/               # Clients SSR/browser
│   ├── finance.ts              # Motor financeiro (OFX/CSV parser)
│   ├── reconciliation.ts       # Motor de conciliação
│   ├── delivery.ts             # Motor de canhotos
│   ├── orders.ts               # Parser de pedidos de mensageria
│   ├── permissions.ts          # Matriz RBAC (4 níveis)
│   └── finance-persistence.ts  # Persistência financeira (centavos)
├── supabase/
│   ├── migrations/             # Migrations versionadas (RLS e evolução do schema)
│   └── tests/                  # Suítes pgTAP de isolamento e grants
├── tests/                      # Testes automatizados Node.js
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
| `npm test` | Roda os testes unitários e de integração Node.js |

### Validação Completa

```bash
npm run typecheck  # 0 erros TypeScript
npm test           # testes unitários e de integração
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
| `orders.test.ts` | Parser NLP de pedidos via mensageria |
| `permissions.test.ts` | Matriz RBAC, alçadas, segregação |
| `internal-transfers.test.ts` | Transferências entre contas |
| `workspace.test.ts` | Multi-tenant, roteamento, módulos |

Além das suítes unitárias, o repositório mantém **testes pgTAP** em `supabase/tests/` cobrindo isolamento RLS, persistência operacional F01 e grants de projeto (executados no CI via `supabase test db`).

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
| [QA — Homologação](docs/qa/FINAL_FINANCE_HOMOLOGATION.md) | Relatório de homologação financeira |\n| [Cadastro de Relacionamentos — V1](docs/cadastro-relacionamentos/v1-scope.md) | Escopo, regras de domínio e segurança multi-tenant |

---

## Roadmap de Evolução dos Módulos

A estratégia de engenharia do **RSBUILD OS** é modular e evolutiva. Enquanto os módulos de **Finanças & Caixa (1)** e **Reconciliação (2)** alcançaram homologação completa e operação em produção, as próximas etapas conduzem os módulos de **Logística (3)** e **Auditoria (4)** ao mesmo nível de integração contínua e automação operacional profunda.

| Ciclo / Marco | Foco Principal | Status | Entregas & Capacidades |
|:--------------|:---------------|:-------|:-----------------------|
| **Ciclo 01: Fundação & Finanças** | Módulo 1 (Finanças) & Módulo 2 (Reconciliação) | ✅ Em Produção | Ingestão multibanco (OFX/CSV), persistência em centavos, motor de matching de recebíveis, cálculo de juros/multas, DRE gerencial e geração de baixas em lote. |
| **Ciclo 02: Conectividade & APIs** | Módulo 1 & 2 (Automação de ERP) | 🔧 Em Progresso | Sincronização direta via REST APIs e Webhooks com ERPs legados, eliminando a dependência de arquivos manuais para extratos e títulos. |
| **Ciclo 03: Logística Avançada** | Módulo 3 (Logística & Expedição) | 📋 Planejado | **Elevação da Logística ao nível do Financeiro:** Esteira de OCR/visão computacional para digitalização automática de canhotos, reconciliação entre comprovante de entrega e liquidação financeira, e integração de rotas com faturamento. |
| **Ciclo 04: Governança Cognitiva** | Módulo 4 (Auditoria & RS Guardião) | 📋 Planejado | **Operação Sentinela do RS Guardião:** Alertas preditivos contínuos, detecção de discrepâncias fiscais/contábeis em tempo real, monitoramento autônomo de alçadas e auditoria pericial proativa com HITL. |
| **Ciclo 05: Enterprise Foundry** | Multi-ERP & Expansão | 📋 Planejado | Framework de conectores agnósticos (SAP, TOTVS, Sankhya, etc.), barramento corporativo de mensageria e expansão para novas holdings e verticais de negócio. |

---

## Licença

Software proprietário. Todos os direitos reservados.

Desenvolvido por **[Symbeon Labs](https://github.com/symbeon-labs)** para a holding **RSBUILD**.

---

<p align="center">
  <sub>Engenharia & Arquitetura por <strong>Symbeon Labs</strong> · 2026</sub>
</p>
