-- ============================================================
-- BergLabs – User-scoped listings
--
-- Each agent sees and edits only listings they created.
-- Organization membership still governs team/billing; listings
-- are private to the creator within the org.
-- ============================================================

create index if not exists listings_org_created_by_updated_idx
  on public.listings (organization_id, created_by, updated_at desc);

-- listings
drop policy if exists "listings: members can read own org listings" on public.listings;
drop policy if exists "listings: members can update own org listings" on public.listings;
drop policy if exists "listings: members can delete own org listings" on public.listings;

create policy "listings: members can read own listings"
  on public.listings for select
  to authenticated
  using (
    organization_id = public.user_org_id()
    and created_by = auth.uid()
  );

create policy "listings: members can update own listings"
  on public.listings for update
  to authenticated
  using (
    organization_id = public.user_org_id()
    and created_by = auth.uid()
  )
  with check (
    organization_id = public.user_org_id()
    and created_by = auth.uid()
  );

create policy "listings: members can delete own listings"
  on public.listings for delete
  to authenticated
  using (
    organization_id = public.user_org_id()
    and created_by = auth.uid()
  );

-- listing_images
drop policy if exists "listing_images: members can read own org images" on public.listing_images;
drop policy if exists "listing_images: members can add images to own org listings" on public.listing_images;
drop policy if exists "listing_images: members can update own org images" on public.listing_images;
drop policy if exists "listing_images: members can delete own org images" on public.listing_images;

create policy "listing_images: members can read own listing images"
  on public.listing_images for select
  to authenticated
  using (
    organization_id = public.user_org_id()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.created_by = auth.uid()
    )
  );

create policy "listing_images: members can add images to own listings"
  on public.listing_images for insert
  to authenticated
  with check (
    organization_id = public.user_org_id()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.organization_id = public.user_org_id()
        and l.created_by = auth.uid()
    )
  );

create policy "listing_images: members can update own listing images"
  on public.listing_images for update
  to authenticated
  using (
    organization_id = public.user_org_id()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.created_by = auth.uid()
    )
  )
  with check (organization_id = public.user_org_id());

create policy "listing_images: members can delete own listing images"
  on public.listing_images for delete
  to authenticated
  using (
    organization_id = public.user_org_id()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.created_by = auth.uid()
    )
  );

-- listing_versions
drop policy if exists "listing_versions: members can read own org versions" on public.listing_versions;

create policy "listing_versions: members can read own listing versions"
  on public.listing_versions for select
  to authenticated
  using (
    organization_id = public.user_org_id()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.created_by = auth.uid()
    )
  );

-- storage: restrict to objects under listings owned by the caller
drop policy if exists "storage: members can read own org listing images" on storage.objects;
drop policy if exists "storage: members can upload to own org folder" on storage.objects;
drop policy if exists "storage: members can update own org listing images" on storage.objects;
drop policy if exists "storage: members can delete own org listing images" on storage.objects;

create policy "storage: members can read own listing images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
    and exists (
      select 1 from public.listings l
      where l.id = ((storage.foldername(name))[2])::uuid
        and l.created_by = auth.uid()
    )
  );

create policy "storage: members can upload to own listing folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
    and exists (
      select 1 from public.listings l
      where l.id = ((storage.foldername(name))[2])::uuid
        and l.created_by = auth.uid()
    )
  );

create policy "storage: members can update own listing images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
    and exists (
      select 1 from public.listings l
      where l.id = ((storage.foldername(name))[2])::uuid
        and l.created_by = auth.uid()
    )
  );

create policy "storage: members can delete own listing images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = public.user_org_id()::text
    and exists (
      select 1 from public.listings l
      where l.id = ((storage.foldername(name))[2])::uuid
        and l.created_by = auth.uid()
    )
  );
