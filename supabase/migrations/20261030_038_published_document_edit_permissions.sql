-- TMA 038 — Published historical document metadata protection
-- Requires migration 017 (archive_documents) and staff_members roles.
-- Editors may update draft documents, not already-published documents.
-- Owners/Administrators may update both draft and published documents.
-- Publication-status transitions remain guarded by tma_documents_publication_guard.
BEGIN;

DROP POLICY IF EXISTS "Staff can revise document metadata" ON public.archive_documents;

CREATE POLICY "Staff can revise document metadata"
ON public.archive_documents
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members AS staff
    WHERE staff.user_id = (SELECT auth.uid())
      AND staff.status = 'active'
      AND (
        staff.role IN ('owner', 'admin')
        OR (staff.role = 'editor' AND archive_documents.publication_status = 'draft')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_members AS staff
    WHERE staff.user_id = (SELECT auth.uid())
      AND staff.status = 'active'
      AND (
        staff.role IN ('owner', 'admin')
        OR (staff.role = 'editor' AND archive_documents.publication_status = 'draft')
      )
  )
);

-- Prevent a direct API request from reassigning original authorship.
-- This also applies to Owners/Admins; authored-by history should be preserved.
CREATE OR REPLACE FUNCTION public.tma_documents_immutable_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Document creator cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tma_documents_immutable_creator ON public.archive_documents;
CREATE TRIGGER tma_documents_immutable_creator
BEFORE UPDATE ON public.archive_documents
FOR EACH ROW EXECUTE FUNCTION public.tma_documents_immutable_creator();

COMMIT;
