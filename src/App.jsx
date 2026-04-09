import { useEffect, useMemo, useRef, useState } from "react";
import Lobby from "./components/Lobby.jsx";
import RoomInfo from "./components/RoomInfo.jsx";
import CharSelect from "./components/CharSelect.jsx";
import Game from "./components/Game.jsx";
import { randomRoomId, randomPlayerId } from "./utils/constants";

const VIEWS = {
  LOBBY: "lobby",
  ROOM_INFO: "room_info",
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
  const [signalingStatus, setSignalingStatus] = useState("idle");
  const [isHost, setIsHost] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [localReady, setLocalReady] = useState(false);
  const [readyPeers, setReadyPeers] = useState([]);
  const sendSignalRef = useRef(null);

  const signalingUrl =
    import.meta.env.VITE_WS_URL ??
    `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT ?? 8999}`;

  const handleCreateRoom = () => {
    const nextRoom = randomRoomId();
    setRoomId(nextRoom);
    setStatusLabel(`Created room ${nextRoom}`);
    setIsHost(true);
    setLocalReady(false);
    setReadyPeers([]);
    setView(VIEWS.ROOM_INFO);
  };

  const handleJoinRoom = (targetRoomId) => {
    if (!targetRoomId) return;
    setRoomId(targetRoomId);
    setStatusLabel(`Joined room ${targetRoomId}`);
    setIsHost(false);
    setLocalReady(false);
    setReadyPeers([]);
    setView(VIEWS.ROOM_INFO);
  };

  const handleLocalReady = () => {
    setLocalReady(true);
    sendSignalRef.current?.({ type: "ready", peerId: playerId });
  };

  const handleChampionSelect = (champKey) => {
    setChampion(champKey);
  };

  const handleChampionConfirm = () => {
    setView(VIEWS.GAME);
  };

useEffect(() => {
    if (!roomId) {
      setConnectedPeers([]);
      setSignalingStatus("waiting for room");
      return;
    }

    setSignalingStatus("connecting");
    const socket = new WebSocket(signalingUrl);
    let retryTimer;
    let cancelled = false;

    const handleMessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        setSignalingStatus("invalid signal message");
        return;
      }

      if (payload.type === "joined") {
        setConnectedPeers(payload.peers);
        setSignalingStatus(`joined ${payload.roomId}`);
      } else if (payload.type === "peer-joined") {
        setConnectedPeers((prev) => {
          if (prev.includes(payload.peerId)) return prev;
          return [...prev, payload.peerId];
        });
        setSignalingStatus(`peer joined ${payload.peerId}`);
      } else if (payload.type === "peer-left") {
        setConnectedPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setReadyPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setSignalingStatus(`peer left ${payload.peerId}`);
      } else if (payload.type === "ready") {
        setReadyPeers((prev) => prev.includes(payload.peerId) ? prev : [...prev, payload.peerId]);
      }
    };

    let pingInterval;

    sendSignalRef.current = (msg) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    };

    socket.addEventListener("open", () => {
      setSignalingStatus("connected to signaling server");
      socket.send(JSON.stringify({ type: "join", roomId, peerId: playerId }));
      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    });
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", () => setSignalingStatus("signaling error"));
    socket.addEventListener("close", () => {
      if (cancelled) return;
      setSignalingStatus("signaling disconnected, retrying...");
      retryTimer = setTimeout(() => setRetryKey((prev) => prev + 1), 1500);
    });

    return () => {
      cancelled = true;
      sendSignalRef.current = null;
      clearInterval(pingInterval);
      socket.removeEventListener("message", handleMessage);
      if (socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      setSignalingStatus("idle");
    };
  }, [roomId, signalingUrl, retryKey, playerId]);

  // Auto-advance to champion select once every connected peer is ready
  useEffect(() => {
    if (view !== VIEWS.ROOM_INFO) return;
    if (!localReady || connectedPeers.length === 0) return;
    if (connectedPeers.every((id) => readyPeers.includes(id))) {
      setView(VIEWS.CHAMP_SELECT);
    }
  }, [localReady, readyPeers, connectedPeers, view]);

  const activePanel = useMemo(() => view, [view]);
  const lobbyStatus = `${statusLabel} · ${signalingStatus}`;

  return (
    <div className="app-shell">
      {activePanel === VIEWS.LOBBY && (
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          statusLabel={lobbyStatus}
          connectedPeers={connectedPeers}
          roomId={roomId}
        />
      )}

      {activePanel === VIEWS.ROOM_INFO && (
        <RoomInfo
          roomId={roomId}
          playerId={playerId}
          connectedPeers={connectedPeers}
          signalingStatus={signalingStatus}
          localReady={localReady}
          readyPeers={readyPeers}
          onReady={handleLocalReady}
        />
      )}

      {activePanel === VIEWS.CHAMP_SELECT && (
        <CharSelect
          selectedChampion={champion}
          onSelectChampion={handleChampionSelect}
          onComplete={handleChampionConfirm}
          connectedPeers={connectedPeers}
          playerId={playerId}
          roomId={roomId}
        />
      )}

      {activePanel === VIEWS.GAME && (
        <Game
          champion={champion}
          roomId={roomId}
          playerId={playerId}
          connectedPeers={connectedPeers}
          signalingStatus={signalingStatus}
          isHost={isHost}
        />
      )}
    </div>
  );
}
