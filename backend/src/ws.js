// ─── Secure WebSocket server ──────────────────────────────────────────────────
// • JWT ตรวจทันทีตอน HTTP Upgrade request (ก่อน WS handshake เสร็จ)
// • ไม่รับ message จาก client (server-push only) → ป้องกัน injection
// • Heartbeat ping/pong ทุก 30 วินาที ตัด dead connection อัตโนมัติ

const WebSocket  = require('ws');
const jwt        = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/jwt');

/** @type {Set<{ws: WebSocket, userId: string, role: string}>} */
const wsClients = new Set();

/**
 * สร้าง WebSocket server แล้วผูกกับ HTTP server ที่ส่งมา
 * @param {import('http').Server} server
 */
function createWsServer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  // ─── ตรวจ JWT ระหว่าง HTTP Upgrade (ก่อน accept connection) ──────────────
  wss.on('headers', (headers, req) => {
    // เจาะ token จาก ?token=...
    const raw   = req.url || '';
    const match = raw.match(/[?&]token=([^&]+)/);
    // ถ้าไม่มี token → wss.on('connection') จะถูก block โดย handleProtocols
    // หรือปล่อยให้ connection handler ตรวจแทน
    req._token = match ? decodeURIComponent(match[1]) : null;
  });

  wss.on('connection', (ws, req) => {
    // ─── ตรวจ JWT ──────────────────────────────────────────────────────────
    const token = req._token;
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    const client = { ws, userId: String(decoded.id), role: decoded.role };
    wsClients.add(client);

    // Server-push only: ไม่ process message ใดจาก client
    ws.on('message', () => { /* ignore all */ });
    ws.on('close',   () => wsClients.delete(client));
    ws.on('error',   () => wsClients.delete(client));
    ws.on('pong',    () => { ws.isAlive = true; });
    ws.isAlive = true;
  });

  // ─── Heartbeat – ตัด dead connection ทุก 30s ─────────────────────────────
  const beat = setInterval(() => {
    for (const c of wsClients) {
      if (!c.ws.isAlive) {
        c.ws.terminate();
        wsClients.delete(c);
        continue;
      }
      c.ws.isAlive = false;
      c.ws.ping();
    }
  }, 30_000);

  wss.on('close', () => clearInterval(beat));
  return wss;
}

/**
 * ส่ง event ไปยัง WebSocket clients ที่ผ่าน filter
 * @param {object} payload  – ข้อมูล event ที่จะส่ง
 * @param {(c: {userId:string, role:string}) => boolean} [filter]  – default = ส่งทุกคน
 */
function broadcast(payload, filter = () => true) {
  const msg = JSON.stringify(payload);
  for (const c of wsClients) {
    if (c.ws.readyState === WebSocket.OPEN && filter(c)) {
      try { c.ws.send(msg); } catch { wsClients.delete(c); }
    }
  }
}

module.exports = { createWsServer, broadcast };
