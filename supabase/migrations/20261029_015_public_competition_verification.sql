-- Public, read-only verification status for published competitions.
-- Requires migrations 012 (sources) and 014 (formal verification).
-- No staff notes, verifier identity, or fingerprints are returned.
BEGIN;

CREATE OR REPLACE FUNCTION public.tma_public_competition_is_verified(p_competition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.competitions c
    JOIN public.competition_verifications v ON v.competition_id = c.id
    WHERE c.id = p_competition_id
      AND c.publication_status = 'published'
      AND c.archived_at IS NULL
      AND v.results_fingerprint = public.tma_competition_fingerprint(c.id)
      AND v.source_fingerprint = public.tma_reviewed_source_fingerprint(c.id)
      AND EXISTS (
        SELECT 1 FROM public.competition_sources s
        WHERE s.competition_id = c.id AND s.reviewed_at IS NOT NULL
      )
  );
$$;

REVOKE ALL ON FUNCTION public.tma_public_competition_is_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_competition_is_verified(uuid) TO anon, authenticated;

COMMIT;
