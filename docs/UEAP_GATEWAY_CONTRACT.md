# Contrato de Integração — RSBUILD Finance

## UEAP Gateway (contrato externo)

RSBUILD Finance integra-se ao protocolo UEAP exclusivamente por uma interface de gateway versionada. O núcleo, as especificações privadas, o código, o SDK e os mecanismos internos do UEAP permanecem fora deste repositório.

### Payload mínimo proposto
- `organization_id`: escopo tenant RSBUILD.
- `event_type`: evento operacional normalizado.
- `subject_type` e `subject_id`: referência interna opaca.
- `occurred_at`: instante UTC do evento.
- `evidence_hash`: SHA-256 do artefato ou da projeção aprovada.
- `contract_version`: versão do contrato de integração.
- `correlation_id`: correlação com lote/execução.

### Resposta mínima esperada
- `attestation_id` externo ou referência opaca.
- `event_hash`.
- `issuer`.
- `signature_reference` ou referência verificável.
- `registry_reference`, quando aplicável.
- `attested_at`.
- `status`: pending, attested ou failed.

O contrato não determina implementação criptográfica do UEAP nem expõe seu núcleo privado. Hashes armazenados no RSBUILD são metadados de integridade, não uma declaração de veracidade contábil.

## Limites da integração
- Enviar somente dados mínimos necessários para a atestação.
- Não enviar arquivos financeiros brutos por padrão.
- Não armazenar segredos do gateway em tabelas acessíveis ao cliente.
- Falhas e tentativas devem ser correlacionáveis e auditáveis.
- A integração deve ser desligável sem interromper a persistência financeira.
- Atestação não substitui validação, conciliação, aceite humano ou aprovação do ERP.

## ERP
- Adaptadores começam em modo somente leitura e dry-run.
- ERP de destino permanece não selecionado até confirmação de escopo, autorização e mapeamento.
- Não executar escrita, baixa, pagamento ou liquidação automaticamente nesta etapa.
- Cada execução registra sistema, versão do adaptador, modo, estado e correspondências.

## Compatibilidade
Mudanças no contrato exigem versionamento, testes de contrato e atualização deste documento. Nenhuma implementação proprietária UEAP deve ser copiada para este repositório.
