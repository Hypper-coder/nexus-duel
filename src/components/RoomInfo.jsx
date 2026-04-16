export default function RoomInfo({ roomId, playerId, connectedPeers, signalingStatus, localReady, readyPeers, onReady, gameMode }) {
  const requiredPeers = gameMode === "ffa" ? 3 : 1;
  const requiredTotal = requiredPeers + 1;
  const allPeersReady = connectedPeers.length >= requiredPeers && connectedPeers.every((id) => readyPeers.includes(id));
  const waitingForSelf = !localReady;
  const waitingForOthers = localReady && !allPeersReady;
  const modeLabel = gameMode === "ffa" ? "Free For All (4 players)" : "1v1 (2 players)";

  return (
    <section className="panel">
      <h2>Room Overview</h2>
      <p>
        Room ID: <strong>{roomId || "None"}</strong>
      </p>
      <p>Mode: <strong>{modeLabel}</strong></p>
      <p>Status: {signalingStatus}</p>
      <div style={{ marginTop: "1rem" }}>
        <strong>Players ({connectedPeers.length + 1} / {requiredTotal}):</strong>
        <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
          <li>
            {playerId} (you) — {localReady ? "✓ Ready" : "Not ready"}
          </li>
          {connectedPeers.map((id) => (
            <li key={id}>
              {id} — {readyPeers.includes(id) ? "✓ Ready" : "Not ready"}
            </li>
          ))}
        </ul>
      </div>
      {connectedPeers.length < requiredPeers && (
        <p style={{ marginTop: "0.5rem", opacity: 0.6 }}>
          Waiting for {requiredPeers - connectedPeers.length} more player{requiredPeers - connectedPeers.length !== 1 ? "s" : ""} to join…
        </p>
      )}
      {waitingForSelf && connectedPeers.length > 0 && (
        <button type="button" style={{ marginTop: "1rem" }} onClick={onReady}>
          Ready!
        </button>
      )}
      {waitingForOthers && (
        <p style={{ marginTop: "1rem", opacity: 0.6 }}>Waiting for other players…</p>
      )}

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
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <Key label="1" /><Key label="2" /><Key label="3" /><Key label="4" />
            </div>
            <span style={{ fontSize: "0.88rem", opacity: 0.7 }}>Target mode — Champions / Towers / Creeps / Closest</span>
          </div>
        </div>
      </div>

    </section>
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
