// โหลดค่า environment variables จากไฟล์ .env (เช่น SUPABASE_URL, JWT_SECRET)
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');

// นำเข้า routes แต่ละกลุ่ม
const authRoutes   = require('./routes/authRoutes');   // เส้นทางสำหรับ login / register
const userRoutes   = require('./routes/userRoutes');   // เส้นทางสำหรับผู้ใช้ทั่วไป
const adminRoutes  = require('./routes/adminRoutes');  // เส้นทางสำหรับแอดมิน
const legacyRoutes = require('./routes/legacyRoutes'); // เส้นทาง legacy (ของเก่า)

const app  = express();
const port = process.env.PORT || 5000; // ใช้พอร์ตจาก .env หรือ 5000 เป็นค่าเริ่มต้น

// ─── Middleware ที่ใช้กับทุก request ─────────────────────────────────────────
app.use(cors());          // อนุญาตให้ frontend ต่างโดเมนเรียก API ได้
app.use(express.json()); // แปลง request body จาก JSON อัตโนมัติ

// ─── Health check – ใช้เช็คว่า server ยังทำงานอยู่ไหม ────────────────────────
app.get('/', (req, res) => res.send('Backend running smoothly with Supabase'));

// ─── ผูก routes เข้ากับ path ──────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);   // เช่น POST /api/auth/login
app.use('/api/user',  userRoutes);   // เช่น GET  /api/user/files
app.use('/api/admin', adminRoutes);  // เช่น GET  /api/admin/users
app.use('/',          legacyRoutes); // เช่น POST /upload, GET /files

// ─── เปิด server รับ request ──────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
