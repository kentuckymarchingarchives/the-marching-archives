-- TMA 042: Five public discovery features.
-- Existing requirements: competitions, competition_rounds, competition_entries,
-- staff_members, competition_verifications and public activity (031).
BEGIN;

-- A narrow authorization helper prevents featured_competitions policies from
-- depending on the caller's direct access to the private staff directory.
CREATE OR REPLACE FUNCTION public.tma_featured_is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_members s
    WHERE s.user_id = (SELECT auth.uid()) AND s.role = 'owner' AND s.status = 'active');
$$;
REVOKE ALL ON FUNCTION public.tma_featured_is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_featured_is_owner() TO anon, authenticated;

-- Owner-curated featured competitions. Public can only view published, unarchived competitions.
CREATE TABLE IF NOT EXISTS public.featured_competitions (
  competition_id uuid PRIMARY KEY REFERENCES public.competitions(id) ON DELETE CASCADE,
  editorial_note text NOT NULL DEFAULT '' CHECK (char_length(editorial_note) <= 400),
  sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS featured_competitions_order_idx ON public.featured_competitions(sort_order,created_at DESC);
ALTER TABLE public.featured_competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS featured_competitions_public_read ON public.featured_competitions;
CREATE POLICY featured_competitions_public_read ON public.featured_competitions
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.competitions c
    WHERE c.id = competition_id AND c.publication_status = 'published' AND c.archived_at IS NULL)
  OR (SELECT public.tma_featured_is_owner())
);
DROP POLICY IF EXISTS featured_competitions_owner_write ON public.featured_competitions;
CREATE POLICY featured_competitions_owner_write ON public.featured_competitions
FOR ALL TO authenticated
USING ((SELECT public.tma_featured_is_owner()))
WITH CHECK ((SELECT public.tma_featured_is_owner()));
REVOKE ALL ON TABLE public.featured_competitions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.featured_competitions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.featured_competitions TO authenticated;

-- Public year-by-year coverage; counts are not presented as claims of completeness.
CREATE OR REPLACE FUNCTION public.tma_public_coverage(p_organization text DEFAULT NULL)
RETURNS TABLE (organization_code text, season_year integer, competitions bigint, rounds bigint, result_entries bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 WITH visible AS (
  SELECT c.id, c.organization_code, c.season_year
  FROM public.competitions c
  WHERE c.publication_status = 'published' AND c.archived_at IS NULL
    AND (p_organization IS NULL OR c.organization_code = p_organization)
 ), results AS (
  SELECT v.organization_code, v.season_year, v.id AS competition_id,
    COUNT(DISTINCT r.id) FILTER (WHERE r.archived_at IS NULL) AS round_count,
    COUNT(e.id) FILTER (WHERE r.archived_at IS NULL) AS entry_count
  FROM visible v
  LEFT JOIN public.competition_rounds r ON r.competition_id = v.id
  LEFT JOIN public.competition_entries e ON e.round_id = r.id
  GROUP BY v.organization_code, v.season_year, v.id
 )
 SELECT r.organization_code::text, r.season_year::integer,
  COUNT(DISTINCT r.competition_id)::bigint,
  SUM(r.round_count)::bigint, SUM(r.entry_count)::bigint
 FROM results r GROUP BY r.organization_code, r.season_year
 ORDER BY r.season_year DESC, r.organization_code;
$$;
REVOKE ALL ON FUNCTION public.tma_public_coverage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_coverage(text) TO anon, authenticated;

-- Date-based archive lookup: only exact known competition dates are eligible.
CREATE OR REPLACE FUNCTION public.tma_public_on_this_day(p_month integer, p_day integer, p_limit integer DEFAULT 25)
RETURNS TABLE (id uuid, slug text, name text, season_year integer, organization_code text, competition_date date, city text, state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT c.id, c.slug::text, c.name::text, c.season_year, c.organization_code::text,
  c.competition_date, c.city::text, c.state::text
 FROM public.competitions c
 WHERE p_month BETWEEN 1 AND 12 AND p_day BETWEEN 1 AND 31
  AND c.publication_status = 'published' AND c.archived_at IS NULL
  AND c.slug IS NOT NULL AND c.competition_date IS NOT NULL
  AND EXTRACT(MONTH FROM c.competition_date) = p_month
  AND EXTRACT(DAY FROM c.competition_date) = p_day
 ORDER BY c.season_year DESC, c.name, c.id
 LIMIT LEAST(GREATEST(COALESCE(p_limit,25),1),50);
$$;
REVOKE ALL ON FUNCTION public.tma_public_on_this_day(integer,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_on_this_day(integer,integer,integer) TO anon, authenticated;
COMMIT;
