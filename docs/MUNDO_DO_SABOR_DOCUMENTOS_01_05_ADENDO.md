# Adendo técnico — documentos executivos Mundo do Sabor (01–05)

**Data:** 2026-11-04  
**Objeto:** atualizar a leitura dos cinco documentos originais à luz da implementação D02 do RSBUILD Finance.

Este adendo não substitui nem altera retroativamente os PDFs assinados/compartilhados. Deve acompanhar a próxima revisão controlada dos documentos.

## Regra de interpretação comum

A existência de código, migrations versionadas, workflows verdes ou ambiente dedicado não equivale a: (a) migration aplicada no projeto remoto; (b) homologação funcional com usuários reais; (c) disponibilidade em produção; (d) aceite do cliente; (e) contratação, cessão ou licença de propriedade intelectual. Essas condições devem ser registradas separadamente.

## Documento 01 — Apresentação executiva

**Manter:** a proposta de valor e a narrativa de reconciliação financeira assistida.

**Atualizar na próxima revisão:** declarar que existe uma base técnica D02 em desenvolvimento, com autenticação SSR, vínculo multiempresa, persistência PostgreSQL, armazenamento privado e fluxo de importação em evolução.

**Não declarar:** integração Omie/bancos concluída, conciliação automática, aplicação implantada/disponível ou homologação operacional. A existência da base técnica não altera o status comercial nem amplia o escopo acordado.

## Documento 02 — Definição do MVP Mundo do Sabor

**Manter:** o escopo de negócio original, os formatos de entrada previstos e as exclusões expressas (integração ERP/bancos e conciliação automática, salvo aditivo).

**Atualizar:** substituir afirmações absolutas de inexistência de persistência/auth por uma distinção: infraestrutura técnica D02 implementada/versionada; homologação e decisão operacional de uso ainda pendentes.

**Não inferir:** que a infraestrutura construída transforma automaticamente persistência, multiempresa, integrações ou automações em entregáveis contratados do MVP.

## Documento 03 — Arquitetura e interoperabilidade

**Atualizar o estado técnico para:** Next.js App Router; Supabase gerenciado como base de persistência; PostgreSQL como fonte de verdade; Supabase Auth SSR; membership/RLS por organização; bucket privado tenant-scoped; parsing de CSV/OFX no servidor; valores monetários em centavos inteiros; importação idempotente por organização; gateway UEAP por contrato.

**Registrar limites:** o upload no Storage e a transação PostgreSQL são operações separadas, com compensação em falha; isso não é atomicidade distribuída. O ERP permanece somente leitura/dry-run, sem escrita autorizada. O núcleo UEAP não integra este repositório.

## Documento 04 — Registro de decisões e condições

Manter a necessidade de persistência como decisão operacional a confirmar. Acrescentar quatro estados independentes:

1. **Técnico:** implementação e migrations versionadas.
2. **Infraestrutura:** confirmação de migrations aplicadas no projeto remoto e configuração de Auth/Storage.
3. **Operacional:** usuários, rotinas, permissões, suporte e homologação com dois tenants.
4. **Comercial/contratual:** escopo, preço, aceite, propriedade intelectual e autorização de uso.

Nenhum desses estados deve ser usado como substituto dos demais.

## Documento 05 — Diagnóstico, validação e condições comerciais

**Manter:** etapas comerciais, entregáveis, pagamentos, governança, confidencialidade, proteção de dados, critérios de aceite e controle de mudança de escopo.

**Complementar:** anexar inventário dos ativos preexistentes e desenvolvimentos realizados no RSBUILD Finance, distinguindo componentes reutilizáveis da Symbeon, configurações específicas do cliente, integrações contratadas e itens ainda não homologados.

**Propriedade intelectual:** código existente não implica cessão ou licença automática. Qualquer cessão, licença, exclusividade, transferência de repositório ou obrigação de suporte deve constar expressamente do instrumento contratual.

## Evidências mínimas antes de declarar D02 homologada

- Histórico remoto confirma todas as migrations necessárias.
- Auth/SMTP/callback validados com contas reais de teste.
- Upload, download e compensação Storage testados com dois tenants.
- Viewer sem permissão de escrita; membership revogada impede acesso.
- Importação server-side reproduz os registros derivados da fonte e rejeita parsing parcial.
- Reimportação idempotente com contadores separados.
- Valores monetários permanecem inteiros em centavos.
- Persistência confirmada após logout/login.
- Evidências de CI, pgTAP, Security/Performance Advisors e testes de aceitação arquivadas.

