# 🧪 Homologação Funcional — PR #159 Data Intake V1

**Data:** 26/11/2026  
**Ambiente:** Local Dev (`http://localhost:3001`)  
**Organizações QA:** `mundo_sabor_qa`, `hub_acai_qa`

---

## 📋 Pré-requisitos

- [x] Dev server rodando em `http://localhost:3001`
- [x] Variáveis de ambiente configuradas (`.env.local`)
- [ ] Login com usuário da organização QA
- [ ] Arquivos de teste disponíveis

---

## 🎯 Testes de UI (Manual)

### 1. Acesso ao Painel Data Intake

**Passos:**
1. Acesse `http://localhost:3001`
2. Faça login com usuário da organização QA
3. Navegue para **Financeiro → Importações**
4. Role até a seção **"Central de documentos"**

**Verificar:**
- [ ] Painel "Central de documentos" está visível
- [ ] Seção "RSBUILD DATA INTAKE · V1" aparece
- [ ] Botão "＋ Enviar documento" está disponível (se role permite)
- [ ] Lista de documentos mostra "Nenhum documento recebido"

**Resultado:** ⏳ Pendente

---

### 2. Upload de Documento PDF

**Arquivo:** `INSUMOS_FINANCAS_RECONCILIACAO/4. Outros documentos/categoriasemuso_303631.pdf`

**Passos:**
1. Selecione tipo "Documento de apoio financeiro"
2. Clique em "＋ Enviar documento"
3. Selecione o arquivo PDF
4. Aguarde upload

**Verificar:**
- [ ] Mensagem "Documento recebido e armazenado com segurança"
- [ ] Documento aparece na lista com SHA-256
- [ ] Status mostra "RECEBIDO"
- [ ] Botão "Baixar" está disponível

**Resultado:** ⏳ Pendente

---

### 3. Upload de Planilha XLSX

**Arquivo:** `INSUMOS_FINANCAS_RECONCILIACAO/2. Contas a pagar/CONTAS A PAGAR PAGOS.xlsx`

**Passos:**
1. Selecione tipo "Planilha"
2. Faça upload do arquivo XLSX

**Verificar:**
- [ ] Upload bem-sucedido
- [ ] Documento registrado com tipo "spreadsheet"

**Resultado:** ⏳ Pendente

---

### 4. Upload de Extrato OFX

**Arquivo:** `INSUMOS_FINANCAS_RECONCILIACAO/1. Extratos bancários/ITAU Extrato_7421_996567_17-11-2026.ofx`

**Nota:** OFX não está na lista de tipos suportados. Teste com CSV ou TXT.

**Arquivo alternativo:** `INSUMOS_FINANCAS_RECONCILIACAO/1. Extratos bancários/ITAU Extrato_7421_996567_17-11-2026.pdf`

**Passos:**
1. Selecione tipo "Documento de apoio financeiro"
2. Faça upload do PDF do extrato

**Verificar:**
- [ ] Upload bem-sucedido
- [ ] Documento registrado

**Resultado:** ⏳ Pendente

---

### 5. Detecção de Duplicata

**Passos:**
1. Tente fazer upload do mesmo arquivo PDF novamente
2. Observe a resposta

**Verificar:**
- [ ] Erro "Este arquivo já foi recebido nesta organização"
- [ ] Não cria documento duplicado

**Resultado:** ⏳ Pendente

---

### 6. Download de Documento

**Passos:**
1. Clique em "Baixar" em um documento da lista
2. Aguarde o download

**Verificar:**
- [ ] Arquivo baixa com sucesso
- [ ] Nome do arquivo é o original
- [ ] Conteúdo está correto

**Resultado:** ⏳ Pendente

---

### 7. Permissões por Role

**Testar com diferentes roles:**

| Role | Upload | Download | Visualizar |
|---|---|---|---|
| `viewer` | ❌ | ✅ | ✅ |
| `operator` | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ |
| `owner` | ✅ | ✅ | ✅ |

**Verificar:**
- [ ] Viewer não vê botão de upload
- [ ] Operator consegue fazer upload
- [ ] Admin consegue fazer upload

**Resultado:** ⏳ Pendente

---

### 8. Isolamento entre Organizações

**Passos:**
1. Faça login com usuário da `hub_acai_qa`
2. Verifique se documentos da `mundo_sabor_qa` aparecem

**Verificar:**
- [ ] Documentos de outras organizações NÃO aparecem
- [ ] Tentativa de acesso direto à API retorna erro

**Resultado:** ⏳ Pendente

---

## 🔧 Testes de API (Opcional)

### Listar Documentos
```bash
curl -X GET "http://localhost:3001/api/data-intake?organizationId=550e8400-e29b-41d4-a716-446655440002" \
  -H "Cookie: {sua_sessão}"
```

### Criar Upload Intent
```bash
curl -X POST "http://localhost:3001/api/data-intake/upload-intent" \
  -H "Content-Type: application/json" \
  -H "Cookie: {sua_sessão}" \
  -d '{
    "organizationId": "550e8400-e29b-41d4-a716-446655440002",
    "fileName": "teste.pdf",
    "fileSize": 1024,
    "documentType": "financial_support"
  }'
```

---

## 📊 Resultados Consolidados

| Teste | Status | Observações |
|---|---|---|
| 1. Acesso ao Painel | ⏳ | |
| 2. Upload PDF | ⏳ | |
| 3. Upload XLSX | ⏳ | |
| 4. Upload OFX/PDF | ⏳ | |
| 5. Detecção de Duplicata | ⏳ | |
| 6. Download | ⏳ | |
| 7. Permissões | ⏳ | |
| 8. Isolamento | ⏳ | |

---

## 🚨 Problemas Encontrados

| # | Descrição | Severidade | Status |
|---|---|---|---|
| | | | |

---

## ✅ Critérios de Aprovação

- [ ] Todos os testes de upload funcionam
- [ ] Duplicatas são detectadas corretamente
- [ ] Downloads funcionam com auditoria
- [ ] Permissões respeitadas por role
- [ ] Isolamento entre organizações OK
- [ ] Nenhum erro crítico no console

---

## 📝 Notas

- O Data Intake V1 **não interpreta conteúdo** — apenas armazena e registra
- Estados futuros (`under_review`, `accepted`, `rejected`) serão implementados depois
- O cleanup automático requer `CRON_SECRET` configurado no Vercel
