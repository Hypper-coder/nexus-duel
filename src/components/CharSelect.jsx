import { CHAMPIONS } from "../utils/constants";
import bersImg from "../assets/bers.png";
import mageImg from "../assets/fate caster.png";
import archerImg from "../assets/fate archer.png";
import saberImg from "../assets/saber.png";
import ridderAttackImg from "../assets/fate rider attack.png";
import assassinImg from "../assets/fate assasin.png";
import lancerImg from "../assets/fate lancer.png";

const CHAMPION_ICONS = {
  warrior: bersImg,
  mage: mageImg,
  archer: archerImg,
  saber: saberImg,
  ridder: ridderAttackImg,
  assassin: assassinImg,
  lancer: lancerImg
};

export default function CharSelect({
  selectedChampion,
  onSelectChampion,
  onComplete,
  connectedPeers,
  playerId,
  roomId,
  champSelections = {},
  champReadyPeers = [],
  localChampReady = false
}) {
  const allPlayers = [playerId, ...connectedPeers];
  const allConfirmed =
    localChampReady &&
    connectedPeers.length > 0 &&
    connectedPeers.every((id) => champReadyPeers.includes(id));

  // Champions locked in by someone else (confirmed, not you)
  const lockedByOther = new Set(
    connectedPeers
      .filter((id) => champReadyPeers.includes(id) && champSelections[id])
      .map((id) => champSelections[id])
  );

  return (
    <section className="panel">
      <h2>Champion Selection</h2>
      <p>Pick a champion before jumping into the arena.</p>
      <div style={{ marginBottom: "1rem" }}>
        <strong>Room:</strong> {roomId || "Unknown"}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Players ({allPlayers.length}):</strong>
        <ul style={{ margin: 4, paddingLeft: "1rem" }}>
          {allPlayers.map((id) => {
            const isYou = id === playerId;
            const sel = champSelections[id];
            const confirmed = isYou ? localChampReady : champReadyPeers.includes(id);
            return (
              <li key={id}>
                {id}{isYou ? " (you)" : ""} —{" "}
                {confirmed
                  ? `✓ Locked in ${CHAMPIONS[sel]?.name ?? sel}`
                  : sel
                  ? `Picked ${CHAMPIONS[sel]?.name ?? sel}…`
                  : "choosing…"}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="champion-grid">
        {Object.values(CHAMPIONS).map((champion) => {
          const takenByOther = lockedByOther.has(champion.key);
          const isSelected = selectedChampion === champion.key;
          const isDisabled = localChampReady || takenByOther;

          return (
            <article
              key={champion.key}
              className={[
                "champion-card",
                isSelected ? "champion-card--selected" : "",
                takenByOther ? "champion-card--taken" : ""
              ].join(" ").trim()}
            >
              {CHAMPION_ICONS[champion.key] && (
                <img
                  src={CHAMPION_ICONS[champion.key]}
                  alt={champion.name}
                  className="champion-card__icon"
                />
              )}
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
              <div className="champion-card__ult">
                <strong>R — {champion.abilities.r.name}</strong>
                <span>{champion.abilities.r.damage > 0 ? `${champion.abilities.r.damage} dmg` : ""}
                  {champion.abilities.r.aoeRadius ? ` · AoE` : ""}
                  {champion.abilities.r.trueDamage ? ` · True dmg` : ""}
                  {champion.abilities.r.speedBoost ? ` · Speed ×${champion.abilities.r.speedBoost}` : ""}
                </span>
              </div>
              {takenByOther ? (
                <button type="button" disabled>Taken</button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectChampion(champion.key)}
                  disabled={isDisabled}
                >
                  {isSelected ? "Selected" : "Select"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <div style={{ marginTop: "1rem" }}>
        {!localChampReady ? (
          <button type="button" onClick={onComplete} disabled={!selectedChampion || lockedByOther.has(selectedChampion)}>
            Lock in
          </button>
        ) : allConfirmed ? (
          <p style={{ opacity: 0.8 }}>All players locked in — starting…</p>
        ) : (
          <p style={{ opacity: 0.6 }}>Waiting for other players to lock in…</p>
        )}
      </div>
    </section>
  );
}
