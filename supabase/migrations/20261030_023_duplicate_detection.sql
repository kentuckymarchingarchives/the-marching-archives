-- TMA / 023: Read-only, staff-restricted duplicate candidate detection.
-- Review candidates manually; no records are modified by this function.

CREATE OR REPLACE FUNCTION public.tma_duplicate_candidates()
RETURNS TABLE (
  record_type text,
  title text,
  context text,
  record_ids uuid[],
  review_id uuid,
  match_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.tma_is_staff() THEN
    RAISE EXCEPTION 'Active staff access required' USING ERRCODE = '42501';
  END IF;

  -- Same normalized ensemble name + location + kind; may still be legitimate.
  RETURN QUERY
  SELECT
    'bands'::text,
    MIN(b.name)::text,
    concat_ws(' · ', MIN(b.city), MIN(b.state), MIN(b.kind))::text,
    (array_agg(b.id ORDER BY b.created_at, b.id))[1:20],
    NULL::uuid,
    count(*)::bigint
  FROM public.bands b
  GROUP BY
    lower(btrim(regexp_replace(b.name, '[[:space:]]+', ' ', 'g'))),
    lower(btrim(coalesce(b.city,''))),
    lower(btrim(coalesce(b.state,''))),
    b.kind
  HAVING count(*) > 1
  ORDER BY count(*) DESC, MIN(b.name)
  LIMIT 100;

  -- Match org, season, competition date, and normalized event name.
  -- An event intentionally split into multiple records may appear here.
  RETURN QUERY
  SELECT
    'competitions'::text,
    MIN(c.name)::text,
    (MIN(c.organization_code) || ' · ' || MIN(c.season_year)::text ||
     ' · ' || coalesce(MIN(c.competition_date)::text, 'Date unknown'))::text,
    (array_agg(c.id ORDER BY c.created_at, c.id))[1:20],
    NULL::uuid,
    count(*)::bigint
  FROM public.competitions c
  GROUP BY
    c.organization_code,
    c.season_year,
    c.competition_date,
    lower(btrim(regexp_replace(c.name, '[[:space:]]+', ' ', 'g')))
  HAVING count(*) > 1
  ORDER BY count(*) DESC, MIN(c.name)
  LIMIT 100;

  -- Same round, same ensemble name and location, but different band IDs.
  -- Exact repeated band_id is already prevented by UNIQUE(round_id, band_id).
  RETURN QUERY
  SELECT
    'entries'::text,
    MIN(b.name)::text,
    (MIN(c.name) || ' · ' || MIN(r.name) || ' · ' || MIN(c.season_year)::text)::text,
    (array_agg(e.id ORDER BY e.created_at, e.id))[1:20],
    (array_agg(c.id ORDER BY c.id))[1],
    count(*)::bigint
  FROM public.competition_entries e
  JOIN public.bands b ON b.id = e.band_id
  JOIN public.competition_rounds r ON r.id = e.round_id
  JOIN public.competitions c ON c.id = r.competition_id
  GROUP BY
    e.round_id,
    lower(btrim(regexp_replace(b.name, '[[:space:]]+', ' ', 'g'))),
    lower(btrim(coalesce(b.city,''))),
    lower(btrim(coalesce(b.state,'')))
  HAVING count(*) > 1 AND count(DISTINCT e.band_id) > 1
  ORDER BY count(*) DESC, MIN(b.name)
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_duplicate_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_duplicate_candidates() TO authenticated;
COMMENT ON FUNCTION public.tma_duplicate_candidates() IS
  'Read-only duplicate review candidates for active TMA staff; returns at most 100 groups per category.';
