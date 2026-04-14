import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [champSelections, setChampSelections] = useState({});
  const [localChampReady, setLocalChampReady] = useState(false);
  const [champReadyPeers, setChampReadyPeers] = useState([]);
  const [localRematch, setLocalRematch] = useState(false);
  const [rematchPeers, setRematchPeers] = useState([]);
  const [score, setScore] = useState({ local: 0, opponent: 0 });

  const sendSignalRef = useRef(null);
  // Game component registers a handler here to receive in-game WS messages
  const gameMessageHandlerRef = useRef(null);
  // Refs so the WS open handler can re-broadcast champ state after reconnect
  const viewRef = useRef(view);
  const championRef = useRef(champion);
  const localChampReadyRef = useRef(localChampReady);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { championRef.current = champion; }, [champion]);
  useEffect(() => { localChampReadyRef.current = localChampReady; }, [localChampReady]);

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
    setLocalChampReady(false);
    setChampReadyPeers([]);
    setChampSelections({});
    setView(VIEWS.ROOM_INFO);
  };

  const handleJoinRoom = (targetRoomId) => {
    if (!targetRoomId) return;
    setRoomId(targetRoomId);
    setStatusLabel(`Joined room ${targetRoomId}`);
    setIsHost(false);
    setLocalReady(false);
    setReadyPeers([]);
    setLocalChampReady(false);
    setChampReadyPeers([]);
    setChampSelections({});
    setView(VIEWS.ROOM_INFO);
  };

  const handleLocalReady = () => {
    setLocalReady(true);
    sendSignalRef.current?.({ type: "ready", peerId: playerId });
  };

  const handleChampionSelect = (champKey) => {
    setChampion(champKey);
    setChampSelections((prev) => ({ ...prev, [playerId]: champKey }));
    sendSignalRef.current?.({ type: "champ-select", peerId: playerId, champKey });
  };

  const handleChampionConfirm = () => {
    setLocalChampReady(true);
    sendSignalRef.current?.({ type: "champ-ready", peerId: playerId, champKey: champion });
  };

  const handleReturnToLobby = () => {
    setLocalReady(false);
    setReadyPeers([]);
    setLocalChampReady(false);
    setChampReadyPeers([]);
    setChampSelections({});
    setLocalRematch(false);
    setRematchPeers([]);
    setScore({ local: 0, opponent: 0 });
    setChampion("warrior");
    setView(VIEWS.LOBBY);
  };

  const handleRematch = () => {
    setLocalRematch(true);
    sendSignalRef.current?.({ type: "rematch", peerId: playerId });
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
        setChampReadyPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setChampSelections((prev) => { const n = { ...prev }; delete n[payload.peerId]; return n; });
        setRematchPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setSignalingStatus(`peer left ${payload.peerId}`);
      } else if (payload.type === "ready") {
        setReadyPeers((prev) => prev.includes(payload.peerId) ? prev : [...prev, payload.peerId]);
      } else if (payload.type === "champ-select") {
        setChampSelections((prev) => ({ ...prev, [payload.peerId]: payload.champKey }));
      } else if (payload.type === "champ-ready") {
        setChampSelections((prev) => ({ ...prev, [payload.peerId]: payload.champKey }));
        setChampReadyPeers((prev) => prev.includes(payload.peerId) ? prev : [...prev, payload.peerId]);
      } else if (payload.type === "rematch") {
        setRematchPeers((prev) => prev.includes(payload.peerId) ? prev : [...prev, payload.peerId]);
      } else {
        // In-game messages (state, hit, gem-heal, game-over, …) — forward to running game
        gameMessageHandlerRef.current?.(payload);
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
      // Re-broadcast champ state if WS reconnects while in champion select
      if (viewRef.current === VIEWS.CHAMP_SELECT) {
        const champKey = championRef.current;
        socket.send(JSON.stringify({ type: "champ-select", peerId: playerId, champKey }));
        if (localChampReadyRef.current) {
          socket.send(JSON.stringify({ type: "champ-ready", peerId: playerId, champKey }));
        }
      }
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

  // When entering champ select, broadcast current selection so the other player sees it immediately
  useEffect(() => {
    if (view !== VIEWS.CHAMP_SELECT) return;
    setChampSelections((prev) => ({ ...prev, [playerId]: champion }));
    sendSignalRef.current?.({ type: "champ-select", peerId: playerId, champKey: champion });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Auto-advance to game once every connected peer has confirmed their champion
  useEffect(() => {
    if (view !== VIEWS.CHAMP_SELECT) return;
    if (!localChampReady || connectedPeers.length === 0) return;
    if (connectedPeers.every((id) => champReadyPeers.includes(id))) {
      setView(VIEWS.GAME);
    }
  }, [localChampReady, champReadyPeers, connectedPeers, view]);

  // Rematch: both players agreed → go back to champ select and reset round state
  useEffect(() => {
    if (view !== VIEWS.GAME) return;
    if (!localRematch || connectedPeers.length === 0) return;
    if (connectedPeers.every((id) => rematchPeers.includes(id))) {
      setLocalRematch(false);
      setRematchPeers([]);
      setLocalChampReady(false);
      setChampReadyPeers([]);
      setChampSelections({});
      setView(VIEWS.CHAMP_SELECT);
    }
  }, [localRematch, rematchPeers, connectedPeers, view]);

  const wsSend = useCallback((msg) => sendSignalRef.current?.(msg), []);
  const onRegisterGameHandler = useCallback((handler) => { gameMessageHandlerRef.current = handler; }, []);

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
          champSelections={champSelections}
          champReadyPeers={champReadyPeers}
          localChampReady={localChampReady}
        />
      )}

      {activePanel === VIEWS.GAME && (
        <Game
          champion={champion}
          roomId={roomId}
          playerId={playerId}
          signalingStatus={signalingStatus}
          isHost={isHost}
          wsSend={wsSend}
          onRegisterGameHandler={onRegisterGameHandler}
          score={score}
          onScoreUpdate={(delta) => setScore((prev) => ({ local: prev.local + delta.local, opponent: prev.opponent + delta.opponent }))}
          onReturnToLobby={handleReturnToLobby}
          onRematch={handleRematch}
        />
      )}
    </div>
  );
}
