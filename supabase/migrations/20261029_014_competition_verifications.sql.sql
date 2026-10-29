-- The Marching Archives: formal competition verification.
-- Prerequisite: migration 012 (competition_sources) and 009 (publishing).
BEGIN;

CREATE TABLE IF NOT EXISTS public.competition_verifications (
  competition_id uuid PRIMARY KEY REFERENCES public.competitions(id) ON DELETE CASCADE,
  verified_by uuid NOT NULL REFERENCES auth.users(id),
  verified_at timestamptz NOT NULL DEFAULT now(),
  verification_notes text NOT NULL CHECK (char_length(btrim(verification_notes)) BETWEEN 10 AND 2000),
  results_fingerprint text NOT NULL,
  source_fingerprint text NOT NULL
);
ALTER TABLE public.competition_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_verifications TO authenticated;
DROP POLICY IF EXISTS tma_verifications_staff_read ON public.competition_verifications;
CREATE POLICY tma_verifications_staff_read ON public.competition_verifications
 FOR SELECT TO authenticated USING (public.tma_archive_staff());

-- Only reviewed citations count. The canonical JSON digest changes if any
-- reviewed citation is added, edited, unreviewed or deleted.
CREATE OR REPLACE FUNCTION public.tma_reviewed_source_fingerprint(p_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT md5(COALESCE(jsonb_agg(
    jsonb_build_object('id', s.id, 'title', s.title, 'type', s.source_type,
      'url', s.url, 'citation', s.citation, 'reviewed_at', s.reviewed_at)
    ORDER BY s.id)::text, '[]'))
  FROM public.competition_sources s
  WHERE s.competition_id = p_id AND s.reviewed_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.tma_reviewed_source_fingerprint(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_reviewed_source_fingerprint(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tma_verification_is_current(p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.competition_verifications%ROWTYPE;
BEGIN
  IF NOT public.tma_archive_staff() THEN RETURN false; END IF;
  SELECT * INTO v FROM public.competition_verifications WHERE competition_id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = p_id
    AND c.publication_status = 'published' AND c.archived_at IS NULL)
    AND v.results_fingerprint = public.tma_competition_fingerprint(p_id)
    AND v.source_fingerprint = public.tma_reviewed_source_fingerprint(p_id)
    AND EXISTS (SELECT 1 FROM public.competition_sources s
      WHERE s.competition_id = p_id AND s.reviewed_at IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.tma_verification_is_current(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_verification_is_current(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tma_verify_published_competition(p_id uuid, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.tma_archive_manager() THEN
   RAISE EXCEPTION 'Only Owners and Administrators can verify';
 END IF;
 IF char_length(btrim(coalesce(p_notes, ''))) NOT BETWEEN 10 AND 2000 THEN
   RAISE EXCEPTION 'Verification notes must be 10–2000 characters';
 END IF;
 PERFORM 1 FROM public.competitions WHERE id = p_id AND publication_status = 'published'
   AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Publish the competition before verifying it'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.competition_approvals WHERE competition_id = p_id) THEN
   RAISE EXCEPTION 'Competition must have an approved historical review';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.competition_sources
   WHERE competition_id = p_id AND reviewed_at IS NOT NULL) THEN
   RAISE EXCEPTION 'At least one reviewed citation is required';
 END IF;
 INSERT INTO public.competition_verifications
   (competition_id, verified_by, verified_at, verification_notes, results_fingerprint, source_fingerprint)
 VALUES (p_id, auth.uid(), now(), btrim(p_notes),
   public.tma_competition_fingerprint(p_id), public.tma_reviewed_source_fingerprint(p_id))
 ON CONFLICT (competition_id) DO UPDATE SET
   verified_by = EXCLUDED.verified_by,
   verified_at = EXCLUDED.verified_at,
   verification_notes = EXCLUDED.verification_notes,
   results_fingerprint = EXCLUDED.results_fingerprint,
   source_fingerprint = EXCLUDED.source_fingerprint;
END;
$$;
REVOKE ALL ON FUNCTION public.tma_verify_published_competition(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_verify_published_competition(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tma_revoke_competition_verification(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.tma_archive_manager() THEN
   RAISE EXCEPTION 'Only Owners and Administrators can revoke verification';
 END IF;
 DELETE FROM public.competition_verifications WHERE competition_id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tma_revoke_competition_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_revoke_competition_verification(uuid) TO authenticated;
COMMIT;
