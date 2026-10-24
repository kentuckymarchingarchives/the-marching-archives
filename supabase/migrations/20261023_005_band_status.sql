
BEGIN;

ALTER TABLE public.bands
ADD COLUMN IF NOT EXISTS competitive_status text
NOT NULL DEFAULT 'unknown';

ALTER TABLE public.bands
DROP CONSTRAINT IF EXISTS bands_competitive_status_check;

ALTER TABLE public.bands
ADD CONSTRAINT bands_competitive_status_check
CHECK (
  competitive_status IN (
    'active_competing',
    'active_noncompeting',
    'inactive',
    'unknown'
  )
);

CREATE INDEX IF NOT EXISTS
  bands_competitive_status_idx
ON public.bands (competitive_status);

COMMIT;