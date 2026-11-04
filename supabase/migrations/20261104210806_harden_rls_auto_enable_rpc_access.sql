-- Restrict direct RPC execution while preserving the internal event trigger.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
