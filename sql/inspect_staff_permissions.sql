-- TMA Fix 10: READ-ONLY structural inspection, to run in Supabase SQL Editor.
-- This does NOT simulate a signed-in user's RLS/JWT context.

-- 1. RLS state for staff/research/competition tables.
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename IN ('staff_members', 'competitions', 'competition_rounds',
    'competition_entries', 'score_captions', 'caption_scores',
    'archive_documents', 'research_assignments', 'competition_research_notes',
    'research_approval_reviews')
    OR tablename LIKE 'research_%')
ORDER BY tablename;

-- 2. Active policies: read USING and WITH CHECK expressions carefully.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename IN ('staff_members', 'competitions', 'competition_rounds',
    'competition_entries', 'score_captions', 'caption_scores',
    'archive_documents', 'research_assignments', 'competition_research_notes')
    OR tablename LIKE 'research_%')
ORDER BY tablename, policyname;

-- 3. Database functions, execution grants and SECURITY DEFINER designation.
SELECT n.nspname AS schema_name, p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname LIKE 'tma_%' OR p.proname IN ('save_round_entry_result'))
ORDER BY p.proname, arguments;

-- 4. Row counts of staff role/status combinations only; no personal data.
SELECT role, status, COUNT(*) AS account_count
FROM public.staff_members
GROUP BY role, status
ORDER BY role, status;

-- 5. Check actual migration history (may be unavailable if migrations were run manually).
-- In Supabase dashboard, compare the migration files and SQL applied in project history.
