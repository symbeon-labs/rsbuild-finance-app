# F01 — Revisão cruzada das especificações 1.1 a 1.4

**Versão:** 0.1  
**Data:** 2026-11-12  
**Status:** Revisão documental — bloqueadores identificados; não aprovada para implementação  
**Escopo:** consistência entre domínio, modelo lógico, modelo físico e contratos transacionais/testes.

> Esta revisão compara os quatro documentos da branch F01. Não executa código, migrations, consultas ao Supabase nem testes funcionais. Os achados são inconsistências documentais e lacunas de contrato, não evidência de defeito em runtime.

## 1. Parecer executivo

**F01 ainda não está pronto para virar migration ou implementação transacional.** A arquitetura geral é coerente — separa título, liquidação, movimento bancário e decisão de conciliação; preserva tenant scope; define maker-checker; e trata reversões e split como eventos quantitativos. Porém, há conflitos entre redações antigas e decisões consolidadas nos adendos, além de lacunas aritméticas que podem produzir saldos incorretos.

### Resultado

- **Aprovável como direção arquitetural:** separação dos agregados, tenant isolation, autorização server-side, histórico append-only, ledger bancário quantitativo.
- **Não aprovável ainda como contrato de implementação:** composição de ajustes, saldo de título, reversão parcial, estado parcial da liquidação, granularidade título/parcela e semântica de liquidação sem movimento bancário.
- **Gate recomendado:** corrigir os itens P0 abaixo nos documentos F01.1–F01.4 e fazer nova leitura cruzada antes de qualquer migration.

## 2. Achados prioritários

### CR-01 — P0: “sem movimento bancário” está confundido com “sem alocação de título”

**Onde:** F01.1 seção 9.1/P02 e seção 9.4; F01.1 B06; F01.3 seção 4.4 e seção 13.7; F01.4 confirm_settlement.

**Conflito:** P02 chama a política de “Liquidação sem movimento bancário”, mas seu texto restringe “liquidação sem alocação”. São conceitos diferentes:
- uma liquidação pode extinguir título por alocação e ter evidência de pagamento em caixa, compensação ou outro meio sem linha bancária importada;
- uma liquidação sem alocação não extingue título específico e exigiria ledger de crédito/adiantamento, fora do MVP.

**Risco:** bloquear indevidamente meios legítimos de liquidação sem extrato, ou interpretar a permissão de pagamento fora do banco como permissão para confirmar liquidação sem título associado.

**Correção requerida:** renomear P02 para “Liquidação sem movimento bancário” e definir duas regras independentes:
1. **Alocação em título:** obrigatória para toda liquidação confirmada no MVP.
2. **Vínculo com movimento bancário:** opcional, desde que exista meio de pagamento e evidência documental mínima conforme política.
Manter crédito/adiantamento sem alocação desabilitado.

**Teste necessário:** confirmar liquidação alocada a título sem financial_record, com evidência e meio aceitos; confirmar que liquidação sem alocação continua rejeitada.

### CR-02 — P0: fórmula de extinção pode gerar saldo negativo e contradiz o modelo de saldo

**Onde:** F01.3 seção 13.2/13.4; F01.4 seção 2.2 e fixture A1; F01.2 seção 4.4–4.5.

**Conflito:** a fórmula define `title_extinguished_minor = principal_amount_minor + SUM(title_effect_minor)` e o saldo como valor original confirmado menos valores extintos. A fixture A1 aplica principal 100.000 + juros com `title_effect_minor=+2.000`, resultando em 102.000 extintos sobre título original de 100.000. Isso pode produzir saldo negativo de 2.000. Ao mesmo tempo, o comando de alocação limita principal ao saldo aberto, mas não especifica como juros vencidos passam a compor o saldo exigível.

**Risco:** sobre-extinção, saldo negativo, juros sem base de cálculo/competência e reconciliação inconsistente.

**Correção requerida:** separar explicitamente:
- principal original ainda aberto;
- encargos/acréscimos reconhecidos e exigíveis;
- desconto/abatimento que reduz obrigação;
- caixa pago/recebido.
Definir se juros/multa são registrados como ajuste do título antes da liquidação (aumentando o saldo exigível) ou se podem ser extintos na mesma liquidação sem alterar o principal original. A fórmula de saldo deve subtrair extinção do saldo exigível, nunca subtrair do principal original um valor maior que ele. Não permitir que a fixture A1 seja aceite sem esse contrato.

**Gate:** responsável financeiro aprova exemplos de juros, multa, desconto caixa-only e desconto que reduz obrigação, com saldo anterior e posterior explicitados.

### CR-03 — P0: ajustes têm dois schemas incompatíveis e o modelo lógico não incorporou a decisão B03

**Onde:** F01.2 seção 4.5; F01.3 seção 4.6 versus seção 13.12; F01.4 seção 2.2.

**Conflito:** o modelo lógico ainda descreve `amount_minor` e sinal a formalizar. A tabela física base ainda descreve `effect` + `amount_minor`. O adendo físico 13.12 determina substituição por `cash_effect_minor` e `title_effect_minor`, ambos assinados. F01.4 já usa os dois campos.

**Risco:** implementação pode seguir a tabela antiga e não suportar o contrato aritmético de F01.4.

**Correção requerida:** atualizar o corpo principal de F01.2 e F01.3, não apenas o adendo, para um único schema canônico. Definir se os efeitos ficam na linha de ajuste ou materializados na alocação; documentar FK e escopo da alocação. Remover `fee`/tarifa do catálogo de ajustes de título conforme B03.

### CR-04 — P0: estorno parcial não está refletido no estado da liquidação

**Onde:** F01.1 seção 5; F01.2 seção 4.3; F01.3 seção 4.4 e seção 8; F01.4 reverse_settlement e fixture A6.

**Conflito:** F01.1 e F01.2 usam apenas `draft/confirmed/reversed`; F01.3 mantém a mesma enumeração e transição direta `confirmed → reversed`. F01.4 exige reversões parciais sucessivas e estado “parcialmente revertida”.

**Risco:** estado materializado não consegue representar uma liquidação parcialmente revertida sem mentir ou depender de inferência não especificada.

**Correção requerida:** introduzir estado `partially_reversed` (ou declarar formalmente que status é projeção calculada e definir a fórmula/consulta de projeção). Documentar os campos/entidades de reversão por alocação e a regra de total reversível por valor de título e caixa separadamente. Evitar `reversal_of_id` como alternativa ambígua quando a arquitetura adotada é evento de reversão separado.

### CR-05 — P0: granularidade título versus parcela não está fechada

**Onde:** F01.1 seção 4.2 e 4.4; F01.2 seção 4.4; F01.3 seção 4.5 e FK adicional; F01.4 allocate_settlement.

**Conflito:** uma alocação sempre referencia `financial_title_id` e pode opcionalmente referenciar `title_installment_id`. Porém, os comandos não definem como impedir que o mesmo saldo seja consumido uma vez no nível do título e novamente no nível de uma parcela. Também não definem se o saldo do título é agregado das parcelas ou se títulos com parcelas podem receber alocação direta no cabeçalho.

**Risco:** dupla contagem e sobre-alocação apesar de locks por linha, se o comando bloquear agregados diferentes ou não consolidar o saldo.

**Correção requerida:** fechar regra P01 do MVP:
- ou a alocação é sempre no nível da parcela quando o título tem parcelas, e no nível do título somente quando não há parcelas;
- ou a alocação sempre aponta para a unidade operacional canônica e o banco impede coexistência de alocação em níveis diferentes para o mesmo título.
Definir lock do agregado raiz do título e das parcelas afetadas, e saldo derivado único.

### CR-06 — P1: idempotência global de comandos não tem persistência física correspondente

**Onde:** F01.4 seções 1 e 3.2; F01.2 seção 4.3 e 8; F01.3 settlements/reversals.

**Conflito:** F01.4 define idempotência para todo comando mutável, escopada por organização + tipo de comando. O modelo lógico/físico só apresenta `idempotency_key` em settlements e reversals, com UNIQUE por organização, sem uma tabela/contrato comum para criação de título, alocação, conciliação, política e grants. A constraint por organização isolada também não corresponde ao namespace por tipo de comando descrito em F01.4.

**Risco:** colisões entre comandos distintos, ausência de replay seguro em comandos que não criam settlement e comportamento divergente entre API e banco.

**Correção requerida:** escolher e documentar um único desenho:
- ledger/tabela comum de command idempotency com UNIQUE (organization_id, command_type, idempotency_key), hash do payload, estado e referência do resultado; ou
- chaves idempotentes específicas em cada agregado, com namespace e constraints coerentes e cobertura explícita de cada comando.
A primeira opção oferece contrato mais uniforme, mas exige definir retenção e recuperação de comandos em processamento.

### CR-07 — P1: alocação bancária e conciliação podem ser executadas em transações separadas

**Onde:** F01.4 propose/confirm_reconciliation e allocate_bank_movement; F01.3 seção 4.8 e 13.6.

**Conflito:** F01.4 diz que confirmar conciliação com consumo deve executar alocação bancária na mesma transação, mas também define comando independente `allocate_bank_movement`. Não está claro se o comando independente é uma etapa operacional válida anterior à decisão de conciliação, ou se toda alocação bancária é necessariamente consequência de uma decisão confirmada.

**Risco:** movimento consumido sem decisão correspondente, decisão confirmada sem consumo, ou duplicidade de alocação em retries.

**Correção requerida:** definir uma única sequência:
- opção A: confirmação de conciliação chama internamente o serviço de alocação no mesmo comando/transação;
- opção B: alocação bancária é evento operacional independente e a conciliação apenas referencia a alocação já existente.
Em ambos os casos, definir status da alocação, idempotência e invariantes para evitar órfãos.

### CR-08 — P1: versão de política e instante efetivo são ambíguos em comandos retroativos

**Onde:** F01.4 envelope comum e activate_policy_configuration; F01.3 B08; F01.2 versão de política.

**Conflito:** F01.4 permite `effective_at` no envelope, mas não especifica se a política é selecionada pelo instante de processamento ou pelo instante efetivo da operação. B08 diz selecionar versão pelo instante efetivo. Também não define o que acontece quando se registra hoje uma liquidação retroativa cuja política daquele instante difere da política vigente hoje.

**Risco:** operações retroativas usarem política inadequada ou permitirem manipulação de alçada por data retroativa.

**Correção requerida:** definir política selecionada pelo instante efetivo e validar janela retroativa permitida por autorização específica; registrar separadamente instante de processamento e instante efetivo. Não permitir ao cliente escolher livremente `effective_at` em comandos sensíveis.

### CR-09 — P1: F01.1 ainda tem invariantes e exemplos anteriores às decisões B06/B03

**Onde:** F01.1 seção 6, item 7; seção 9.1/P02; seção 9.4; F01.3 seção 13.12; F01.4.

**Conflito:** o item 7 permite liquidação confirmada sem alocação mediante justificativa aprovada; B06 e F01.4 proíbem isso no MVP. P02 mistura ausência de movimento bancário com ausência de alocação. A seção 9.4 ainda sugere habilitar liquidação sem movimento bancário como opção dependente de meio/evidência.

**Risco:** configurador ou implementação podem reintroduzir capacidade bloqueada por B06.

**Correção requerida:** substituir o item 7 por “toda liquidação confirmada no MVP exige uma ou mais alocações completas”; esclarecer que ausência de movimento bancário pode ser permitida separadamente, com alocação e evidência; remover toggle de não alocado/adiantamento.

## 3. Pontos coerentes que devem ser preservados

1. Separação entre título, liquidação e movimento bancário.
2. Alocação como relação entre liquidação e unidade de obrigação/direito.
3. `financial_records` como fonte do movimento importado; não duplicar extrato em título.
4. Ledger quantitativo próprio para split de movimento bancário.
5. Decisão de conciliação como evidência/decisão, não como liquidação.
6. Isolamento tenant-scoped, FKs compostas e RLS.
7. Ator derivado da sessão e autorização granular server-side.
8. Maker-checker obrigatório no MVP para confirmação de liquidação e aprovação de política.
9. Eventos de estorno append-only; nunca apagar liquidação original.
10. Omie read-only no v0.1; sem write-back declarado.

## 4. Sequência recomendada de correção documental

1. Corrigir F01.1: P02, invariante 7, estados de reversão e regra título/parcela.
2. Corrigir F01.2: schema canônico de ajustes, estado parcial de reversão, idempotência e regra de granularidade.
3. Corrigir F01.3: remover schemas antigos contraditórios do corpo principal; consolidar reversões e idempotência; formalizar transações e relações.
4. Corrigir F01.4: alinhar comandos e fixtures ao saldo exigível, política temporal, alocação bancária e granularidade.
5. Executar nova revisão cruzada e só então propor plano de migrations.
6. Aprovar separadamente políticas de negócio e alçadas com a diretoria/responsável financeiro.

## 5. Critério de saída

F01 só estará documentalmente consistente quando:
- cada conceito tiver uma definição única nos quatro documentos;
- as fórmulas fecharem para todos os casos de ajuste, liquidação e estorno sem saldo negativo ou dupla contagem;
- status materializados corresponderem às transições permitidas;
- todas as relações tenant-scoped tiverem FK/constraint ou validação transacional explicitamente justificada;
- cada comando tiver autorização, idempotência, locks, auditoria, falhas e rollback definidos;
- cenários de teste cobrirem exatamente os contratos, sem contradições internas.

**Parecer final:** manter F01 em Draft. Não iniciar migrations nem implementação de liquidação enquanto CR-01 a CR-05 não forem resolvidos e revisados. CR-06 a CR-09 também devem ser fechados antes da implementação completa do ciclo.
