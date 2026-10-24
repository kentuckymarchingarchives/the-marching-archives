
BEGIN;

-- 1. Add the archive fields.

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.competition_rounds
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS bands_archived_at_idx
  ON public.bands (archived_at);

CREATE INDEX IF NOT EXISTS competitions_archived_at_idx
  ON public.competitions (archived_at);

CREATE INDEX IF NOT EXISTS rounds_archived_at_idx
  ON public.competition_rounds (archived_at);

-- 2. Staff authorization helpers.

CREATE OR REPLACE FUNCTION public.tma_archive_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members s
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.tma_archive_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members s
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.tma_archive_staff()
  FROM PUBLIC;

REVOKE ALL ON FUNCTION public.tma_archive_manager()
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tma_archive_staff()
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.tma_archive_manager()
  TO authenticated;

-- 3. Archive visibility.
-- These restrictive SELECT policies work alongside
-- the existing permissive RLS policies.
-- Staff can still review archived historical records.

DROP POLICY IF EXISTS tma_archived_bands_read
  ON public.bands;

CREATE POLICY tma_archived_bands_read
ON public.bands
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  archived_at IS NULL
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_archived_competitions_read
  ON public.competitions;

CREATE POLICY tma_archived_competitions_read
ON public.competitions
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  archived_at IS NULL
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_archived_rounds_read
  ON public.competition_rounds;

CREATE POLICY tma_archived_rounds_read
ON public.competition_rounds
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  (
    archived_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = competition_id
        AND c.archived_at IS NULL
    )
  )
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_archived_entries_read
  ON public.competition_entries;

CREATE POLICY tma_archived_entries_read
ON public.competition_entries
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.bands b
      WHERE b.id = band_id
        AND b.archived_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.competition_rounds r
      JOIN public.competitions c
        ON c.id = r.competition_id
      WHERE r.id = round_id
        AND r.archived_at IS NULL
        AND c.archived_at IS NULL
    )
  )
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_archived_names_read
  ON public.band_names;

CREATE POLICY tma_archived_names_read
ON public.band_names
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bands b
    WHERE b.id = band_id
      AND b.archived_at IS NULL
  )
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_archived_captions_read
  ON public.score_captions;

CREATE POLICY tma_archived_captions_read
ON public.score_captions
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    JOIN public.competitions c
      ON c.id = r.competition_id
    WHERE r.id = round_id
      AND r.archived_at IS NULL
      AND c.archived_at IS NULL
  )
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_archived_scores_read
  ON public.caption_scores;

CREATE POLICY tma_archived_scores_read
ON public.caption_scores
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_entries e
    JOIN public.bands b ON b.id = e.band_id
    JOIN public.competition_rounds r ON r.id = e.round_id
    JOIN public.competitions c ON c.id = r.competition_id
    WHERE e.id = entry_id
      AND b.archived_at IS NULL
      AND r.archived_at IS NULL
      AND c.archived_at IS NULL
  )
  OR (SELECT public.tma_archive_staff())
);

-- 4. One database function for archive operations.

CREATE OR REPLACE FUNCTION public.tma_manage_archive(
  p_kind text,
  p_id uuid,
  p_operation text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent_archived timestamptz;
  v_archived timestamptz;
  v_existing_entries integer;
BEGIN
  IF NOT public.tma_archive_manager() THEN
    RAISE EXCEPTION
      'Only active owners and administrators may manage archives';
  END IF;

  IF p_kind NOT IN ('band', 'competition', 'round') THEN
    RAISE EXCEPTION 'Invalid archive record type';
  END IF;

  IF p_operation NOT IN ('archive', 'restore', 'delete') THEN
    RAISE EXCEPTION 'Invalid archive operation';
  END IF;

  IF p_kind = 'band' THEN

    SELECT archived_at INTO v_archived
    FROM public.bands
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Band not found';
    END IF;

    IF p_operation = 'archive' THEN
      UPDATE public.bands
      SET archived_at = now()
      WHERE id = p_id AND archived_at IS NULL;

    ELSIF p_operation = 'restore' THEN
      UPDATE public.bands
      SET archived_at = NULL
      WHERE id = p_id AND archived_at IS NOT NULL;

    ELSE
      IF v_archived IS NULL THEN
        RAISE EXCEPTION
          'Archive the band before permanently deleting it';
      END IF;

      SELECT count(*) INTO v_existing_entries
      FROM public.competition_entries
      WHERE band_id = p_id;

      IF v_existing_entries > 0 THEN
        RAISE EXCEPTION
          'Band has competition history. Remove its entries first';
      END IF;

      DELETE FROM public.band_names
      WHERE band_id = p_id;

      DELETE FROM public.bands
      WHERE id = p_id;
    END IF;

  ELSIF p_kind = 'competition' THEN

    SELECT archived_at INTO v_archived
    FROM public.competitions
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Competition not found';
    END IF;

    IF p_operation = 'archive' THEN
      UPDATE public.competitions
      SET archived_at = now()
      WHERE id = p_id AND archived_at IS NULL;

    ELSIF p_operation = 'restore' THEN
      UPDATE public.competitions
      SET archived_at = NULL
      WHERE id = p_id AND archived_at IS NOT NULL;

    ELSE
      IF v_archived IS NULL THEN
        RAISE EXCEPTION
          'Archive the competition before deleting it';
      END IF;

      DELETE FROM public.caption_scores cs
      USING public.competition_entries e,
            public.competition_rounds r
      WHERE cs.entry_id = e.id
        AND e.round_id = r.id
        AND r.competition_id = p_id;

      DELETE FROM public.caption_scores cs
      USING public.score_captions sc,
            public.competition_rounds r
      WHERE cs.caption_id = sc.id
        AND sc.round_id = r.id
        AND r.competition_id = p_id;

      DELETE FROM public.score_captions sc
      USING public.competition_rounds r
      WHERE sc.round_id = r.id
        AND r.competition_id = p_id;

      DELETE FROM public.competition_entries e
      USING public.competition_rounds r
      WHERE e.round_id = r.id
        AND r.competition_id = p_id;

      DELETE FROM public.competition_rounds
      WHERE competition_id = p_id;

      DELETE FROM public.competitions
      WHERE id = p_id;
    END IF;

  ELSE

    SELECT r.archived_at, c.archived_at
    INTO v_archived, v_parent_archived
    FROM public.competition_rounds r
    JOIN public.competitions c
      ON c.id = r.competition_id
    WHERE r.id = p_id
    FOR UPDATE OF r, c;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Round not found';
    END IF;

    IF p_operation = 'archive' THEN
      UPDATE public.competition_rounds
      SET archived_at = now()
      WHERE id = p_id AND archived_at IS NULL;

    ELSIF p_operation = 'restore' THEN
      IF v_parent_archived IS NOT NULL THEN
        RAISE EXCEPTION
          'Restore the parent competition first';
      END IF;

      UPDATE public.competition_rounds
      SET archived_at = NULL
      WHERE id = p_id AND archived_at IS NOT NULL;

    ELSE
      IF v_archived IS NULL THEN
        RAISE EXCEPTION
          'Archive the round before deleting it';
      END IF;

      DELETE FROM public.caption_scores cs
      USING public.competition_entries e
      WHERE cs.entry_id = e.id
        AND e.round_id = p_id;

      DELETE FROM public.caption_scores cs
      USING public.score_captions sc
      WHERE cs.caption_id = sc.id
        AND sc.round_id = p_id;

      DELETE FROM public.score_captions
      WHERE round_id = p_id;

      DELETE FROM public.competition_entries
      WHERE round_id = p_id;

      DELETE FROM public.competition_rounds
      WHERE id = p_id;
    END IF;

  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_manage_archive(
  text, uuid, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tma_manage_archive(
  text, uuid, text
) TO authenticated;

COMMIT;
