-- TMA 033: Link research assignments to competition records.
-- Prerequisite: migration 022 (research_assignments and its RPCs).
-- Existing assignments remain intact and unlinked until explicitly associated.
BEGIN;

ALTER TABLE public.research_assignments
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS research_assignments_competition_status_idx
  ON public.research_assignments (competition_id, status, updated_at DESC)
  WHERE competition_id IS NOT NULL;

-- Narrow privileged operation: creates one task linked to an existing competition.
-- Ownership and assignee validation are performed in the database.
CREATE OR REPLACE FUNCTION public.tma_create_competition_research_task(
  p_competition_id uuid,
  p_title text,
  p_description text,
  p_assigned_to uuid,
  p_priority text,
  p_due_date date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.staff_members AS s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status = 'active' AND s.role IN ('owner','admin','editor')
  ) THEN
    RAISE EXCEPTION 'Active staff required' USING ERRCODE = '42501';
  END IF;

  IF p_competition_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.competitions AS c WHERE c.id = p_competition_id
  ) THEN
    RAISE EXCEPTION 'Competition not found' USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 160
    OR char_length(coalesce(p_description, '')) > 5000
    OR p_priority IS NULL OR p_priority NOT IN ('low','normal','high','urgent')
  THEN
    RAISE EXCEPTION 'Invalid task data' USING ERRCODE = '22023';
  END IF;

  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_members AS s
    WHERE s.user_id = p_assigned_to AND s.status = 'active'
      AND s.role IN ('owner','admin','editor')
  ) THEN
    RAISE EXCEPTION 'Assignee is not active staff' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.research_assignments (
    title, description, assigned_to, created_by, priority, due_date, competition_id
  ) VALUES (
    btrim(p_title), coalesce(p_description, ''), p_assigned_to,
    (SELECT auth.uid()), p_priority, p_due_date, p_competition_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_create_competition_research_task(uuid,text,text,uuid,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_create_competition_research_task(uuid,text,text,uuid,text,date) TO authenticated;
COMMIT;
