CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees can read all" ON announcements FOR SELECT USING (true);
CREATE POLICY "employees can insert" ON announcements FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "employees can update own" ON announcements FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "employees can delete own" ON announcements FOR DELETE USING (auth.uid() = created_by);
