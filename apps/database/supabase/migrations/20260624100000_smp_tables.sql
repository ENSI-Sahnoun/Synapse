CREATE TABLE public.tables (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  room_id     uuid        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  label       text        NOT NULL DEFAULT '',
  position_x  numeric     NOT NULL DEFAULT 0,
  position_y  numeric     NOT NULL DEFAULT 0,
  width       numeric     NOT NULL DEFAULT 120,
  height      numeric     NOT NULL DEFAULT 80,
  rotation    integer     NOT NULL DEFAULT 0
                          CHECK (rotation >= 0 AND rotation < 360),
  status      text        NOT NULL DEFAULT 'free'
                          CHECK (status IN ('free', 'occupied', 'reserved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tables_room_id_idx ON public.tables (room_id);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tables_select" ON public.tables
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tables_insert" ON public.tables
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "tables_update" ON public.tables
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "tables_delete" ON public.tables
  FOR DELETE USING (current_user_role() = 'admin');

ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
