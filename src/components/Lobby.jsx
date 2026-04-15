import { useState } from "react";

export default function Lobby({ onCreateRoom, onJoinRoom, statusLabel, connectedPeers, roomId }) {
  const [roomInput, setRoomInput] = useState("");
  const [selectedMode, setSelectedMode] = useState("1v1");

  return (
    <section className="panel">
      <h2>Lobby</h2>
      <p>{statusLabel}</p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={() => setSelectedMode("1v1")}
          style={{ opacity: selectedMode === "1v1" ? 1 : 0.4, fontWeight: selectedMode === "1v1" ? "bold" : "normal" }}
        >
          1v1 (2 players)
        </button>
        <button
          type="button"
          onClick={() => setSelectedMode("ffa")}
          style={{ opacity: selectedMode === "ffa" ? 1 : 0.4, fontWeight: selectedMode === "ffa" ? "bold" : "normal" }}
        >
          FFA (4 players)
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={() => onCreateRoom(selectedMode)}>
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

      <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.25rem" }}>
        <strong style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5 }}>Gemstones</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.75rem" }}>
          <InfoRow icon="💎" text="Gemstones spawn on the map and can be picked up by walking over them." />
          <InfoRow icon="❤️" text="Picking up a gemstone restores 50% of your max HP and 50% of your max mana." />
          <InfoRow icon="⏱️" text="After being picked up, a gemstone respawns at a new location after 30 seconds." />
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.25rem" }}>
        <strong style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5 }}>Towers</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.75rem" }}>
          <InfoRow icon="🏰" text="Each player has a tower near their spawn that automatically attacks nearby enemies." />
          <InfoRow icon="⚔️" text="In 1v1 you can only damage an enemy tower after their champion is dead. In FFA towers are always attackable." />
          <InfoRow icon="🔄" text="Walk up to an enemy tower and press Space to attack it. Your champion must be in melee/attack range." />
          <InfoRow icon="💀" text="When a tower is destroyed its owner gets one final respawn — a last stand. If they die again, they are permanently eliminated." />
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.25rem" }}>
        <strong style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5 }}>How to win</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.75rem" }}>
          <InfoRow icon="🏆" text="1v1 — permanently eliminate your opponent (destroy their tower then kill them on their last stand)." />
          <InfoRow icon="🏆" text="FFA — be the last player standing. All other players must be permanently eliminated." />
          <InfoRow icon="📊" text="The player with the highest score at the end wins. If scores are tied, the match is a draw." />
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.25rem" }}>
        <strong style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5 }}>Scoring</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.75rem" }}>
          <ScoreRow pts={1} label="Kill a regular creep" color="#94a3b8" />
          <ScoreRow pts={2} label="Kill a Twitch monster or caster minion" color="#fbbf24" />
          <ScoreRow pts={3} label="Kill an enemy champion" color="#f87171" />
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", opacity: 0.5, lineHeight: 1.5 }}>
            Your tower also earns points by killing creeps and minions automatically.
            The player with the highest score when only 1 champion is left standing wins. Tied scores result in a draw.
          </p>
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.25rem" }}>
        <strong style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5 }}>Controls</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 32px)", gridTemplateRows: "repeat(2, 32px)", gap: "3px" }}>
              <div />
              <Key label="W" />
              <div />
              <Key label="A" />
              <Key label="S" />
              <Key label="D" />
            </div>
            <span style={{ fontSize: "0.88rem", opacity: 0.7 }}>Move</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Key label="Space" wide />
            <span style={{ fontSize: "0.88rem", opacity: 0.7 }}>Basic attack</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Key label="R" accent />
            <span style={{ fontSize: "0.88rem", opacity: 0.7 }}>Ultimate — targets nearest enemy champion</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ icon, text }) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ opacity: 0.75 }}>{text}</span>
    </div>
  );
}

function ScoreRow({ pts, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "36px",
        height: "24px",
        borderRadius: "5px",
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${color}55`,
        color,
        fontSize: "0.8rem",
        fontWeight: "800",
        flexShrink: 0,
      }}>
        +{pts}
      </span>
      <span style={{ fontSize: "0.88rem", opacity: 0.75 }}>{label}</span>
    </div>
  );
}

function Key({ label, wide, accent }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: wide ? "88px" : "32px",
      height: "32px",
      padding: "0 6px",
      borderRadius: "5px",
      border: accent ? "1px solid rgba(255, 100, 0, 0.7)" : "1px solid rgba(255,255,255,0.25)",
      background: accent ? "rgba(255, 100, 0, 0.12)" : "rgba(255,255,255,0.06)",
      fontSize: "0.75rem",
      fontWeight: "700",
      letterSpacing: "0.03em",
      color: accent ? "#ff8c3a" : "rgba(255,255,255,0.75)",
      boxShadow: "0 2px 0 rgba(0,0,0,0.4)",
      userSelect: "none",
      flexShrink: 0,
    }}>
      {label}
    </div>
  );
}
