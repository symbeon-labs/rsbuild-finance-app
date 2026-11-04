-- Restrict direct RPC execution when the platform/project has installed
-- the optional event-trigger helper. Fresh local Supabase stacks do not have it.
do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$migration$;
