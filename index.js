require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Participant = require("./Participant");

const app = express(), server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: ORIGIN }));
app.use(express.json());
const io = new Server(server, { cors: { origin: ORIGIN, methods: ["GET", "POST"] } });
const rooms = new Map();

const clean = (v, max=32) => String(v || "").trim().replace(/[<>]/g, "").slice(0, max);
const pub = u => ({ socketId: u.socketId, name: u.name, x: u.x, y: u.y });

app.get("/api/health", (_req, res) => res.json({
  ok: true, service: "ProxiSpeak",
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
}));

app.get("/api/nearby", async (req, res) => {
  try {
    const room = clean(req.query.room, 40), x = Number(req.query.x), y = Number(req.query.y);
    const radius = Math.min(Math.max(Number(req.query.radius || 260), 1), 1000);
    if (!room || !Number.isFinite(x) || !Number.isFinite(y))
      return res.status(400).json({ error: "Provide room, x and y." });
    const found = await Participant.find({
      room, location: { $near: { $geometry: { type: "Point", coordinates: [x, y] }, $maxDistance: radius } }
    }).limit(100).lean();
    res.json(found.map(u => ({
      socketId: u.socketId, name: u.name,
      x: u.location.coordinates[0], y: u.location.coordinates[1]
    })));
  } catch (e) { res.status(503).json({ error: "Nearby search failed", detail: e.message }); }
});

io.on("connection", socket => {
 socket.on("room:join", async (data = {}, ack = () => {}) => {
  const name = String(data.name || "Guest").trim();
  const room = String(data.room || "lobby").trim();

  const user = {
    socketId: socket.id,
    name,
    room,
    x: 500,
    y: 300
  };

  socket.data.profile = user;
  socket.join(room);

  if (!rooms.has(room)) {
    rooms.set(room, new Map());
  }

  rooms.get(room).set(socket.id, user);

  console.log("Friend joined:", user.name);
  console.log("Room members:",
    [...rooms.get(room).values()].map(u => u.name)
  );

  const peers = [...rooms.get(room).values()]
    .filter(u => u.socketId !== socket.id);

  ack({
    ok: true,
    self: user,
    peers
  });

  io.to(room).emit(
    "room:members",
    [...rooms.get(room).values()]
  );
});

  socket.on("position:update", async data => {
    const u = socket.data.profile; if (!u) return;
    const x = Number(data.x), y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    u.x = Math.max(0, Math.min(1000, x)); u.y = Math.max(0, Math.min(600, y));
    rooms.get(u.room)?.set(socket.id, u);
    socket.to(u.room).emit("position:update", { socketId: socket.id, x: u.x, y: u.y });
    try {
      await Participant.updateOne({ socketId: socket.id }, { $set: {
        "location.coordinates": [u.x, u.y], updatedAt: new Date()
      }});
    } catch (e) { console.warn("Position update failed:", e.message); }
  });

  socket.on("rtc:signal", ({ to, signal }={}) => {
    const u = socket.data.profile;
    if (!u || !to || !signal || !rooms.get(u.room)?.has(to)) return;
    io.to(to).emit("rtc:signal", { from: socket.id, signal });
  });

  socket.on("disconnect", async () => {
    const u = socket.data.profile; if (!u) return;
    const members = rooms.get(u.room); members?.delete(socket.id);
    if (members?.size === 0) rooms.delete(u.room);
    else if (members) io.to(u.room).emit("room:members", [...members.values()].map(pub));
    socket.to(u.room).emit("peer:left", { socketId: socket.id });
    try { await Participant.deleteOne({ socketId: socket.id }); }
    catch (e) { console.warn("MongoDB delete failed:", e.message); }
  });
});

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/proxispeak")
  .then(() => console.log("MongoDB connected"))
  .catch(e => console.warn("MongoDB unavailable:", e.message));
server.listen(PORT, () => console.log(`ProxiSpeak server: http://localhost:${PORT}`));
