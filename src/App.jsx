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
  const [score, setScore] = useState({ local: 0, opponents: {} });
  const [gameMode, setGameMode] = useState("1v1");
  const [mySlot, setMySlot] = useState(0);
  const [slotAssignments, setSlotAssignments] = useState({});

  const sendSignalRef = useRef(null);
  const gameMessageHandlerRef = useRef(null);
  // Refs for values read inside WS event handlers (avoid stale closures)
  const viewRef = useRef(view);
  const championRef = useRef(champion);
  const localReadyRef = useRef(localReady);
  const localChampReadyRef = useRef(localChampReady);
  const isHostRef = useRef(isHost);
  const gameModeRef = useRef(gameMode);
  const slotAssignmentsRef = useRef(slotAssignments);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { championRef.current = champion; }, [champion]);
  useEffect(() => { localReadyRef.current = localReady; }, [localReady]);
  useEffect(() => { localChampReadyRef.current = localChampReady; }, [localChampReady]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { slotAssignmentsRef.current = slotAssignments; }, [slotAssignments]);

  const signalingUrl =
    import.meta.env.VITE_WS_URL ??
    `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT ?? 8999}`;

  const handleCreateRoom = (mode = "1v1") => {
    const nextRoom = randomRoomId();
    const initSlots = { [playerId]: 0 };
    setRoomId(nextRoom);
    setStatusLabel(`Created room ${nextRoom}`);
    setIsHost(true);
    isHostRef.current = true;
    setGameMode(mode);
    gameModeRef.current = mode;
    setMySlot(0);
    setSlotAssignments(initSlots);
    slotAssignmentsRef.current = initSlots;
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
    isHostRef.current = false;
    setLocalReady(false);
    setReadyPeers([]);
    setLocalChampReady(false);
    setChampReadyPeers([]);
    setChampSelections({});
    setSlotAssignments({});
    slotAssignmentsRef.current = {};
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
    setScore({ local: 0, opponents: {} });
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
        // Host assigns a slot to the new peer and broadcasts the full config
        if (isHostRef.current) {
          const current = slotAssignmentsRef.current;
          const taken = new Set(Object.values(current));
          let next = 1;
          while (taken.has(next)) next++;
          const updated = { ...current, [payload.peerId]: next };
          slotAssignmentsRef.current = updated;
          setSlotAssignments(updated);
          sendSignalRef.current?.({ type: "room-config", mode: gameModeRef.current, slots: updated });
        }
        // Resend ready/champ-ready state so the new peer learns what we already signalled
        if (localReadyRef.current) {
          sendSignalRef.current?.({ type: "ready", peerId: playerId });
        }
        if (localChampReadyRef.current) {
          sendSignalRef.current?.({ type: "champ-ready", peerId: playerId, champKey: championRef.current });
        }
      } else if (payload.type === "peer-left") {
        setConnectedPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setReadyPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setChampReadyPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setChampSelections((prev) => { const n = { ...prev }; delete n[payload.peerId]; return n; });
        setRematchPeers((prev) => prev.filter((id) => id !== payload.peerId));
        setSignalingStatus(`peer left ${payload.peerId}`);
      } else if (payload.type === "room-config") {
        setGameMode(payload.mode);
        gameModeRef.current = payload.mode;
        setSlotAssignments(payload.slots);
        slotAssignmentsRef.current = payload.slots;
        const slot = payload.slots[playerId];
        if (slot !== undefined) setMySlot(slot);
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

  const requiredPeers = gameMode === "ffa" ? 3 : 1;

  // Auto-advance to champion select once enough peers are present and all are ready
  useEffect(() => {
    if (view !== VIEWS.ROOM_INFO) return;
    if (!localReady || connectedPeers.length < requiredPeers) return;
    if (connectedPeers.every((id) => readyPeers.includes(id))) {
      setView(VIEWS.CHAMP_SELECT);
    }
  }, [localReady, readyPeers, connectedPeers, view, requiredPeers]);

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
    if (!localChampReady || connectedPeers.length < requiredPeers) return;
    if (connectedPeers.every((id) => champReadyPeers.includes(id))) {
      setView(VIEWS.GAME);
    }
  }, [localChampReady, champReadyPeers, connectedPeers, view, requiredPeers]);

  // Rematch: all players agreed → go back to champ select and reset round state
  useEffect(() => {
    if (view !== VIEWS.GAME) return;
    if (!localRematch || connectedPeers.length === 0) return;
    if (connectedPeers.every((id) => rematchPeers.includes(id))) {
      setLocalRematch(false);
      setRematchPeers([]);
      setLocalChampReady(false);
      setChampReadyPeers([]);
      setChampSelections({});
      setScore({ local: 0, opponents: {} });
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
          gameMode={gameMode}
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
          onScoreUpdate={(delta) => setScore((prev) => {
            const newOpponents = { ...prev.opponents };
            if (delta.opponentId) {
              newOpponents[delta.opponentId] = (newOpponents[delta.opponentId] ?? 0) + (delta.opponent ?? 0);
            }
            return { local: prev.local + (delta.local ?? 0), opponents: newOpponents };
          })}
          onReturnToLobby={handleReturnToLobby}
          onRematch={handleRematch}
          gameMode={gameMode}
          mySlot={mySlot}
          slotAssignments={slotAssignments}
          champSelections={champSelections}
        />
      )}
    </div>
  );
}
