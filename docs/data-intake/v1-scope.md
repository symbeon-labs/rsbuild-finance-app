# RSBUILD DATA INTAKE — V1

## Objetivo
Receber e preservar documentos de uma organização com metadados, integridade, autoria e acesso controlado. O primeiro ponto de entrada é Financeiro → Importações, mas o contrato de API e as tabelas são independentes do parser bancário e podem ser reutilizados por outros módulos.

## Fluxo
1. Usuário autenticado seleciona a organização ativa.
2. A API valida membership, papel e entitlement Finance no servidor.
3. O servidor valida extensão, limite de tamanho, codificação textual e assinaturas binárias básicas.
4. Calcula SHA-256 e verifica duplicidade dentro da organização.
5. Armazena o original no bucket privado `rsbuild-data-intake`.
6. Registra metadados e evento `uploaded`.
7. Membros autorizados consultam a lista; download é feito por URL assinada de 60 segundos.

## Formatos V1
PDF, XLSX, XLS, DOCX, CSV, JSON, XML, TXT, PNG, JPG/JPEG e WEBP. Limite por arquivo: 20 MiB.

## Segurança
- Bucket privado; nenhuma URL pública.
- Upload e geração de URL assinada somente no servidor.
- Service role nunca é exposta ao browser.
- Prefixo de Storage começa pelo UUID da organização.
- Metadados e eventos têm RLS por membership.
- Operações de escrita exigem owner/admin/operator e entitlement Finance.
- Viewer pode listar e baixar documentos da organização.
- SHA-256 identifica duplicatas por organização.
- Não existe exclusão pela interface/API V1.

## Estados e classificação
Classificações: financial_support, invoice, boleto, receipt, contract, spreadsheet, other.
Estado inicial: received. Estados previstos para etapas seguintes: under_review, accepted e rejected.

## Limites deliberados
V1 é intake e preservação, não um pipeline OCR/ETL. Não interpreta conteúdo, não cria lançamentos financeiros, não associa automaticamente notas a fornecedores, não altera registros bancários e não envia conteúdo para provedores de IA. Toda extração e publicação futura exige revisão humana e trilha de auditoria.

## Próximas etapas
- Preview seguro de PDF/imagem com proteção contra conteúdo ativo.
- Extração de texto e OCR assíncronos.
- Parsers específicos para NF-e, boletos, comprovantes e planilhas.
- Fila de revisão e associação a relacionamentos.
- Idempotência e reprocessamento com versões de parser.
- Integração modular com Financeiro, Fiscal, Logística e Contratos.
