# 🧪 Homologação PR #159 — Data Intake V1 (Manual)

**Status:** Aguardando execução manual
**Ambiente:** `http://localhost:3001`
**Data:** 26/11/2026

---

## 📋 Pré-requisitos

- [x] Dev server rodando em `http://localhost:3001`
- [x] API endpoints respondendo (4/4)
- [ ] Login com usuário autenticado no Supabase
- [ ] Acesso à organização QA (`mundo_sabor_qa` ou `hub_acai_qa`)

---

## 🎯 Passo 1: Acesso e Login

1. Abra o navegador em `http://localhost:3001`
2. Faça login com:
   - Email: seu email de teste
   - Senha: sua senha de teste
3. Após login, selecione uma organização QA:
   - `mundo_sabor_qa` ou
   - `hub_acai_qa`

**Verificar:**
- [ ] Login bem-sucedido
- [ ] Workspace carregou corretamente
- [ ] Role mostrada na topbar (viewer/operator/admin)

---

## 🎯 Passo 2: Navegar até Importações

1. Clique na sidebar em **"Financeiro"**
2. Clique em **"Importações"**
3. Role até a seção **"Central de documentos"**

**Verificar:**
- [ ] Seção "RSBUILD DATA INTAKE · V1" aparece
- [ ] Título "Central de documentos" visível
- [ ] Botão "＋ Enviar documento" aparece (se role permite)

---

## 🎯 Passo 3: Upload de PDF

**Arquivo:** `categoriasemuso_303631.pdf` (ou qualquer PDF de teste)

1. Clique em "＋ Enviar documento"
2. Selecione tipo: **"Documento de apoio financeiro"**
3. Clique para selecionar arquivo
4. Escolha o PDF
5. Aguarde upload

**Verificar:**
- [ ] Upload começa sem erro
- [ ] Mensagem de sucesso aparece
- [ ] Documento aparece na lista
- [ ] SHA-256 mostrado
- [ ] Status: "RECEBIDO"

---

## 🎯 Passo 4: Upload de XLSX

**Arquivo:** `CONTAS A PAGAR PAGOS.xlsx` (ou qualquer XLSX de teste)

1. Clique em "＋ Enviar documento"
2. Selecione tipo: **"Planilha"**
3. Faça upload do XLSX

**Verificar:**
- [ ] Upload bem-sucedido
- [ ] Documento aparece na lista
- [ ] Tipo mostra "spreadsheet"

---

## 🎯 Passo 5: Detecção de Duplicata

1. Tente fazer upload do **mesmo arquivo PDF** novamente
2. Observe a resposta

**Verificar:**
- [ ] Erro: "Este arquivo já foi recebido nesta organização"
- [ ] Nenhum documento duplicado criado

---

## 🎯 Passo 6: Download de Documento

1. Clique em **"Baixar"** em um documento da lista
2. Aguarde o download

**Verificar:**
- [ ] Arquivo baixa com sucesso
- [ ] Nome do arquivo é o original
- [ ] Conteúdo íntegro

---

## 🎯 Passo 7: Teste de Permissões

### Role: Viewer
1. Se seu usuário for `viewer`:
   - Botão de upload deve estar **desabilitado** ou não visível
   - Deve conseguir ver documentos existentes
   - Deve conseguir baixar

### Role: Operator
1. Se seu usuário for `operator`:
   - Botão de upload deve estar **habilitado**
   - Deve conseguir fazer upload
   - Deve conseguir baixar

### Role: Admin
1. Se seu usuário for `admin`:
   - Botão de upload deve estar **habilitado**
   - Deve conseguir fazer upload
   - Deve conseguir baixar

**Verificar:**
- [ ] Permissões respeitadas conforme role

---

## 🎯 Passo 8: Isolamento entre Organizações

1. Faça logout
2. Faça login com usuário de **outra organização** (se disponível)
3. Verifique se documentos da organização anterior aparecem

**Verificar:**
- [ ] Documentos de outras organizações **NÃO** aparecem
- [ ] Isolamento por organization_id funcionando

---

## 🎯 Passo 9: Teste de Validação

### Tamanho Máximo
1. Tente fazer upload de um arquivo >20MB (se tiver)

**Verificar:**
- [ ] Erro: "Arquivo excede o tamanho máximo de 20MB"

### Tipo de Arquivo
1. Tente fazer upload de `.exe` ou arquivo não suportado

**Verificar:**
- [ ] Erro: "Tipo de arquivo não suportado"

---

## 📊 Resultados

| Teste | Status | Observações |
|---|---|---|
| 1. Acesso e Login | ⏳ | |
| 2. Navegar até Importações | ⏳ | |
| 3. Upload PDF | ⏳ | |
| 4. Upload XLSX | ⏳ | |
| 5. Detecção de Duplicata | ⏳ | |
| 6. Download | ⏳ | |
| 7. Permissões | ⏳ | |
| 8. Isolamento | ⏳ | |
| 9. Validação | ⏳ | |

---

## ✅ Critérios de Aprovação

Para PR #159 ser aprovada:

- [ ] Todos os uploads funcionam (PDF, XLSX)
- [ ] Duplicatas detectadas corretamente
- [ ] Downloads funcionam
- [ ] Permissões respeitadas por role
- [ ] Isolamento entre organizações OK
- [ ] Validações de tamanho e tipo funcionam
- [ ] Nenhum erro crítico no console do navegador

---

## 🚨 Problemas Encontrados

| # | Descrição | Severidade | Status |
|---|---|---|---|
| | | | |

---

## 📝 Notas Adicionais

- Data Intake V1 **não interpreta conteúdo** — apenas armazena
- Estados futuros (`under_review`, `accepted`, `rejected`) serão implementados depois
- O cleanup automático de intents expirados requer `CRON_SECRET` configurado no Vercel
- Bucket de storage é privado (não público)
