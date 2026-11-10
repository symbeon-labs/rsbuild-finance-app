# Arquitetura, Infraestrutura e Livro de Decisões Técnicas — RSBUILD OS (FinApp)

> **Documento Canônico de Referência Técnica e Governança**  
> **Versão:** 1.0.0  
> **Data:** 10 de Novembro de 2026  
> **Status:** Homologado / Em Produção (Ciclo 01)  
> **Escopo:** Holding RSBUILD, Operação Hub Açaí & Operação Mundo do Sabor  

---

## 1. Sumário Executivo e Contexto de Negócio

### 1.1. O Desafio e o Propósito do Sistema
A holding **RSBUILD** gerencia participações operacionais e financeiras nas empresas **Mundo do Sabor** (fabricação e distribuição de picolés e sorvetes) e **Hub Açaí / Bluemix Foods** (distribuição e logística de açaí e polpas). Historicamente, ambas as operações enfrentavam desafios críticos:
1. **Falta de Visibilidade Centralizada:** Ausência de uma torre de controle unificada para a diretoria acompanhar o fluxo de caixa diário, o cumprimento de metas e a aderência aos cronogramas de entregas.
2. **Fragilidade de Processos e Risco de Erro/Fraude no ERP Omie:** Operadores com permissão irrestrita no ERP podiam alterar pedidos faturados, excluir baixas de títulos ou conciliar valores divergentes para "fechar o caixa" sem aprovação superior, gerando rombos contábeis e vulnerabilidade operacional (problema identificado e reportado pela diretoria financeira — *Regra Raquel Toss*).
3. **Descompasso entre Entradas Bancárias e Registros Fiscais:** Centenas de transações via PIX, boletos e maquininhas de cartão exigiam reconciliação manual diária lenta, propensa a duplicidades e sem trilha de auditoria formal.
4. **Comunicação Fragmentada e Risco em Canhotos:** Pedidos chegavam por áudios e mensagens informais de WhatsApp, enquanto canhotos de entrega física eram perdidos, inviabilizando cobranças judiciais e validação contábil.

O **RSBUILD OS (FinApp)** foi projetado e construído para ser a plataforma corporativa definitiva que soluciona esses quatro vetores com **blindagem de governança, automação inteligente e segregação estrita de dados**.

---

### 1.2. Fronteira Comercial e Delimitação de Escopo (Ciclo 01 vs. Upgrades)
Para manter o alinhamento orçamentário e a transparência entre as partes, o escopo foi rigorosamente fatiado entre o que está contratado e entregue no **Ciclo 01** e os produtos previstos para os ciclos de expansão:

| Ciclo / Produto | Código de Referência | Status Contratual | Descrição Funcional |
| :--- | :--- | :--- | :--- |
| **Ciclo 01 (Base)** | `ENG-MS-01` | **Contratado & Ativo** (R$ 6.000 em 3x R$ 2.000) | Normalização de pedidos WhatsApp Mundo do Sabor + Protocolo digital de canhotos. |
| **Ciclo 01 (Base)** | `ENG-MS-02` | **Contratado & Ativo** (Ciclo 01) | Padronização de catálogo, regras de faturamento e esteira de expedição. |
| **Ciclo 01 (Base)** | `ENG-HA-01` | **Contratado & Ativo** (Ciclo 01) | Pipeline logístico Hub Açaí + Integração preliminar de estoque/vendas. |
| **Produto 2 (Upgrade)** | `PROD-02-RECON` | *Planejado (Ciclo 02)* | Motor autônomo de conciliação bancária bancária avançada (AI matcher para divergências parciais e juros compostos). |
| **Produto 3 (Upgrade)** | `PROD-03-LOG` | *Planejado (Ciclo 02)* | Algoritmo de cubagem e roteirização inteligente de frotas com rastreio de motoristas. |
| **Produto 4 (Upgrade)** | `PROD-04-AUDIT` | *Planejado (Ciclo 03)* | Agente RS de auditoria forense contínua no Omie (alertas preditivos de fraude e anomalias). |
| **Produto 5 (Upgrade)** | `PROD-05-FOUNDRY` | *Planejado (Ciclo 04)* | Conectores multi-ERP e esteira de automações customizadas da holding. |

---

## 2. Topologia de Infraestrutura e Stack Tecnológica

```
+-----------------------------------------------------------------------------------+
|                                 CAMADA DO CLIENTE                                 |
|   Navegador Web / Mobile (PWA Responsive)                                         |
|   - Next.js 15 App Router (React 19, TypeScript Strict, Tailwind CSS v4)         |
|   - Topbar com Seletor de Tenant & Badge de Perfil RBAC                           |
|   - Workspace Dinâmico: Torre de Controle, Conciliação, Baixas ERP, Auditoria     |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS / SSR Auth Cookies
                                          v
+-----------------------------------------------------------------------------------+
|                             BACKEND / EDGE SERVER                                 |
|   Vercel / Cloud Edge Runtime                                                     |
|   - SSR Authentication Middleware (@supabase/ssr)                                 |
|   - Multi-tenant Slug & UUID Resolver (`app/page.tsx`)                            |
|   - Permissions Engine & Authority Gates (`lib/permissions.ts`)                   |
|   - Finance & Reconciliation Core Engine (`lib/finance.ts`)                       |
+-------------------+---------------------+--------------------+--------------------+
                    |                     |                    |
                    | SQL / RLS           | REST v1            | HTTPS Webhooks
                    v                     v                    v
+-----------------------+ +-----------------------+ +-----------------------+
|  SUPABASE POSTGRESQL  | |       OMIE ERP        | |   WHATSAPP BUSINESS   |
| - Schema Multi-tenant | | - Consulta de Títulos | | - Webhook de Entrada  |
| - RLS Policies        | | - Baixas em Lote      | | - Parser NLP          |
| - Audit Trail Tables  | | - Travas de Alçada    | | - Coleta de Canhotos  |
| - Auth Users & Roles  | |   (Somente Admin)     | |                       |
+-----------------------+ +-----------------------+ +-----------------------+
```

### 2.1. Componentes da Stack
- **Frontend Framework:** Next.js 15.5+ utilizando React 19 em modo estrito.
- **Linguagem & Tipagem:** TypeScript com flags estritas ativadas (`noImplicitAny`, `strictNullChecks`).
- **Camada de Estilização:** Tailwind CSS v4 com paleta corporativa neutra e indicadores de status semânticos (Esmeralda para conciliado, Âmbar para pendente, Vermelho para discrepância/crítico).
- **Banco de Dados & Autenticação:** Supabase PostgreSQL com extensão `pgcrypto` para UUIDv4, gerido via migrations versionadas (`supabase/migrations/`).
- **Autenticação em Sessão:** `@supabase/ssr` gerenciando tokens JWT criptografados em cookies HttpOnly, imunes a ataques XSS no lado do cliente.
- **Suíte de Testes:** Node.js Native Test Runner com 62 testes unitários e de integração cobrindo 100% dos motores de permissões, conciliação e parsing financeiro.

---

## 3. Arquitetura Multi-Tenant e Mapeamento Canônico

### 3.1. Modelo de Isolamento
A plataforma adota o modelo **Shared Database, Shared Schema com Segregação Lógica via Row Level Security (RLS)**. Cada tabela transacional possui uma coluna obrigatória `organization_id UUID NOT NULL REFERENCES organizations(id)`.

Nenhum usuário consegue ler ou gravar dados de outra organização através de injeção direta de parâmetros, pois as políticas RLS validam a associação do usuário na tabela `organization_members`.

### 3.2. Mapeamento dos 3 Tenants Oficiais

| Slug Canônico | UUID de Produção no Supabase | Nome da Organização | Propósito & Perfil no Sistema |
| :--- | :--- | :--- | :--- |
| `rsbuild` | `0269fe05-0990-41a8-a28c-2919691eaf0f` | **RSBUILD Holding** | Visão executiva consolidada, Torre de Controle de Sprints, governança geral e parametrização. |
| `hub_acai` | `ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76` | **Hub Açaí / Bluemix** | Operação de açaí, conciliação de contas distribuidora, esteira logística H1–H4. |
| `mundo_sabor` | `c5356414-adce-4fdc-941b-15cfe26b991e` | **Mundo do Sabor** | Operação de fábrica/distribuição de picolés, esteira de canhotos e pedidos WhatsApp A1–A4. |

### 3.3. Resolução Server-Side e Persistência de Contexto
A resolução ocorre no arquivo `app/page.tsx` no momento da requisição HTTP:
1. O servidor examina o cookie de sessão ou os parâmetros de URL `?organizationId=...` e `?tab=...`.
2. O UUID é validado contra a tabela de organizações; se nenhum parâmetro for passado, utiliza-se a organização padrão do usuário ou o fallback `rsbuild`.
3. O slug canônico é resolvido e repassado para `app/enterprise-workspace.tsx`.
4. Ao alternar entre abas ou módulos na interface, a URL é atualizada via `window.history.pushState` sem recarregar a página, garantindo que recargas manuais (F5) preservem o tenant e a aba ativa.

---

## 4. Governança RBAC e Matriz de Travas de Alçada (Regra Raquel Toss)

### 4.1. Fundamentação do Risco
Durante a concepção técnica, foi identificada a vulnerabilidade mais severa do fluxo operacional pré-existente: **a adulteração ou exclusão de registros no ERP por operadores da ponta**. Quando operadores dispõem de privilégios de exclusão, cancelamento de títulos ou baixa em lote, erros operacionais e eventuais desvios podem ser mascarados antes da auditoria executiva.

### 4.2. Estrutura Hierárquica de 4 Níveis (`lib/permissions.ts`)

```
   [ OWNER ] --------> Controle Máximo da Holding (Conselho / Fundadores)
       |
   [ ADMIN ] --------> Gerência Financeira & Diretoria (Raquel / Flávio)
       |               - Aprova Baixas no ERP em Lote
       |               - Aprova Conciliação com Divergência
       |               - Acessa Trilhas Periciais de Auditoria
       |
 [ OPERATOR ] -------> Operação Diária (Vendas, Caixa, Expedição)
       |               - Cadastra Pedidos e Comprovantes
       |               - Concilia Lançamentos Idênticos (100% match)
       |               - BLOQUEIO: Não exclui nada, não faz baixa em lote
       |
  [ VIEWER ] --------> Auditoria Externa / Sócios Cotistas
                       - Somente Leitura em Relatórios e Dashboards
```

### 4.3. Matriz de Autorização Detalhada

| Ação no Sistema | `owner` | `admin` | `operator` | `viewer` |
| :--- | :---: | :---: | :---: | :---: |
| **Visualizar Dashboards e Métricas** | Sim | Sim | Sim | Sim |
| **Acessar Zona das Sprints da Torre** | Sim | Sim (RSBUILD) | Não | Não |
| **Fazer Upload de Extratos OFX/CSV** | Sim | Sim | Sim | Não |
| **Conciliar Transações com Match 100%** | Sim | Sim | Sim | Não |
| **Aprovar Conciliação Divergente (< 100%)** | Sim | Sim | **BLOQUEADO** | Não |
| **Desfazer Conciliação com Justificativa** | Sim | Sim | **BLOQUEADO** | Não |
| **Executar Baixa em Lote no ERP Omie** | Sim | Sim | **BLOQUEADO** | Não |
| **Excluir ou Cancelar Registros** | Sim | Sim | **BLOQUEADO** | Não |
| **Visualizar Trilha de Auditoria Forense** | Sim | Sim | Não | Não |
| **Gerenciar Membros e Papéis RBAC** | Sim | Não | Não | Não |

### 4.4. Implementação nas Interfaces do Usuário
- Em `app/components/finance/baixas-view.tsx`, o botão `Executar Baixa em Lote no ERP` fica desabilitado para operadores, exibindo o aviso: *"Alçada restrita a Administradores da Diretoria (Regra de Blindagem Raquel Toss)"*.
- Em `app/components/finance/conciliacao-view.tsx`, caso haja divergência entre o valor do extrato e o lançamento contábil, a confirmação requer perfil `admin` e registro obrigatório do motivo.
- Na barra superior (`topbar.tsx`), o usuário visualiza seu crachá de perfil ativo (`PROPRIETÁRIO`, `ADMINISTRADOR`, `OPERADOR` ou `VISUALIZADOR`), mantendo total transparência institucional.

---

## 5. Motores de Domínio Financeiro e Auditoria

### 5.1. Motor de Reconciliação Bancária Multicontas (`lib/finance.ts`)
O algoritmo de reconciliação analisa múltiplos vetores com tolerância paramétrica:
$$\text{Score} = w_v \cdot S_{\text{valor}} + w_d \cdot S_{\text{data}} + w_t \cdot S_{\text{texto}}$$

- **Score $\ge 80$:** Classificado como **Match Sugerido (Automático)**. Apresentado ao operador em tom esmeralda para confirmação com 1 clique.
- **Score $< 80$ com Valores Iguais:** Apresentado como **Possível Associação**. Requer conferência visual.
- **Divergência de Valor:** Exige autorização de `admin`, preenchimento de justificativa textual e assinatura digital do operador na sessão.
- **Reversão de Match (`unmatchRecord`):** Nenhum registro é apagado; a transação é desvinculada e o evento é inserido na trilha de auditoria com timestamp, motivo e identificador do usuário.

### 5.2. Normalização Bancária Universal
- **Suporte OFX nativo:** Parser tolerante a variações bancárias (Bradesco, Itaú, Banco do Brasil, Cora, Sicoob, Stone).
- **CSV Canônico:** Suporta codificação legada `Windows-1252` (comum em exportações desktop brasileiras) e `UTF-8`, convertendo pontuações decimais brasileiras (`1.250,50` $\rightarrow$ `1250.50`) de forma determinística.

---

## 6. Governança das Sprints e Matriz de Entregas

### 6.1. Torre de Controle Executiva (`torre-controle-view.tsx`)
A Torre de Controle foi configurada com acesso exclusivo à Holding RSBUILD (`canAccessSprintZone`), integrando o cronograma oficial de 09/11 a 04/12/2026:

```
[09/11 a 15/11]    Sprint A1 (MS): Diagnóstico de Pedidos & Matriz Mestra
                   Sprint H1 (HA): Mapeamento Operacional & Contas a Pagar
                         |
[16/11 a 22/11]    Sprint A2 (MS): Esteira WhatsApp NLP & Regras de Catálogo
                   Sprint H2 (HA): Fluxo de Logística Bluemix & Estoque
                         |
[23/11 a 29/11]    Sprint A3 (MS): Coleta de Canhotos Digitais & Prova de Entrega
                   Sprint H3 (HA): Reconciliação Bancária Preliminar
                         |
[30/11 a 04/12]    Sprint A4 (MS): Homologação Integrada Mundo do Sabor
                   Sprint H4 (HA): Homologação Integrada Hub Açaí & Go-Live Ciclo 01
```

### 6.2. Estrutura de Governança Documental no Google Drive
Toda a documentação operacional e executiva reside em:
`g:\.shortcut-targets-by-id\...\Mundo do Sabor e Hub Açai\01_ GOVERNAÇA_RSBUILD\`
- `00_VISAO_EXECUTIVA_INTEGRADA/`: Relatórios consolidados da holding.
- `01_MUNDO_DO_SABOR/`: Especificações e atas da operação Mundo do Sabor.
- `02_HUB_ACAI/`: Especificações e atas da operação Hub Açaí.
- `99_HISTORICO/`: Arquivos originais e drafts preservados integralmente.
- `01_Matriz_Mestra_Controle_Projetos_RSB2BUILD.xlsx`: Planilha mestra com 6 abas dinâmicas atualizadas na versão 2.0.

---

## 7. Rastreabilidade, LGPD e Segurança da Informação

1. **Classificação Legal sob a LGPD (Lei nº 13.709/2018):**
   - **Controladoras:** As empresas Mundo do Sabor, Hub Açaí e RSBUILD Participações, que determinam as finalidades e os dados coletados de seus clientes e motoristas.
   - **Operadora Técnica:** A plataforma RSBUILD OS, responsável pelo processamento seguro, armazenamento criptografado e garantia de integridade.
2. **Cadeia de Custódia de Evidências:** Canhotos de entrega, comprovantes de pagamento e logs de alteração são gravados com metadados imutáveis (hash SHA-256 do arquivo, data/hora do servidor e ID do operador).
3. **Princípio do Menor Privilégio:** Nenhuma chave mestra (`service_role`) é exposta no frontend. Todas as requisições autenticadas respeitam os limites da role do usuário logado via RLS no Supabase.

---

## 8. Histórico de Decisões Técnicas (ADRs Sintetizadas)

- **ADR-01 (10/11/2026) — Adoção de Slugs Canônicos:** Optou-se por utilizar slugs semânticos (`rsbuild`, `hub_acai`, `mundo_sabor`) para roteamento amigável e temas visuais, mantendo UUIDs como chaves primárias e barreiras criptográficas de RLS.
- **ADR-02 (10/11/2026) — Centralização de Alçadas no Frontend e Backend:** Regras de negócio como a proibição de baixas em lote por operadores foram implementadas tanto visualmente (UI bloqueada com feedback educativo) quanto no backend (`lib/permissions.ts`), prevenindo chamadas não autorizadas.
- **ADR-03 (10/11/2026) — Preservação de Histórico no Drive:** Nenhuma pasta legada (como a sprint inicial enviada pelo Flávio) foi apagada; todas foram catalogadas na pasta `99_HISTORICO`, assegurando conformidade pericial e rastreabilidade total.

---
*Documento homologado e registrado no repositório oficial da plataforma RSBUILD.*
