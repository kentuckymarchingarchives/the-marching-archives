-- THE MARCHING ARCHIVES — FIX #7
-- Keep rounds, result entries, caption definitions and caption scores
-- read-only while their competition is published, including for managers.
-- Requires migration 003 (staff security) and migration 009 (publishing).
-- Run after migrations 037 and 038 when those have been installed.

BEGIN;

CREATE OR REPLACE FUNCTION public.tma_can_edit_competition(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.tma_can_manage()
    AND EXISTS (
      SELECT 1
      FROM public.competitions AS c
      WHERE c.id = p_id
        AND c.publication_status = 'draft'
        AND c.archived_at IS NULL
    );
$$;

-- Existing migration 003 INSERT/UPDATE/DELETE policies for
-- competition_rounds, competition_entries, score_captions, caption_scores
-- already use this function, so no policy replacement is required.
-- Publishing and unpublishing RPCs manage the competitions row directly;
-- they are intentionally unaffected by this change.

COMMIT;
