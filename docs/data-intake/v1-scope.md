# RSBUILD DATA INTAKE — V1

## Objetivo
Receber e preservar documentos de uma organização com metadados, integridade, autoria e acesso controlado. O primeiro ponto de entrada é Financeiro → Importações, mas o contrato de API e as tabelas são independentes do parser bancário e podem ser reutilizados por outros módulos.

## Fluxo
1. Usuário autenticado seleciona a organização ativa.
2. A API valida membership, papel e entitlement Finance no servidor.
3. O servidor valida membership, papel, entitlement, extensão e limite; emite um token de upload de uso único para um caminho aleatório.
4. O navegador envia os bytes diretamente ao bucket privado Supabase Storage, sem atravessar o limite de payload das Vercel Functions.
5. A rota de finalização baixa o objeto no servidor, valida codificação/assinaturas, calcula SHA-256 e verifica duplicidade por organização.
6. Registra metadados e evento `uploaded`.
7. Membros autorizados consultam a lista; download é feito por URL assinada de 60 segundos.

## Formatos V1
PDF, XLSX, XLS, DOCX, CSV, JSON, XML, TXT, PNG, JPG/JPEG e WEBP. Limite por arquivo: 20 MiB. A configuração local do Supabase e o bucket seguem o mesmo limite.

## Segurança
- Bucket privado; nenhuma URL pública.
- Upload e geração de URL assinada somente no servidor.
- Service role nunca é exposta ao browser.
- Prefixo de Storage começa pelo UUID da organização.
- Metadados e eventos têm RLS por membership.
- Operações de escrita exigem owner/admin/operator e entitlement Finance.
- Viewer pode listar e baixar documentos da organização.
- SHA-256 identifica duplicatas por organização.
- Upload intents são registrados no banco, vinculados ao usuário, nome, tamanho, MIME, classificação e observação, com validade de duas horas.
- A reconciliação diária remove objetos expirados sem metadados e preserva objetos já registrados.
- A finalização tem tolerância de 15 minutos após a expiração; a rotina de limpeza respeita a mesma janela.
- XLSX/DOCX são verificados pela estrutura ZIP/OOXML, tipos de conteúdo e partes internas obrigatórias; limites de entradas e expansão protegem contra ZIP bombs.
- Download só entrega a URL assinada quando o evento de auditoria obrigatório foi persistido.
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
