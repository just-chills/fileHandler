-- ============================================================
-- Supabase Tables for FileHandler (SCOOPDrive)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  username              TEXT    UNIQUE NOT NULL,
  full_name             TEXT    NOT NULL,
  email                 TEXT    UNIQUE NOT NULL,
  password_hash         TEXT    NOT NULL,
  role                  TEXT    NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  locked_until          TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Refresh Tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT    NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── OTP Codes (Forgot Password) ─────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id         SERIAL PRIMARY KEY,
  email      TEXT    UNIQUE NOT NULL,
  code       TEXT    NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Files ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  filename   TEXT    NOT NULL,
  file_url   TEXT    NOT NULL,
  file_size  BIGINT,
  mimetype   TEXT,
  status     TEXT    NOT NULL DEFAULT 'active',  -- 'active' | 'deleted'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
