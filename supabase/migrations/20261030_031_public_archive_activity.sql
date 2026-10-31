-- TMA 031: Public activity feed built from existing archive records.
-- Prerequisites: migration 014 (competition_verifications),
-- migration 012 (competition_sources), migration 009 (fingerprint),
-- and band/competition slugs.
-- No public direct SELECT permission is added to restricted tables.
BEGIN;

CREATE OR REPLACE FUNCTION public.tma_public_archive_activity(
  p_limit integer DEFAULT 30,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  event_key text,
  event_type text,
  title text,
  description text,
  event_at timestamptz,
  destination text,
  organization_code text,
  season_year integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH recent_competitions AS (
    SELECT c.id, c.slug, c.name, c.organization_code, c.season_year,
           c.published_at
    FROM public.competitions c
    WHERE c.publication_status = 'published'
      AND c.archived_at IS NULL
      AND c.published_at IS NOT NULL
      AND c.published_at <= now()
    ORDER BY c.published_at DESC, c.id DESC
    LIMIT 100
  ),
  recent_bands AS (
    SELECT b.id, b.slug, b.name, b.city, b.state, b.created_at
    FROM public.bands b
    WHERE b.slug IS NOT NULL AND b.created_at <= now()
    ORDER BY b.created_at DESC, b.id DESC
    LIMIT 100
  ),
  recent_verifications AS (
    SELECT v.competition_id, v.verified_at, v.results_fingerprint,
           v.source_fingerprint, c.slug, c.name,
           c.organization_code, c.season_year
    FROM public.competition_verifications v
    JOIN public.competitions c ON c.id = v.competition_id
    WHERE c.publication_status = 'published'
      AND c.archived_at IS NULL
      AND c.published_at IS NOT NULL
      AND c.published_at <= now()
      AND v.verified_at <= now()
    ORDER BY v.verified_at DESC, v.competition_id DESC
    LIMIT 100
  ),
  items AS (
    SELECT 'competition:' || c.id::text AS event_key,
           'competition'::text AS event_type,
           c.name::text AS title,
           ('Published ' || c.organization_code || ' competition results')::text AS description,
           c.published_at AS event_at,
           ('/competitions/' || c.slug)::text AS destination,
           c.organization_code::text AS organization_code,
           c.season_year::integer AS season_year
    FROM recent_competitions c WHERE c.slug IS NOT NULL

    UNION ALL

    SELECT 'band:' || b.id::text, 'band'::text, b.name::text,
           ('Ensemble profile added' ||
            CASE WHEN nullif(concat_ws(', ', nullif(b.city, ''), nullif(b.state, '')), '') IS NOT NULL
              THEN ' · ' || concat_ws(', ', nullif(b.city, ''), nullif(b.state, ''))
              ELSE '' END)::text,
           b.created_at, ('/bands/' || b.slug)::text,
           NULL::text, NULL::integer
    FROM recent_bands b

    UNION ALL

    SELECT 'verification:' || v.competition_id::text || ':' || v.verified_at::text,
           'verification'::text, v.name::text,
           ('Historical competition results verified · ' || v.organization_code)::text,
           v.verified_at, ('/competitions/' || v.slug)::text,
           v.organization_code::text, v.season_year::integer
    FROM recent_verifications v
    WHERE v.slug IS NOT NULL
      AND v.results_fingerprint = public.tma_competition_fingerprint(v.competition_id)
      AND v.source_fingerprint = public.tma_reviewed_source_fingerprint(v.competition_id)
      AND EXISTS (
        SELECT 1 FROM public.competition_sources s
        WHERE s.competition_id = v.competition_id AND s.reviewed_at IS NOT NULL
      )
  )
  SELECT i.event_key, i.event_type, i.title, i.description,
         i.event_at, i.destination, i.organization_code, i.season_year
  FROM items i
  WHERE p_type IS NULL OR p_type = 'all' OR i.event_type = p_type
  ORDER BY i.event_at DESC, i.event_key DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.tma_public_archive_activity(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_archive_activity(integer,text) TO anon, authenticated;

COMMIT;
