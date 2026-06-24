-- Add table linkage and rotation to seats
ALTER TABLE public.seats
  ADD COLUMN table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  ADD COLUMN rotation integer NOT NULL DEFAULT 0
             CHECK (rotation >= 0 AND rotation < 360);

CREATE INDEX seats_table_id_idx ON public.seats (table_id);

-- Trigger: sync table status when any linked seat changes status
CREATE OR REPLACE FUNCTION public.sync_table_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_table_id uuid;
  v_any_occupied boolean;
BEGIN
  -- Determine which table_id to update
  v_table_id := COALESCE(NEW.table_id, OLD.table_id);

  IF v_table_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.seats
    WHERE table_id = v_table_id
      AND status IN ('occupied', 'reserved')
  ) INTO v_any_occupied;

  UPDATE public.tables
    SET status = CASE WHEN v_any_occupied THEN 'occupied' ELSE 'free' END
    WHERE id = v_table_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER seats_sync_table_status
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.sync_table_status();
