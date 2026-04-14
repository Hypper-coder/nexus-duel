import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import GameScene from "../game/GameScene";
import GameSync from "../network/GameSync";
import { ARENA_SIZE } from "../utils/constants";

export default function Game({ champion, roomId, playerId, signalingStatus, isHost, wsSend, onRegisterGameHandler, score, onScoreUpdate, onReturnToLobby, onRematch }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Initializing scene...");
  const [gameOver, setGameOver] = useState(null); // "victory" | "defeat" | "draw"
  const [rematchRequested, setRematchRequested] = useState(false);

  useEffect(() => {
    setStatus(signalingStatus);
  }, [signalingStatus]);

  // GameSync uses the WebSocket channel — no WebRTC needed
  const gameSync = useMemo(() => new GameSync(wsSend), [wsSend]);

  // Register this game's incoming message handler with App so WS messages reach the scene
  useEffect(() => {
    onRegisterGameHandler((payload) => gameSync.onIncoming(payload));
    return () => onRegisterGameHandler(null);
  }, [gameSync, onRegisterGameHandler]);

  useEffect(() => {
    if (!containerRef.current) return;

    const localTint = isHost ? 0x7c3aed : 0x0ea5e9;
    const remoteTint = isHost ? 0x0ea5e9 : 0x7c3aed;
    const localSpawn = isHost ? ARENA_SIZE.playerOneSpawn : ARENA_SIZE.playerTwoSpawn;
    const remoteSpawn = isHost ? ARENA_SIZE.playerTwoSpawn : ARENA_SIZE.playerOneSpawn;

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
          onGameOver: (result) => setGameOver(result),
          onScoreUpdate
        })
      ],
      backgroundColor: "#0f172a",
      audio: { noAudio: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: ARENA_SIZE.width,
        height: ARENA_SIZE.height
      }
    };

    const game = new Phaser.Game(config);

    return () => {
      game.destroy(true);
      gameSync.dispose();
    };
  }, [champion, containerRef, playerId, roomId, gameSync, isHost]);

  const handleRematchClick = () => {
    setRematchRequested(true);
    onRematch?.();
  };

  const overlayLabel = gameOver === "victory" ? "Victory!" : gameOver === "defeat" ? "Defeat" : "Draw";

  return (
    <div className="game-fullscreen">
      <div ref={containerRef} className="game-fullscreen__canvas" />
      <div className="game-fullscreen__hud">
        {roomId} · {champion} · {status}
      </div>
      <div className="game-scoreboard-hud">
        <span className="game-scoreboard-hud__entry game-scoreboard-hud__entry--you">You  {score.local}</span>
        <span className="game-scoreboard-hud__divider">–</span>
        <span className="game-scoreboard-hud__entry game-scoreboard-hud__entry--opp">{score.opponent}  Opp</span>
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
                <tr>
                  <td>Opponent</td>
                  <td>{score.opponent}</td>
                </tr>
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
