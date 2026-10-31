-- THE MARCHING ARCHIVES — FIX #8
-- Prevent changes to a published competition's historical metadata.
-- Existing Owners/Admins retain the ability to unpublish via
-- public.tma_unpublish_competition(uuid), then edit the draft.
-- Requires migrations 002 (integrity), 003 (staff RLS), and 009 (publishing).
-- Apply after migration 039.

BEGIN;

CREATE OR REPLACE FUNCTION public.tma_guard_published_competition_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  -- tma_competition_integrity fires first alphabetically and maintains
  -- published_at. Ignore only the two publishing bookkeeping fields.
  v_old := to_jsonb(OLD) - 'publication_status' - 'published_at';
  v_new := to_jsonb(NEW) - 'publication_status' - 'published_at';

  IF OLD.publication_status = 'published' THEN
    IF NEW.publication_status = 'published' THEN
      IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Published competition details are locked. Return the competition to Draft before editing.';
      END IF;
    ELSIF NEW.publication_status = 'draft' THEN
      IF v_new IS DISTINCT FROM v_old THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Unpublishing cannot change competition details. Unpublish first, then edit the Draft.';
      END IF;
    END IF;
  ELSIF OLD.publication_status = 'draft'
        AND NEW.publication_status = 'published' THEN
    -- Reject publishing and editing historical fields in the same statement.
    -- The publishing RPC updates only publication_status after approval.
    IF v_new IS DISTINCT FROM v_old THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Publish the reviewed Draft without changing competition details.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_tma_published_competition_metadata_guard
  ON public.competitions;

CREATE TRIGGER zz_tma_published_competition_metadata_guard
BEFORE UPDATE ON public.competitions
FOR EACH ROW
EXECUTE FUNCTION public.tma_guard_published_competition_metadata();

-- The trigger function is not an RPC; keep it unavailable for direct calls.
REVOKE ALL ON FUNCTION public.tma_guard_published_competition_metadata()
  FROM PUBLIC, anon, authenticated;

COMMIT;
