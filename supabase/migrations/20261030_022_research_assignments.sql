-- TMA Research Assignments (Phase 4)
-- Install after staff_members and staff management. Review on staging first.
BEGIN;

CREATE TABLE IF NOT EXISTS public.research_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  assigned_to uuid REFERENCES public.staff_members(user_id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.staff_members(user_id),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','completed')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS research_assignments_status_idx ON public.research_assignments(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS research_assignments_assignee_idx ON public.research_assignments(assigned_to, status);
CREATE INDEX IF NOT EXISTS research_assignments_due_idx ON public.research_assignments(due_date) WHERE status <> 'completed';

ALTER TABLE public.research_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active staff can see research assignments" ON public.research_assignments;
CREATE POLICY "Active staff can see research assignments" ON public.research_assignments
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.staff_members s
          WHERE s.user_id = (SELECT auth.uid()) AND s.status = 'active'
            AND s.role IN ('owner','admin','editor'))
);

-- No direct client writes. All writes use narrowly-scoped RPCs that recheck permissions.
REVOKE ALL ON TABLE public.research_assignments FROM anon, authenticated;
GRANT SELECT ON TABLE public.research_assignments TO authenticated;

CREATE OR REPLACE FUNCTION public.tma_create_research_assignment(
  p_title text, p_description text, p_assigned_to uuid,
  p_priority text, p_due_date date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_members s
     WHERE s.user_id = (SELECT auth.uid()) AND s.status = 'active'
       AND s.role IN ('owner','admin','editor')) THEN
    RAISE EXCEPTION 'Active staff required' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 160
    OR char_length(coalesce(p_description,'')) > 5000
    OR p_priority IS NULL OR p_priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'Invalid task data' USING ERRCODE = '22023';
  END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM public.staff_members s WHERE s.user_id = p_assigned_to AND s.status='active'
       AND s.role IN ('owner','admin','editor')
  ) THEN
    RAISE EXCEPTION 'Assignee is not active staff' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.research_assignments(title,description,assigned_to,created_by,priority,due_date)
  VALUES (btrim(p_title),coalesce(p_description,''),p_assigned_to,(SELECT auth.uid()),p_priority,p_due_date)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tma_edit_research_assignment(
  p_id uuid, p_title text, p_description text, p_assigned_to uuid,
  p_priority text, p_status text, p_due_date date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.research_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_task FROM public.research_assignments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id = (SELECT auth.uid())
      AND s.status = 'active' AND (s.role IN ('owner','admin') OR s.user_id = v_task.created_by)) THEN
    RAISE EXCEPTION 'Only Owners, Administrators, and the creator can edit this task' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 160
    OR char_length(coalesce(p_description,'')) > 5000
    OR p_priority IS NULL OR p_priority NOT IN ('low','normal','high','urgent')
    OR p_status IS NULL OR p_status NOT IN ('todo','in_progress','blocked','completed') THEN
    RAISE EXCEPTION 'Invalid task data' USING ERRCODE = '22023';
  END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM public.staff_members s WHERE s.user_id = p_assigned_to AND s.status = 'active'
       AND s.role IN ('owner','admin','editor')
  ) THEN RAISE EXCEPTION 'Assignee is not active staff' USING ERRCODE = '22023'; END IF;
  UPDATE public.research_assignments SET
    title = btrim(p_title), description = coalesce(p_description,''), assigned_to = p_assigned_to,
    priority = p_priority, status = p_status, due_date = p_due_date,
    completed_at = CASE WHEN p_status = 'completed' THEN coalesce(completed_at,now()) ELSE NULL END,
    updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tma_set_research_assignment_status(p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.research_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_task FROM public.research_assignments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('todo','in_progress','blocked','completed') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff_members s
     WHERE s.user_id = (SELECT auth.uid()) AND s.status = 'active'
       AND (s.role IN ('owner','admin') OR s.user_id = v_task.assigned_to OR s.user_id = v_task.created_by)) THEN
    RAISE EXCEPTION 'You cannot update this task' USING ERRCODE = '42501';
  END IF;
  UPDATE public.research_assignments SET status = p_status,
    completed_at = CASE WHEN p_status='completed' THEN coalesce(completed_at,now()) ELSE NULL END,
    updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_create_research_assignment(text,text,uuid,text,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tma_edit_research_assignment(uuid,text,text,uuid,text,text,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tma_set_research_assignment_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_create_research_assignment(text,text,uuid,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tma_edit_research_assignment(uuid,text,text,uuid,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tma_set_research_assignment_status(uuid,text) TO authenticated;
COMMIT;
