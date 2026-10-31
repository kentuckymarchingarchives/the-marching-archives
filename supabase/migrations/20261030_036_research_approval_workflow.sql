-- TMA 036: Research approval workflow
-- Requires 022 (research_assignments). Does NOT publish/verify competition records.
BEGIN;
CREATE TABLE IF NOT EXISTS public.research_approvals (
 task_id uuid PRIMARY KEY REFERENCES public.research_assignments(id) ON DELETE CASCADE,
 state text NOT NULL CHECK (state IN ('pending','approved','changes_requested')),
 submitted_by uuid NOT NULL REFERENCES public.staff_members(user_id),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 submission_note text NOT NULL DEFAULT '' CHECK (char_length(submission_note)<=2000),
 reviewed_by uuid REFERENCES public.staff_members(user_id),
 reviewed_at timestamptz,
 review_note text NOT NULL DEFAULT '' CHECK (char_length(review_note)<=2000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.research_approval_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 task_id uuid NOT NULL REFERENCES public.research_assignments(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.staff_members(user_id),
 event text NOT NULL CHECK (event IN ('submitted','approved','changes_requested','invalidated')),
 note text NOT NULL DEFAULT '' CHECK (char_length(note)<=2000),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_approval_events_task_idx ON public.research_approval_events(task_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS research_approvals_state_idx ON public.research_approvals(state, submitted_at DESC);
ALTER TABLE public.research_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_approval_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_approvals, public.research_approval_events FROM anon, authenticated;
GRANT SELECT ON public.research_approvals, public.research_approval_events TO authenticated;
DROP POLICY IF EXISTS "Active staff see research approvals" ON public.research_approvals;
CREATE POLICY "Active staff see research approvals" ON public.research_approvals
 FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id=(SELECT auth.uid()) AND s.status='active' AND s.role IN ('owner','admin','editor'))
 );
DROP POLICY IF EXISTS "Active staff see research approval events" ON public.research_approval_events;
CREATE POLICY "Active staff see research approval events" ON public.research_approval_events
 FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id=(SELECT auth.uid()) AND s.status='active' AND s.role IN ('owner','admin','editor'))
 );

CREATE OR REPLACE FUNCTION public.tma_submit_research_for_review(p_task_id uuid, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.research_assignments%ROWTYPE; v_prev public.research_approvals%ROWTYPE; v_actor uuid := (SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id=v_actor AND s.status='active' AND s.role IN ('owner','admin','editor')) THEN
  RAISE EXCEPTION 'Active staff required' USING ERRCODE='42501';
 END IF;
 IF char_length(coalesce(p_note,''))>2000 THEN RAISE EXCEPTION 'Note too long' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_task FROM public.research_assignments WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE='P0002'; END IF;
 IF v_task.status <> 'completed' THEN RAISE EXCEPTION 'Mark the research assignment completed first' USING ERRCODE='22023'; END IF;
 IF v_task.assigned_to IS DISTINCT FROM v_actor AND v_task.created_by IS DISTINCT FROM v_actor
   AND NOT EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id=v_actor AND s.role IN ('owner','admin') AND s.status='active') THEN
  RAISE EXCEPTION 'Only the assignee, creator, or manager may submit' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_prev FROM public.research_approvals WHERE task_id=p_task_id FOR UPDATE;
 IF FOUND AND v_prev.state IN ('pending','approved') THEN
  RAISE EXCEPTION 'Already submitted or approved' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.research_approvals(task_id,state,submitted_by,submitted_at,submission_note,reviewed_by,reviewed_at,review_note,updated_at)
 VALUES(p_task_id,'pending',v_actor,now(),coalesce(p_note,''),NULL,NULL,'',now())
 ON CONFLICT(task_id) DO UPDATE SET state='pending',submitted_by=EXCLUDED.submitted_by,submitted_at=EXCLUDED.submitted_at,
  submission_note=EXCLUDED.submission_note,reviewed_by=NULL,reviewed_at=NULL,review_note='',updated_at=now();
 INSERT INTO public.research_approval_events(task_id,actor_id,event,note) VALUES(p_task_id,v_actor,'submitted',coalesce(p_note,''));
END;$$;

CREATE OR REPLACE FUNCTION public.tma_review_research(p_task_id uuid, p_decision text, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := (SELECT auth.uid()); v_task public.research_assignments%ROWTYPE; v_approval public.research_approvals%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id=v_actor AND s.status='active' AND s.role IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Owner or Administrator required' USING ERRCODE='42501';
 END IF;
 IF p_decision NOT IN ('approved','changes_requested') OR char_length(coalesce(p_note,''))>2000 OR (p_decision='changes_requested' AND char_length(btrim(coalesce(p_note,'')))<5) THEN
  RAISE EXCEPTION 'Invalid decision or review note' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_task FROM public.research_assignments WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO v_approval FROM public.research_approvals WHERE task_id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_approval.state <> 'pending' OR v_task.status <> 'completed' THEN
  RAISE EXCEPTION 'This task is not awaiting review' USING ERRCODE='22023';
 END IF;
 IF v_approval.submitted_by=v_actor THEN
  RAISE EXCEPTION 'You cannot approve or reject your own submission' USING ERRCODE='42501';
 END IF;
 UPDATE public.research_approvals SET state=p_decision,reviewed_by=v_actor,reviewed_at=now(),review_note=coalesce(p_note,''),updated_at=now() WHERE task_id=p_task_id;
 INSERT INTO public.research_approval_events(task_id,actor_id,event,note) VALUES(p_task_id,v_actor,p_decision,coalesce(p_note,''));
END;$$;

-- Any substantive task edit after submission invalidates the decision.
-- Trigger executes under DB-owner privileges; the original task update still uses its existing RPC permissions.
CREATE OR REPLACE FUNCTION public.tma_invalidate_research_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state text;
BEGIN
 IF ROW(NEW.title,NEW.description,NEW.assigned_to,NEW.priority,NEW.status,NEW.due_date,NEW.competition_id)
    IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.assigned_to,OLD.priority,OLD.status,OLD.due_date,OLD.competition_id) THEN
   SELECT state INTO v_state FROM public.research_approvals WHERE task_id=NEW.id FOR UPDATE;
   IF v_state IN ('pending','approved') THEN
    UPDATE public.research_approvals SET state='changes_requested',review_note='Assignment changed after submission; resubmit for review.',
      reviewed_by=NULL,reviewed_at=NULL,updated_at=now() WHERE task_id=NEW.id;
    -- Actor can be null during privileged maintenance operations; keep safe event history when authenticated.
    IF (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id=(SELECT auth.uid())) THEN
     INSERT INTO public.research_approval_events(task_id,actor_id,event,note)
     VALUES(NEW.id,(SELECT auth.uid()),'invalidated','Assignment changed after submission.');
    END IF;
   END IF;
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS tma_research_approval_invalidation ON public.research_assignments;
CREATE TRIGGER tma_research_approval_invalidation AFTER UPDATE ON public.research_assignments
 FOR EACH ROW EXECUTE FUNCTION public.tma_invalidate_research_approval();
REVOKE ALL ON FUNCTION public.tma_submit_research_for_review(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.tma_review_research(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tma_submit_research_for_review(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tma_review_research(uuid,text,text) TO authenticated;
COMMIT;
