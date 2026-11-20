begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('77777777-7777-4777-8777-777777777771','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f03-owner@test.invalid','',now(),now(),now()),
  ('77777777-7777-4777-8777-777777777772','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f03-operator@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, legal_name, display_name, slug)
values
  ('88888888-8888-4888-8888-888888888881','F03 Tenant A Ltda','F03 Tenant A','f03_tenant_a'),
  ('88888888-8888-4888-8888-888888888882','F03 Tenant B Ltda','F03 Tenant B','f03_tenant_b')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values
  ('88888888-8888-4888-8888-888888888881','77777777-7777-4777-8777-777777777771','owner'),
  ('88888888-8888-4888-8888-888888888881','77777777-7777-4777-8777-777777777772','operator')
on conflict do nothing;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);

insert into public.receivable_titles (
  id, organization_id, document_number, customer_name, amount_minor, due_date, status, created_by
) values
  ('99999999-9999-4999-8999-999999999981','88888888-8888-4888-8888-888888888881','F03-OK','Cliente F03',10000,'2026-12-01','pendente','77777777-7777-4777-8777-777777777771'),
  ('99999999-9999-4999-8999-999999999982','88888888-8888-4888-8888-888888888881','F03-ROLLBACK','Cliente F03',20000,'2026-12-02','pendente','77777777-7777-4777-8777-777777777771'),
  ('99999999-9999-4999-8999-999999999983','88888888-8888-4888-8888-888888888882','F03-OTHER-TENANT','Outro Cliente',30000,'2026-12-03','pendente','77777777-7777-4777-8777-777777777771'),
  ('99999999-9999-4999-8999-999999999984','88888888-8888-4888-8888-888888888881','F03-DIFFERENCE','Cliente F03',20000,'2026-12-04','pendente','77777777-7777-4777-8777-777777777771');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);

select is(
  public.confirm_receivable_settlements(
    '88888888-8888-4888-8888-888888888881',
    '[{"receivableTitleId":"99999999-9999-4999-8999-999999999981","amountMinor":10000,"settlementDate":"2026-11-19","sourceRecordId":"F03-FITID-1"}]'::jsonb
  )->>'insertedCount',
  '1',
  'owner confirms one settlement'
);
select is(
  (select status from public.receivable_titles where id='99999999-9999-4999-8999-999999999981'),
  'baixado',
  'confirmed settlement changes title state durably'
);

select lives_ok(
  $$select public.confirm_receivable_settlements(
    '88888888-8888-4888-8888-888888888881',
    '[{"receivableTitleId":"99999999-9999-4999-8999-999999999984","amountMinor":19999,"settlementDate":"2026-11-19","observation":"Valor original: R$ 200,00; juros: R$ 0,00; desconto: R$ 0,01"}]'::jsonb
  )$$,
  'documentary settlement variance is accepted when represented in the observation'
);
select is(
  (select amount_minor from public.settlements where receivable_title_id='99999999-9999-4999-8999-999999999984'),
  19999::bigint,
  'the actually received amount is persisted'
);
select is(
  (select observation from public.settlements where receivable_title_id='99999999-9999-4999-8999-999999999984'),
  'Valor original: R$ 200,00; juros: R$ 0,00; desconto: R$ 0,01',
  'original amount, interest and discount context is preserved'
);

select is(
  (select count(*)::integer from public.settlements where receivable_title_id='99999999-9999-4999-8999-999999999981'),
  1,
  'confirmed settlement row is persisted exactly once'
);

select throws_ok(
  $$select public.confirm_receivable_settlements(
    '88888888-8888-4888-8888-888888888881',
    '[{"receivableTitleId":"99999999-9999-4999-8999-999999999982","amountMinor":20000,"settlementDate":"2026-11-19"},{"receivableTitleId":"99999999-9999-4999-8999-999999999999","amountMinor":20000,"settlementDate":"2026-11-19"}]'::jsonb
  )$$,
  'P0002',
  null,
  'a mixed valid/invalid batch fails as one transaction'
);
select is(
  (select status from public.receivable_titles where id='99999999-9999-4999-8999-999999999982'),
  'pendente',
  'failed batch rolls back the earlier title transition'
);
select is(
  (select count(*)::integer from public.settlements where receivable_title_id='99999999-9999-4999-8999-999999999982'),
  0,
  'failed batch leaves no partial settlement row'
);

select throws_ok(
  $$select public.confirm_receivable_settlements(
    '88888888-8888-4888-8888-888888888881',
    '[{"receivableTitleId":"99999999-9999-4999-8999-999999999983","amountMinor":30000,"settlementDate":"2026-11-19"}]'::jsonb
  )$$,
  'P0002',
  null,
  'a title from another tenant is not visible to the requested organization'
);

select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777772',true);
select throws_ok(
  $$select public.confirm_receivable_settlements(
    '88888888-8888-4888-8888-888888888881',
    '[{"receivableTitleId":"99999999-9999-4999-8999-999999999982","amountMinor":20000,"settlementDate":"2026-11-19"}]'::jsonb
  )$$,
  '42501',
  null,
  'operator cannot confirm a settlement reserved for owner/admin'
);

select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);
select throws_ok(
  $$select public.confirm_receivable_settlements(
    '88888888-8888-4888-8888-888888888881',
    '[{"receivableTitleId":"99999999-9999-4999-8999-999999999981","amountMinor":10000,"settlementDate":"2026-11-19"}]'::jsonb
  )$$,
  '55000',
  null,
  'repeated confirmation cannot create a second settlement for a paid title'
);

reset role;
select * from finish();
rollback;
