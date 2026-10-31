-- TMA 030 — Owner-managed archive news and updates.
-- Run in Supabase SQL Editor after staff_members exists.
BEGIN;

CREATE TABLE IF NOT EXISTS public.archive_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'archive',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT archive_updates_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 100),
  CONSTRAINT archive_updates_title_check CHECK (length(btrim(title)) BETWEEN 5 AND 160),
  CONSTRAINT archive_updates_summary_check CHECK (length(btrim(summary)) BETWEEN 10 AND 320),
  CONSTRAINT archive_updates_content_check CHECK (length(btrim(content)) BETWEEN 20 AND 10000),
  CONSTRAINT archive_updates_category_check CHECK (category IN ('archive','research','correction','website')),
  CONSTRAINT archive_updates_status_check CHECK (status IN ('draft','published')),
  CONSTRAINT archive_updates_publish_check CHECK (status = 'draft' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS archive_updates_public_idx
 ON public.archive_updates (published_at DESC, id DESC) WHERE status = 'published';

ALTER TABLE public.archive_updates ENABLE ROW LEVEL SECURITY;
-- No direct access policies: use deliberately narrow, protected functions below.
REVOKE ALL ON TABLE public.archive_updates FROM PUBLIC, anon, authenticated;

-- Owner-only staff list, including drafts. Does not expose auth emails.
CREATE OR REPLACE FUNCTION public.tma_owner_archive_updates()
RETURNS TABLE (
  id uuid, slug text, title text, summary text, content text,
  category text, status text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT u.id, u.slug, u.title, u.summary, u.content, u.category,
        u.status, u.published_at, u.created_at, u.updated_at
 FROM public.archive_updates u
 WHERE EXISTS (
   SELECT 1 FROM public.staff_members s
   WHERE s.user_id = (SELECT auth.uid())
     AND s.role = 'owner' AND s.status = 'active'
 )
 ORDER BY u.updated_at DESC, u.id DESC
 LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.tma_owner_archive_updates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_owner_archive_updates() TO authenticated;

-- Public, published-only archive list with a bounded result count.
CREATE OR REPLACE FUNCTION public.tma_public_archive_updates(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, slug text, title text, summary text, category text,
  published_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT u.id, u.slug, u.title, u.summary, u.category, u.published_at
 FROM public.archive_updates u
 WHERE u.status = 'published' AND u.published_at <= now()
 ORDER BY u.published_at DESC, u.id DESC
 LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100);
$$;
REVOKE ALL ON FUNCTION public.tma_public_archive_updates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_archive_updates(integer) TO anon, authenticated;

-- Public detail does not expose unpublished content, staff IDs or internal metadata.
CREATE OR REPLACE FUNCTION public.tma_public_archive_update(p_slug text)
RETURNS TABLE (
 slug text, title text, summary text, content text,
 category text, published_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT u.slug, u.title, u.summary, u.content, u.category, u.published_at
 FROM public.archive_updates u
 WHERE u.slug = p_slug AND u.status = 'published' AND u.published_at <= now()
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.tma_public_archive_update(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_archive_update(text) TO anon, authenticated;

-- A single owner-protected mutation function. Never trust client role values.
CREATE OR REPLACE FUNCTION public.tma_owner_save_archive_update(
  p_id uuid, p_slug text, p_title text, p_summary text,
  p_content text, p_category text, p_status text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_id uuid;
 v_actor uuid := (SELECT auth.uid());
 v_slug text := lower(btrim(coalesce(p_slug,'')));
 v_title text := btrim(coalesce(p_title,''));
 v_summary text := btrim(coalesce(p_summary,''));
 v_content text := btrim(coalesce(p_content,''));
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.staff_members s
   WHERE s.user_id = v_actor AND s.role = 'owner' AND s.status = 'active'
 ) THEN
   RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501';
 END IF;
 IF length(v_slug) > 100 OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR length(v_title) NOT BETWEEN 5 AND 160
    OR length(v_summary) NOT BETWEEN 10 AND 320
    OR length(v_content) NOT BETWEEN 20 AND 10000
    OR p_category NOT IN ('archive','research','correction','website')
    OR p_status NOT IN ('draft','published') THEN
   RAISE EXCEPTION 'Invalid update fields' USING ERRCODE='22023';
 END IF;
 IF p_id IS NULL THEN
   INSERT INTO public.archive_updates
      (slug,title,summary,content,category,status,published_at,created_by,updated_by)
   VALUES (v_slug,v_title,v_summary,v_content,p_category,p_status,
           CASE WHEN p_status='published' THEN now() ELSE NULL END,
           v_actor,v_actor)
   RETURNING id INTO v_id;
 ELSE
   UPDATE public.archive_updates u SET
     slug=v_slug, title=v_title, summary=v_summary, content=v_content,
     category=p_category, status=p_status,
     published_at=CASE
       WHEN p_status='draft' THEN NULL
       WHEN u.published_at IS NOT NULL THEN u.published_at
       ELSE now() END,
     updated_by=v_actor, updated_at=now()
   WHERE u.id=p_id RETURNING u.id INTO v_id;
   IF v_id IS NULL THEN RAISE EXCEPTION 'Update not found' USING ERRCODE='P0002'; END IF;
 END IF;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tma_owner_save_archive_update(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_owner_save_archive_update(uuid,text,text,text,text,text,text) TO authenticated;
COMMIT;
