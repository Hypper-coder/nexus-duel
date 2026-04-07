import { useMemo, useState } from "react";
import Lobby from "./components/Lobby.jsx";
import CharSelect from "./components/CharSelect.jsx";
import Game from "./components/Game.jsx";
import { randomRoomId, randomPlayerId } from "./utils/constants";

const VIEWS = {
  LOBBY: "lobby",
  CHAMP_SELECT: "char_select",
  GAME: "game"
};

export default function App() {
  const [view, setView] = useState(VIEWS.LOBBY);
  const [roomId, setRoomId] = useState(() => randomRoomId());
  const [champion, setChampion] = useState("warrior");
  const [playerId] = useState(() => randomPlayerId());
  const [statusLabel, setStatusLabel] = useState("Create or join a room to begin.");
  const [connectedPeers, setConnectedPeers] = useState([]);

  const handleCreateRoom = () => {
    const nextRoom = randomRoomId();
    setRoomId(nextRoom);
    setStatusLabel(`Created room ${nextRoom}`);
    setView(VIEWS.CHAMP_SELECT);
  };

  const handleJoinRoom = (targetRoomId) => {
    if (!targetRoomId) return;
    setRoomId(targetRoomId);
    setStatusLabel(`Joined room ${targetRoomId}`);
    setView(VIEWS.CHAMP_SELECT);
  };

  const handleChampionSelect = (champKey) => {
    setChampion(champKey);
  };

  const handleChampionConfirm = () => {
    setView(VIEWS.GAME);
  };

  const activePanel = useMemo(() => view, [view]);

  return (
    <div className="app-shell">
      {activePanel === VIEWS.LOBBY && (
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          statusLabel={statusLabel}
          connectedPeers={connectedPeers}
          roomId={roomId}
        />
      )}

      {activePanel === VIEWS.CHAMP_SELECT && (
        <CharSelect
          selectedChampion={champion}
          onSelectChampion={handleChampionSelect}
          onComplete={handleChampionConfirm}
          connectedPeers={connectedPeers}
          roomId={roomId}
        />
      )}

      {activePanel === VIEWS.GAME && (
        <Game
          champion={champion}
          roomId={roomId}
          playerId={playerId}
          onPeerListChange={setConnectedPeers}
        />
      )}
    </div>
  );
}
