# RSBUILD Finance — Pré-homologação sem custo

**Data de referência:** 11/11/2026  
**Repositório:** `symbeon-labs/rsbuild-finance-app`  
**Objetivo:** consolidar evidências técnicas disponíveis e preparar a homologação funcional sem criar infraestrutura paga, sem alterar o Supabase remoto e sem publicar em produção.

## 1. Decisão operacional

A homologação seguirá em modo **zero custo adicional** até a formalização comercial do RSBUILD.

- Não criar Supabase Branch de QA.
- Não habilitar compute adicional nem serviço pago.
- Não executar migrations, inserts, updates ou deletes no Supabase remoto.
- Não utilizar dados, usuários ou organizações reais de clientes como massa de teste.
- Não mesclar PRs nem promover deploy para produção como parte deste pacote.
- Não contornar autenticação/SSO do Preview nem solicitar compartilhamento de credenciais.

## 2. Evidências técnicas verificadas

### PR #34 — fluxo de importação e persistência

Commit validado: `34fe8519d2a5591e9c30e562a453b46ae3655d62`.

| Verificação | Resultado observado |
|---|---|
| CI principal | PASS — run #239 |
| Audit, testes, typecheck e build | PASS |
| Full Verification — aplicação | PASS |
| Full Verification — migrations locais e pgTAP | PASS |
| Vercel Preview | READY para o commit candidato (verificação anterior) |
| Teste manual da interface | BLOCKED — Preview protegido por SSO/acesso não disponível nesta sessão |

Runs consultados:
- CI: [run 43057474224](https://github.com/symbeon-labs/rsbuild-finance-app/actions/runs/43057474224)
- Full Verification: [run 43057474203](https://github.com/symbeon-labs/rsbuild-finance-app/actions/runs/43057474203)

**Interpretação:** a validação automatizada da aplicação e da suíte de banco em Supabase local isolado passou. Isso não prova o comportamento ponta a ponta na interface, o isolamento real entre dois usuários nem a operação no ambiente do cliente.

### PR #35 — protocolo de homologação

Commit consultado: `c8e3e33994f71ed320f52b79ffc8c7410362a9ee`.

- Workflow `Final Finance QA`: execução técnica PASS — [run 43058605875](https://github.com/symbeon-labs/rsbuild-finance-app/actions/runs/43058605875).
- Etapas concluídas com sucesso: instalação, audit, testes, TypeScript e build.
- Job de registro funcional: SKIPPED, pois a execução foi disparada por evento de push, não por `workflow_dispatch`.
- O formulário de execução manual ainda depende de o workflow existir na branch padrão. Não mesclar apenas para habilitá-lo.

## 3. Achado adicional da revisão estática

### F-01 — Limite de 5.000 movimentos sem aviso na experiência

**Classificação:** risco funcional de completude de dados; correção recomendada antes de aceite para operações com volume superior ao limite.

- A rota `GET /api/imports` consulta no máximo 5.000 registros e devolve o campo `truncated` quando atinge esse limite.
- O consumidor em `app/enterprise-workspace.tsx` utiliza `payload.records`, mas não trata `payload.truncated`.
- Consequência potencial: quando a organização ultrapassar 5.000 movimentos no conjunto consultado, totais e indicadores calculados no cliente podem representar somente a amostra retornada.
- A existência do limite foi confirmada no diff da PR #34. Não foi possível observar o efeito em runtime por falta de acesso interativo ao Preview.

**Recomendação de fechamento:** implementar paginação/carregamento incremental com agregação consistente, ou bloquear/sinalizar claramente os indicadores quando a resposta estiver truncada. Adicionar teste automatizado para o comportamento acima do limite. Até a correção ou uma decisão formal de escopo/volume, manter este achado aberto.

## 4. Estado de acesso e infraestrutura

| Dependência | Estado |
|---|---|
| Supabase remoto | Nenhuma escrita ou migration executada nesta etapa |
| Branch Supabase exclusiva de QA | Não criada — decisão de custo zero |
| Preview Vercel | Deploy READY anteriormente; acesso interativo bloqueado por proteção/SSO |
| Identidades de QA | **Não cadastradas no Supabase Auth** |
| Dois tenants de teste | Não provisionados/confirmados |
| Massa sintética | Preparada em fixture; compatibilidade com parser ainda precisa ser validada |
| Evidência visual da interface | Pendente de acesso autorizado ao Preview |

As organizações já existentes no banco não devem ser presumidas como tenants de teste e não serão utilizadas para simular isolamento.

## 4.1 Identidades indicadas, mas não cadastradas

Os seguintes e-mails foram indicados para uso nos testes, mas **não foram cadastrados** no Supabase Auth:

| Identidade | Uso proposto | Estado |
|---|---|---|
| `symbeonlabs@gmail.com` | QA — Organização A | Não cadastrada |
| `makunesayto@gmail.com` | QA — Organização B | Não cadastrada |

Portanto, neste momento não existem duas identidades de QA provisionadas nem evidência de vínculo a dois tenants distintos. A indicação dos endereços não equivale a cadastro, convite, autenticação ou autorização de acesso.

O provisionamento deverá ser feito pelo responsável autorizado do ambiente, após definição dos dois tenants exclusivamente de teste. Nenhuma conta foi criada, convite enviado ou dado remoto alterado nesta etapa. Não compartilhar senhas, links mágicos, códigos OTP ou tokens.

## 5. Matriz funcional — estado atual

Os casos abaixo permanecem sem PASS funcional. A classificação BLOCKED indica ausência de pré-condição de acesso/ambiente, não uma falha comprovada do produto.

| ID | Caso | Estado | Motivo / condição para executar |
|---|---|---|---|
| QA-01 | Login e recuperação de sessão | BLOCKED | Identidades não cadastradas no Supabase Auth e acesso autorizado ao Preview pendente |
| QA-02 | Importação de arquivo sintético | BLOCKED | Preview acessível e fixture compatível com o parser |
| QA-03 | Contadores de inseridos e duplicados | BLOCKED | Executar QA-02 e comparar retorno com resultado persistido |
| QA-04 | Persistência após reload e novo login | BLOCKED | Identidades/sessão de teste e execução de importação |
| QA-05 | Isolamento entre organizações | BLOCKED | Cadastrar as duas identidades e vinculá-las a dois tenants de teste distintos |
| QA-06 | Isolamento de dados locais por organização | BLOCKED | Acesso interativo e duas organizações de teste |
| QA-07 | Responsividade móvel e desktop | BLOCKED | Acesso interativo ao Preview |

## 6. Massa sintética preparada

Fixture versionada: [finance-import-synthetic.csv](./fixtures/finance-import-synthetic.csv).

- 3 movimentos sintéticos: 2 entradas e 1 saída.
- Total de entradas esperado: R$ 2.375,25.
- Total de saídas esperado: R$ 250,50.
- Saldo líquido esperado: R$ 2.124,75.
- Categorias e descrições são artificiais; não há dados de cliente.
- O arquivo serve para validar leitura e prévia CSV. A contagem de duplicados exige reimportação controlada e confirmação do comportamento idempotente no ambiente de teste.

## 7. Plano de execução sem custo

1. Manter PR #34 e PR #35 em revisão; não mesclar nem promover produção.
2. Usar os resultados atuais do GitHub Actions como evidência técnica, vinculados aos SHAs acima.
3. O responsável autorizado deve cadastrar as duas identidades indicadas no Supabase Auth e vinculá-las a tenants exclusivamente de teste. Não reutilizar organizações ou dados reais de clientes.
4. Confirmar um caminho autorizado para acessar o Preview protegido, sem compartilhar senhas, cookies ou tokens.
5. Revisar o parser e confirmar CSV/OFX sintético compatível; registrar dataset, hash e resultado esperado.
6. Executar QA-01 a QA-07 no Preview, capturando evidências sem dados sensíveis.
7. Registrar defeitos, retestar correções e fechar o relatório com o SHA exato testado.

Se o acesso ao Preview continuar indisponível, a alternativa é executar localmente pelo responsável técnico, usando configuração de teste e dados sintéticos, sem apontar para o Supabase de produção. A execução local deve registrar versão/commit, ambiente e evidências.

## 8. Critério de homologação

A homologação só poderá ser declarada concluída quando:

- CI técnico estiver verde no commit candidato;
- QA-01 a QA-07 estiverem PASS, com evidências revisáveis;
- os testes multi-tenant forem executados com duas identidades cadastradas e duas organizações de teste;
- não houver defeitos críticos ou altos em aberto;
- houver aceite humano registrado.

**Status nesta data: PRÉ-HOMOLOGAÇÃO TÉCNICA APROVADA; HOMOLOGAÇÃO FUNCIONAL NÃO CONCLUÍDA; IDENTIDADES DE QA NÃO CADASTRADAS; F-01 ABERTO PARA CORREÇÃO/DECISÃO.**

Este documento não representa aceite do cliente, certificação de segurança, autorização de produção ou declaração de que todos os módulos do RSBUILD Finance estão prontos.
