-- =========================================================================
-- Atualiza status da dependência de credenciais Omie do Hub Açaí para 'received'
-- Justificativa: Acesso/login ao Omie fornecido formalmente pela operação do Hub Açaí.
-- =========================================================================

update public.project_dependencies
set status = 'received'
where title = 'Credenciais e alçadas da API Omie (Hub Açaí)';
