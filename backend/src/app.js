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
const port = process.env.PORT || 5000;

// ─── CORS – allow localhost in dev, and the deployed Vercel URL in production ──
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3000',
  process.env.FRONTEND_URL,   // e.g. https://your-app.vercel.app  (set on Render)
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json()); // แปลง request body จาก JSON อัตโนมัติ

// ─── Simple request logger ────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const color = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[${res.statusCode}]\x1b[0m ${req.method} ${req.originalUrl} (${Date.now() - start}ms)`);
  });
  next();
});

// ─── Health check – ใช้เช็คว่า server ยังทำงานอยู่ไหม ────────────────────────
app.get('/', (req, res) => res.send('Backend running smoothly with Supabase'));

// ─── ผูก routes เข้ากับ path ──────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);   // เช่น POST /api/auth/login
app.use('/api/user',  userRoutes);   // เช่น GET  /api/user/files
app.use('/api/admin', adminRoutes);  // เช่น GET  /api/admin/users
app.use('/',          legacyRoutes); // เช่น POST /upload, GET /files

// ─── Multer / global error handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  res.status(status).json({ message: err.message });
});

// ─── HTTP server + WebSocket ──────────────────────────────────────────
const http = require('http');
const { createWsServer } = require('./ws');

const server = http.createServer(app);
createWsServer(server); // ผูก WebSocket เข้ากับ HTTP server เดียวกัน

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
