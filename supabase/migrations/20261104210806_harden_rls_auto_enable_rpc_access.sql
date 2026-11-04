-- Restrict execution of the event-trigger helper from API roles.
-- The ensure_rls event trigger remains enabled and invokes this function as owner.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
