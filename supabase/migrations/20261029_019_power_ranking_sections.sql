-- Run AFTER 018. Backfills existing entries; does not delete rankings.
BEGIN;
CREATE TABLE public.power_ranking_sections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 edition_id uuid NOT NULL REFERENCES public.power_ranking_editions(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
 kind text NOT NULL CHECK (kind IN ('overall','class','additional')),
 classification text,
 parent_section_id uuid REFERENCES public.power_ranking_sections(id) ON DELETE RESTRICT,
 max_entries integer CHECK (max_entries BETWEEN 1 AND 1000),
 numbered boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (edition_id,name),
 UNIQUE (id,edition_id),
 CONSTRAINT section_shape CHECK (
  (kind='overall' AND parent_section_id IS NULL AND classification IS NULL AND numbered)
  OR (kind='class' AND parent_section_id IS NULL AND classification IS NOT NULL AND numbered)
  OR (kind='additional' AND parent_section_id IS NOT NULL AND classification IS NULL)
 )
);
-- Existing editions become one-section editions, preserving all existing entries.
INSERT INTO public.power_ranking_sections(edition_id,name,kind,classification,sort_order)
SELECT id, CASE WHEN classification='Overall' THEN 'Overall Rankings' ELSE 'Class '||classification END,
 CASE WHEN classification='Overall' THEN 'overall' ELSE 'class' END,
 NULLIF(classification,'Overall'),0 FROM public.power_ranking_editions;
ALTER TABLE public.power_ranking_entries ADD COLUMN section_id uuid;
UPDATE public.power_ranking_entries e SET section_id=s.id
FROM public.power_ranking_sections s WHERE s.edition_id=e.edition_id;
ALTER TABLE public.power_ranking_entries ALTER COLUMN section_id SET NOT NULL;
ALTER TABLE public.power_ranking_entries ADD CONSTRAINT entries_section_edition_fk
 FOREIGN KEY (section_id,edition_id) REFERENCES public.power_ranking_sections(id,edition_id);
ALTER TABLE public.power_ranking_entries DROP CONSTRAINT IF EXISTS power_ranking_entries_edition_id_rank_key;
ALTER TABLE public.power_ranking_entries DROP CONSTRAINT IF EXISTS power_ranking_entries_edition_id_band_id_key;
ALTER TABLE public.power_ranking_entries ALTER COLUMN rank DROP NOT NULL;
ALTER TABLE public.power_ranking_entries ADD CONSTRAINT rank_or_unranked CHECK (rank IS NULL OR rank BETWEEN 1 AND 10000);
CREATE UNIQUE INDEX power_entries_rank_per_section ON public.power_ranking_entries(section_id,rank) WHERE rank IS NOT NULL;
CREATE UNIQUE INDEX power_entries_band_per_section ON public.power_ranking_entries(section_id,band_id);
CREATE INDEX power_sections_edition_order ON public.power_ranking_sections(edition_id,sort_order);
-- Ensure additional groups belong to Overall of the SAME edition and enforce section formatting.
CREATE FUNCTION public.tma_validate_power_section() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_kind text; parent_edition uuid; org text;
BEGIN
 SELECT organization_code INTO org FROM public.power_ranking_editions WHERE id=NEW.edition_id;
 IF NEW.kind='class' AND org <> 'KMEA' THEN RAISE EXCEPTION 'Only KMEA supports class rankings'; END IF;
 IF NEW.kind='additional' THEN
   SELECT kind,edition_id INTO parent_kind,parent_edition FROM public.power_ranking_sections WHERE id=NEW.parent_section_id;
   IF parent_kind IS DISTINCT FROM 'overall' OR parent_edition IS DISTINCT FROM NEW.edition_id THEN
     RAISE EXCEPTION 'Additional groups must belong to Overall Rankings in this edition';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_power_section BEFORE INSERT OR UPDATE ON public.power_ranking_sections
FOR EACH ROW EXECUTE FUNCTION public.tma_validate_power_section();
CREATE FUNCTION public.tma_validate_power_entry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE is_numbered boolean; max_count integer; existing_count integer;
BEGIN
 SELECT numbered,max_entries INTO is_numbered,max_count FROM public.power_ranking_sections WHERE id=NEW.section_id AND edition_id=NEW.edition_id;
 IF is_numbered IS NULL THEN RAISE EXCEPTION 'Invalid ranking section'; END IF;
 IF is_numbered AND NEW.rank IS NULL THEN RAISE EXCEPTION 'Numbered section requires a rank'; END IF;
 IF NOT is_numbered AND NEW.rank IS NOT NULL THEN RAISE EXCEPTION 'Unnumbered group cannot have a rank'; END IF;
 IF max_count IS NOT NULL THEN
   SELECT count(*) INTO existing_count FROM public.power_ranking_entries
     WHERE section_id=NEW.section_id AND id IS DISTINCT FROM NEW.id;
   IF existing_count >= max_count THEN RAISE EXCEPTION 'This section is full'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_power_entry BEFORE INSERT OR UPDATE ON public.power_ranking_entries
FOR EACH ROW EXECUTE FUNCTION public.tma_validate_power_entry();
ALTER TABLE public.power_ranking_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY power_sections_read ON public.power_ranking_sections FOR SELECT TO anon,authenticated
USING (EXISTS(SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND (e.status='published' OR public.tma_can_manage())));
CREATE POLICY power_sections_insert ON public.power_ranking_sections FOR INSERT TO authenticated
WITH CHECK (public.tma_can_manage() AND EXISTS(SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'));
CREATE POLICY power_sections_update ON public.power_ranking_sections FOR UPDATE TO authenticated
USING (public.tma_can_manage() AND EXISTS(SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'))
WITH CHECK (public.tma_can_manage() AND EXISTS(SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'));
CREATE POLICY power_sections_delete ON public.power_ranking_sections FOR DELETE TO authenticated
USING (public.tma_can_manage() AND EXISTS(SELECT 1 FROM public.power_ranking_editions e WHERE e.id=edition_id AND e.status='draft'));
GRANT SELECT ON public.power_ranking_sections TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.power_ranking_sections TO authenticated;
COMMIT;
