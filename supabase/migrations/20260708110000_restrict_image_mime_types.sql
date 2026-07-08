-- Claude vision does not support HEIC; the frontend converts uploads to
-- JPEG client-side. Restrict the bucket to formats the whole pipeline
-- can handle.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'listing-images';
