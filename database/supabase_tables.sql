-- ============================================================
-- Actual Supabase Schema for FileHandler (SCOOPDrive)
-- This reflects the ACTUAL tables created by the DB admin
-- ============================================================

-- ─── Users ───────────────────────────────────────────────────
-- Actual columns (as probed from live DB):
--   id, username, email, password, status, role, created_at
--
-- NOTE: No full_name, no password_hash, no is_active,
--       no locked_until, no failed_login_attempts

CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL   PRIMARY KEY,
  username   TEXT        UNIQUE NOT NULL,
  email      TEXT        UNIQUE NOT NULL,
  password   TEXT        NOT NULL,           -- bcrypt hash
  role       TEXT        NOT NULL DEFAULT 'user',    -- 'user' | 'admin'
  status     TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'disabled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Files ───────────────────────────────────────────────────
-- Actual columns (as probed from live DB):
--   id, user_id, filename, file_url, file_size, status, created_at
--
-- NOTE: No mimetype column

CREATE TABLE IF NOT EXISTS files (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
  filename   TEXT        NOT NULL,
  file_url   TEXT        NOT NULL,
  file_size  BIGINT,
  status     TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'deleted'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS Policies ─────────────────────────────────────────────
-- OPTION A: Use service_role key in backend (recommended)
--   Set SUPABASE_SERVICE_KEY in backend/.env
--   Get from: Supabase Dashboard > Settings > API > service_role
--
-- OPTION B: Add permissive policies if using anon key
--   Run the SQL below in Supabase SQL Editor

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Permissive policies for backend anon key access (OPTION B)
CREATE POLICY "backend_users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "backend_users_select" ON users FOR SELECT USING (true);
CREATE POLICY "backend_users_update" ON users FOR UPDATE USING (true);

CREATE POLICY "backend_files_all"    ON files FOR ALL USING (true) WITH CHECK (true);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_status  ON files(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ─── Row Level Security (optional, recommended) ──────────────
-- Disable RLS so the service role key can manage all rows.
-- Enable and add policies when using Supabase Auth directly.
ALTER TABLE users          DISABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE files          DISABLE ROW LEVEL SECURITY;

-- ─── Seed: create first admin (change password after first login) ──
-- INSERT INTO users (username, full_name, email, password_hash, role)
-- VALUES ('admin', 'Administrator', 'admin@example.com',
--         '$2a$12$REPLACE_WITH_BCRYPT_HASH', 'admin');
