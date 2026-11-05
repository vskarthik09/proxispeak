import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const PORT = Number(process.env.PORT || 3001);
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, port: PORT }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`Week 3 Socket.IO signaling server running on port ${PORT}`);
});

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

for (const client of [pubClient, subClient]) {
  client.on('error', (err) => console.error('[Redis]', err.message));
}

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));

const rooms = new Map();

function getRoomPeers(roomId, socketId) {
  const members = rooms.get(roomId) || new Set();
  return [...members].filter((id) => id !== socketId);
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} on ${PORT}`);

  socket.on('room:join', ({ roomId, displayName } = {}, ack = () => {}) => {
    if (!roomId || typeof roomId !== 'string') {
      ack({ ok: false, error: 'roomId is required' });
      return;
    }

    const cleanName = String(displayName || 'Guest').slice(0, 40);
    socket.data.roomId = roomId;
    socket.data.displayName = cleanName;
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);

  socket.on('webrtc:offer', ({ targetId, sdp } = {}) => {
    if (targetId && sdp) io.to(targetId).emit('webrtc:offer', {
      fromId: socket.id, sdp, displayName: socket.data.displayName || 'Guest'
    });
  });

  socket.on('webrtc:answer', ({ targetId, sdp } = {}) => {
    if (targetId && sdp) io.to(targetId).emit('webrtc:answer', { fromId: socket.id, sdp });
  });

  socket.on('webrtc:ice-candidate', ({ targetId, candidate } = {}) => {
    if (targetId && candidate) io.to(targetId).emit('webrtc:ice-candidate', {
      fromId: socket.id, candidate
    });
  });

  socket.on('room:leave', () => leaveRoom(socket));

  socket.on('disconnect', () => {
    leaveRoom(socket);
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

function leaveRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  socket.to(roomId).emit('peer:left', { socketId: socket.id });
  const members = rooms.get(roomId);
  if (members) {
    members.delete(socket.id);
    if (members.size === 0) rooms.delete(roomId);
  }
  socket.leave(roomId);
  delete socket.data.roomId;
}

httpServer.listen(PORT, () => {
  console.log(`Signaling server listening at http://localhost:${PORT}`);
  console.log(`Redis adapter configured: ${REDIS_URL}`);
});

async function shutdown() {
  await new Promise((resolve) => io.close(resolve));
  await Promise.allSettled([pubClient.quit(), subClient.quit()]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
