-- THE MARCHING ARCHIVES — FIX #9
-- Require a current approved review before ANY draft -> published transition,
-- including direct table writes. Do not conflate this competition review with
-- research assignment approval (migration 036).
-- Requires migrations 009 (competition approval + fingerprint), 039 and 040.
BEGIN;

CREATE OR REPLACE FUNCTION public.tma_enforce_competition_publication_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fingerprint text;
  v_current_fingerprint text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.publication_status = 'published' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Create the competition as a Draft, then review, approve and publish it.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.publication_status = 'draft'
     AND NEW.publication_status = 'published' THEN
    -- This is an additional defense. The older integrity trigger also
    -- restricts who may publish; checking here preserves that requirement.
    IF NOT public.tma_archive_manager() THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Only active Owners and Administrators may publish.';
    END IF;

    -- The per-competition row is already locked by this UPDATE.
    -- The original publish RPC also locks this row before reading approval.
    SELECT ca.data_fingerprint
      INTO v_fingerprint
    FROM public.competition_approvals ca
    WHERE ca.competition_id = NEW.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'An approved competition review is required before publishing.';
    END IF;

    -- Structural checks are mandatory, even for a direct status UPDATE.
    PERFORM public.tma_assert_publishable(NEW.id);
    v_current_fingerprint := public.tma_competition_fingerprint(NEW.id);

    IF v_fingerprint IS DISTINCT FROM v_current_fingerprint THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Competition data changed after approval. Review and approve again.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Alphabetically after the existing tma_competition_integrity and
-- zz_tma_published_competition_metadata_guard BEFORE triggers. The approval
-- fingerprint is calculated against the still-Draft stored row.
DROP TRIGGER IF EXISTS zzz_tma_enforce_publication_approval
  ON public.competitions;

CREATE TRIGGER zzz_tma_enforce_publication_approval
BEFORE INSERT OR UPDATE OF publication_status ON public.competitions
FOR EACH ROW
EXECUTE FUNCTION public.tma_enforce_competition_publication_approval();

REVOKE ALL ON FUNCTION public.tma_enforce_competition_publication_approval()
  FROM PUBLIC, anon, authenticated;

COMMIT;
