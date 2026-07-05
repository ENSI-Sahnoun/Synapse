-- Seat-map editor added a "door" element that writes tables.table_type,
-- but the column was never created. Add it so upsertSeatMapAction stops
-- failing with "Could not find the 'table_type' column of 'tables'".
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS table_type text NOT NULL DEFAULT 'table'
    CHECK (table_type IN ('table', 'door'));

-- Force PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload schema';
