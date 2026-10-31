-- TMA migration 032: staff-only competition documentation completeness.
-- Depends on the competition_sources and competition_verifications migrations.
-- Read-only, does not modify archive records.
BEGIN;

CREATE OR REPLACE FUNCTION public.tma_staff_competition_completeness(
  p_organization text DEFAULT NULL,
  p_publication text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  competition_id uuid,
  competition_slug text,
  competition_name text,
  season_year integer,
  organization_code text,
  publication_status text,
  round_count bigint,
  entry_count bigint,
  placement_count bigint,
  scored_count bigint,
  reviewed_source_count bigint,
  verification_current boolean,
  completeness_score integer,
  total_matching bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.staff_members sm
    WHERE sm.user_id = auth.uid()
      AND sm.status = 'active'
      AND sm.role IN ('owner', 'admin', 'editor')
  ) THEN
    RAISE EXCEPTION 'Active staff access required' USING ERRCODE = '42501';
  END IF;

  IF p_publication NOT IN ('all', 'draft', 'published') OR p_publication IS NULL THEN
    RAISE EXCEPTION 'Invalid publication filter';
  END IF;

  RETURN QUERY
  WITH matching AS (
    SELECT c.id, c.slug, c.name, c.season_year,
           c.organization_code, c.publication_status
    FROM public.competitions c
    WHERE c.archived_at IS NULL
      AND (p_organization IS NULL OR c.organization_code = p_organization)
      AND (p_publication = 'all' OR c.publication_status = p_publication)
  ),
  calculated AS (
    SELECT m.id, m.slug, m.name, m.season_year,
           m.organization_code, m.publication_status,
           COALESCE(r.rounds, 0)::bigint AS rounds,
           COALESCE(r.entries, 0)::bigint AS entries,
           COALESCE(r.placements, 0)::bigint AS placements,
           COALESCE(r.scores, 0)::bigint AS scores,
           COALESCE(s.reviewed, 0)::bigint AS reviewed,
           CASE
             WHEN m.publication_status = 'published'
             THEN public.tma_verification_is_current(m.id)
             ELSE false
           END AS verified
    FROM matching m
    LEFT JOIN LATERAL (
      SELECT count(DISTINCT cr.id) AS rounds,
             count(ce.id) AS entries,
             count(ce.id) FILTER (
               WHERE ce.overall_placement IS NOT NULL
                  OR ce.class_placement IS NOT NULL
             ) AS placements,
             count(ce.id) FILTER (WHERE ce.total_score IS NOT NULL) AS scores
      FROM public.competition_rounds cr
      LEFT JOIN public.competition_entries ce ON ce.round_id = cr.id
      WHERE cr.competition_id = m.id
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS reviewed
      FROM public.competition_sources cs
      WHERE cs.competition_id = m.id AND cs.reviewed_at IS NOT NULL
    ) s ON true
  ),
  scored AS (
    SELECT x.*,
      (CASE WHEN x.rounds > 0 THEN 15 ELSE 0 END
       + CASE WHEN x.entries > 0 THEN 20 ELSE 0 END
       + CASE WHEN x.entries > 0 THEN floor(20.0 * x.placements / x.entries)::integer ELSE 0 END
       + CASE WHEN x.entries > 0 THEN floor(20.0 * x.scores / x.entries)::integer ELSE 0 END
       + CASE WHEN x.reviewed > 0 THEN 15 ELSE 0 END
       + CASE WHEN x.verified THEN 10 ELSE 0 END)::integer AS score
    FROM calculated x
  )
  SELECT x.id, x.slug, x.name, x.season_year,
         x.organization_code, x.publication_status,
         x.rounds, x.entries, x.placements, x.scores, x.reviewed,
         x.verified, x.score,
         count(*) OVER ()::bigint
  FROM scored x
  ORDER BY x.score ASC, x.season_year DESC, x.name ASC, x.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET LEAST(GREATEST(COALESCE(p_offset, 0), 0), 5000);
END;
$$;

REVOKE ALL ON FUNCTION public.tma_staff_competition_completeness(text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_staff_competition_completeness(text,text,integer,integer) TO authenticated;

COMMIT;
