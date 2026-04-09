export default function RoomInfo({ roomId, playerId, connectedPeers, signalingStatus, localReady, readyPeers, onReady }) {
  const allPeersReady = connectedPeers.length > 0 && connectedPeers.every((id) => readyPeers.includes(id));
  const waitingForSelf = !localReady;
  const waitingForOthers = localReady && !allPeersReady;

  return (
    <section className="panel">
      <h2>Room Overview</h2>
      <p>
        Room ID: <strong>{roomId || "None"}</strong>
      </p>
      <p>Status: {signalingStatus}</p>
      <div style={{ marginTop: "1rem" }}>
        <strong>Players ({connectedPeers.length + 1}):</strong>
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
      {connectedPeers.length === 0 && (
        <p style={{ marginTop: "0.5rem", opacity: 0.6 }}>Waiting for another player to join…</p>
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
