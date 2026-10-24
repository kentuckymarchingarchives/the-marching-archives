
BEGIN;

-- Store the location of the band logo.
-- Null means no logo has been uploaded.

ALTER TABLE public.bands
ADD COLUMN IF NOT EXISTS logo_path text;

-- Public image bucket with strict file restrictions.
-- Logos are public, but uploads are restricted.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'band-logos',
  'band-logos',
  true,
  2097152,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Staff must be actively authorized to upload.

DROP POLICY IF EXISTS
  "TMA staff upload band logos"
ON storage.objects;

CREATE POLICY "TMA staff upload band logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'band-logos'
  AND name ~
    '^bands/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
  AND EXISTS (
    SELECT 1
    FROM public.staff_members s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'editor')
  )
);

-- Staff need SELECT permission for operations
-- such as removing an existing storage object.
-- Public delivery is handled by the public bucket.

DROP POLICY IF EXISTS
  "TMA staff manage band logo objects"
ON storage.objects;

CREATE POLICY "TMA staff manage band logo objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'band-logos'
  AND EXISTS (
    SELECT 1
    FROM public.staff_members s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'editor')
  )
);

DROP POLICY IF EXISTS
  "TMA staff delete band logos"
ON storage.objects;

CREATE POLICY "TMA staff delete band logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'band-logos'
  AND EXISTS (
    SELECT 1
    FROM public.staff_members s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'editor')
  )
);

COMMIT;
