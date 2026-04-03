import { useState } from "react";

export default function Lobby({ onCreateRoom, onJoinRoom, statusLabel }) {
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
    </section>
  );
}
