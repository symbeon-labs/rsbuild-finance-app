-- F01-lite: grants explícitos para as tabelas operacionais.
--
-- O padrão do projeto (ver 20261104210850_d02_managed_persistence.sql) exige
-- grants explícitos: novas tabelas em public não são expostas automaticamente
-- ao role authenticated. Sem estes grants, as APIs F01 falham com 42501
-- mesmo com as policies de RLS corretas.
--
-- Os privilégios seguem o menor privilégio compatível com as policies:
-- tabelas mutáveis recebem CRUD completo (o RLS restringe por papel);
-- snapshots e trilhas de decisão são append-only (select + insert).

grant select, insert, update, delete on
  public.receivable_titles,
  public.delivery_proofs,
  public.whatsapp_orders,
  public.settlements
  to authenticated;

grant select, insert on
  public.erp_snapshots,
  public.erp_movements,
  public.reconciliation_decisions
  to authenticated;
