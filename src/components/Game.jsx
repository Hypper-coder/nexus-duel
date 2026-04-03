import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import GameScene from "../game/GameScene";
import PeerConnection from "../network/PeerConnection";
import GameSync from "../network/GameSync";
import { ARENA_SIZE } from "../utils/constants";

export default function Game({ champion, roomId, playerId }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Initializing scene...");

  const peerConnection = useMemo(() => new PeerConnection(playerId), [playerId]);
  const gameSync = useMemo(() => new GameSync(peerConnection), [peerConnection]);

  useEffect(() => {
    if (!containerRef.current) return;

    const config = {
      type: Phaser.AUTO,
      width: ARENA_SIZE.width,
      height: ARENA_SIZE.height,
      parent: containerRef.current,
      scene: [
        new GameScene({
          championKey: champion,
          playerId,
          roomId,
          gameSync
        })
      ],
      backgroundColor: "#0f172a"
    };

    const game = new Phaser.Game(config);

    const removeReady = peerConnection.onReady(() => setStatus("Connected to peer network"));
    const removeError = peerConnection.onError((error) =>
      setStatus(`Peer connection error: ${error.message}`)
    );

    return () => {
      removeReady();
      removeError();
      game.destroy(true);
      gameSync.dispose();
      peerConnection.disconnect();
    };
  }, [champion, containerRef, peerConnection, playerId, roomId, gameSync]);

  return (
    <section className="panel">
      <h2>Game Room</h2>
      <p>Room ID: {roomId || "–"}</p>
      <p>Champion: {champion}</p>
      <p>Player ID: {playerId}</p>
      <p>Status: {status}</p>
      <div ref={containerRef} className="game-canvas" />
    </section>
  );
}
