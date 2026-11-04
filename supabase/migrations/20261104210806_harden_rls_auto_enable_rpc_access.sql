-- The function is installed by the platform bootstrap in hosted environments.
-- Local clean databases may not have it yet; keep this migration safe in both.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
