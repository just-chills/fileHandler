// ─── SSE broadcast module ─────────────────────────────────────────────────────
// ─── events.js – re-export จาก ws.js เพื่อ backward-compatibility ────────────
// controllers ที่ require('../events') ยังใช้ได้เหมือนเดิม
const { broadcast } = require('./ws');
module.exports = { broadcast };
