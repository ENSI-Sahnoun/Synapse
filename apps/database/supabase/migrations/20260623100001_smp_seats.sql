CREATE TABLE public.seats (
  id           uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  room_id      uuid        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  label        text        NOT NULL,
  position_x   numeric     NOT NULL DEFAULT 0,
  position_y   numeric     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'free'
                           CHECK (status IN ('free', 'occupied', 'reserved', 'out_of_service')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX seats_room_id_idx ON public.seats (room_id);
CREATE INDEX seats_room_id_status_idx ON public.seats (room_id, status);

ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seats_select" ON public.seats
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "seats_insert" ON public.seats
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "seats_update" ON public.seats
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "seats_delete" ON public.seats
  FOR DELETE USING (current_user_role() = 'admin');

ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;
