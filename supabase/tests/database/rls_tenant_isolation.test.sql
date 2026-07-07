-- ============================================================
-- RLS tenant-isolation tests (pgTAP).
-- Run with: supabase test db
--
-- Verifies that a user in organization A can never read or write
-- organization B's data through any table.
-- ============================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- ------------------------------------------------------------
-- Fixtures: two organizations with one user each.
-- ------------------------------------------------------------
insert into public.organizations (id, name)
values
  ('a0000000-0000-0000-0000-00000000000a', 'Byrå A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Byrå B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna@byra-a.se', extensions.crypt('password-a', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bengt@byra-b.se', extensions.crypt('password-b', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}');

insert into public.profiles (id, organization_id, email, full_name, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', 'anna@byra-a.se', 'Anna A', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', 'bengt@byra-b.se', 'Bengt B', 'owner');

insert into public.listings (id, organization_id, created_by, address)
values
  ('aaaa1111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Storgatan 1, Stockholm'),
  ('bbbb2222-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'Lillgatan 2, Göteborg');

insert into public.listing_images (listing_id, organization_id, storage_path)
values
  ('aaaa1111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a/aaaa1111-0000-0000-0000-000000000001/img1.jpg'),
  ('bbbb2222-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b/bbbb2222-0000-0000-0000-000000000001/img1.jpg');

-- ------------------------------------------------------------
-- Act as Anna (organization A)
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.organizations),
  1,
  'user A sees exactly one organization (their own)'
);

select is(
  (select id from public.organizations),
  'a0000000-0000-0000-0000-00000000000a'::uuid,
  'user A sees only organization A'
);

select is(
  (select count(*)::int from public.profiles),
  1,
  'user A sees only profiles in organization A'
);

select is(
  (select count(*)::int from public.listings),
  1,
  'user A sees only listings in organization A'
);

select is(
  (select address from public.listings),
  'Storgatan 1, Stockholm',
  'user A sees listing A, not listing B'
);

select is(
  (select count(*)::int from public.listing_images),
  1,
  'user A sees only images in organization A'
);

-- Cross-tenant writes must fail or affect zero rows.
select throws_ok(
  $$insert into public.listings (organization_id, created_by, address)
    values ('b0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'Intrång 1')$$,
  '42501',
  null,
  'user A cannot insert a listing into organization B'
);

select throws_ok(
  $$insert into public.listings (organization_id, created_by, address)
    values ('a0000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'Fel skapare')$$,
  '42501',
  null,
  'user A cannot forge created_by as another user'
);

update public.listings
set address = 'Hackad adress'
where id = 'bbbb2222-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.listings where address = 'Hackad adress'),
  0,
  'user A''s update of listing B affects zero rows'
);

delete from public.listings where id = 'bbbb2222-0000-0000-0000-000000000001';

-- ------------------------------------------------------------
-- Act as Bengt (organization B) – listing B must be intact.
-- ------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select count(*)::int from public.listings where id = 'bbbb2222-0000-0000-0000-000000000001'),
  1,
  'listing B survived user A''s delete attempt'
);

select is(
  (select address from public.listings where id = 'bbbb2222-0000-0000-0000-000000000001'),
  'Lillgatan 2, Göteborg',
  'listing B''s address is unchanged after user A''s update attempt'
);

select is(
  (select count(*)::int from public.organizations),
  1,
  'user B sees exactly one organization (their own)'
);

-- ------------------------------------------------------------
-- Role escalation: an agent must not be able to promote themself.
-- ------------------------------------------------------------
set local role postgres;
set local request.jwt.claims to '';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carl@byra-a.se', extensions.crypt('password-c', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}');

insert into public.profiles (id, organization_id, email, full_name, role)
values ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-00000000000a', 'carl@byra-a.se', 'Carl C', 'agent');

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select throws_ok(
  $$update public.profiles set role = 'owner' where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'an agent''s attempt to escalate their own role is rejected'
);

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'an agent cannot escalate themself to admin via the owner/admin policy'
);

select is(
  (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'agent',
  'an agent cannot escalate their own role'
);

-- Agents cannot read invitations (owner/admin only).
select is(
  (select count(*)::int from public.invitations),
  0,
  'an agent cannot read invitations'
);

-- ------------------------------------------------------------
-- Anonymous users see nothing.
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '';

select throws_ok(
  $$select count(*) from public.listings$$,
  '42501',
  null,
  'anonymous users cannot read listings'
);

select throws_ok(
  $$select count(*) from public.organizations$$,
  '42501',
  null,
  'anonymous users cannot read organizations'
);

select * from finish();
rollback;
