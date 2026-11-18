# RSBUILD OS — Modelo de ambientes DEV, SANDBOX, QA e PRODUÇÃO

**Status:** padrão operacional proposto para evolução da experiência do workspace  
**Escopo desta PR:** clareza de apresentação, catálogo de capacidades e separação conceitual dos ambientes.  
**Importante:** este documento descreve o modelo e as responsabilidades; não afirma que todos os ambientes possuem pipeline de deploy independente já configurado.

## 1. Princípio

SANDBOX e QA não são sinônimos.

- **DEV** é o espaço de construção e validação técnica da equipe de engenharia.
- **SANDBOX** é o laboratório interno isolado da RSBUILD para experimentação, simulação, testes destrutivos controlados e validação técnica com dados sintéticos.
- **QA** é o workspace de homologação de uma organização/cliente, com escopo de teste definido, usuários convidados, dados controlados, roteiro, resultados e evidências.
- **PRODUÇÃO** é o ambiente operacional real, sujeito às licenças, permissões e controles de produção.

## 2. Matriz de responsabilidades

| Ambiente | Finalidade | Dados | Público | Evidência principal |
|---|---|---|---|---|
| DEV | Construção e testes automatizados | Fixtures e dados locais | Engenharia | CI, testes unitários e integração |
| SANDBOX | Experimentação interna e simulação | Sintéticos, isolados no schema `sandbox` | Equipe RSBUILD e membros explicitamente autorizados | Execuções técnicas, cenários e trilha de auditoria |
| QA | Homologação funcional do cliente | Dados sintéticos/controlados por organização | RSBUILD e avaliadores convidados | Casos de teste, avaliações, evidências e aceite |
| PRODUÇÃO | Operação empresarial | Dados reais | Usuários autorizados do cliente | Eventos operacionais e trilha de auditoria |

## 3. Como isso se aplica à implementação atual

### QA
Os workspaces `mundo_sabor_qa` e `hub_acai_qa` são organizações próprias. O catálogo de capacidades do workspace consulta `public.organization_capability_licenses` e considera a organização e o ambiente QA. A navegação e as APIs devem aplicar a mesma regra de disponibilidade: licença concedida, ambiente autorizado, não expirada e estado operacional `active`.

O Guia de Homologação e o futuro QA Control Center pertencem à experiência de QA. Eles devem responder: o que foi testado, por quem, em qual versão/roteiro, com qual resultado e quais evidências sustentam o aceite.

### SANDBOX
O Sandbox não é uma organização QA com outro nome. A implementação usa organizações e memberships isolados no schema `sandbox`, endpoints próprios (`/api/sandbox`) e validação de entitlement dedicada (`has_sandbox_capability_entitlements`).

A função de entitlement do Sandbox relaciona o laboratório à organização QA correspondente e exige que as capacidades solicitadas estejam concedidas, ativas, autorizadas para QA e dentro da validade. Isso permite que o laboratório interno exercite capacidades autorizadas no QA correspondente sem conceder acesso à produção.

O Sandbox deve ser apresentado como **Laboratório interno**, acessado pela Central RSBUILD. Não deve aparecer como opção de ambiente no seletor de workspaces QA/produção nem ser descrito como se consultasse diretamente a licença de um tenant de produção.

### PRODUÇÃO
O catálogo de capacidades da organização de produção consulta o entitlement daquela organização no ambiente `production`. Uma concessão para QA não concede acesso em produção.

## 4. Regras de experiência

1. Nunca apresentar um teste de Sandbox como homologação ou aceite do cliente.
2. Nunca converter uma avaliação positiva isolada em aprovação geral do módulo.
3. Nunca mostrar um módulo como disponível se a API correspondente o bloquear.
4. Mostrar estados distintos: disponível, aguardando liberação, aguardando ativação, em desenvolvimento, não implementado, licença expirada, suspenso e revogado.
5. Manter claramente identificados organização, ambiente, ciclo de teste e responsável.
6. Ações destrutivas e reset de dados devem permanecer restritas ao Sandbox e aos papéis autorizados.
7. Não copiar dados reais para Sandbox ou QA sem política explícita de proteção, minimização e autorização.

## 5. Critérios de aceite para esta evolução

- O modal de capacidades informa que seu estado corresponde à organização selecionada em QA ou Produção.
- A interface esclarece que o Sandbox é um laboratório separado, acessado pela Central RSBUILD.
- A consulta visual de licenças usa a mesma condição operacional da autorização de API: `operational_status = active`.
- Licença expirada não é apresentada como simples ausência de concessão.
- O catálogo não concede licenças nem altera permissões.
- A descrição da PR diferencia homologação de cliente (QA) de experimentação interna (Sandbox).

## 6. Evolução posterior

Depois de validar este padrão no Mundo do Sabor QA e no Hub Açaí QA, os componentes visuais e de acompanhamento podem ser reutilizados em outros workspaces. A reutilização não deve misturar dados, memberships, licenças ou resultados de homologação entre organizações.
