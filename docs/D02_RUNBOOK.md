# D02 — Runbook de ativação

## Variáveis

Configure no ambiente de deploy (Preview e Production):

| Variável | Escopo | Origem |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Supabase Publishable key |
| `SUPABASE_SECRET_KEY` | Server only | Supabase Secret API key (`sb_secret_...`) |
| `RSBUILD_PLATFORM_ADMIN_EMAILS` | Server only | Allowlist de administradores verificados |

Nunca use prefixo `NEXT_PUBLIC_` na chave secreta. Não armazene credenciais em GitHub, issues, fixtures ou logs.

## Supabase Auth

1. Habilite Email provider e password sign-in.
2. Configure SMTP próprio e remetente verificado para convites.
3. Defina Site URL para o domínio oficial do app.
4. Adicione redirect allowlist para:
   - `https://SEU_DOMINIO/auth/callback`
   - `https://SEU_DOMINIO/**` somente se necessário; prefira rotas explícitas.
   - URL localhost para desenvolvimento.
5. Convites enviados pelo endpoint terminam em `/auth/callback?next=/account/password`.
6. Após o primeiro convite, o usuário define senha de no mínimo 12 caracteres.

## Provisionamento

Endpoint: `POST /api/admin/provision`

Payload:
```json
{
  "email": "usuario@empresa.com",
  "legalName": "Empresa Ltda",
  "displayName": "Empresa",
  "taxIdentifier": "opcional"
}
```

Controles:
- Sessão autenticada e e-mail confirmado.
- E-mail do ator presente em `RSBUILD_PLATFORM_ADMIN_EMAILS`.
- Origem da requisição deve corresponder à origem do app.
- Organização criada por cliente server-only com chave secreta.
- Usuário convidado pelo Supabase Auth e associado como `owner`.
- Falha de convite ou membership executa rollback compensatório da organização/usuário recém-criado.

Se o e-mail já pertencer a uma conta existente, o endpoint localiza a conta e cria o vínculo owner sem reenviar convite. Em rollback, contas preexistentes nunca são excluídas; somente usuários recém-criados pelo próprio fluxo podem ser removidos.

## Importação

1. O usuário escolhe uma organização à qual pertence.
2. O arquivo CSV/OFX (máximo 10 MiB) é enviado ao bucket privado no prefixo UUID do tenant.
3. A API calcula SHA-256 e interpreta o arquivo original no servidor usando parser versionado. O campo `records` do navegador, se enviado por cliente antigo ou adulterado, não é fonte de dados e não é persistido.
4. Se houver qualquer erro de parsing, o arquivo inteiro é rejeitado; não há importação parcial silenciosa. A versão do parser, índice da linha e identificador de origem são registrados nos metadados de cada registro.
5. Valores são mantidos como inteiros em centavos (`amount_minor`) do parser ao banco, API e agregações; apenas a camada de formatação converte para BRL.
6. A RPC `commit_financial_import` valida membership/role, payload e path; cria lote, artefato, registros e evento de auditoria em uma transação.
7. Índice único por organização + chave de deduplicação torna reenvios idempotentes.
   - A chave atual usa hash do arquivo original + posição da linha, evitando colapsar duas transações legítimas com mesmo dia/descrição/valor.
   - Isso garante retry idempotente do mesmo arquivo; não afirma deduplicação semântica entre extratos diferentes. `sourceRecordId` permanece como proveniência.
8. Se a RPC falhar, a API tenta remover o objeto recém-enviado. Se a compensação falhar, um evento estruturado é registrado no log com tenant, path e hash; o objeto deve ser revisado na rotina de reconciliação. Isso não é atomicidade distribuída entre Storage e PostgreSQL.
9. A RPC retorna `inserted_count`, `duplicate_count` e `rejected_count` separadamente. O endpoint rejeita o arquivo inteiro antes da RPC em caso de erro de parsing; duplicatas não são rejeições.

## Aceitação antes de produção

- [ ] SMTP real entrega convite e callback conclui PKCE.
- [ ] Administrador consegue provisionar organização e owner.
- [ ] Owner/operator consegue persistir importação e recuperar dados após novo login.
- [ ] Viewer lê, mas não importa.
- [ ] Tenant B não lê, atualiza, remove nem baixa artefatos do tenant A.
- [ ] Reimportar o mesmo extrato não duplica lançamentos.
- [ ] Logs e browser não contêm chave secreta.
- [ ] Advisors Security/Performance reexecutados após migrations.

O ambiente local e os testes pgTAP não substituem esses testes de aceitação com usuários autenticados reais.
