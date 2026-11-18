-- Remove EXECUTE de anon nas funções públicas expostas por default privileges.
-- anon não possui policies de leitura nessas funções; authenticated e
-- service_role mantêm o acesso exigido pelas rotas e políticas RLS.

revoke execute on function public.can_read_rsbuild_project(uuid) from anon;
revoke execute on function public.can_operate_rsbuild_project(uuid) from anon;
revoke execute on function public.sandbox_reset() from anon;

-- A migration 20261128000000 substituiu a RPC antiga de 5 argumentos
-- por uma assinatura com escopo de ambientes e expiração (7 argumentos).
revoke execute on function public.set_organization_capability_license(
  uuid, text, text, text, text, text[], timestamptz
) from anon;

-- Auditoria: registra se restar algum EXECUTE de anon em função do schema public.
do $$
declare
  fn record;
begin
  for fn in
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    raise notice 'anon ainda possui EXECUTE em public.%', fn.proname;
  end loop;
end $$;
