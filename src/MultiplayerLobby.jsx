// ═══════════════════════════════════════════════════════
//  Heroes of Fortune — Multiplayer Lobby  (Fixed)
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = 'https://respected-blonde-hardware-oops.trycloudflare.com';
const FONT = "'Cinzel','Palatino Linotype',Georgia,serif";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&display=swap');
@keyframes glow{0%,100%{text-shadow:0 0 20px #dc143c,0 0 40px #8b0000}50%{text-shadow:0 0 50px #dc143c,0 0 80px #ff0000}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.fadeUp{animation:fadeUp 0.4s ease}
.btn{transition:all 0.15s;cursor:pointer}
.btn:hover:not(:disabled){filter:brightness(1.2);transform:translateY(-2px)}
.btn:disabled{opacity:0.4;cursor:not-allowed}
.room-card{transition:all 0.2s;cursor:pointer}
.room-card:hover{border-color:#dc143c!important;box-shadow:0 4px 20px rgba(220,20,60,0.3)!important}
.spin{animation:spin 1s linear infinite}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:#8b0000;border-radius:2px}
`;

const ROOT = {
  minHeight: '100vh',
  background: '#0a0005',
  backgroundImage:
    'radial-gradient(ellipse at 30% 0%,#1a0010 0%,#0a0005 50%),radial-gradient(ellipse at 70% 100%,#001200 0%,transparent 50%)',
  fontFamily: FONT,
  color: '#d4a0a8',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

export default function MultiplayerLobby({ onSinglePlayer }) {
  const [playerName, setPlayerName]   = useState('');
  const [rooms, setRooms]             = useState([]);
  const [status, setStatus]           = useState('disconnected'); // disconnected | connecting | connected | error
  const [statusMsg, setStatusMsg]     = useState('');
  const [creating, setCreating]       = useState(false);
  const [joining, setJoining]         = useState(null);     // roomId being joined
  const [inRoom, setInRoom]           = useState(null);     // { roomId, players, isHost }
  const [chatLog, setChatLog]         = useState([]);
  const [chatInput, setChatInput]     = useState('');
  const socketRef = useRef(null);

  // ── Connect to server ────────────────────────────────────────────
  useEffect(() => {
    setStatus('connecting');
    setStatusMsg('Connecting to server…');

    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      path: '/socket.io/',
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setStatus('connected');
      setStatusMsg('');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error:', err.message);
      setStatus('error');
      setStatusMsg(`Cannot reach server — is "npm run server" running? (${err.message})`);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setStatus('disconnected');
      setStatusMsg('Disconnected from server.');
    });

    // Room list broadcast from server
    socket.on('roomList', (list) => {
      setRooms(list);
    });

    // Someone joined our room
    socket.on('playerJoined', ({ players }) => {
      setInRoom((r) => r ? { ...r, players } : r);
    });

    // Someone left our room
    socket.on('playerLeft', ({ players }) => {
      setInRoom((r) => r ? { ...r, players } : r);
    });

    // Host started the game
    socket.on('gameStarted', ({ players, gameConfig }) => {
      // TODO: transition to game screen, passing players & config
      console.log('Game started!', players, gameConfig);
    });

    // Chat
    socket.on('chatMessage', (msg) => {
      setChatLog((l) => [...l, msg].slice(-50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Create Room ──────────────────────────────────────────────────
  const handleCreate = () => {
    const name = playerName.trim() || 'Hero';
    if (!socketRef.current?.connected) return;

    setCreating(true);

    socketRef.current.emit('createRoom', { playerName: name }, (res) => {
      setCreating(false);
      if (res?.success) {
        setInRoom({ roomId: res.roomId, players: res.player ? [res.player] : [], isHost: true });
      } else {
        setStatusMsg(`Failed to create room: ${res?.error || 'unknown error'}`);
      }
    });
  };

  // ── Join Room ────────────────────────────────────────────────────
  const handleJoin = (roomId) => {
    const name = playerName.trim() || 'Hero';
    if (!socketRef.current?.connected) return;

    setJoining(roomId);

    socketRef.current.emit('joinRoom', { roomId, playerName: name }, (res) => {
      setJoining(null);
      if (res?.success) {
        setInRoom({ roomId: res.roomId, players: res.players || [], isHost: false });
      } else {
        setStatusMsg(`Failed to join: ${res?.error || 'unknown error'}`);
      }
    });
  };

  // ── Start Game (host only) ───────────────────────────────────────
  const handleStart = () => {
    if (!inRoom?.isHost) return;
    socketRef.current?.emit('startGame', { roomId: inRoom.roomId, gameConfig: {} });
  };

  // ── Leave Room ───────────────────────────────────────────────────
  const handleLeave = () => {
    // Disconnect and reconnect to cleanly leave the room
    socketRef.current?.disconnect();
    setInRoom(null);
    // Small delay then reconnect
    setTimeout(() => socketRef.current?.connect(), 200);
  };

  // ── Send Chat ────────────────────────────────────────────────────
  const sendChat = () => {
    if (!chatInput.trim() || !inRoom) return;
    socketRef.current?.emit('chatMessage', { roomId: inRoom.roomId, message: chatInput.trim() });
    setChatInput('');
  };

  // ══════════════════════════════════════════════════════════════════
  //  IN-ROOM VIEW
  // ══════════════════════════════════════════════════════════════════
  if (inRoom) {
    return (
      <div style={ROOT}>
        <style>{CSS}</style>
        <div style={{ width: '100%', maxWidth: '560px' }} className="fadeUp">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '6px' }}>⚔️🏰⚔️</div>
            <h2
              style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '18px', color: '#dc143c', margin: '0 0 4px', letterSpacing: '3px' }}
              className="glow"
            >
              Room: {inRoom.roomId}
            </h2>
            <p style={{ color: '#3a0015', fontSize: '10px', margin: 0, letterSpacing: '2px' }}>
              {inRoom.isHost ? '👑 YOU ARE HOST' : '🗡️ WAITING FOR HOST TO START'}
            </p>
          </div>

          {/* Players */}
          <div style={{ background: 'rgba(10,0,5,0.8)', border: '1px solid rgba(139,0,0,0.3)', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: '9px', letterSpacing: '3px', color: '#6b0020', marginBottom: '10px' }}>
              HEROES ({inRoom.players.length}/5)
            </div>
            {inRoom.players.map((p, i) => (
              <div key={p.id || i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', padding: '6px', background: 'rgba(139,0,0,0.06)', borderRadius: '4px', border: '1px solid rgba(139,0,0,0.12)' }}>
                <span style={{ fontSize: '14px' }}>{p.isHost ? '👑' : '⚔️'}</span>
                <span style={{ flex: 1, fontSize: '11px', color: p.isHost ? '#ffd700' : '#d4a0a8' }}>{p.name}</span>
                {p.isHost && <span style={{ fontSize: '8px', color: '#8b0000', letterSpacing: '1px' }}>HOST</span>}
              </div>
            ))}
            {inRoom.players.length < 5 && (
              <div style={{ padding: '6px', textAlign: 'center', color: '#2a0015', fontSize: '9px', letterSpacing: '2px', animation: 'pulse 2s infinite' }}>
                WAITING FOR MORE HEROES…
              </div>
            )}
          </div>

          {/* Chat */}
          <div style={{ background: 'rgba(10,0,5,0.8)', border: '1px solid rgba(139,0,0,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: '9px', letterSpacing: '3px', color: '#6b0020', marginBottom: '8px' }}>CHAT</div>
            <div style={{ height: '100px', overflowY: 'auto', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {chatLog.length === 0 && <div style={{ color: '#1a0010', fontSize: '9px' }}>No messages yet…</div>}
              {chatLog.map((m, i) => (
                <div key={i} style={{ fontSize: '9px', lineHeight: '1.4' }}>
                  <span style={{ color: '#8b0000' }}>{m.playerName}: </span>
                  <span style={{ color: '#6b3040' }}>{m.message}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Type a message…"
                style={{ flex: 1, background: '#0a0005', border: '1px solid #1a0010', color: '#d4a0a8', borderRadius: '4px', padding: '5px 8px', fontFamily: FONT, fontSize: '10px', outline: 'none' }}
              />
              <button className="btn" onClick={sendChat} style={{ padding: '5px 10px', fontFamily: FONT, fontSize: '10px', background: 'rgba(139,0,0,0.2)', border: '1px solid #8b000055', color: '#8b0000', borderRadius: '4px' }}>
                Send
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {inRoom.isHost && (
              <button
                className="btn"
                onClick={handleStart}
                disabled={inRoom.players.length < 1}
                style={{ flex: 2, padding: '13px', fontFamily: FONT, fontSize: '13px', letterSpacing: '2px', background: 'linear-gradient(135deg,#1a0005,#3a0010)', border: '2px solid #dc143c', color: '#dc143c', borderRadius: '5px', boxShadow: '0 4px 20px rgba(220,20,60,0.3)' }}
              >
                ⚔️ Start Battle
              </button>
            )}
            <button
              className="btn"
              onClick={handleLeave}
              style={{ flex: 1, padding: '13px', fontFamily: FONT, fontSize: '11px', background: 'rgba(10,0,5,0.7)', border: '1px solid #3a0015', color: '#6b3040', borderRadius: '5px' }}
            >
              ← Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  LOBBY VIEW
  // ══════════════════════════════════════════════════════════════════
  return (
    <div style={ROOT}>
      <style>{CSS}</style>
      <div style={{ width: '100%', maxWidth: '560px' }} className="fadeUp">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎮🌐💀</div>
          <h1 style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 'clamp(16px,4vw,26px)', color: '#dc143c', letterSpacing: '4px', margin: '0 0 4px' }} className="glow">
            Multiplayer Arena
          </h1>
          <p style={{ letterSpacing: '4px', color: '#6b0020', fontSize: '9px', margin: 0 }}>UP TO 5 HEROES PER BATTLE</p>
        </div>

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '16px', padding: '7px 10px', background: 'rgba(10,0,5,0.7)', border: `1px solid ${status === 'connected' ? '#39ff1433' : status === 'error' ? '#dc143c33' : '#1a001033'}`, borderRadius: '5px' }}>
          {status === 'connecting' && <div className="spin" style={{ width: '8px', height: '8px', border: '2px solid #8b0000', borderTopColor: '#dc143c', borderRadius: '50%' }} />}
          {status === 'connected'  && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#39ff14', boxShadow: '0 0 6px #39ff14' }} />}
          {status === 'error'      && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc143c', boxShadow: '0 0 6px #dc143c' }} />}
          {status === 'disconnected' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3a0015' }} />}
          <span style={{ fontSize: '9px', color: status === 'connected' ? '#39ff14' : status === 'error' ? '#ff4466' : '#3a0015', letterSpacing: '1px' }}>
            {status === 'connecting'  && 'CONNECTING…'}
            {status === 'connected'   && 'SERVER ONLINE'}
            {status === 'error'       && (statusMsg || 'CONNECTION ERROR')}
            {status === 'disconnected' && 'DISCONNECTED'}
          </span>
        </div>

        {/* Player name */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontFamily: "'Cinzel',serif", fontSize: '9px', letterSpacing: '3px', color: '#6b0020', marginBottom: '6px' }}>YOUR NAME</label>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter hero name…"
            maxLength={20}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0a0005', border: '1px solid rgba(139,0,0,0.4)', color: '#d4a0a8', borderRadius: '5px', padding: '10px 12px', fontFamily: FONT, fontSize: '13px', outline: 'none' }}
          />
        </div>

        {/* Create Room */}
        <button
          className="btn"
          onClick={handleCreate}
          disabled={creating || status !== 'connected'}
          style={{ width: '100%', padding: '13px', marginBottom: '20px', fontFamily: FONT, fontSize: '13px', letterSpacing: '2px', background: status === 'connected' && !creating ? 'linear-gradient(135deg,#1a0005,#3a0010)' : 'rgba(10,0,5,0.5)', border: `2px solid ${status === 'connected' && !creating ? '#dc143c' : '#1a0010'}`, color: status === 'connected' && !creating ? '#dc143c' : '#2a0015', borderRadius: '5px', boxShadow: status === 'connected' && !creating ? '0 4px 20px rgba(220,20,60,0.25)' : 'none' }}
        >
          {creating ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span className="spin" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #dc143c44', borderTopColor: '#dc143c', borderRadius: '50%' }} />
              CREATING…
            </span>
          ) : '🏰 Create Room'}
        </button>

        {/* Room list */}
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: '9px', letterSpacing: '3px', color: '#6b0020', marginBottom: '10px' }}>
          JOIN BATTLE ({rooms.length} AVAILABLE)
        </div>

        {rooms.length === 0 ? (
          <div style={{ padding: '18px', textAlign: 'center', background: 'rgba(10,0,5,0.6)', border: '1px solid rgba(139,0,0,0.1)', borderRadius: '6px', color: '#2a0015', fontSize: '10px', letterSpacing: '1px', marginBottom: '16px' }}>
            No rooms available. Create one to get started!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '16px', maxHeight: '260px', overflowY: 'auto' }}>
            {rooms.map((room) => (
              <div
                key={room.id}
                className="room-card"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(10,0,5,0.8)', border: '1px solid rgba(139,0,0,0.25)', borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
              >
                <span style={{ fontSize: '18px' }}>🏰</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: '11px', color: '#d4a0a8' }}>Room {room.id}</div>
                  <div style={{ fontSize: '9px', color: '#3a0015' }}>Host: {room.host} · {room.playerCount}/{room.maxPlayers} heroes</div>
                </div>
                <button
                  className="btn"
                  onClick={() => handleJoin(room.id)}
                  disabled={joining === room.id || status !== 'connected'}
                  style={{ padding: '6px 14px', fontFamily: FONT, fontSize: '10px', background: 'rgba(139,0,0,0.25)', border: '1px solid #dc143c66', color: '#dc143c', borderRadius: '4px' }}
                >
                  {joining === room.id ? '…' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Single player fallback */}
        <button
          className="btn"
          onClick={onSinglePlayer}
          style={{ width: '100%', padding: '11px', fontFamily: FONT, fontSize: '11px', letterSpacing: '2px', background: 'rgba(10,0,5,0.5)', border: '1px solid #1a0010', color: '#3a0015', borderRadius: '5px' }}
        >
          ✕ Single Player
        </button>
      </div>
    </div>
  );
}
