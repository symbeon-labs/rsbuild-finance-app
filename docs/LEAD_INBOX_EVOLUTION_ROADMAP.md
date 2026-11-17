# Caixa de Mensagens RSBUILD — evolução incremental

## Objetivo da primeira entrega

Receber no Workspace RSBUILD as solicitações já persistidas pelo formulário da página institucional. A primeira versão é uma caixa de entrada de leitura: listar, filtrar, abrir os dados enviados e iniciar contato por e-mail ou WhatsApp.

## Escopo entregue neste PR

- Reutilizar `diagnostic_requests` e o endpoint público de gravação já existentes.
- Ler os registros por endpoint autenticado, usando a sessão Supabase e as políticas RLS existentes.
- Exibir a caixa somente no Workspace RSBUILD para membros owner, admin ou operator.
- Apresentar contagem total, novas e em análise.
- Abrir o conteúdo integral da solicitação e facilitar o primeiro retorno.
- Não alterar status nem introduzir um CRM completo nesta etapa.

## Evoluções possíveis — fora do escopo atual

| Etapa | Evolução | Valor operacional |
|---|---|---|
| 1 | Marcar como lida / não lida | Distinguir mensagens visualizadas das pendentes |
| 2 | Atualizar status (nova, em análise, qualificada, encerrada) | Dar visibilidade ao andamento sem criar um CRM complexo |
| 3 | Responsável interno | Definir quem conduz cada contato |
| 4 | Notas privadas | Registrar contexto interno sem expor ao solicitante |
| 5 | Linha do tempo de atividades | Preservar histórico de contatos e mudanças |
| 6 | Notificações | Avisar a equipe quando chegar uma nova solicitação |
| 7 | Atualização em tempo real | Reduzir a necessidade de atualização manual |
| 8 | Priorização assistida | Sugerir urgência e área de interesse com critérios transparentes e revisão humana |
| 9 | Métricas de conversão | Medir volume, tempo de resposta e evolução das oportunidades |

## Limites de segurança

- O formulário público pode enviar dados, mas nunca consultar a caixa.
- A leitura interna usa sessão autenticada e RLS; não expor chave privilegiada no navegador.
- O acesso permanece restrito à organização RSBUILD e aos papéis autorizados.
- Notas, atribuições e eventos futuros devem manter segregação de acesso e trilha de auditoria.
- Coletar e reter somente os dados necessários para responder à solicitação, observando o aviso de privacidade e a LGPD.

## Critério para evoluir

Só implementar cada etapa quando houver necessidade operacional observável. A prioridade imediata é validar o ciclo completo: formulário enviado → registro persistido → mensagem visível no Workspace → equipe consegue responder.
