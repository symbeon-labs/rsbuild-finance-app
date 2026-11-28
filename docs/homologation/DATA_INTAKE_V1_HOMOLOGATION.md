# Homologação — RSBUILD OS Data Intake V1

**Data:** 26/11/2026  
**Branch:** `reconcile/rsbuild-data-intake-main-2026-11-26`  
**Ambiente:** Local dev (`http://localhost:3001`)

---

## 📋 Checklist de Homologação

### FASE 1: API Tests (Automatizados)

#### 1.1 Listar documentos (GET /api/data-intake)
```bash
curl -X GET "http://localhost:3001/api/data-intake?organizationId={ORG_ID}" \
  -H "Cookie: {AUTH_COOKIE}"
```
**Esperado:** 200 OK com array de documentos

#### 1.2 Criar upload intent (POST /api/data-intake/upload-intent)
```bash
curl -X POST "http://localhost:3001/api/data-intake/upload-intent" \
  -H "Content-Type: application/json" \
  -H "Cookie: {AUTH_COOKIE}" \
  -d '{
    "organizationId": "{ORG_ID}",
    "fileName": "teste.pdf",
    "fileSize": 1024,
    "documentType": "financial_support",
    "description": "Teste de upload"
  }'
```
**Esperado:** 201 Created com `path`, `token`, `expiresAt`

#### 1.3 Completar upload (POST /api/data-intake/complete)
```bash
curl -X POST "http://localhost:3001/api/data-intake/complete" \
  -H "Content-Type: application/json" \
  -H "Cookie: {AUTH_COOKIE}" \
  -d '{
    "organizationId": "{ORG_ID}",
    "fileName": "teste.pdf",
    "path": "{STORAGE_PATH}",
    "documentType": "financial_support",
    "description": "Teste de upload"
  }'
```
**Esperado:** 201 Created com documento registrado

#### 1.4 Download documento (GET /api/data-intake/[documentId]/download)
```bash
curl -X GET "http://localhost:3001/api/data-intake/{DOC_ID}/download" \
  -H "Cookie: {AUTH_COOKIE}"
```
**Esperado:** 200 OK com arquivo ou redirect para signed URL

---

### FASE 2: Testes de Validação

#### 2.1 Arquivo muito grande (>20MB)
- **Esperado:** 413 `file_too_large`

#### 2.2 Tipo de arquivo não suportado (.exe, .zip)
- **Esperado:** 415 `unsupported_file_type`

#### 2.3 Arquivo corrompido (PDF sem assinatura)
- **Esperado:** 415 `unsupported_or_invalid_file`

#### 2.4 Duplicata (mesmo SHA-256)
- **Esperado:** 409 `duplicate_document`

#### 2.5 Acesso cross-organization
- **Esperado:** 403 Forbidden

---

### FASE 3: Testes de UI (Manual)

#### 3.1 Painel Data Intake
- [ ] Acessar seção "Importações" no workspace
- [ ] Verificar se painel Data Intake está visível
- [ ] Testar upload de PDF
- [ ] Testar upload de XLSX
- [ ] Testar upload de OFX
- [ ] Verificar lista de documentos
- [ ] Testar download de documento

#### 3.2 Permissões
- [ ] Verificar se `viewer` não pode fazer upload
- [ ] Verificar se `operator` pode fazer upload
- [ ] Verificar se `admin` pode fazer upload

---

## 📊 Resultados

| Teste | Status | Observações |
|---|---|---|
| 1.1 Listar documentos | ⏳ | |
| 1.2 Upload intent | ⏳ | |
| 1.3 Complete upload | ⏳ | |
| 1.4 Download | ⏳ | |
| 2.1 Arquivo grande | ⏳ | |
| 2.2 Tipo inválido | ⏳ | |
| 2.3 Arquivo corrompido | ⏳ | |
| 2.4 Duplicata | ⏳ | |
| 2.5 Cross-org | ⏳ | |
| 3.1 UI Panel | ⏳ | |
| 3.2 Permissões | ⏳ | |

---

## 🔧 Notas Técnicas

### Variáveis necessárias
- `organizationId`: UUID da organização (ex: `mundo_sabor_qa`)
- `AUTH_COOKIE`: Cookie de sessão Supabase
- `STORAGE_PATH`: Path retornado pelo upload-intent
- `DOC_ID`: ID do documento retornado pelo complete

### Arquivos de teste disponíveis
- `INSUMOS_FINANCAS_RECONCILIACAO/1. Extratos bancários/ITAU Extrato_7421_996567_17-11-2026.ofx`
- `INSUMOS_FINANCAS_RECONCILIACAO/2. Contas a pagar/CONTAS A PAGAR PAGOS.xlsx`
- `INSUMOS_FINANCAS_RECONCILIACAO/4. Outros documentos/categoriasemuso_303631.pdf`

### Limitações conhecidas
- Vercel rate limit (24h) — usando dev server local
- Supabase Preview skipped — sem branch de preview
- Functional homologation record skipped — requer execução manual
