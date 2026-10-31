-- TMA Migration 035: Scoped, read-only competition revision history.
-- Requires audit migration 021. No existing archive records are changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.tma_competition_revision_history(
  p_competition_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 30
)
RETURNS TABLE (
  id bigint,
  occurred_at timestamptz,
  actor_user_id uuid,
  table_name text,
  operation text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  total_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  WITH authorized AS (
    SELECT 1 AS ok
    WHERE auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.staff_members s
        WHERE s.user_id = auth.uid()
          AND s.status = 'active'
          AND s.role IN ('owner','admin')
      )
      AND EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = p_competition_id)
  ),
  related_rounds AS (
    SELECT cr.id::text AS id FROM public.competition_rounds cr
    WHERE cr.competition_id = p_competition_id
    UNION
    SELECT COALESCE(e.new_values->>'id', e.old_values->>'id', e.record_id)
    FROM public.archive_audit_events e
    WHERE e.table_name = 'competition_rounds'
      AND (e.old_values->>'competition_id' = p_competition_id::text
        OR e.new_values->>'competition_id' = p_competition_id::text)
  ),
  related_entries AS (
    SELECT ce.id::text AS id FROM public.competition_entries ce
      JOIN related_rounds rr ON rr.id = ce.round_id::text
    UNION
    SELECT COALESCE(e.new_values->>'id', e.old_values->>'id', e.record_id)
    FROM public.archive_audit_events e
    WHERE e.table_name = 'competition_entries'
      AND (e.old_values->>'round_id' IN (SELECT id FROM related_rounds)
        OR e.new_values->>'round_id' IN (SELECT id FROM related_rounds))
  ),
  scoped AS (
    SELECT e.*
    FROM public.archive_audit_events e
    WHERE EXISTS (SELECT 1 FROM authorized)
      AND (
        (e.table_name = 'competitions' AND e.record_id = p_competition_id::text)
        OR (e.table_name IN ('competition_rounds','score_captions') AND (
          (e.table_name = 'competition_rounds' AND (e.old_values->>'competition_id' = p_competition_id::text OR e.new_values->>'competition_id' = p_competition_id::text))
          OR (e.table_name = 'score_captions' AND (e.old_values->>'round_id' IN (SELECT id FROM related_rounds) OR e.new_values->>'round_id' IN (SELECT id FROM related_rounds)))
        ))
        OR (e.table_name = 'competition_entries' AND
          (e.old_values->>'round_id' IN (SELECT id FROM related_rounds) OR e.new_values->>'round_id' IN (SELECT id FROM related_rounds)))
        OR (e.table_name = 'caption_scores' AND
          (e.old_values->>'entry_id' IN (SELECT id FROM related_entries) OR e.new_values->>'entry_id' IN (SELECT id FROM related_entries)))
        OR (e.table_name = 'competition_sources' AND
          (e.old_values->>'competition_id' = p_competition_id::text OR e.new_values->>'competition_id' = p_competition_id::text))
      )
  )
  SELECT e.id, e.occurred_at, e.actor_user_id, e.table_name, e.operation,
         e.record_id, e.old_values, e.new_values,
         count(*) OVER ()::bigint AS total_count
  FROM scoped e
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT least(greatest(coalesce(p_page_size,30),1),100)
  OFFSET (least(greatest(coalesce(p_page,1),1),10000) - 1)
         * least(greatest(coalesce(p_page_size,30),1),100);
$$;
REVOKE ALL ON FUNCTION public.tma_competition_revision_history(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_competition_revision_history(uuid,integer,integer) TO authenticated;
COMMIT;
