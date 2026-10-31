-- TMA 037: exact, RLS-aware research analytics without row sampling.
-- Install after migrations 022, 024, and 036.
BEGIN;
CREATE OR REPLACE FUNCTION public.tma_research_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'editor')
  ) THEN
    RAISE EXCEPTION 'Active staff required' USING ERRCODE = '42501';
  END IF;

  WITH task_totals AS (
    SELECT
      count(*)::integer AS assignments,
      count(*) FILTER (WHERE status = 'completed')::integer AS completed,
      count(*) FILTER (WHERE status <> 'completed' AND due_date < CURRENT_DATE)::integer AS overdue
    FROM public.research_assignments
  ),
  review_totals AS (
    SELECT
      count(*) FILTER (WHERE state = 'pending')::integer AS pending,
      count(*) FILTER (WHERE state = 'approved')::integer AS approved,
      count(*) FILTER (WHERE state IN ('approved', 'changes_requested'))::integer AS decided
    FROM public.research_approvals
  ),
  task_by_member AS (
    SELECT assigned_to AS user_id,
      count(*) FILTER (WHERE status = 'completed')::integer AS completed,
      count(*) FILTER (WHERE status <> 'completed')::integer AS open
    FROM public.research_assignments
    WHERE assigned_to IS NOT NULL
    GROUP BY assigned_to
  ),
  approvals_by_member AS (
    SELECT submitted_by AS user_id,
      count(*) FILTER (WHERE state = 'approved')::integer AS approved
    FROM public.research_approvals
    GROUP BY submitted_by
  ),
  member_totals AS (
    SELECT s.user_id, s.display_name, s.greeting_name, s.role,
      coalesce(t.completed, 0)::integer AS completed,
      coalesce(t.open, 0)::integer AS open,
      coalesce(a.approved, 0)::integer AS approved
    FROM public.staff_members s
    LEFT JOIN task_by_member t ON t.user_id = s.user_id
    LEFT JOIN approvals_by_member a ON a.user_id = s.user_id
    WHERE s.status = 'active' AND s.role IN ('owner', 'admin', 'editor')
  )
  SELECT jsonb_build_object(
    'assignments', tt.assignments,
    'completed', tt.completed,
    'overdue', tt.overdue,
    'pending', rt.pending,
    'approved', rt.approved,
    'decided', rt.decided,
    'contributions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.user_id,
        'name', coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(m.greeting_name), ''), 'Staff member'),
        'role', m.role,
        'completed', m.completed,
        'open', m.open,
        'approved', m.approved
      ) ORDER BY m.completed DESC, m.approved DESC, m.user_id)
      FROM member_totals m
    ), '[]'::jsonb)
  ) INTO result
  FROM task_totals tt CROSS JOIN review_totals rt;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_research_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_research_analytics() TO authenticated;
COMMIT;
