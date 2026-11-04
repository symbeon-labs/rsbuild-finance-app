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

Convites para e-mails já existentes são recusados por segurança; a associação de usuários existentes deve ser feita por um fluxo administrativo separado, não por convite duplicado.

## Importação

1. O usuário escolhe uma organização à qual pertence.
2. O arquivo CSV/OFX (máximo 10 MiB) é enviado ao bucket privado no prefixo UUID do tenant.
3. A API calcula SHA-256 do arquivo e normaliza valores para centavos inteiros.
4. A RPC `commit_financial_import` valida membership/role, payload e path; cria lote, artefato, registros e evento de auditoria em uma transação.
5. Índice único por organização + chave de deduplicação torna reenvios idempotentes.
6. Se a RPC falhar, a API remove o objeto recém-enviado; a política DELETE permite isso somente ao operador do tenant dono do prefixo.

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
