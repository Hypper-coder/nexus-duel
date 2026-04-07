import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import GameScene from "../game/GameScene";
import PeerConnection from "../network/PeerConnection";
import GameSync from "../network/GameSync";
import { ARENA_SIZE } from "../utils/constants";

export default function Game({ champion, roomId, playerId, onPeerListChange }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Initializing scene...");
  const [connectedPeers, setConnectedPeers] = useState([]);
  const peerConnection = useMemo(() => new PeerConnection(playerId), [playerId]);
  const gameSync = useMemo(() => new GameSync(peerConnection), [peerConnection]);
  const wsRef = useRef(null);
  const signalingUrl =
    import.meta.env.VITE_WS_URL ??
    `ws://${window.location.hostname}:${import.meta.env.VITE_WS_PORT ?? 8999}`;

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
  }, [champion, containerRef, peerConnection, playerId, roomId, gameSync]);

  useEffect(() => {
    if (!roomId) return undefined;

    const socket = new WebSocket(signalingUrl);
    wsRef.current = socket;

    const handleMessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (error) {
        setStatus("Signaling: invalid message");
        return;
      }

    if (payload.type === "joined") {
      setConnectedPeers(payload.peers);
      setStatus(`Joined ${payload.roomId} (${payload.peers.length} peer(s))`);
      payload.peers.forEach((peerId) => peerConnection.connectTo(peerId));
    } else if (payload.type === "peer-joined") {
      setConnectedPeers((prev) => {
        if (prev.includes(payload.peerId)) return prev;
        return [...prev, payload.peerId];
      });
      setStatus(`Peer joined: ${payload.peerId}`);
      peerConnection.connectTo(payload.peerId);
    } else if (payload.type === "peer-left") {
      setConnectedPeers((prev) => prev.filter((id) => id !== payload.peerId));
      setStatus(`Peer left: ${payload.peerId}`);
    }
  };

    socket.addEventListener("open", () => {
      setStatus("Connected to signaling server");
      socket.send(JSON.stringify({ type: "join", roomId }));
    });
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", () => setStatus("Signaling error"));
    socket.addEventListener("close", () => setStatus("Signaling disconnected"));

    return () => {
      socket.removeEventListener("message", handleMessage);
      socket.close();
      wsRef.current = null;
      setConnectedPeers([]);
    };
  }, [roomId, peerConnection, signalingUrl]);

  useEffect(() => {
    if (typeof onPeerListChange === "function") {
      onPeerListChange(connectedPeers);
    }
  }, [connectedPeers, onPeerListChange]);

  return (
    <section className="panel">
      <h2>Game Room</h2>
      <p>Room ID: {roomId || "–"}</p>
      <p>Champion: {champion}</p>
      <p>Player ID: {playerId}</p>
      <p>Status: {status}</p>
      <p>Connected peers: {connectedPeers.length}</p>
      {connectedPeers.length > 0 && (
        <ul style={{ paddingLeft: "1rem", margin: "0 0 1rem 0" }}>
          {connectedPeers.map((peerId) => (
            <li key={peerId}>{peerId}</li>
          ))}
        </ul>
      )}
      <div ref={containerRef} className="game-canvas" />
    </section>
  );
}
