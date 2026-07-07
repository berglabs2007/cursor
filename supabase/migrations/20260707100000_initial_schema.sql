-- ============================================================
-- BergLabs – initial schema
-- Multi-tenant model: every row carries organization_id and is
-- protected by RLS (see 20260707100001_rls_policies.sql).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- organizations
-- ------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  org_number text check (org_number is null or org_number ~ '^\d{6}-?\d{4}$'),
  stripe_customer_id text unique,
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  seats_purchased integer not null default 0 check (seats_purchased >= 0),
  created_at timestamptz not null default now()
);

comment on table public.organizations is 'One real-estate agency (mäklarbyrå) = one tenant.';

-- ------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'agent' check (role in ('owner', 'admin', 'agent')),
  created_at timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

-- ------------------------------------------------------------
-- listings
-- ------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  address text not null default '',
  property_type text not null default 'apartment'
    check (property_type in ('villa', 'apartment', 'townhouse', 'vacation_home')),
  rooms numeric(4, 1) check (rooms is null or rooms > 0),
  area_sqm numeric(7, 1) check (area_sqm is null or area_sqm > 0),
  supplementary_area_sqm numeric(7, 1) check (supplementary_area_sqm is null or supplementary_area_sqm >= 0),
  plot_area_sqm numeric(10, 1) check (plot_area_sqm is null or plot_area_sqm >= 0),
  price numeric(12, 0) check (price is null or price >= 0),
  monthly_fee numeric(9, 0) check (monthly_fee is null or monthly_fee >= 0),
  operating_cost numeric(9, 0) check (operating_cost is null or operating_cost >= 0),
  build_year integer check (build_year is null or build_year between 1500 and 2100),
  key_features text not null default '',
  target_audience text check (target_audience is null or target_audience in ('family', 'first_time_buyer', 'investor')),
  tone text not null default 'classic' check (tone in ('classic', 'warm', 'luxury')),
  -- { "headline": string, "body": string, "facts": string }
  generated_text jsonb,
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_organization_id_idx on public.listings (organization_id);
create index listings_org_status_idx on public.listings (organization_id, status);
create index listings_org_created_at_idx on public.listings (organization_id, created_at desc);

-- ------------------------------------------------------------
-- listing_images
-- organization_id is denormalized from listings to keep RLS and
-- storage policies simple and fast.
-- ------------------------------------------------------------
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path text not null,
  -- { "room_type": string, "light": string, "condition": string,
  --   "materials": string[], "notable_details": string[], "summary": string,
  --   "confirmed": boolean }
  ai_analysis_result jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index listing_images_listing_id_idx on public.listing_images (listing_id, sort_order);
create index listing_images_organization_id_idx on public.listing_images (organization_id);

-- ------------------------------------------------------------
-- listing_versions (history / undo)
-- ------------------------------------------------------------
create table public.listing_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index listing_versions_listing_id_idx on public.listing_versions (listing_id, created_at desc);
create index listing_versions_organization_id_idx on public.listing_versions (organization_id);

-- ------------------------------------------------------------
-- subscriptions (mirror of Stripe state, written only by the
-- stripe-webhook Edge Function via service role)
-- ------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  stripe_subscription_id text not null unique,
  plan text not null default 'per_seat',
  seats integer not null default 1 check (seats >= 0),
  status text not null
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_organization_id_idx on public.subscriptions (organization_id);

-- ------------------------------------------------------------
-- invitations (pending agent invites, for seat overview + audit)
-- ------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (organization_id, email)
);

create index invitations_organization_id_idx on public.invitations (organization_id);

-- ============================================================
-- Helper functions used by RLS policies.
-- SECURITY DEFINER so they can read profiles without triggering
-- recursive RLS evaluation.
-- ============================================================

create or replace function public.user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.user_org_id() from public, anon;
revoke execute on function public.user_role() from public, anon;
grant execute on function public.user_org_id() to authenticated;
grant execute on function public.user_role() to authenticated;

-- ============================================================
-- Triggers
-- ============================================================

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Snapshot previous generated text into listing_versions whenever it changes,
-- so the agent can always undo (never lose generated content).
create or replace function public.snapshot_listing_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.generated_text is not null
     and new.generated_text is distinct from old.generated_text then
    insert into public.listing_versions (listing_id, organization_id, content)
    values (old.id, old.organization_id, old.generated_text);
  end if;
  return new;
end;
$$;

create trigger listings_snapshot_version
  before update on public.listings
  for each row execute function public.snapshot_listing_version();

-- ------------------------------------------------------------
-- New user handling.
-- Two paths:
--   1. Invited user: user_metadata contains organization_id (+ role)
--      -> create profile in the existing organization.
--   2. Organization signup: user_metadata contains organization_name
--      -> create the organization and an owner profile.
-- OAuth users without metadata get no profile here; the app sends them
-- to an onboarding page that calls public.create_organization().
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  invited_org_id uuid;
  invited_role text;
  new_org_id uuid;
begin
  invited_org_id := nullif(meta ->> 'organization_id', '')::uuid;

  if invited_org_id is not null then
    -- Only honor the metadata if a matching pending invitation exists.
    -- The metadata is set server-side by the invite-user Edge Function,
    -- but we defend in depth against forged signup metadata.
    select i.role into invited_role
    from public.invitations i
    where i.organization_id = invited_org_id
      and lower(i.email) = lower(new.email)
      and i.status = 'pending'
    limit 1;

    if invited_role is not null then
      insert into public.profiles (id, organization_id, email, full_name, role)
      values (
        new.id,
        invited_org_id,
        new.email,
        coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
        invited_role
      );

      update public.invitations
      set status = 'accepted', accepted_at = now()
      where organization_id = invited_org_id
        and lower(email) = lower(new.email)
        and status = 'pending';
    end if;

    return new;
  end if;

  if nullif(meta ->> 'organization_name', '') is not null then
    insert into public.organizations (name, org_number)
    values (
      meta ->> 'organization_name',
      nullif(meta ->> 'org_number', '')
    )
    returning id into new_org_id;

    insert into public.profiles (id, organization_id, email, full_name, role)
    values (
      new.id,
      new_org_id,
      new.email,
      coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
      'owner'
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Onboarding fallback for OAuth signups: lets an authenticated user
-- without a profile create an organization and become its owner.
-- ------------------------------------------------------------
create or replace function public.create_organization(org_name text, org_number_input text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  user_email text;
  user_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'user already belongs to an organization';
  end if;

  if org_name is null or char_length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  select email,
         coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1))
  into user_email, user_name
  from auth.users
  where id = auth.uid();

  insert into public.organizations (name, org_number)
  values (trim(org_name), nullif(trim(coalesce(org_number_input, '')), ''))
  returning id into new_org_id;

  insert into public.profiles (id, organization_id, email, full_name, role)
  values (auth.uid(), new_org_id, user_email, user_name, 'owner');

  return new_org_id;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

-- ============================================================
-- Grants – tables in public are not auto-exposed; grant explicitly.
-- RLS (next migration) restricts rows; these grants restrict verbs.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on public.organizations to authenticated;
grant update (name, org_number) on public.organizations to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, role) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;

grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, update, delete on public.listing_images to authenticated;
grant select on public.listing_versions to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;

grant all on all tables in schema public to service_role;
