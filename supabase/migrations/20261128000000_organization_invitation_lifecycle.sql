-- Forward-only lifecycle migration. Do not edit previously applied migrations.
alter table public.organization_invitations
  drop constraint if exists organization_invitations_status_check;
alter table public.organization_invitations
  add column if not exists expires_at timestamptz not null default (now() + interval '1 hour'),
  add column if not exists accepted_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists last_sent_at timestamptz;
alter table public.organization_invitations
  add constraint organization_invitations_status_check
  check (status in ('pending','sent','accepted','failed','revoked','expired'));
create index if not exists organization_invitations_acceptance_idx
  on public.organization_invitations (invited_user_id, lower(email), expires_at)
  where status = 'sent';

create or replace function public.accept_organization_invitation(
  p_invitation_id uuid,
  p_user_id uuid,
  p_email text
)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare invitation_row record;
begin
  if p_invitation_id is null or p_user_id is null or p_email is null or length(trim(p_email)) = 0 then
    raise exception 'invalid_invitation_identity' using errcode = '22023';
  end if;
  select id, organization_id, role into invitation_row
    from public.organization_invitations
    where id = p_invitation_id
      and lower(email) = lower(trim(p_email))
      and (invited_user_id is null or invited_user_id = p_user_id)
      and status in ('pending','sent')
      and expires_at > now()
    for update;
  if not found then
    raise exception 'invitation_invalid_or_expired' using errcode = 'P0002';
  end if;

  insert into public.organization_memberships (organization_id,user_id,role)
    values (invitation_row.organization_id,p_user_id,invitation_row.role)
    on conflict (organization_id,user_id) do nothing;
  update public.organization_invitations
    set status = 'accepted', invited_user_id = p_user_id, accepted_at = now()
    where id = invitation_row.id;
  return invitation_row.organization_id;
end;
$$;
revoke all on function public.accept_organization_invitation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.accept_organization_invitation(uuid,uuid,text) to service_role;
revoke insert, update, delete on public.organization_invitations from anon, authenticated;
grant select on public.organization_invitations to authenticated;
