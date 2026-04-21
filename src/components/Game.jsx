import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import GameScene from "../game/GameScene";
import GameSync from "../network/GameSync";
import { ARENA_SIZE, PLAYER_SLOTS } from "../utils/constants";
import { installWorkerTimer } from "../game/workerTimer";

export default function Game({ champion, roomId, playerId, signalingStatus, isHost, wsSend, onRegisterGameHandler, score, onScoreUpdate, onReturnToLobby, onRematch, gameMode, mySlot, slotAssignments, champSelections }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Initializing scene...");
  const [gameOver, setGameOver] = useState(null); // "victory" | "defeat" | "draw"
  const [rematchRequested, setRematchRequested] = useState(false);

  const opponentEntries = useMemo(() =>
    Object.entries(slotAssignments ?? {})
      .filter(([id]) => id !== playerId)
      .sort((a, b) => a[1] - b[1])
      .map(([id, slot]) => ({ id, slot })),
  [slotAssignments, playerId]);

  useEffect(() => {
    setStatus(signalingStatus);
  }, [signalingStatus]);

  const gameSync = useMemo(() => new GameSync(wsSend), [wsSend]);

  useEffect(() => {
    onRegisterGameHandler((payload) => gameSync.onIncoming(payload));
    return () => onRegisterGameHandler(null);
  }, [gameSync, onRegisterGameHandler]);

  useEffect(() => {
    if (!containerRef.current) return;

    const slot = mySlot ?? (isHost ? 0 : 1);
    const slotDef = PLAYER_SLOTS[slot];
    const localTint = slotDef.tint;
    const localSpawn = slotDef.spawn;

    // Compute opponent slot info
    const opponentSlots = Object.entries(slotAssignments ?? {})
      .filter(([id]) => id !== playerId)
      .map(([id, s]) => ({ id, slot: s, championKey: (champSelections ?? {})[id] ?? "warrior" }))
      .sort((a, b) => a.slot - b.slot);

    // Fallback for 1v1 when slotAssignments not yet populated
    const remoteSlot = opponentSlots[0]?.slot ?? (slot === 0 ? 1 : 0);
    const remoteDef = PLAYER_SLOTS[remoteSlot];
    const remoteTint = remoteDef.tint;
    const remoteSpawn = remoteDef.spawn;

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      scene: [
        new GameScene({
          championKey: champion,
          playerId,
          roomId,
          gameSync,
          isHost,
          localTint,
          remoteTint,
          localSpawn,
          remoteSpawn,
          gameMode: gameMode ?? "1v1",
          mySlot: slot,
          opponentSlots: gameMode === "testing" ? [] : (opponentSlots.length > 0 ? opponentSlots : [{ id: "peer_remote", slot: remoteSlot }]),
          onGameOver: (result) => setGameOver(result),
          onScoreUpdate
        })
      ],
      backgroundColor: "#0f172a",
      audio: { noAudio: true },
      // Use setTimeout instead of requestAnimationFrame so the game loop keeps
      // ticking even when the host's browser tab is hidden/backgrounded.
      fps: { target: 60, forceSetTimeOut: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: ARENA_SIZE.width,
        height: ARENA_SIZE.height
      }
    };

    // Route Phaser's setTimeout calls through a Web Worker so the game loop
    // runs at full speed even when this browser tab is hidden/backgrounded.
    // (Chrome throttles plain setTimeout to ~1 fps in hidden tabs; Worker
    // timers are not subject to that throttle.)
    const uninstallWorkerTimer = installWorkerTimer();
    const game = new Phaser.Game(config);

    // Prevent Phaser from pausing when the window loses focus (alt+tab, etc.)
    game.events.on(Phaser.Core.Events.BLUR,   () => game.resume());
    game.events.on(Phaser.Core.Events.HIDDEN, () => game.resume());

    return () => {
      game.destroy(true);
      uninstallWorkerTimer();
      gameSync.dispose();
    };
  }, [champion, containerRef, playerId, roomId, gameSync, isHost]);

  const handleRematchClick = () => {
    setRematchRequested(true);
    onRematch?.();
  };

  const overlayLabel = gameOver === "victory" ? "Victory!" : gameOver === "defeat" ? "Defeat" : "Draw";

  const isFfa = gameMode === "ffa";

  return (
    <div className="game-fullscreen">
      <div ref={containerRef} className="game-fullscreen__canvas" />
      <div className="game-fullscreen__hud">
        {roomId} · {champion} · {status}
      </div>
      <div className="game-scoreboard-hud">
        <span className="game-scoreboard-hud__entry game-scoreboard-hud__entry--you">You  {score.local}</span>
        {opponentEntries.map(({ id, slot }) => (
          <span key={id} className="game-scoreboard-hud__entry game-scoreboard-hud__entry--opp">
            {isFfa ? `P${slot + 1}` : "Opp"}  {score.opponents?.[id] ?? 0}
          </span>
        ))}
      </div>
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-panel">
            <h1 className={`game-over-title game-over-title--${gameOver}`}>{overlayLabel}</h1>
            <table className="scoreboard">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>You</td>
                  <td>{score.local}</td>
                </tr>
                {opponentEntries.map(({ id, slot }) => (
                  <tr key={id}>
                    <td>{isFfa ? `Player ${slot + 1}` : "Opponent"}</td>
                    <td>{score.opponents?.[id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="game-over-actions">
              <button type="button" onClick={handleRematchClick} disabled={rematchRequested}>
                {rematchRequested ? "Waiting for opponent…" : "Rematch"}
              </button>
              <button type="button" onClick={onReturnToLobby}>
                Back to lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
