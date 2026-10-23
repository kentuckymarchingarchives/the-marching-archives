
-- THE MARCHING ARCHIVES
-- MIGRATION 003: STAFF SECURITY

BEGIN;

CREATE OR REPLACE FUNCTION public.tma_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = (SELECT auth.uid())
      AND status = 'active'
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION
  public.tma_can_edit_competition(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.tma_can_manage()
    AND EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = p_id
        AND (
          c.publication_status = 'draft'
          OR public.tma_is_admin()
        )
    );
$$;

-- Replace the overly broad Phase 1 write policies.
DROP POLICY IF EXISTS competitions_staff_write
ON public.competitions;

DROP POLICY IF EXISTS rounds_staff_write
ON public.competition_rounds;

DROP POLICY IF EXISTS entries_staff_write
ON public.competition_entries;

DROP POLICY IF EXISTS captions_staff_write
ON public.score_captions;

DROP POLICY IF EXISTS caption_scores_staff_write
ON public.caption_scores;

-- Creating new competitions.
CREATE POLICY competitions_insert
ON public.competitions FOR INSERT
TO authenticated
WITH CHECK (
  public.tma_can_manage()
  AND publication_status = 'draft'
);

-- Editors can edit draft competitions.
-- Owners/Admins may manage published competitions.
CREATE POLICY competitions_update
ON public.competitions FOR UPDATE
TO authenticated
USING (
  public.tma_can_manage()
  AND (
    publication_status = 'draft'
    OR public.tma_is_admin()
  )
)
WITH CHECK (
  public.tma_can_manage()
  AND (
    publication_status = 'draft'
    OR public.tma_is_admin()
  )
);

CREATE POLICY competitions_delete
ON public.competitions FOR DELETE
TO authenticated
USING (
  public.tma_can_manage()
  AND publication_status = 'draft'
);

CREATE POLICY rounds_insert
ON public.competition_rounds FOR INSERT
TO authenticated
WITH CHECK (
  public.tma_can_edit_competition(competition_id)
);

CREATE POLICY rounds_update
ON public.competition_rounds FOR UPDATE
TO authenticated
USING (
  public.tma_can_edit_competition(competition_id)
)
WITH CHECK (
  public.tma_can_edit_competition(competition_id)
);

CREATE POLICY rounds_delete
ON public.competition_rounds FOR DELETE
TO authenticated
USING (
  public.tma_can_edit_competition(competition_id)
);

CREATE POLICY entries_insert
ON public.competition_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY entries_update
ON public.competition_entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY entries_delete
ON public.competition_entries FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY captions_insert
ON public.score_captions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY captions_update
ON public.score_captions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY captions_delete
ON public.score_captions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY caption_scores_insert
ON public.caption_scores FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.competition_entries e
    JOIN public.competition_rounds r
      ON r.id = e.round_id
    WHERE e.id = entry_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY caption_scores_update
ON public.caption_scores FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_entries e
    JOIN public.competition_rounds r
      ON r.id = e.round_id
    WHERE e.id = entry_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.competition_entries e
    JOIN public.competition_rounds r
      ON r.id = e.round_id
    WHERE e.id = entry_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

CREATE POLICY caption_scores_delete
ON public.caption_scores FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_entries e
    JOIN public.competition_rounds r
      ON r.id = e.round_id
    WHERE e.id = entry_id
      AND public.tma_can_edit_competition(
        r.competition_id
      )
  )
);

COMMIT;
