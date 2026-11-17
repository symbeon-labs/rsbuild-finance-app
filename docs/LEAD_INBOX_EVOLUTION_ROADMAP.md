# Caixa de Mensagens RSBUILD — Handoff v1

## Objetivo

Conectar o formulário institucional já existente ao Workspace RSBUILD e oferecer o mínimo necessário para conduzir cada solicitação recebida sem implantar um CRM completo.

## Escopo desta entrega

1. **Recebimento e visualização:** reutilizar a tabela `diagnostic_requests` e o endpoint público existente.
2. **Marcação de leitura:** recibo individual por usuário; abrir uma solicitação marca como lida para aquele membro, sem alterar a leitura dos demais.
3. **Status do atendimento:** `new`, `in_review`, `qualified`, `disqualified`, `converted`. A alteração permanece restrita a owner/admin conforme a política de atualização já existente na tabela de solicitações.
4. **Responsável:** atribuir a solicitação a um membro owner/admin/operator da organização RSBUILD.
5. **Notas internas:** registrar observações privadas, vinculadas ao autor e à solicitação. Notas são append-only na interface desta versão.
6. **Contato:** atalhos para e-mail e WhatsApp.

## Modelo de dados incremental

- `diagnostic_request_reads`: estado de leitura por usuário e solicitação.
- `diagnostic_request_assignments`: responsável atual, autor da atribuição e data de atualização.
- `diagnostic_request_notes`: notas internas com autoria e data de criação.
- A tabela `diagnostic_requests` permanece como registro original do formulário; não duplicamos os dados de contato.

## Segurança e permissões

- O formulário público continua podendo somente criar solicitações pelo endpoint server-side já existente.
- A leitura da caixa exige sessão autenticada e políticas RLS.
- Leituras são individuais por usuário.
- Atribuições e notas são compartilhadas somente com owner/admin/operator da RSBUILD.
- Alteração de status é limitada a owner/admin, respeitando a política existente.
- A lista de membros é resolvida no servidor; a chave privilegiada nunca é enviada ao navegador.
- Notas não são expostas ao solicitante do formulário.
- Dados pessoais e observações internas devem ser tratados conforme a finalidade de atendimento e o aviso de privacidade aplicável.

## Fora do escopo — evoluções futuras

| Evolução | Quando considerar |
|---|---|
| Histórico unificado de eventos | Quando for necessário auditar cada transição e contato numa timeline |
| Notificações por e-mail/in-app | Quando o volume justificar alertas proativos |
| Atualização em tempo real | Quando a atualização manual deixar de ser suficiente |
| Priorização assistida por IA | Quando houver critérios claros e volume histórico para avaliação |
| Métricas de atendimento e conversão | Quando houver dados suficientes para medir tempo de resposta e conversão |
| Modelos de resposta e templates | Quando a equipe identificar perguntas recorrentes |

## Critério de aceite

- Um envio do formulário aparece na caixa interna.
- Cada membro vê seu próprio estado de leitura.
- Owner/admin consegue alterar status.
- Membros autorizados conseguem atribuir o atendimento a um colega da RSBUILD.
- Membros autorizados conseguem registrar e consultar notas internas.
- Usuários externos e membros de outros tenants não conseguem ler solicitações, notas, atribuições ou recibos.
- O fluxo público de envio continua inalterado.

## Handoff

Este PR deve ser revisado como unidade mínima de atendimento institucional. A implantação deve ocorrer somente após revisão do diff, aplicação da migration e validação do ciclo completo em preview.
