-- ============================================================
-- BergLabs – Row Level Security
--
-- RLS is the primary tenant-isolation mechanism. Every policy is
-- scoped by public.user_org_id() (the caller's organization from
-- profiles), never by client-supplied values.
--
-- The service_role key (used only inside Edge Functions) bypasses
-- RLS by design; Edge Functions must always validate the caller's
-- session + organization server-side.
-- ============================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_versions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invitations enable row level security;

-- Deny by default even for table owners running through PostgREST.
alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.listings force row level security;
alter table public.listing_images force row level security;
alter table public.listing_versions force row level security;
alter table public.subscriptions force row level security;
alter table public.invitations force row level security;

-- ------------------------------------------------------------
-- organizations
-- ------------------------------------------------------------
create policy "org: members can read own organization"
  on public.organizations for select
  to authenticated
  using (id = public.user_org_id());

create policy "org: owner/admin can update own organization"
  on public.organizations for update
  to authenticated
  using (id = public.user_org_id() and public.user_role() in ('owner', 'admin'))
  with check (id = public.user_org_id());

-- No insert/delete for authenticated users: organizations are created by
-- the signup trigger / create_organization() and deleted via support flow
-- (service role) to guarantee Stripe + Storage cleanup.

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create policy "profiles: members can read profiles in own organization"
  on public.profiles for select
  to authenticated
  using (organization_id = public.user_org_id());

create policy "profiles: user can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and organization_id = public.user_org_id()
    -- A user must not be able to escalate their own role.
    and role = public.user_role()
  );

create policy "profiles: owner/admin can update member profiles"
  on public.profiles for update
  to authenticated
  using (
    organization_id = public.user_org_id()
    and public.user_role() in ('owner', 'admin')
    -- Nobody edits the owner except the owner themself (handled above).
    and role <> 'owner'
  )
  with check (
    organization_id = public.user_org_id()
    -- Must be repeated here: WITH CHECK clauses are OR:ed across
    -- permissive policies, so without this an agent could satisfy this
    -- policy's check when updating their own row.
    and public.user_role() in ('owner', 'admin')
    and role in ('admin', 'agent')
  );

create policy "profiles: owner/admin can remove members"
  on public.profiles for delete
  to authenticated
  using (
    organization_id = public.user_org_id()
    and public.user_role() in ('owner', 'admin')
    and role <> 'owner'
    and id <> auth.uid()
  );

-- Inserts happen only via the auth trigger / create_organization()
-- (SECURITY DEFINER) – no direct insert policy.

-- ------------------------------------------------------------
-- listings
-- ------------------------------------------------------------
create policy "listings: members can read own org listings"
  on public.listings for select
  to authenticated
  using (organization_id = public.user_org_id());

create policy "listings: members can create listings in own org"
  on public.listings for insert
  to authenticated
  with check (
    organization_id = public.user_org_id()
    and created_by = auth.uid()
  );

create policy "listings: members can update own org listings"
  on public.listings for update
  to authenticated
  using (organization_id = public.user_org_id())
  with check (organization_id = public.user_org_id());

create policy "listings: members can delete own org listings"
  on public.listings for delete
  to authenticated
  using (organization_id = public.user_org_id());

-- ------------------------------------------------------------
-- listing_images
-- ------------------------------------------------------------
create policy "listing_images: members can read own org images"
  on public.listing_images for select
  to authenticated
  using (organization_id = public.user_org_id());

create policy "listing_images: members can add images to own org listings"
  on public.listing_images for insert
  to authenticated
  with check (
    organization_id = public.user_org_id()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.organization_id = public.user_org_id()
    )
  );

create policy "listing_images: members can update own org images"
  on public.listing_images for update
  to authenticated
  using (organization_id = public.user_org_id())
  with check (organization_id = public.user_org_id());

create policy "listing_images: members can delete own org images"
  on public.listing_images for delete
  to authenticated
  using (organization_id = public.user_org_id());

-- ------------------------------------------------------------
-- listing_versions (read-only for clients; written by trigger)
-- ------------------------------------------------------------
create policy "listing_versions: members can read own org versions"
  on public.listing_versions for select
  to authenticated
  using (organization_id = public.user_org_id());

-- ------------------------------------------------------------
-- subscriptions (read-only for clients; written by stripe-webhook)
-- ------------------------------------------------------------
create policy "subscriptions: members can read own org subscription"
  on public.subscriptions for select
  to authenticated
  using (organization_id = public.user_org_id());

-- ------------------------------------------------------------
-- invitations
-- ------------------------------------------------------------
create policy "invitations: owner/admin can read own org invitations"
  on public.invitations for select
  to authenticated
  using (
    organization_id = public.user_org_id()
    and public.user_role() in ('owner', 'admin')
  );

create policy "invitations: owner/admin can create invitations"
  on public.invitations for insert
  to authenticated
  with check (
    organization_id = public.user_org_id()
    and public.user_role() in ('owner', 'admin')
    and invited_by = auth.uid()
    and role in ('admin', 'agent')
  );

create policy "invitations: owner/admin can update invitations"
  on public.invitations for update
  to authenticated
  using (
    organization_id = public.user_org_id()
    and public.user_role() in ('owner', 'admin')
  )
  with check (organization_id = public.user_org_id());

create policy "invitations: owner/admin can delete invitations"
  on public.invitations for delete
  to authenticated
  using (
    organization_id = public.user_org_id()
    and public.user_role() in ('owner', 'admin')
  );

-- ============================================================
-- Storage: private bucket for listing images.
-- Object paths follow: {organization_id}/{listing_id}/{filename}
-- The first path segment must equal the caller's organization.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  false,
  10485760, -- 10 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "storage: members can read own org listing images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
  );

create policy "storage: members can upload to own org folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
  );

create policy "storage: members can update own org listing images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
  );

create policy "storage: members can delete own org listing images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
  );
