-- Phase 5: Historical document catalog. Metadata and external links only.
-- Requires existing tma_is_staff() and tma_can_manage() helpers.
BEGIN;
CREATE TABLE public.archive_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  document_type text NOT NULL CHECK (document_type IN ('program','recap','newspaper','results','photograph','other')),
  organization_code text CHECK (organization_code IS NULL OR char_length(organization_code) <= 20),
  season_year integer CHECK (season_year IS NULL OR season_year BETWEEN 1800 AND 2200),
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  citation text NOT NULL CHECK (char_length(btrim(citation)) BETWEEN 3 AND 2000),
  document_url text NOT NULL CHECK (document_url ~* '^https://[^[:space:]]+$' AND char_length(document_url) <= 2000),
  rights_note text NOT NULL CHECK (char_length(btrim(rights_note)) BETWEEN 3 AND 500),
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX archive_documents_catalog_idx ON public.archive_documents(publication_status, season_year DESC, created_at DESC);
CREATE INDEX archive_documents_competition_idx ON public.archive_documents(competition_id);
ALTER TABLE public.archive_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.archive_documents TO anon, authenticated;
GRANT INSERT, UPDATE ON public.archive_documents TO authenticated;
CREATE POLICY "Public sees published documents; staff sees all" ON public.archive_documents
  FOR SELECT USING (publication_status = 'published' OR (SELECT public.tma_is_staff()));
CREATE POLICY "Staff can add document metadata" ON public.archive_documents
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.tma_can_manage()) AND created_by = (SELECT auth.uid()) AND (publication_status = 'draft' OR EXISTS (SELECT 1 FROM public.staff_members m WHERE m.user_id = (SELECT auth.uid()) AND m.status = 'active' AND m.role IN ('owner','admin'))));
CREATE POLICY "Staff can revise document metadata" ON public.archive_documents
  FOR UPDATE TO authenticated USING ((SELECT public.tma_can_manage())) WITH CHECK ((SELECT public.tma_can_manage()));

-- Prevent Editors from publishing or unpublishing, even via direct API calls.
CREATE FUNCTION public.tma_documents_publication_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.publication_status IS DISTINCT FROM OLD.publication_status AND NOT EXISTS (
    SELECT 1 FROM public.staff_members m WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Only Owners and Administrators may change document publication status';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tma_documents_publication_guard BEFORE UPDATE ON public.archive_documents
FOR EACH ROW EXECUTE FUNCTION public.tma_documents_publication_guard();
-- Public query only returns explicitly selected public catalog fields in application code.
COMMIT;
