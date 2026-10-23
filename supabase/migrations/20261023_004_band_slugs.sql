
-- THE MARCHING ARCHIVES
-- MIGRATION 004: BAND PROFILE URL SLUGS

BEGIN;

SET LOCAL lock_timeout = '5s';

-- A readable identifier independent of the UUID.
ALTER TABLE public.bands
ADD COLUMN IF NOT EXISTS slug text;

-- Convert a band name into a URL-safe base.
-- Examples:
-- Lafayette High School -> lafayette
-- Blue Devils -> blue-devils
-- Paul Laurence Dunbar High School
-- -> paul-laurence-dunbar

CREATE OR REPLACE FUNCTION public.tma_band_slugify(
  p_name text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(
      TRIM(
        BOTH '-' FROM
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            LOWER(
              REGEXP_REPLACE(
                BTRIM(COALESCE(p_name, '')),
                '[[:space:]]+(high|middle)[[:space:]]+school$',
                '',
                'i'
              )
            ),
            '[^a-z0-9]+',
            '-',
            'g'
          ),
          '-+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'band'
  );
$$;

-- Give existing bands readable unique slugs.
-- Duplicate names receive a UUID-derived suffix.
DO $$
DECLARE
  band_record record;
  base_slug text;
  candidate text;
  counter integer;
BEGIN
  FOR band_record IN
    SELECT id, name, slug
    FROM public.bands
    ORDER BY created_at, id
  LOOP
    IF band_record.slug IS NOT NULL
       AND band_record.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    THEN
      base_slug := band_record.slug;
    ELSE
      base_slug := public.tma_band_slugify(
        band_record.name
      );
    END IF;

    candidate := base_slug;
    counter := 0;

    WHILE EXISTS (
      SELECT 1
      FROM public.bands b
      WHERE b.slug = candidate
        AND b.id <> band_record.id
    ) LOOP
      counter := counter + 1;

      candidate :=
        base_slug || '-' ||
        REPLACE(band_record.id::text, '-', '');

      IF counter > 1 THEN
        candidate := candidate || '-' || counter::text;
      END IF;
    END LOOP;

    UPDATE public.bands
    SET slug = candidate
    WHERE id = band_record.id
      AND slug IS DISTINCT FROM candidate;
  END LOOP;
END;
$$;

-- Protect uniqueness and URL structure.
CREATE UNIQUE INDEX IF NOT EXISTS
  bands_slug_unique_idx
ON public.bands (slug);

ALTER TABLE public.bands
ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.bands
DROP CONSTRAINT IF EXISTS bands_slug_format_check;

ALTER TABLE public.bands
ADD CONSTRAINT bands_slug_format_check
CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Automatically generate slugs for new inserts
-- when staff does not provide a custom slug.
CREATE OR REPLACE FUNCTION public.tma_assign_band_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  base_slug text;
  candidate text;
  suffix text;
  counter integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- A name change does not change an existing URL.
    IF NEW.slug IS NOT DISTINCT FROM OLD.slug THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.slug IS NOT NULL
     AND BTRIM(NEW.slug) <> ''
  THEN
    -- Custom slugs must already be URL-safe.
    IF NEW.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION
        'Band URL must contain lowercase letters, numbers, or hyphens';
    END IF;

    RETURN NEW;
  END IF;

  base_slug := public.tma_band_slugify(NEW.name);
  candidate := base_slug;
  suffix := REPLACE(NEW.id::text, '-', '');

  WHILE EXISTS (
    SELECT 1
    FROM public.bands b
    WHERE b.slug = candidate
      AND b.id <> NEW.id
  ) LOOP
    counter := counter + 1;
    candidate := base_slug || '-' || suffix;

    IF counter > 1 THEN
      candidate := candidate || '-' || counter::text;
    END IF;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_band_slug_trigger
ON public.bands;

CREATE TRIGGER tma_band_slug_trigger
BEFORE INSERT OR UPDATE OF slug
ON public.bands
FOR EACH ROW
EXECUTE FUNCTION public.tma_assign_band_slug();

COMMIT;
