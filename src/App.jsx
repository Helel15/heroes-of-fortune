import { useState } from 'react'
import HeroesOfFortune from './HeroesOfFortune'
import MultiplayerLobby from './MultiplayerLobby'
import './App.css'

function App() {
  const [gameMode, setGameMode] = useState('lobby'); // 'lobby', 'singleplayer', 'multiplayer'
  const [multiplayer, setMultiplayer] = useState(null); // { roomId, playerName, socket }

  const handleModeSelect = (config) => {
    if (config.mode === 'singleplayer') {
      setGameMode('singleplayer');
      setMultiplayer(null);
    } else if (config.mode === 'multiplayer') {
      setGameMode('multiplayer');
      setMultiplayer({
        roomId: config.roomId,
        playerName: config.playerName,
        socket: config.socket
      });
    }
  };

  const handleBackToLobby = () => {
    if (multiplayer?.socket) {
      multiplayer.socket.emit('leaveRoom');
      multiplayer.socket.disconnect();
    }
    setGameMode('lobby');
    setMultiplayer(null);
  };

  if (gameMode === 'lobby') {
    return <MultiplayerLobby onModeSelect={handleModeSelect} />;
  }

  return <HeroesOfFortune multiplayer={multiplayer} onBackToLobby={handleBackToLobby} />;
}

export default App

