-- TMA 034: Private competition research notes. Prerequisites: staff_members, competitions.
-- All writes through narrowly scoped RPCs; no anon or general public access.
BEGIN;
CREATE TABLE IF NOT EXISTS public.competition_research_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 3 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS competition_research_notes_competition_idx ON public.competition_research_notes (competition_id, created_at DESC);
ALTER TABLE public.competition_research_notes ENABLE ROW LEVEL SECURITY;
-- Force RLS even for table owner access where applicable; the SECURITY DEFINER functions below
-- require privileges of their owner, so do not force RLS on this table.
REVOKE ALL ON public.competition_research_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_research_notes TO authenticated;
DROP POLICY IF EXISTS competition_research_notes_staff_read ON public.competition_research_notes;
CREATE POLICY competition_research_notes_staff_read ON public.competition_research_notes
FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.staff_members s WHERE s.user_id = (SELECT auth.uid())
   AND s.status = 'active' AND s.role IN ('owner','admin','editor'))
);

CREATE OR REPLACE FUNCTION public.tma_add_competition_research_note(p_competition_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.staff_members s WHERE s.user_id = (SELECT auth.uid())
     AND s.status = 'active' AND s.role IN ('owner','admin','editor')
 ) THEN RAISE EXCEPTION 'Active staff required' USING ERRCODE = '42501'; END IF;
 IF p_competition_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.competitions c WHERE c.id = p_competition_id
 ) THEN RAISE EXCEPTION 'Competition not found' USING ERRCODE = '22023'; END IF;
 IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 3 AND 4000
 THEN RAISE EXCEPTION 'Note must be 3 to 4000 characters' USING ERRCODE = '22023'; END IF;
 INSERT INTO public.competition_research_notes (competition_id,author_id,body)
 VALUES (p_competition_id,(SELECT auth.uid()),btrim(p_body)) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tma_set_competition_research_note_status(p_note_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.staff_members s WHERE s.user_id = (SELECT auth.uid())
     AND s.status = 'active' AND s.role IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'Owner or Administrator required' USING ERRCODE = '42501'; END IF;
 IF p_status NOT IN ('open','resolved') OR p_status IS NULL
 THEN RAISE EXCEPTION 'Invalid note status' USING ERRCODE = '22023'; END IF;
 UPDATE public.competition_research_notes
 SET status = p_status, updated_at = now(),
     resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
     resolved_by = CASE WHEN p_status = 'resolved' THEN (SELECT auth.uid()) ELSE NULL END
 WHERE id = p_note_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Note not found' USING ERRCODE = '22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.tma_add_competition_research_note(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.tma_set_competition_research_note_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tma_add_competition_research_note(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tma_set_competition_research_note_status(uuid,text) TO authenticated;
COMMIT;
