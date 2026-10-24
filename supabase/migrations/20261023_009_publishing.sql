
BEGIN;

-- Record who reviewed a competition and which exact
-- version of its data they approved.

CREATE TABLE IF NOT EXISTS public.competition_approvals (
  competition_id uuid PRIMARY KEY
    REFERENCES public.competitions(id) ON DELETE CASCADE,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  review_notes text NOT NULL,
  data_fingerprint text NOT NULL
);

ALTER TABLE public.competition_approvals
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.competition_approvals
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.competition_approvals
  TO authenticated;

DROP POLICY IF EXISTS tma_approvals_staff_read
  ON public.competition_approvals;

CREATE POLICY tma_approvals_staff_read
ON public.competition_approvals
FOR SELECT TO authenticated
USING ((SELECT public.tma_archive_staff()));


-- A fingerprint of the competition and all its
-- underlying rounds, entries, captions and scores.
-- Changes to any included record invalidate approval.

CREATE OR REPLACE FUNCTION public.tma_competition_fingerprint(
  p_competition_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT md5(
    jsonb_build_object(
      'competition', (
        SELECT to_jsonb(c)
        FROM public.competitions c
        WHERE c.id = p_competition_id
      ),
      'rounds', (
        SELECT coalesce(
          jsonb_agg(to_jsonb(r) ORDER BY r.id),
          '[]'::jsonb
        )
        FROM public.competition_rounds r
        WHERE r.competition_id = p_competition_id
      ),
      'entries', (
        SELECT coalesce(
          jsonb_agg(to_jsonb(e) ORDER BY e.id),
          '[]'::jsonb
        )
        FROM public.competition_entries e
        JOIN public.competition_rounds r
          ON r.id = e.round_id
        WHERE r.competition_id = p_competition_id
      ),
      'bands', (
        SELECT coalesce(
          jsonb_agg(to_jsonb(b) ORDER BY b.id),
          '[]'::jsonb
        )
        FROM public.bands b
        WHERE EXISTS (
          SELECT 1
          FROM public.competition_entries e
          JOIN public.competition_rounds r
            ON r.id = e.round_id
          WHERE e.band_id = b.id
            AND r.competition_id = p_competition_id
        )
      ),
      'captions', (
        SELECT coalesce(
          jsonb_agg(to_jsonb(sc) ORDER BY sc.id),
          '[]'::jsonb
        )
        FROM public.score_captions sc
        JOIN public.competition_rounds r
          ON r.id = sc.round_id
        WHERE r.competition_id = p_competition_id
      ),
      'scores', (
        SELECT coalesce(
          jsonb_agg(to_jsonb(cs)
            ORDER BY cs.entry_id, cs.caption_id),
          '[]'::jsonb
        )
        FROM public.caption_scores cs
        JOIN public.competition_entries e
          ON e.id = cs.entry_id
        JOIN public.competition_rounds r
          ON r.id = e.round_id
        WHERE r.competition_id = p_competition_id
      )
    )::text
  );
$$;

REVOKE ALL ON FUNCTION
  public.tma_competition_fingerprint(uuid)
  FROM PUBLIC, anon, authenticated;


-- Database-level checks before approval or publishing.
-- These check structural requirements. They do not
-- independently verify historical source accuracy.

CREATE OR REPLACE FUNCTION public.tma_assert_publishable(
  p_competition_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comp public.competitions%ROWTYPE;
  v_round record;
BEGIN
  SELECT * INTO v_comp
  FROM public.competitions
  WHERE id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competition not found';
  END IF;

  IF v_comp.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Archived competitions cannot be published';
  END IF;

  IF nullif(btrim(v_comp.name), '') IS NULL THEN
    RAISE EXCEPTION 'Competition name is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.competition_id = p_competition_id
      AND r.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'Competition must have at least one active round';
  END IF;

  FOR v_round IN
    SELECT id, name, class_scope
    FROM public.competition_rounds
    WHERE competition_id = p_competition_id
      AND archived_at IS NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.competition_entries e
      WHERE e.round_id = v_round.id
        AND (
          e.total_score IS NOT NULL
          OR e.class_placement IS NOT NULL
          OR e.overall_placement IS NOT NULL
        )
    ) THEN
      RAISE EXCEPTION
        'Round "%" has no recorded results',
        v_round.name;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.competition_entries e
      JOIN public.bands b ON b.id = e.band_id
      WHERE e.round_id = v_round.id
        AND b.archived_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        'Round "%" contains an archived band',
        v_round.name;
    END IF;

    IF v_round.class_scope IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.competition_entries e
      WHERE e.round_id = v_round.id
        AND e.classification
          IS DISTINCT FROM v_round.class_scope
    ) THEN
      RAISE EXCEPTION
        'Round "%" has mismatched classifications',
        v_round.name;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.competition_entries e
      WHERE e.round_id = v_round.id
        AND e.classification IS NOT NULL
        AND NOT (
          (v_comp.organization_code IN ('KMEA','MSBA')
            AND e.classification = ANY(
              ARRAY['1A','2A','3A','4A','5A']))
          OR
          (v_comp.organization_code = 'BOA'
            AND e.classification = ANY(
              ARRAY['1A','2A','3A','4A']))
          OR
          (v_comp.organization_code = 'DCI'
            AND e.classification = ANY(
              ARRAY['World','Open','All-Age','International']))
        )
    ) THEN
      RAISE EXCEPTION
        'Round "%" contains invalid classifications',
        v_round.name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.caption_scores cs
    JOIN public.score_captions sc
      ON sc.id = cs.caption_id
    JOIN public.competition_entries e
      ON e.id = cs.entry_id
    JOIN public.competition_rounds r
      ON r.id = e.round_id
    WHERE r.competition_id = p_competition_id
      AND (
        sc.round_id <> e.round_id
        OR cs.score < 0
        OR cs.score > sc.max_score
      )
  ) THEN
    RAISE EXCEPTION
      'Invalid or mismatched caption scores found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION
  public.tma_assert_publishable(uuid)
  FROM PUBLIC, anon, authenticated;


-- Approval records the administrator's manual review.

CREATE OR REPLACE FUNCTION public.tma_approve_competition(
  p_competition_id uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.tma_archive_manager() THEN
    RAISE EXCEPTION
      'Only Owners and Administrators may approve';
  END IF;

  IF length(btrim(coalesce(p_notes, ''))) < 10
     OR length(p_notes) > 2000 THEN
    RAISE EXCEPTION
      'Provide review notes between 10 and 2000 characters';
  END IF;

  SELECT publication_status INTO v_status
  FROM public.competitions
  WHERE id = p_competition_id
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft competitions can be approved';
  END IF;

  PERFORM public.tma_assert_publishable(p_competition_id);

  INSERT INTO public.competition_approvals (
    competition_id,
    approved_by,
    approved_at,
    review_notes,
    data_fingerprint
  )
  VALUES (
    p_competition_id,
    auth.uid(),
    now(),
    btrim(p_notes),
    public.tma_competition_fingerprint(p_competition_id)
  )
  ON CONFLICT (competition_id)
  DO UPDATE SET
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at,
    review_notes = EXCLUDED.review_notes,
    data_fingerprint = EXCLUDED.data_fingerprint;
END;
$$;


-- Publishing requires an existing, unchanged approval.

CREATE OR REPLACE FUNCTION public.tma_publish_competition(
  p_competition_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_approved_fingerprint text;
BEGIN
  IF NOT public.tma_archive_manager() THEN
    RAISE EXCEPTION
      'Only Owners and Administrators may publish';
  END IF;

  SELECT publication_status INTO v_status
  FROM public.competitions
  WHERE id = p_competition_id
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'draft' THEN
    RAISE EXCEPTION 'Competition must be a draft';
  END IF;

  SELECT data_fingerprint
  INTO v_approved_fingerprint
  FROM public.competition_approvals
  WHERE competition_id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'An approved review is required before publishing';
  END IF;

  PERFORM public.tma_assert_publishable(p_competition_id);

  IF v_approved_fingerprint IS DISTINCT FROM
    public.tma_competition_fingerprint(p_competition_id)
  THEN
    RAISE EXCEPTION
      'Competition data changed after approval. Review and approve again';
  END IF;

  UPDATE public.competitions
  SET publication_status = 'published'
  WHERE id = p_competition_id;
END;
$$;


-- Unpublish returns the record to Draft and clears
-- its old approval so corrections require new review.

CREATE OR REPLACE FUNCTION public.tma_unpublish_competition(
  p_competition_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.tma_archive_manager() THEN
    RAISE EXCEPTION
      'Only Owners and Administrators may unpublish';
  END IF;

  SELECT publication_status INTO v_status
  FROM public.competitions
  WHERE id = p_competition_id
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'published' THEN
    RAISE EXCEPTION
      'Only published competitions can be unpublished';
  END IF;

  UPDATE public.competitions
  SET publication_status = 'draft'
  WHERE id = p_competition_id;

  DELETE FROM public.competition_approvals
  WHERE competition_id = p_competition_id;
END;
$$;


REVOKE ALL ON FUNCTION
  public.tma_approve_competition(uuid, text)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.tma_publish_competition(uuid)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.tma_unpublish_competition(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.tma_approve_competition(uuid, text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.tma_publish_competition(uuid)
  TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.tma_unpublish_competition(uuid)
  TO authenticated;


-- Protect drafts from public database queries.
-- Staff retain access for editing and review.

DROP POLICY IF EXISTS tma_publication_competitions_read
  ON public.competitions;

CREATE POLICY tma_publication_competitions_read
ON public.competitions
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  publication_status = 'published'
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_publication_rounds_read
  ON public.competition_rounds;

CREATE POLICY tma_publication_rounds_read
ON public.competition_rounds
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = competition_id
      AND c.publication_status = 'published'
      AND c.archived_at IS NULL
  )
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_publication_entries_read
  ON public.competition_entries;

CREATE POLICY tma_publication_entries_read
ON public.competition_entries
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
      AND c.publication_status = 'published'
  )
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_publication_captions_read
  ON public.score_captions;

CREATE POLICY tma_publication_captions_read
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
      AND c.publication_status = 'published'
  )
  OR (SELECT public.tma_archive_staff())
);

DROP POLICY IF EXISTS tma_publication_scores_read
  ON public.caption_scores;

CREATE POLICY tma_publication_scores_read
ON public.caption_scores
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_entries e
    JOIN public.competition_rounds r
      ON r.id = e.round_id
    JOIN public.competitions c
      ON c.id = r.competition_id
    WHERE e.id = entry_id
      AND r.archived_at IS NULL
      AND c.archived_at IS NULL
      AND c.publication_status = 'published'
  )
  OR (SELECT public.tma_archive_staff())
);

COMMIT;
