import { CHAMPIONS } from "../utils/constants";

export default function CharSelect({
  selectedChampion,
  onSelectChampion,
  onComplete,
  connectedPeers,
  roomId
}) {
  return (
    <section className="panel">
      <h2>Champion Selection</h2>
      <p>Pick a champion before jumping into the arena.</p>
      <div style={{ marginBottom: "1rem" }}>
        <strong>Room:</strong> {roomId || "Unknown"} · <strong>Peers:</strong>{" "}
        {connectedPeers.length}
      </div>
      {connectedPeers.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <strong>Connected players:</strong>
          <ul style={{ margin: 4, paddingLeft: "1rem" }}>
            {connectedPeers.map((peerId) => (
              <li key={peerId}>{peerId}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="champion-grid">
        {Object.values(CHAMPIONS).map((champion) => (
          <article key={champion.key} className="champion-card">
            <header>
              <strong>{champion.name}</strong>
              <p>{champion.description}</p>
            </header>
            <dl>
              <dt>Health</dt>
              <dd>{champion.stats.health}</dd>
              <dt>Mana</dt>
              <dd>{champion.stats.mana}</dd>
              <dt>Speed</dt>
              <dd>{champion.stats.movementSpeed}</dd>
            </dl>
            <button
              type="button"
              onClick={() => onSelectChampion(champion.key)}
              disabled={selectedChampion === champion.key}
            >
              {selectedChampion === champion.key ? "Selected" : "Select"}
            </button>
          </article>
        ))}
      </div>
      <div style={{ marginTop: "1rem" }}>
        <button type="button" onClick={onComplete} disabled={!selectedChampion}>
          Confirm lineup
        </button>
      </div>
    </section>
  );
}
