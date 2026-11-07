# Changelog · RSBUILD OS

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.
O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.0.0] - 2026-11-07

### 🚀 Primeiro Release Oficial — Central Integrada de Operações (RSBUILD OS)

Primeiro lançamento estável em produção da plataforma integrada de inteligência financeira e automação logística para distribuidoras e indústrias, com suporte a multi-módulos, white-label, conformidade fiscal e exportação canônica para o ERP Omie.

---

### 💼 Módulo Financeiro & Controladoria
- **Normalização e Ingestão Bancária Multibanco (ENG-MS-01):**
  - Leitor inteligente de extratos em formato `.OFX` (v100/102, Windows-1252) e `.CSV` brasileiro (separador `;`, vírgula decimal, datas DD/MM/AAAA e ISO).
  - Identificação algorítmica de instituições financeiras parceiras: Itaú (0341), Banco do Nordeste (0004), Banco Inter (0077) e XP Investimentos (0102), com extração de agência, conta e saldo.
  - Exportação oficial de arquivo OFX normalizado para conciliação direta no ERP Omie, ordenado cronologicamente e com sanitização SGML.
- **Motor de Conciliação e Baixas em Lote (ENG-MS-02):**
  - Importação de títulos a receber do Omie (`Financas.Recebimento`).
  - Motor de correspondência assistida entre lançamentos bancários e contas a receber (casamento exato e documental).
  - Cálculo automático de juros, multas e deduções de títulos em atraso.
  - Geração da planilha oficial de Baixa em Lote do Omie (`lote_baixas_omie_*.csv`) e payloads JSON para automações via webhook.
- **Seletor de Período Corporativo & Recálculo Reativo:**
  - Presets contábeis: *Todo o Histórico*, *Mês Atual*, *Mês Anterior*, *Últimos 30/90/365 dias*, *Este Ano*.
  - Filtro customizado com seletores de data `De:` e `Até:` na Topbar.
  - Recálculo reativo em tempo real dos cartões de Entradas, Saídas, Resultado e listagem de movimentações.

---

### 🚚 Módulo Logística & Expedição
- **Padronizador Inteligente de Pedidos WhatsApp (ENG-HA-01):**
  - Decodificação de mensagens informais e transcrições de áudio do WhatsApp de clientes B2B.
  - Reconhecimento semântico de produtos do catálogo de sorvetes e açaí (Tradicional, Banana, Morango, Cupuaçu, Trufado Ninho).
  - Extração de quantidades em numerais e por extenso em português.
  - Totalização automática de caixas físicas e cubagem para ocupação do caminhão HR (capacidade 350 caixas).
  - Geração de planilha de Pedidos de Venda compatível com importação em lote no Omie.
- **Protocolo Digital de Canhotos e Blindagem de Cobrança (ENG-MS-03):**
  - Indexação de comprovantes de entrega da expedição por NF-e.
  - Validador algorítmico de chaves de 44 dígitos da NF-e com dígito verificador SEFAZ (Módulo 11).
  - Parecer de blindagem jurídica preventiva contra protestos indevidos (Lei nº 5.474/1968, Art. 15):
    - *Apto a Protesto:* Canhoto assinado pelo recebedor.
    - *Bloqueio Preventivo:* Notas sem canhoto, extraviadas ou em recusa/avaria de carga.
  - Exportação do relatório oficial de blindagem jurídica (`protocolo_blindagem_canhotos_*.csv`).

---

### 🎨 Arquitetura, UX e Design System
- **Arquitetura Modular Decomposta:**
  - Componentização limpa em pastas funcionais (`app/components/shell`, `app/components/finance`, `app/components/logistics`, `app/types`).
  - Redução do monólito inicial de 1.710 linhas para ~530 linhas com separação estrita de responsabilidades.
- **Sincronização de Navegação por URL (Deep Linking):**
  - Cada tela reflete na URL (`/?tab=visao-geral`, `/?tab=baixas`, `/?tab=canhotos`, etc.), preservando o contexto em atualizações de página (`F5`).
- **Persistência de Sessão em Cache:**
  - Extratos, títulos, canhotos e pedidos salvos em tempo real no `localStorage` do operador, com botão explícito de "Reiniciar Sessão".
- **Design System RSBUILD & Dual Theme:**
  - **Modo Sand:** Paleta editorial corporativa (Terracota `#B5583C`, Charcoal `#2B2C2E`, Sand `#F8F6F2`, fonte Libre Franklin).
  - **Modo Dark Obsidian:** Tema corporativo escuro de alto contraste (`#121316`, `#18191C`, `#F4F1EA`) com zero FOUC via script de injeção inline.
- **Ergonomia de Tabelas:**
  - Colunas de ações fixas à direita (`position: sticky; right: 0`) nas tabelas de grande largura.
- **Segurança e White-Label:**
  - Customização de razão social e logotipo da empresa contratante.
  - Ativação/desativação de módulos restrita exclusivamente ao Superadmin (`neo.sh1w4@gmail.com`).

---

### 🧪 Garantia de Qualidade
- **43 Testes Unitários Automatizados (`npm test`):**
  - 100% de cobertura nos motores fiscais, parsers de extrato, validadores SEFAZ, matching de títulos e interpretação de pedidos.
- **TypeScript Strict:**
  - Compilação limpa com 0 erros (`tsc --noEmit`).
- **Deploy Contínuo:**
  - Build de produção Next.js estático e otimizado com auto-deploy na Vercel.

