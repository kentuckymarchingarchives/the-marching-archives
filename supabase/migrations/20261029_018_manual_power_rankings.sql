-- Manual, organization-specific Power Rankings. Run once in Supabase SQL Editor.
BEGIN;
CREATE TABLE public.power_ranking_editions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_code text NOT NULL CHECK (organization_code IN ('KMEA','BOA')),
 season_year integer NOT NULL CHECK (season_year BETWEEN 1900 AND 2100),
 title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
 classification text NOT NULL DEFAULT 'Overall' CHECK (char_length(trim(classification)) BETWEEN 1 AND 50),
 published_on date,
 source_url text,
 notes text,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_code, season_year, title, classification)
);
CREATE TABLE public.power_ranking_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 edition_id uuid NOT NULL REFERENCES public.power_ranking_editions(id) ON DELETE CASCADE,
 band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
 rank integer NOT NULL CHECK (rank BETWEEN 1 AND 10000),
 rating numeric(12,4),
 note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (edition_id, rank),
 UNIQUE (edition_id, band_id)
);
CREATE INDEX power_ranking_editions_browse_idx ON public.power_ranking_editions (organization_code, season_year DESC, status);
CREATE INDEX power_ranking_entries_edition_idx ON public.power_ranking_entries (edition_id, rank);
ALTER TABLE public.power_ranking_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.power_ranking_entries ENABLE ROW LEVEL SECURITY;
-- Published editions are public; authenticated active staff can read drafts.
CREATE POLICY power_editions_read ON public.power_ranking_editions FOR SELECT TO anon, authenticated
 USING (status = 'published' OR public.tma_can_manage());
CREATE POLICY power_entries_read ON public.power_ranking_entries FOR SELECT TO anon, authenticated
 USING (EXISTS (SELECT 1 FROM public.power_ranking_editions e WHERE e.id = edition_id AND (e.status = 'published' OR public.tma_can_manage())));
-- All staff may create draft editions and edit draft details, admins may publish.
CREATE POLICY power_editions_insert ON public.power_ranking_editions FOR INSERT TO authenticated
 WITH CHECK (public.tma_can_manage() AND status = 'draft');
CREATE POLICY power_editions_update_draft ON public.power_ranking_editions FOR UPDATE TO authenticated
 USING (public.tma_can_manage() AND status = 'draft')
 WITH CHECK (public.tma_can_manage() AND status = 'draft');
CREATE POLICY power_editions_update_admin ON public.power_ranking_editions FOR UPDATE TO authenticated
 USING (public.tma_is_admin()) WITH CHECK (public.tma_is_admin());
CREATE POLICY power_editions_delete_draft ON public.power_ranking_editions FOR DELETE TO authenticated
 USING (public.tma_is_admin() AND status = 'draft');
-- Entries of published rankings are immutable until an admin unpublishes the edition.
CREATE POLICY power_entries_insert ON public.power_ranking_entries FOR INSERT TO authenticated
 WITH CHECK (public.tma_can_manage() AND EXISTS (SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'));
CREATE POLICY power_entries_update ON public.power_ranking_entries FOR UPDATE TO authenticated
 USING (public.tma_can_manage() AND EXISTS (SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'))
 WITH CHECK (public.tma_can_manage() AND EXISTS (SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'));
CREATE POLICY power_entries_delete ON public.power_ranking_entries FOR DELETE TO authenticated
 USING (public.tma_can_manage() AND EXISTS (SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'));
GRANT SELECT ON public.power_ranking_editions, public.power_ranking_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.power_ranking_editions, public.power_ranking_entries TO authenticated;
COMMIT;
