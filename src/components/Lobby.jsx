import { useState } from "react";

export default function Lobby({ onCreateRoom, onJoinRoom, statusLabel, connectedPeers, roomId }) {
  const [roomInput, setRoomInput] = useState("");

  return (
    <section className="panel">
      <h2>Lobby</h2>
      <p>{statusLabel}</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={() => onCreateRoom()}>
          Create room
        </button>
        <input
          placeholder="Enter room ID"
          value={roomInput}
          onChange={(event) => setRoomInput(event.target.value)}
        />
        <button
          type="button"
          onClick={() => onJoinRoom(roomInput.trim())}
          disabled={!roomInput.trim()}
        >
          Join room
        </button>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <strong>Room:</strong> {roomId || "None"}
      </div>
      {connectedPeers && connectedPeers.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <strong>Connected peers:</strong>
          <ul style={{ margin: 0, paddingLeft: "1rem" }}>
            {connectedPeers.map((peerId) => (
              <li key={peerId}>{peerId}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
