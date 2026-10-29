-- Run once in the Supabase SQL Editor before deploying source management.
BEGIN;

CREATE TABLE IF NOT EXISTS public.competition_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 200),
  source_type text NOT NULL DEFAULT 'other' CHECK (source_type IN ('official_results', 'recap_sheet', 'program', 'news', 'website', 'other')),
  url text CHECK (url IS NULL OR char_length(url) <= 2000),
  citation text CHECK (citation IS NULL OR char_length(citation) <= 2000),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 3000),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competition_sources_competition_created_idx
  ON public.competition_sources (competition_id, created_at DESC);

ALTER TABLE public.competition_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_sources TO authenticated;

CREATE POLICY "Active staff can read competition sources"
  ON public.competition_sources FOR SELECT TO authenticated
  USING (public.tma_is_staff());
CREATE POLICY "Active staff can create competition sources"
  ON public.competition_sources FOR INSERT TO authenticated
  WITH CHECK (public.tma_can_manage() AND created_by = (SELECT auth.uid()) AND reviewed_at IS NULL AND reviewed_by IS NULL);
CREATE POLICY "Active staff can update unreviewed source metadata"
  ON public.competition_sources FOR UPDATE TO authenticated
  USING (public.tma_can_manage())
  WITH CHECK (public.tma_can_manage());
CREATE POLICY "Active staff can delete competition sources"
  ON public.competition_sources FOR DELETE TO authenticated
  USING (public.tma_can_manage());

-- Protect verified status from direct client modifications by Editors.
CREATE OR REPLACE FUNCTION public.tma_protect_source_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE can_review boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = (SELECT auth.uid()) AND status = 'active' AND role IN ('owner', 'admin')
  ) INTO can_review;
  IF TG_OP = 'INSERT' THEN
    IF NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL THEN
      IF NOT can_review THEN RAISE EXCEPTION 'Only Owners or Administrators may mark sources reviewed'; END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
       OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by THEN
      IF NOT can_review THEN RAISE EXCEPTION 'Only Owners or Administrators may change review status'; END IF;
    END IF;
    IF (OLD.title, OLD.source_type, OLD.url, OLD.citation, OLD.notes)
       IS DISTINCT FROM (NEW.title, NEW.source_type, NEW.url, NEW.citation, NEW.notes) THEN
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.reviewed_at IS NOT NULL AND NOT can_review THEN
    RAISE EXCEPTION 'Only Owners or Administrators may delete reviewed sources';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_competition_source_review
  BEFORE INSERT OR UPDATE OR DELETE ON public.competition_sources
  FOR EACH ROW EXECUTE FUNCTION public.tma_protect_source_review();

COMMIT;
