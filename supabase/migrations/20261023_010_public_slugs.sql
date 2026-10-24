
BEGIN;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE public.competition_rounds
  ADD COLUMN IF NOT EXISTS slug text;

-- Converts names into URL-friendly text.
CREATE OR REPLACE FUNCTION public.tma_slugify(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT trim(
    both '-'
    from regexp_replace(
      regexp_replace(
        lower(coalesce(p_text, '')),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-+',
      '-',
      'g'
    )
  );
$$;

-- Existing competitions: year + organization + name.
DO $$
DECLARE
  v_record record;
  v_base text;
  v_slug text;
  v_number integer;
BEGIN
  FOR v_record IN
    SELECT id, name, season_year, organization_code
    FROM public.competitions
    WHERE slug IS NULL OR slug = ''
    ORDER BY season_year, name, id
  LOOP
    v_base := public.tma_slugify(
      v_record.season_year::text || ' ' ||
      v_record.organization_code || ' ' ||
      v_record.name
    );

    IF v_base = '' THEN
      v_base := 'competition-' ||
        left(v_record.id::text, 8);
    END IF;

    v_slug := v_base;
    v_number := 2;

    WHILE EXISTS (
      SELECT 1
      FROM public.competitions
      WHERE slug = v_slug
        AND id <> v_record.id
    ) LOOP
      v_slug := v_base || '-' || v_number;
      v_number := v_number + 1;
    END LOOP;

    UPDATE public.competitions
    SET slug = v_slug
    WHERE id = v_record.id;
  END LOOP;
END;
$$;

-- Existing rounds: unique within their competition.
DO $$
DECLARE
  v_record record;
  v_base text;
  v_slug text;
  v_number integer;
BEGIN
  FOR v_record IN
    SELECT id, competition_id, name
    FROM public.competition_rounds
    WHERE slug IS NULL OR slug = ''
    ORDER BY competition_id, sort_order, id
  LOOP
    v_base := public.tma_slugify(v_record.name);

    IF v_base = '' THEN
      v_base := 'round-' ||
        left(v_record.id::text, 8);
    END IF;

    v_slug := v_base;
    v_number := 2;

    WHILE EXISTS (
      SELECT 1
      FROM public.competition_rounds
      WHERE competition_id = v_record.competition_id
        AND slug = v_slug
        AND id <> v_record.id
    ) LOOP
      v_slug := v_base || '-' || v_number;
      v_number := v_number + 1;
    END LOOP;

    UPDATE public.competition_rounds
    SET slug = v_slug
    WHERE id = v_record.id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  tma_competitions_slug_unique
ON public.competitions (slug);

CREATE UNIQUE INDEX IF NOT EXISTS
  tma_rounds_competition_slug_unique
ON public.competition_rounds (competition_id, slug);

-- New competitions and rounds receive slugs
-- automatically, without changing staff forms.

CREATE OR REPLACE FUNCTION public.tma_competition_slug_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_number integer := 2;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Preserve URLs when event names are edited.
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION
        'Competition slugs are immutable';
    END IF;

    RETURN NEW;
  END IF;

  v_base := public.tma_slugify(
    NEW.season_year::text || ' ' ||
    NEW.organization_code || ' ' ||
    NEW.name
  );

  IF v_base = '' THEN
    v_base := 'competition-' ||
      left(NEW.id::text, 8);
  END IF;

  v_slug := v_base;

  WHILE EXISTS (
    SELECT 1 FROM public.competitions
    WHERE slug = v_slug
  ) LOOP
    v_slug := v_base || '-' || v_number;
    v_number := v_number + 1;
  END LOOP;

  NEW.slug := v_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_competition_slug_before_write
ON public.competitions;

CREATE TRIGGER tma_competition_slug_before_write
BEFORE INSERT OR UPDATE OF slug
ON public.competitions
FOR EACH ROW
EXECUTE FUNCTION public.tma_competition_slug_trigger();

CREATE OR REPLACE FUNCTION public.tma_round_slug_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_number integer := 2;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'Round slugs are immutable';
    END IF;

    RETURN NEW;
  END IF;

  v_base := public.tma_slugify(NEW.name);

  IF v_base = '' THEN
    v_base := 'round-' || left(NEW.id::text, 8);
  END IF;

  v_slug := v_base;

  WHILE EXISTS (
    SELECT 1 FROM public.competition_rounds
    WHERE competition_id = NEW.competition_id
      AND slug = v_slug
  ) LOOP
    v_slug := v_base || '-' || v_number;
    v_number := v_number + 1;
  END LOOP;

  NEW.slug := v_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_round_slug_before_write
ON public.competition_rounds;

CREATE TRIGGER tma_round_slug_before_write
BEFORE INSERT OR UPDATE OF slug
ON public.competition_rounds
FOR EACH ROW
EXECUTE FUNCTION public.tma_round_slug_trigger();

-- Ensure newly inserted records always receive a slug.
ALTER TABLE public.competitions
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.competition_rounds
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.competitions
  ADD CONSTRAINT tma_competition_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE public.competition_rounds
  ADD CONSTRAINT tma_round_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

COMMIT;
