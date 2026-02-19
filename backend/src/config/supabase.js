const { createClient } = require('@supabase/supabase-js');

// ตัด / ท้าย URL ออก เพื่อป้องกัน URL ซ้ำตอนสร้าง storage path
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');

// ใช้ service_role key ก่อน (ข้าม RLS ได้) ถ้าไม่มีค่อย fallback ไปใช้ anon key
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

// สร้าง Supabase client สำหรับใช้งานทั้งโปรเจกต์
const supabase    = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase, supabaseUrl };
