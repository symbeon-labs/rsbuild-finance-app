-- Forward-only lifecycle migration. Do not edit previously applied migrations.
alter table public.organization_invitations
  drop constraint if exists organization_invitations_status_check;
alter table public.organization_invitations
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists accepted_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists last_sent_at timestamptz;
alter table public.organization_invitations
  add constraint organization_invitations_status_check
  check (status in ('pending','sent','accepted','failed','revoked','expired'));
create index if not exists organization_invitations_acceptance_idx
  on public.organization_invitations (invited_user_id, lower(email), expires_at)
  where status = 'sent';

create or replace function public.accept_organization_invitations_for_user(p_user_id uuid, p_email text)
returns setof uuid language plpgsql security definer set search_path = ''
as $$
declare invitation_row record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_user_id is null or p_email is null or length(trim(p_email)) = 0 then
    raise exception 'invalid_invitation_identity' using errcode = '22023';
  end if;
  for invitation_row in
    select id, organization_id, role from public.organization_invitations
    where invited_user_id = p_user_id and lower(email) = lower(trim(p_email))
      and status = 'sent' and expires_at > now()
    order by created_at asc for update
  loop
    insert into public.organization_memberships (organization_id,user_id,role)
    values (invitation_row.organization_id,p_user_id,invitation_row.role)
    on conflict (organization_id,user_id) do update set role = excluded.role;
    update public.organization_invitations
      set status = 'accepted', accepted_at = now() where id = invitation_row.id;
    return next invitation_row.organization_id;
  end loop;
  update public.organization_invitations set status = 'expired'
    where invited_user_id = p_user_id and lower(email) = lower(trim(p_email))
      and status = 'sent' and expires_at <= now();
  return;
end;
$$;
revoke all on function public.accept_organization_invitations_for_user(uuid,text) from public, anon, authenticated;
grant execute on function public.accept_organization_invitations_for_user(uuid,text) to service_role;
revoke insert, update, delete on public.organization_invitations from anon, authenticated;
grant select on public.organization_invitations to authenticated;
