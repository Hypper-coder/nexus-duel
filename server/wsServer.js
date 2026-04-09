import WebSocket, { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 8999;
const rooms = new Map(); // roomId -> Set of sockets

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("listening", () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});

wss.on("connection", (socket) => {
  socket.id = randomUUID();
  socket.roomId = null;

  socket.on("message", (rawMessage) => {
    let payload;
    try {
      payload = JSON.parse(rawMessage.toString());
    } catch (error) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    handleMessage(socket, payload);
  });

  socket.on("close", () => cleanupSocket(socket));
});

function handleMessage(socket, payload) {
  const { type, roomId } = payload;

  switch (type) {
    case "join":
      joinRoom(socket, roomId, payload.peerId);
      break;
    case "leave":
      leaveRoom(socket);
      break;
    default:
      broadcastToRoom(socket, roomId || socket.roomId, payload);
  }
}

function joinRoom(socket, roomId, peerId) {
  if (!roomId) {
    socket.send(JSON.stringify({ type: "error", message: "roomId required" }));
    return;
  }

  leaveRoom(socket);

  if (peerId) socket.peerId = peerId;

  const room = rooms.get(roomId) ?? new Set();
  room.add(socket);
  rooms.set(roomId, room);
  socket.roomId = roomId;

  const peers = Array.from(room)
    .map((peer) => peer.peerId ?? peer.id)
    .filter((id) => id !== (socket.peerId ?? socket.id));

  socket.send(JSON.stringify({ type: "joined", roomId, yourId: socket.peerId ?? socket.id, peers }));
  broadcastToRoom(socket, roomId, { type: "peer-joined", peerId: socket.peerId ?? socket.id });
}

function leaveRoom(socket) {
  const { roomId } = socket;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(socket);
  if (room.size === 0) {
    rooms.delete(roomId);
  } else {
    broadcastToRoom(socket, roomId, { type: "peer-left", peerId: socket.peerId ?? socket.id });
  }

  socket.roomId = null;
}

function cleanupSocket(socket) {
  leaveRoom(socket);
}

function broadcastToRoom(sender, roomId, message) {
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const serialized = JSON.stringify({ ...message, roomId, from: sender.id });

  for (const client of room) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}
