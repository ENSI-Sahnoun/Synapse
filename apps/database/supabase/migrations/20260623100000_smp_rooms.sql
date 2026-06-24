CREATE TABLE public.rooms (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name        text        NOT NULL,
  capacity    int         NOT NULL CHECK (capacity > 0),
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'closed', 'reserved')),
  status_note text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "rooms_delete" ON public.rooms
  FOR DELETE USING (current_user_role() = 'admin');
