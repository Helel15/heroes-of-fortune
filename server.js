// ═══════════════════════════════════════════════════════
//  Heroes of Fortune — Multiplayer Server  (Fixed)
// ═══════════════════════════════════════════════════════
import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 5000;
const MAX_PLAYERS = 5;

const httpServer = createServer((req, res) => {
  // Basic health-check endpoint so the browser can reach the server
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Heroes of Fortune Server OK');
});

const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://lesly-subalgebraical-overgreatly.ngrok-free.dev',
      'https://respected-blonde-hardware-oops.trycloudflare.com',
      'https://respected-blonde-hardware-oops.trycloudflare.com',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 10000,
});

// rooms: Map<roomId, { id, host, players: [], gameState, started }>
const rooms = new Map();

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomList() {
  return [...rooms.values()]
    .filter((r) => !r.started && r.players.length < MAX_PLAYERS)
    .map(({ id, host, players }) => ({
      id,
      host,
      playerCount: players.length,
      maxPlayers: MAX_PLAYERS,
    }));
}

function broadcastRoomList() {
  io.emit('roomList', getRoomList());
}

io.on('connection', (socket) => {
  console.log(`✅ Client connected:    ${socket.id}`);

  // ── Send current room list as soon as client connects ──────────────
  socket.emit('roomList', getRoomList());

  // ── CREATE ROOM ────────────────────────────────────────────────────
  socket.on('createRoom', ({ playerName }, callback) => {
    try {
      const roomId = generateRoomId();
      const player = { id: socket.id, name: playerName || 'Hero', isHost: true };

      rooms.set(roomId, {
        id: roomId,
        host: playerName || 'Hero',
        players: [player],
        gameState: null,
        started: false,
      });

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.playerName = playerName;

      console.log(`🏰 Room created: ${roomId} by ${playerName}`);
      broadcastRoomList();

      // Always call callback so the client resolves correctly
      if (typeof callback === 'function') {
        callback({ success: true, roomId, player });
      }
    } catch (err) {
      console.error('createRoom error:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // ── JOIN ROOM ──────────────────────────────────────────────────────
  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    try {
      const room = rooms.get(roomId);

      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }
      if (room.started) {
        return callback?.({ success: false, error: 'Game already started' });
      }
      if (room.players.length >= MAX_PLAYERS) {
        return callback?.({ success: false, error: 'Room is full' });
      }

      const player = { id: socket.id, name: playerName || 'Hero', isHost: false };
      room.players.push(player);

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.playerName = playerName;

      // Tell everyone in the room a new player arrived
      io.to(roomId).emit('playerJoined', { player, players: room.players });

      console.log(`👥 ${playerName} joined room ${roomId} (${room.players.length}/${MAX_PLAYERS})`);
      broadcastRoomList();

      callback?.({ success: true, roomId, player, players: room.players });
    } catch (err) {
      console.error('joinRoom error:', err);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── START GAME ─────────────────────────────────────────────────────
  socket.on('startGame', ({ roomId, gameConfig }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const requester = room.players.find((p) => p.id === socket.id);
    if (!requester?.isHost) return; // only host can start

    room.started = true;
    room.gameState = gameConfig || {};

    io.to(roomId).emit('gameStarted', { players: room.players, gameConfig: room.gameState });
    broadcastRoomList();
    console.log(`⚔️  Game started in room ${roomId}`);
  });

  // ── GAME STATE SYNC ────────────────────────────────────────────────
  socket.on('gameAction', ({ roomId, action, payload }) => {
    // Relay action to everyone else in the room
    socket.to(roomId).emit('gameAction', { playerId: socket.id, action, payload });
  });

  // ── CHAT ───────────────────────────────────────────────────────────
  socket.on('chatMessage', ({ roomId, message }) => {
    io.to(roomId).emit('chatMessage', {
      playerId: socket.id,
      playerName: socket.data.playerName || 'Hero',
      message,
      timestamp: Date.now(),
    });
  });

  // ── DISCONNECT ─────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} (${reason})`);

    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`🗑️  Room ${roomId} deleted (empty)`);
    } else {
      // Transfer host if host left
      if (!room.players.some((p) => p.isHost)) {
        room.players[0].isHost = true;
        room.host = room.players[0].name;
      }
      io.to(roomId).emit('playerLeft', { playerId: socket.id, players: room.players });
    }

    broadcastRoomList();
  });
});

httpServer.listen(PORT, () => {
  console.log('');
  console.log('  🎮 Heroes of Fortune — Multiplayer Server');
  console.log(`  🔗 Server running on http://localhost:${PORT}`);
  console.log(`  🌐 WebSocket: ws://localhost:${PORT}`);
  console.log(`  👥 Max players per room: ${MAX_PLAYERS}`);
  console.log('');
});
