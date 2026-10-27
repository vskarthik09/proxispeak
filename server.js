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
