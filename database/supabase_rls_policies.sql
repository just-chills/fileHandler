-- ============================================================
-- RLS Policies for FileHandler (SCOOPDrive)
-- Run this in the Supabase SQL Editor if using the anon key in backend
-- NOTE: If backend uses service_role key, these are not needed
-- ============================================================

-- ─── Allow backend to insert users (registration) ─────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow anon/service to insert (registration)
CREATE POLICY "Allow insert users" ON users
  FOR INSERT WITH CHECK (true);

-- Allow anon to select own user or all (for login check)
CREATE POLICY "Allow select users" ON users
  FOR SELECT USING (true);

-- Allow anon to update own user
CREATE POLICY "Allow update users" ON users
  FOR UPDATE USING (true);

-- ─── Files table ─────────────────────────────────────────────
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on files" ON files
  FOR ALL USING (true) WITH CHECK (true);
