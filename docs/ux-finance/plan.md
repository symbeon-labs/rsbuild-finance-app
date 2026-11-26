# UX Finance — plano de consistência V1

## Objetivo
Padronizar a experiência de interação dos módulos financeiros do RSBUILD, reduzindo fricção operacional sem alterar regras de negócio.

## Escopo
- **Importações:** hierarquia de ações, filtros e prévia.
- **Movimentações:** barra de busca, filtros e estados vazios.
- **Baixas / títulos:** organização da navegação por natureza e situação, preservando todos os filtros existentes.
- **DRE:** fluxo de revisão, seleção e feedback das classificações.
- **Centro de Operações em Lote:** seleção, ações e comunicação de governança.
- **Padrões compartilhados:** controles responsivos, acessibilidade e estados ativos.

## Dependência e não duplicação
A PR #156 já cobre uma trilha de elevação visual da Torre de Controle e componentes da Mesa de Conciliação. Esta trilha evita duplicar essas alterações. Qualquer ajuste na Conciliação será limitado ao necessário para consistência e coordenado com a #156.

## Guardrails
- Branch isolada baseada em `main`.
- Não alterar cálculos, regras financeiras, conciliação, permissões, APIs ou persistência.
- Não modificar dados operacionais nem executar migrations.
- Não fazer merge nem deploy de produção.
- Preservar o design system existente e as variantes Sand / Obsidian.
- Validar typecheck, testes, build e responsividade antes de solicitar revisão.
- Distinguir evidências de CI, Preview e QA funcional autenticado.

## Plano de validação
1. Revisão do diff para confirmar escopo visual.
2. Typecheck e testes automatizados.
3. Build/CI e Preview da PR.
4. Homologação visual em desktop e mobile nos ambientes QA, sem tocar workspaces operacionais.

## Status
Implementação visual parcial registrada em Importações, Movimentações, Baixas/Títulos, DRE e Centro de Operações em Lote. Typecheck, testes, build, Preview e QA visual ainda pendentes.
