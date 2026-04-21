import { useState } from "react";

const ACCENT = "#a78bfa";
const DIVIDER = "1px solid rgba(255,255,255,0.07)";

export default function Lobby({ onCreateRoom, onJoinRoom, onStartTesting, statusLabel, connectedPeers, roomId }) {
  const [roomInput, setRoomInput] = useState("");
  const [selectedMode, setSelectedMode] = useState("1v1");
  const [activeTab, setActiveTab] = useState("controls");

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Title ── */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
        <h1 style={{
          margin: 0,
          fontSize: "2.6rem",
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: "linear-gradient(90deg, #a78bfa 0%, #60a5fa 60%, #a78bfa 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Nexus Duel
        </h1>
        <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
          Multiplayer arena battle — 5 minute rounds
        </p>
      </div>

      {/* ── Match setup ── */}
      <section className="panel">
        <Label>Mode</Label>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {[
            { key: "1v1",     label: "1v1",          sub: "2 players" },
            { key: "ffa",     label: "FFA",          sub: "4 players" },
            { key: "testing", label: "Testing",      sub: "solo" },
          ].map(({ key, label, sub }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedMode(key)}
              style={{
                background: selectedMode === key
                  ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${selectedMode === key ? "#7c3aed" : "rgba(255,255,255,0.1)"}`,
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "0.55rem 1.2rem", gap: "2px", minWidth: 90,
                boxShadow: selectedMode === key ? "0 0 16px rgba(124,58,237,0.4)" : "none",
              }}
            >
              <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: "0.7rem", opacity: 0.6, fontWeight: 400 }}>{sub}</span>
            </button>
          ))}
        </div>

        {selectedMode === "testing" ? (
          <button type="button" onClick={onStartTesting} style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
            Start Testing
          </button>
        ) : (
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => onCreateRoom(selectedMode)}>
              Create room
            </button>
            <input
              placeholder="Room ID"
              value={roomInput}
              onChange={e => setRoomInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && roomInput.trim() && onJoinRoom(roomInput.trim())}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "0.65rem 0.85rem", color: "#f9fafb", fontSize: "0.9rem",
                width: 120, outline: "none",
              }}
            />
            <button type="button" onClick={() => onJoinRoom(roomInput.trim())} disabled={!roomInput.trim()}>
              Join room
            </button>
          </div>
        )}

        {(roomId || (connectedPeers && connectedPeers.length > 0)) && (
          <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.82rem", color: "rgba(255,255,255,0.5)" }}>
            {roomId && (
              <span>Room <strong style={{ color: ACCENT, letterSpacing: "0.06em" }}>{roomId}</strong></span>
            )}
            {connectedPeers && connectedPeers.length > 0 && (
              <span>{connectedPeers.length} peer{connectedPeers.length !== 1 ? "s" : ""} connected</span>
            )}
          </div>
        )}

        <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.25)" }}>{statusLabel}</p>
      </section>

      {/* ── Info tabs ── */}
      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: DIVIDER }}>
          {[
            { key: "controls",   label: "Controls" },
            { key: "objectives", label: "Objectives" },
            { key: "modes",      label: "Game Modes" },
            { key: "scoring",    label: "Scoring" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1, background: "none", border: "none", borderRadius: 0,
                borderBottom: activeTab === key ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: activeTab === key ? ACCENT : "rgba(255,255,255,0.4)",
                padding: "0.7rem 0.5rem", fontSize: "0.8rem", fontWeight: activeTab === key ? 700 : 400,
                letterSpacing: "0.04em", cursor: "pointer", transition: "color 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: "1.25rem 1.5rem" }}>
          {activeTab === "controls" && <TabControls />}
          {activeTab === "objectives" && <TabObjectives />}
          {activeTab === "modes" && <TabModes />}
          {activeTab === "scoring" && <TabScoring />}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── Controls tab ── */
function TabControls() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <Row label="Movement" keys={["W", "A", "S", "D"]} desc="Move your champion in any direction." />
      <Row label="Attack" keys={["Space"]} desc="Attack the nearest valid target. Hold near a tower to hit it." />
      <Row label="Ultimate" keys={["R"]} desc="Fire your champion's ultimate ability when you have enough mana." />
      <div style={{ borderTop: DIVIDER, paddingTop: "1rem" }}>
        <SectionTitle>Targeting Modes</SectionTitle>
        <p style={descStyle}>Press 1–4 to change what Space auto-targets. The active mode is shown in your HUD.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.5rem", marginTop: "0.6rem" }}>
          <TargetRow k="1" label="Champions only" color="#f87171" />
          <TargetRow k="2" label="Towers only" color="#60a5fa" />
          <TargetRow k="3" label="Creeps only" color="#4ade80" />
          <TargetRow k="4" label="Closest target" color="#fbbf24" />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── Objectives tab ── */
function TabObjectives() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      <div>
        <SectionTitle>Towers</SectionTitle>
        <InfoList items={[
          "Each player has a tower at their spawn. It automatically attacks nearby enemies.",
          "A tower can only be attacked when the owner is dead — and you must be standing inside its attack radius.",
          "When a tower is destroyed, the owner gets one final respawn (Last Stand).",
          "If the owner dies during Last Stand they are permanently eliminated and the game ends instantly.",
          "A tower with its owner present deals +30% of the enemy's max HP as bonus damage.",
        ]} />
      </div>

      <div style={{ borderTop: DIVIDER, paddingTop: "1.1rem" }}>
        <SectionTitle>Gemstones</SectionTitle>
        <InfoList items={[
          "Two gemstones spawn on the map at all times.",
          "Walk over a gemstone to instantly restore 50% of your max HP and 50% of your max mana.",
          "After being picked up a gemstone respawns at a new random location after 30 seconds.",
        ]} />
      </div>

      <div style={{ borderTop: DIVIDER, paddingTop: "1.1rem" }}>
        <SectionTitle>Creeps & Monsters</SectionTitle>
        <InfoList items={[
          "Regular creeps spawn from the edges of the map and roam the arena. Worth 1 point each.",
          "Twitch monsters lurk in the corners — tougher, deal more damage, worth 2 points.",
          "Caster minions are spawned by towers every 20 seconds and march toward enemies. Worth 2 points.",
        ]} />
      </div>

      <div style={{ borderTop: DIVIDER, paddingTop: "1.1rem" }}>
        <SectionTitle>Respawning</SectionTitle>
        <InfoList items={[
          "When you die you respawn at your tower spawn after 8 seconds.",
          "If your tower is already destroyed your next death is permanent — no more respawns.",
        ]} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── Game Modes tab ── */
function TabModes() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      <ModeBlock
        name="1v1 — Duel"
        players="2 players"
        color="#a78bfa"
        rules={[
          "One player creates a room, the other joins using the room ID.",
          "First destroy your opponent's tower, then kill them during their Last Stand.",
          "The last standing player wins instantly regardless of score.",
          "If the 5-minute timer expires, the player with the highest score wins.",
        ]}
      />

      <div style={{ borderTop: DIVIDER, paddingTop: "1.1rem" }}>
        <ModeBlock
          name="FFA — Free For All"
          players="4 players"
          color="#fbbf24"
          rules={[
            "4 players share one arena — everyone fights everyone.",
            "Be the last player not permanently eliminated to win.",
            "If the 5-minute timer expires, the player with the highest score wins.",
          ]}
        />
      </div>

      <div style={{ borderTop: DIVIDER, paddingTop: "1.1rem" }}>
        <ModeBlock
          name="Testing — Solo"
          players="1 player"
          color="#4ade80"
          rules={[
            "Jump into a solo session to practice abilities and learn the map.",
            "An unkillable Berserker dummy stands at the center of the map.",
            "No timer, no game over — play as long as you like.",
          ]}
        />
      </div>

    </div>
  );
}

/* ────────────────────────────────────────────────────── Scoring tab ── */
function TabScoring() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <SectionTitle>Points per kill</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <ScoreRow pts={1} label="Regular creep" color="#94a3b8" />
        <ScoreRow pts={2} label="Twitch monster" color="#fb923c" />
        <ScoreRow pts={2} label="Caster minion" color="#fb923c" />
        <ScoreRow pts={3} label="Enemy champion" color="#f87171" />
      </div>

      <div style={{ borderTop: DIVIDER, paddingTop: "1rem" }}>
        <SectionTitle>How winners are decided</SectionTitle>
        <InfoList items={[
          "Perma-elimination: the last surviving player wins outright — score is irrelevant.",
          "5-minute timer: highest score wins. Tied scores result in a draw.",
          "Your tower earns kill points automatically when it destroys creeps or minions.",
        ]} />
      </div>

      <div style={{ borderTop: DIVIDER, paddingTop: "1rem" }}>
        <SectionTitle>Score tips</SectionTitle>
        <InfoList items={[
          "Killing the enemy champion (+3 pts) is the biggest score swing in the game.",
          "Farming Twitch monsters in the corners is efficient — they respawn as a group.",
          "Caster minions keep marching even after their tower dies, so they are free points.",
        ]} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────── Small shared components ── */

function Label({ children }) {
  return (
    <p style={{ margin: "0 0 0.55rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
      {children}
    </p>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{ margin: "0 0 0.55rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: ACCENT, fontWeight: 700 }}>
      {children}
    </p>
  );
}

const descStyle = { margin: 0, fontSize: "0.83rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.55 };

function InfoList({ items }) {
  return (
    <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      {items.map((text, i) => (
        <li key={i} style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>{text}</li>
      ))}
    </ul>
  );
}

function Row({ label, keys, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0, paddingTop: "1px" }}>
        {keys.map(k => (
          <kbd key={k} style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 5, padding: "0.15rem 0.45rem", fontSize: "0.75rem", fontFamily: "inherit",
            color: "#e2e8f0", fontWeight: 700, whiteSpace: "nowrap",
          }}>{k}</kbd>
        ))}
      </div>
      <div>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f1f5f9" }}>{label} </span>
        <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)" }}>{desc}</span>
      </div>
    </div>
  );
}

function TargetRow({ k, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <kbd style={{
        background: "rgba(255,255,255,0.07)", border: `1px solid ${color}55`,
        borderRadius: 5, padding: "0.15rem 0.45rem", fontSize: "0.75rem", fontFamily: "inherit",
        color, fontWeight: 700, minWidth: 20, textAlign: "center",
      }}>{k}</kbd>
      <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.55)" }}>{label}</span>
    </div>
  );
}

function ModeBlock({ name, players, color, rules }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.6rem" }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 700, color }}>{name}</span>
        <span style={{
          fontSize: "0.68rem", color, border: `1px solid ${color}44`,
          background: `${color}11`, borderRadius: 5, padding: "0.1rem 0.45rem",
          fontWeight: 600, letterSpacing: "0.04em",
        }}>{players}</span>
      </div>
      <InfoList items={rules} />
    </div>
  );
}

function ScoreRow({ pts, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 36, height: 24, borderRadius: 5,
        background: "rgba(255,255,255,0.05)", border: `1px solid ${color}55`,
        color, fontSize: "0.8rem", fontWeight: 800, flexShrink: 0,
      }}>+{pts}</span>
      <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{label}</span>
    </div>
  );
}
