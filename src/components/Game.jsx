import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import GameScene from "../game/GameScene";
import PeerConnection from "../network/PeerConnection";
import GameSync from "../network/GameSync";
import { ARENA_SIZE } from "../utils/constants";

export default function Game({ champion, roomId, playerId, connectedPeers, signalingStatus, isHost }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Initializing scene...");
  const [peerReady, setPeerReady] = useState(false);

  useEffect(() => {
    setStatus(signalingStatus);
  }, [signalingStatus]);

  const peerConnection = useMemo(() => new PeerConnection(playerId), [playerId]);
  const gameSync = useMemo(() => new GameSync(peerConnection), [peerConnection]);

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
          remoteSpawn
        })
      ],
      backgroundColor: "#0f172a",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: ARENA_SIZE.width,
        height: ARENA_SIZE.height
      }
    };

    const game = new Phaser.Game(config);

    const removeReady = peerConnection.onReady(() => {
      setStatus("Connected to PeerJS");
      setPeerReady(true);
    });
    const removeError = peerConnection.onError((error) =>
      setStatus(`Peer connection error: ${error.message}`)
    );
    const removeConnected = peerConnection.onConnected((peerId) =>
      setStatus(`Peer connected: ${peerId}`)
    );

    return () => {
      removeReady();
      removeError();
      removeConnected();
      game.destroy(true);
      gameSync.dispose();
      peerConnection.disconnect();
    };
  }, [champion, containerRef, peerConnection, playerId, roomId, gameSync, isHost]);

  // Only the guest initiates the WebRTC connection — if both sides call connectTo
  // simultaneously they each store their own outgoing connection and ignore the
  // incoming one, so no data ever flows. The host just waits for the incoming
  // connection (handled by peer.on("connection") in PeerConnection). We also
  // wait for peerReady so our peer is registered with PeerJS before connecting.
  useEffect(() => {
    if (isHost || !peerReady) return;
    connectedPeers.forEach((peerId) => peerConnection.connectTo(peerId));
  }, [connectedPeers, peerConnection, isHost, peerReady]);

  return (
    <div className="game-fullscreen">
      <div ref={containerRef} className="game-fullscreen__canvas" />
      <div className="game-fullscreen__hud">
        {roomId} · {champion} · {status}
      </div>
    </div>
  );
}
