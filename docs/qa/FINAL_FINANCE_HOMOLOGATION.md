# RSBUILD Finance — Final QA / Homologação Funcional

**Escopo:** validar o fluxo de importação e leitura financeira do PR #34 antes de qualquer merge ou deploy de produção.

## Regras de segurança

- Executar exclusivamente em Preview e com usuários/organizações de teste autorizados.
- Usar arquivos CSV/OFX sintéticos, sem dados pessoais ou financeiros reais.
- Não executar migrations nem alterações no Supabase remoto.
- Não usar contas de clientes nem alterar registros de produção.
- Não compartilhar tokens, cookies, senhas ou credenciais nas evidências.
- Deploy Preview em estado `READY` não equivale a homologação funcional.

## Pré-condições

- [ ] Preview do commit candidato está acessível.
- [ ] Dois usuários de teste autorizados estão disponíveis.
- [ ] Cada usuário tem acesso somente à organização de teste correspondente.
- [ ] Arquivo sintético de importação preparado.
- [ ] Evidências serão armazenadas em local autorizado, sem segredos.

Se não houver duas organizações e usuários de teste, marcar os testes multi-tenant como **BLOCKED**. Não substituir por dados reais.

## Casos de teste

### QA-01 — Login e recuperação de sessão

1. Abrir o Preview em janela limpa.
2. Autenticar com o usuário de teste A.
3. Confirmar que a organização esperada está ativa.
4. Atualizar a página e confirmar a recuperação correta da sessão.

**Aprovação:** sessão válida, organização correta e ausência de erro de autenticação.

### QA-02 — Importação sintética

1. Selecionar o arquivo CSV/OFX sintético.
2. Conferir a prévia e os avisos.
3. Confirmar a importação somente se a prévia estiver válida.
4. Registrar o resultado apresentado pela interface.

**Aprovação:** arquivo processado sem erro inesperado; nenhum dado real utilizado.

### QA-03 — Contadores

1. Registrar a quantidade esperada de novos registros e duplicados no arquivo de teste.
2. Executar a importação.
3. Comparar os contadores da interface com o resultado persistido/retornado.

**Aprovação:** contadores de inseridos e duplicados correspondem ao resultado da operação; não aceitar sucesso com contagem enganosa.

### QA-04 — Persistência após reload

1. Registrar os movimentos importados visíveis.
2. Recarregar a página.
3. Sair e entrar novamente, se o ambiente de teste permitir.
4. Comparar os movimentos antes e depois.

**Aprovação:** movimentos persistidos da organização ativa são recuperados pelo GET e permanecem consistentes após reload e nova sessão.

### QA-05 — Isolamento entre organizações

1. Com usuário A, importar dados sintéticos exclusivos da organização A.
2. Encerrar a sessão e autenticar com usuário B, vinculado à organização B.
3. Verificar se os dados de A não aparecem em B.
4. Repetir a conferência ao retornar a A.

**Aprovação:** nenhum movimento, resumo ou dado de A é exibido em B, e vice-versa. Se não houver dois usuários/organizações de teste, marcar BLOCKED.

### QA-06 — Isolamento de dados locais

1. Na organização A, registrar dados de protótipo nos módulos de títulos, comprovantes/canhotos ou pedidos, se disponíveis.
2. Trocar para a organização B.
3. Verificar que os dados locais de A não aparecem em B.
4. Retornar a A e confirmar o escopo local esperado.

**Aprovação:** chaves locais são segregadas por organização. Os módulos identificados como protótipo não devem ser tratados como registros oficiais persistidos no servidor.

### QA-07 — Responsividade

1. Testar a tela em viewport móvel e desktop.
2. Percorrer login, importação, resultados e dashboard.
3. Verificar cortes, sobreposição, rolagem horizontal indevida e controles inacessíveis.

**Aprovação:** ações essenciais permanecem utilizáveis e informações críticas legíveis nos dois viewports.

## Registro e execução pelo GitHub Actions

1. Abrir **Actions → Final Finance QA**.
2. Selecionar **Run workflow** na branch de homologação.
3. Informar o responsável e o resultado de cada caso: `PASS`, `FAIL`, `BLOCKED` ou `PENDING`.
4. Informar um link/identificador de evidências e observações.
5. Executar. O workflow repetirá CI técnico e gerará um artefato `final-qa-report.md`.

O gate só retorna sucesso quando o CI técnico estiver verde, todos os sete casos estiverem em `PASS` e houver referência de evidências. `BLOCKED`, `FAIL` ou `PENDING` mantêm a homologação reprovada/não concluída.

## Evidências mínimas

- Identificação do commit e URL do Preview.
- Capturas sem dados sensíveis dos resultados de cada caso.
- Arquivo sintético utilizado (ou hash/nome e especificação do dataset).
- Resultado esperado versus observado para os contadores.
- Evidência de troca entre as duas organizações.
- Responsável, data e observações/defeitos.

## Critério de saída

- [ ] CI técnico aprovado.
- [ ] QA-01 a QA-07 aprovados.
- [ ] Evidências revisáveis anexadas ou referenciadas.
- [ ] Nenhum defeito P0/P1 aberto.
- [ ] Aprovação humana registrada no PR #34.

**Este workflow registra e avalia a homologação; não faz merge, não publica produção e não altera o Supabase remoto.** A aprovação do workflow, isoladamente, não substitui revisão humana nem configura proteção de branch no GitHub.
