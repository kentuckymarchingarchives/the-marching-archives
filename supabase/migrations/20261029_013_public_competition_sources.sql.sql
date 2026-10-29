-- Apply AFTER 20261029_012_competition_sources.sql.
-- The underlying competition_sources table remains staff-only.
-- This read-only function exposes citation fields only for reviewed sources
-- belonging to published, non-archived competitions.
BEGIN;

CREATE OR REPLACE FUNCTION public.tma_public_competition_sources(p_competition_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  source_type text,
  url text,
  citation text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.title, s.source_type, s.url, s.citation
  FROM public.competition_sources AS s
  JOIN public.competitions AS c ON c.id = s.competition_id
  WHERE s.competition_id = p_competition_id
    AND s.reviewed_at IS NOT NULL
    AND c.publication_status = 'published'
    AND c.archived_at IS NULL
  ORDER BY s.created_at DESC, s.id DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.tma_public_competition_sources(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_competition_sources(uuid) TO anon, authenticated;

COMMIT;
