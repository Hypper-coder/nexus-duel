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

  const lockedByOther = new Set(
    connectedPeers
      .filter((id) => champReadyPeers.includes(id) && champSelections[id])
      .map((id) => champSelections[id])
  );

  return (
    <section className="panel char-select">
      <h2 className="char-select__title">Champion Selection</h2>
      <p className="char-select__subtitle">Choose your champion and lock in before the battle begins.</p>

      <div className="char-select__meta">
        <span>Room</span>
        <span className="char-select__room">{roomId || "Unknown"}</span>
      </div>

      <div className="char-select__players">
        {allPlayers.map((id) => {
          const isYou = id === playerId;
          const sel = champSelections[id];
          const confirmed = isYou ? localChampReady : champReadyPeers.includes(id);
          return (
            <div
              key={id}
              className={[
                "char-select__player",
                isYou ? "char-select__player--you" : "",
                confirmed ? "char-select__player--locked" : ""
              ].join(" ").trim()}
            >
              <div className="char-select__player-dot" />
              <span>
                {isYou ? "You" : id}
                {confirmed
                  ? ` — locked ${CHAMPIONS[sel]?.name ?? sel}`
                  : sel
                  ? ` — ${CHAMPIONS[sel]?.name ?? sel}…`
                  : " — choosing…"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="char-select__lockin">
        {!localChampReady ? (
          <button
            type="button"
            className="btn-lockin"
            onClick={onComplete}
            disabled={!selectedChampion || lockedByOther.has(selectedChampion)}
          >
            Lock In
          </button>
        ) : allConfirmed ? (
          <p style={{ opacity: 0.8, margin: 0 }}>All players locked in — starting…</p>
        ) : (
          <p style={{ opacity: 0.5, margin: 0 }}>Waiting for other players…</p>
        )}
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
              onClick={() => !isDisabled && onSelectChampion(champion.key)}
            >
              <div className="champion-card__img-wrap">
                {CHAMPION_ICONS[champion.key] && (
                  <img
                    src={CHAMPION_ICONS[champion.key]}
                    alt={champion.name}
                    className="champion-card__icon"
                  />
                )}
              </div>

              <div className="champion-card__body">
                <div className="champion-card__name">{champion.name}</div>
                <div className="champion-card__desc">{champion.description}</div>

                <div className="champion-card__stats">
                  <div className="champion-card__stat">
                    <span className="champion-card__stat-label"><span>♥</span> HP</span>
                    <span className="champion-card__stat-val">{champion.stats.health}</span>
                  </div>
                  <div className="champion-card__stat">
                    <span className="champion-card__stat-label"><span>◆</span> Mana</span>
                    <span className="champion-card__stat-val">{champion.stats.mana}</span>
                  </div>
                  <div className="champion-card__stat">
                    <span className="champion-card__stat-label"><span>⚡</span> Speed</span>
                    <span className="champion-card__stat-val">{champion.stats.movementSpeed}</span>
                  </div>
                </div>

                <div className="champion-card__ult">
                  <strong>R — {champion.abilities.r.name}</strong>
                  <span>
                    {champion.abilities.r.undyingRage ? "5s invulnerability · heals at low HP" : ""}
                    {!champion.abilities.r.undyingRage && champion.abilities.r.damage > 0 ? `${champion.abilities.r.damage} dmg` : ""}
                    {champion.abilities.r.aoeRadius ? " · AoE" : ""}
                    {champion.abilities.r.trueDamage ? " · True dmg" : ""}
                    {champion.abilities.r.speedBoost ? ` · Speed ×${champion.abilities.r.speedBoost}` : ""}
                  </span>
                </div>

                {takenByOther ? (
                  <button type="button" disabled>Taken</button>
                ) : (
                  <button type="button" disabled={isDisabled}>
                    {isSelected ? "Selected" : "Select"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
