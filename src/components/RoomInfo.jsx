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

    </section>
  );
}
