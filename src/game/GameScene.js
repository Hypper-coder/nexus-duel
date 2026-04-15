import Phaser from "phaser";
import Player from "./Player";
import { ARENA_SIZE, GAME_STATES, CHAMPIONS, PLAYER_SLOTS } from "../utils/constants";
import { buildChampionState } from "./Champion";
import bersImg from "../assets/bers.png";
import bersAttackImg from "../assets/bers attack.png";
import fateCasterImg from "../assets/fate caster.png";
import fateCasterAttackImg from "../assets/fate caster attack.png";
import fateArcherImg from "../assets/fate archer.png";
import fateArcherAttackImg from "../assets/fate archer attack.png";
import saberImg from "../assets/saber.png";
import saberAttackImg from "../assets/saber attack.png";
import ridderImg from "../assets/fate rider.png";
import ridderAttackImg from "../assets/fate rider attack.png";
import assassinImg from "../assets/fate assasin.png";
import assassinAttackImg from "../assets/fate assasin attack.png";
import lancerImg from "../assets/fate lancer.png";
import goblinImg from "../assets/goblin.png";
import grailImg from "../assets/grail.png";
import grailAttackImg from "../assets/grail attack.png";
import rockImg from "../assets/rock.png";
import gemstoneImg from "../assets/gemstone.png";
import mapaImg from "../assets/map.png";
import twitchImg from "../assets/twitch.png";
import casterMiniImg from "../assets/caster mini.png";
import Creep from "./Creep";
import Tower from "./Tower";
import Rock from "./Rock";
import Gemstone from "./Gemstone";
import Twitch from "./Twitch";
import CasterMinion from "./CasterMinion";

const MOVE_SPEED = 250;

export default class GameScene extends Phaser.Scene {
  constructor(options = {}) {
    super({ key: "GameScene" });
    this.options = options;
    this.remoteSubscription = null;
    this.messageCleanup = null;
    this.bars = [];
  }

  init() {
    this.playerId = this.options.playerId ?? "peer_local";
    this.championKey = this.options.championKey ?? "warrior";
    this.roomId = this.options.roomId || "ROOM_UNKNOWN";
    this.gameSync = this.options.gameSync;
    this.localTint = this.options.localTint ?? 0x7c3aed;
    this.remoteTint = this.options.remoteTint ?? 0x0ea5e9;
    this.localSpawn = this.options.localSpawn ?? ARENA_SIZE.playerOneSpawn;
    this.remoteSpawn = this.options.remoteSpawn ?? ARENA_SIZE.playerTwoSpawn;
    this.isHost = this.options.isHost ?? false;
    this.gameMode = this.options.gameMode ?? "1v1";
    this.mySlot = this.options.mySlot ?? 0;
    // opponentSlots: [{ id, slot }] — one entry for 1v1, three for FFA
    this.opponentSlots = this.options.opponentSlots ?? [{ id: "peer_remote", slot: this.mySlot === 0 ? 1 : 0 }];
    this.gameOverFired = false;
    this.respawnScheduled = false;
    this.lastStandUsed = false;
    this.localKills = 0;
    // For FFA: track kills per opponent id
    this.lastOpponentKillsMap = {};
    this.opponentSlots.forEach(({ id }) => { this.lastOpponentKillsMap[id] = 0; });
  }

  preload() {
    this.load.image("warrior", bersImg);
    this.load.image("warrior attack", bersAttackImg);
    this.load.image("mage", fateCasterImg);
    this.load.image("mage attack", fateCasterAttackImg);
    this.load.image("archer", fateArcherImg);
    this.load.image("archer attack", fateArcherAttackImg);
    this.load.image("saber", saberImg);
    this.load.image("goblin", goblinImg);
    this.load.image("mapa", mapaImg);
    this.load.image("rock", rockImg);
    this.load.image("gemstone", gemstoneImg);
    this.load.image("twitch", twitchImg);
    this.load.image("caster mini", casterMiniImg);
    this.load.image("saber attack", saberAttackImg);
    this.load.image("ridder", ridderImg);
    this.load.image("ridder attack", ridderAttackImg);
    this.load.image("assassin", assassinImg);
    this.load.image("assassin attack", assassinAttackImg);
    this.load.image("lancer", lancerImg);
    this.load.image("grail", grailImg);
    this.load.image("grail attack", grailAttackImg);
  }

  create() {
    this.add.image(ARENA_SIZE.width / 2, ARENA_SIZE.height / 2, "mapa")
      .setDisplaySize(ARENA_SIZE.width, ARENA_SIZE.height)
      .setDepth(0);

    const championDef = CHAMPIONS[this.championKey] ?? CHAMPIONS.warrior;

    const playerState = buildChampionState(
      championDef.key,
      this.playerId,
      this.localSpawn
    );

    this.player = new Player(this, {
      ...playerState,
      tint: this.localTint
    });

    // Build opponent players — one per opponentSlot
    this.opponents = this.opponentSlots.map(({ id, slot, championKey }) => {
      const slotDef = PLAYER_SLOTS[slot] ?? PLAYER_SLOTS[1];
      const state = buildChampionState(championKey ?? "warrior", id, slotDef.spawn);
      return new Player(this, { ...state, tint: slotDef.tint });
    });
    // Convenience alias for 1v1 code paths
    this.opponent = this.opponents[0];

    this.statusText = this.add
      .text(16, 16, `Room ${this.roomId} | Champion ${championDef.name}`)
      .setDepth(10);

    this.cursors = this.input.keyboard.addKeys("W,S,A,D");
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.ultimateKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    if (this.gameSync) {
      this.remoteSubscription = this.gameSync.onRemoteState((payload) => this.applyRemoteState(payload));
      this.messageCleanup = this.gameSync.onMessage((payload) => this.handleNetworkMessage(payload));

      this.gameSync.start(() => {
        const payload = {
          roomId: this.roomId,
          state: { ...this.player.getState(), kills: this.localKills, lastStandUsed: this.lastStandUsed },
          status: GAME_STATES.playing
        };
        if (this.isHost) {
          payload.world = this.getWorldState();
        }
        return payload;
      });
    }

    this.playerBars = this.createBars(this.player, PLAYER_SLOTS[this.mySlot].tint, 0x60a5fa);
    this.playerBars.healthBar.setVisible(false);
    this.playerBars.manaBar.setVisible(false);
    this.opponentBarsList = this.opponents.map((opp, i) => {
      const slotDef = PLAYER_SLOTS[this.opponentSlots[i].slot] ?? PLAYER_SLOTS[1];
      return this.createBars(opp, slotDef.tint, 0x3b82f6);
    });
    // Alias for 1v1 code paths
    this.opponentBars = this.opponentBarsList[0];

    this.rocks = this.placeRocks();
    const spawnGemstone = () => new Gemstone(this, () => this.getRandomGemPosition());
    this.gemstones = [spawnGemstone(), spawnGemstone()];
    this.creeps = [];
    this.twitches = this.spawnTwitches();
    this.casterMinions = [];

    if (this.isHost) {
      this._startTwitchGroupRespawnWatcher();
      this.time.addEvent({
        delay: 20000,
        loop: true,
        callback: () => {
          // Local tower sends 1 minion toward one opponent (prefer alive, fallback to any)
          const target = this.opponents.find(o => o.data.isAlive) ?? this.opponents[0];
          if (target) {
            const localTowerPos = PLAYER_SLOTS[this.mySlot].towerPos;
            this.casterMinions.push(new CasterMinion(this, localTowerPos.x, localTowerPos.y, target, PLAYER_SLOTS[this.mySlot].tint, `slot${this.mySlot}`));
          }
          // Each opponent tower sends a minion toward local player
          this.opponentSlots.forEach(({ slot }) => {
            const slotDef = PLAYER_SLOTS[slot] ?? PLAYER_SLOTS[1];
            this.casterMinions.push(new CasterMinion(this, slotDef.towerPos.x, slotDef.towerPos.y, this.player, slotDef.tint, `slot${slot}`));
          });
        }
      });
    }

    // Build towers — one per player slot
    const allSlots = [this.mySlot, ...this.opponentSlots.map(o => o.slot)];
    this.towersBySlot = {};
    allSlots.forEach((s) => {
      const def = PLAYER_SLOTS[s];
      if (!def || this.towersBySlot[s]) return;
      this.towersBySlot[s] = new Tower(this, def.towerPos.x, def.towerPos.y, def.tint);
    });
    this.localTower = this.towersBySlot[this.mySlot];
    this.remoteTower = this.towersBySlot[this.opponentSlots[0]?.slot] ?? this.localTower;

    this.createPlayerHUD();
  }

  createPlayerHUD() {
    const cx = ARENA_SIZE.width / 2;
    const panelY = ARENA_SIZE.height - 28; // panel center, 28px from bottom
    const d = 30;
    const barMaxW = 185;
    const barH = 12;
    const boxSize = 42;

    // Dark background panel
    this.add.rectangle(cx, panelY, 530, 50, 0x000000, 0.82).setOrigin(0.5).setDepth(d);

    // ── HP bar ──────────────────────────────────────────────────────────
    const barLeft = cx - 230;
    const hpY = panelY - 9;
    const mpY = panelY + 9;

    this.add.text(barLeft - 4, hpY, 'HP', { fontSize: '8px', color: '#86efac' })
      .setOrigin(1, 0.5).setDepth(d + 1);
    this.add.rectangle(barLeft + barMaxW / 2, hpY, barMaxW, barH, 0x1e293b)
      .setOrigin(0.5).setDepth(d + 1);
    this.hudHpFill = this.add.rectangle(barLeft, hpY, barMaxW, barH, 0x22c55e)
      .setOrigin(0, 0.5).setDepth(d + 2);
    this.hudHpText = this.add.text(barLeft + barMaxW / 2, hpY, '', { fontSize: '9px', color: '#fff' })
      .setOrigin(0.5).setDepth(d + 3);

    // ── MP bar ──────────────────────────────────────────────────────────
    this.add.text(barLeft - 4, mpY, 'MP', { fontSize: '8px', color: '#93c5fd' })
      .setOrigin(1, 0.5).setDepth(d + 1);
    this.add.rectangle(barLeft + barMaxW / 2, mpY, barMaxW, barH, 0x1e293b)
      .setOrigin(0.5).setDepth(d + 1);
    this.hudMpFill = this.add.rectangle(barLeft, mpY, barMaxW, barH, 0x3b82f6)
      .setOrigin(0, 0.5).setDepth(d + 2);
    this.hudMpText = this.add.text(barLeft + barMaxW / 2, mpY, '', { fontSize: '9px', color: '#fff' })
      .setOrigin(0.5).setDepth(d + 3);

    // ── Divider ─────────────────────────────────────────────────────────
    const divX = cx + 14;
    this.add.rectangle(divX, panelY, 1, 38, 0xffffff, 0.12).setDepth(d + 1);

    // ── ATK box (Space) ─────────────────────────────────────────────────
    const qCx = divX + 14 + boxSize / 2;
    this.add.rectangle(qCx, panelY, boxSize, boxSize, 0x334155).setOrigin(0.5).setDepth(d + 1);
    // thin border
    const qBorder = this.add.graphics().setDepth(d + 1);
    qBorder.lineStyle(1, 0x64748b, 0.6);
    qBorder.strokeRect(qCx - boxSize / 2, panelY - boxSize / 2, boxSize, boxSize);
    // cooldown overlay — starts at top of box, origin (0,0)
    this.hudQOverlay = this.add.rectangle(qCx - boxSize / 2, panelY - boxSize / 2, boxSize, 0, 0x000000, 0.78)
      .setOrigin(0, 0).setDepth(d + 2);
    // small key hint top-left
    this.add.text(qCx - boxSize / 2 + 3, panelY - boxSize / 2 + 3, 'SPC', { fontSize: '7px', color: '#94a3b8' })
      .setOrigin(0, 0).setDepth(d + 4);
    // label shown when ready
    this.hudQReadyLabel = this.add.text(qCx, panelY + 5, 'ATK', { fontSize: '10px', color: '#e2e8f0', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(d + 4);
    // timer shown when on cooldown
    this.hudQTimer = this.add.text(qCx, panelY + 4, '', { fontSize: '12px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(d + 4);

    // ── ULT box (R) ─────────────────────────────────────────────────────
    const rCx = qCx + boxSize + 8;
    this.add.rectangle(rCx, panelY, boxSize, boxSize, 0x3d1f0d).setOrigin(0.5).setDepth(d + 1);
    const rBorder = this.add.graphics().setDepth(d + 1);
    rBorder.lineStyle(1, 0xc2410c, 0.6);
    rBorder.strokeRect(rCx - boxSize / 2, panelY - boxSize / 2, boxSize, boxSize);
    this.hudROverlay = this.add.rectangle(rCx - boxSize / 2, panelY - boxSize / 2, boxSize, 0, 0x000000, 0.78)
      .setOrigin(0, 0).setDepth(d + 2);
    this.add.text(rCx - boxSize / 2 + 3, panelY - boxSize / 2 + 3, 'R', { fontSize: '7px', color: '#fb923c' })
      .setOrigin(0, 0).setDepth(d + 4);
    this.hudRReadyLabel = this.add.text(rCx, panelY + 5, 'ULT', { fontSize: '10px', color: '#ff8c3a', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(d + 4);
    this.hudRTimer = this.add.text(rCx, panelY + 4, '', { fontSize: '12px', color: '#ff8c3a', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(d + 4);
  }

  updatePlayerHUD() {
    const { stats, abilities } = this.player.data;
    const barMaxW = 185;
    const boxSize = 42;

    // HP
    const hpRatio = Math.max(0, Math.min(1, stats.health / stats.maxHealth));
    this.hudHpFill.displayWidth = barMaxW * hpRatio;
    this.hudHpText.setText(`${Math.ceil(stats.health)} / ${stats.maxHealth}`);

    // MP
    const mpRatio = Math.max(0, Math.min(1, stats.mana / stats.maxMana));
    this.hudMpFill.displayWidth = barMaxW * mpRatio;
    this.hudMpText.setText(`${Math.floor(stats.mana)} / ${stats.maxMana}`);

    // ATK (Q/Space) cooldown
    const qCd = abilities.q?.cooldownRemaining ?? 0;
    const qOnCd = qCd > 0.05;
    this.hudQOverlay.displayHeight = boxSize * Math.min(1, qCd / (abilities.q?.cooldown ?? 1));
    this.hudQReadyLabel.setVisible(!qOnCd);
    this.hudQTimer.setText(qOnCd ? qCd.toFixed(1) : '');

    // ULT (R) cooldown — also dim if not enough mana
    const rCd = abilities.r?.cooldownRemaining ?? 0;
    const rOnCd = rCd > 0.05;
    const rNoMana = !rOnCd && stats.mana < (abilities.r?.manaCost ?? 0);
    this.hudROverlay.displayHeight = boxSize * Math.min(1, rCd / (abilities.r?.cooldown ?? 1));
    this.hudRReadyLabel.setVisible(!rOnCd);
    this.hudRReadyLabel.setAlpha(rNoMana ? 0.4 : 1);
    this.hudRTimer.setText(rOnCd ? rCd.toFixed(1) : '');
  }

  placeRocks() {
    const COUNT = 8;
    const MIN_DIST = 130;
    const MARGIN = 90;
    const { width, height } = ARENA_SIZE;

    const spawns = PLAYER_SLOTS.map(s => s.spawn);
    const tooClose = (x, y, list, minD) =>
      list.some(p => Math.hypot(p.x - x, p.y - y) < minD);

    const placed = [];
    let attempts = 0;
    while (placed.length < COUNT && attempts < 1000) {
      attempts++;
      const x = MARGIN + Math.random() * (width  - MARGIN * 2);
      const y = MARGIN + Math.random() * (height - MARGIN * 2);
      if (this._inTowerRange(x, y)) continue;
      if (tooClose(x, y, spawns,  140)) continue;
      if (tooClose(x, y, placed,  MIN_DIST)) continue;
      placed.push({ x, y });
    }

    return placed.map(({ x, y }) => new Rock(this, x, y));
  }

  _towerZones() {
    return PLAYER_SLOTS.map(s => s.towerPos);
  }

  _inTowerRange(x, y, clearance = 220) {
    return this._towerZones().some(t => Math.hypot(t.x - x, t.y - y) < clearance);
  }

  _safeRandom(minX, maxX, minY, maxY, clearance = 220) {
    for (let i = 0; i < 200; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (!this._inTowerRange(x, y, clearance)) return { x, y };
    }
    // Fallback to center if all attempts fail
    return { x: ARENA_SIZE.width / 2, y: ARENA_SIZE.height / 2 };
  }

  spawnTwitches() {
    const corners = [
      { x: 230, y: 120 },  // top-left circle
      { x: 970, y: 120 },  // top-right circle
      { x: 230, y: 660 },  // bottom-left circle
      { x: 970, y: 660 },  // bottom-right circle
    ];
    const escortOffsets = [
      { dx: -45, dy: 30 },
      { dx:  45, dy: 30 },
      { dx:   0, dy: -45 },
    ];

    this.twitchGroups = corners.map(({ x, y }) => {
      const twitch = new Twitch(this, x, y);
      const escorts = escortOffsets.map(({ dx, dy }) => new Creep(this, x + dx, y + dy));
      escorts.forEach(c => this.creeps.push(c));
      const group = { x, y, twitch, escorts, respawning: false };
      const aggroAll = () => {
        twitch.aggroed = true;
        escorts.forEach(c => { c.aggroed = true; });
      };
      twitch.onAggro = aggroAll;
      escorts.forEach(c => { c.onAggro = aggroAll; });
      return group;
    });

    return this.twitchGroups.map(g => g.twitch);
  }

  _rebuildTwitchGroup(groupIndex) {
    const group = this.twitchGroups?.[groupIndex];
    if (!group) return;
    const { x, y } = group;
    const escortOffsets = [
      { dx: -45, dy: 30 },
      { dx:  45, dy: 30 },
      { dx:   0, dy: -45 },
    ];

    const newTwitch = new Twitch(this, x, y);
    const twitchIdx = this.twitches.indexOf(group.twitch);
    if (twitchIdx !== -1) this.twitches[twitchIdx] = newTwitch;
    group.twitch = newTwitch;

    const oldEscorts = [...group.escorts];
    const newEscorts = escortOffsets.map(({ dx, dy }, i) => {
      const c = new Creep(this, x + dx, y + dy);
      const oldIdx = this.creeps.indexOf(oldEscorts[i]);
      if (oldIdx !== -1) this.creeps[oldIdx] = c;
      else this.creeps.push(c);
      return c;
    });
    group.escorts = newEscorts;

    const aggroAll = () => {
      newTwitch.aggroed = true;
      newEscorts.forEach(c => { c.aggroed = true; });
    };
    newTwitch.onAggro = aggroAll;
    newEscorts.forEach(c => { c.onAggro = aggroAll; });
  }

  _startTwitchGroupRespawnWatcher() {
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.twitchGroups) return;
        for (const group of this.twitchGroups) {
          if (group.respawning) continue;
          const allDead = !group.twitch.isAlive && group.escorts.every(c => !c.isAlive);
          if (allDead) {
            group.respawning = true;
            this.time.delayedCall(20000, () => {
              const { x, y } = group;
              const escortOffsets = [
                { dx: -45, dy: 30 },
                { dx:  45, dy: 30 },
                { dx:   0, dy: -45 },
              ];
              // Replace twitch
              const newTwitch = new Twitch(this, x, y);
              const twitchIdx = this.twitches.indexOf(group.twitch);
              if (twitchIdx !== -1) this.twitches[twitchIdx] = newTwitch;
              group.twitch = newTwitch;

              // Replace escorts
              const newEscorts = escortOffsets.map(({ dx, dy }) => {
                const c = new Creep(this, x + dx, y + dy);
                const oldIdx = this.creeps.indexOf(group.escorts.shift());
                if (oldIdx !== -1) this.creeps[oldIdx] = c;
                else this.creeps.push(c);
                return c;
              });
              group.escorts = newEscorts;
              const aggroAll = () => {
                newTwitch.aggroed = true;
                newEscorts.forEach(c => { c.aggroed = true; });
              };
              newTwitch.onAggro = aggroAll;
              newEscorts.forEach(c => { c.onAggro = aggroAll; });
              group.respawning = false;

              // Notify guests to rebuild this group
              const groupIndex = this.twitchGroups.indexOf(group);
              if (this.gameSync && groupIndex !== -1) {
                this.gameSync.send({ type: "twitch-group-respawn", groupIndex, roomId: this.roomId });
              }
            });
          }
        }
      }
    });
  }

  spawnCreeps(count) {
    const creeps = [];
    const p = ARENA_SIZE.padding;
    const W = ARENA_SIZE.width;
    const H = ARENA_SIZE.height;

    for (let i = 0; i < count; i++) {
      let x, y, safe = false;
      for (let attempt = 0; attempt < 200; attempt++) {
        const edge = Phaser.Math.Between(0, 3);
        if (edge === 0) { x = Phaser.Math.Between(p, W - p); y = p; }
        else if (edge === 1) { x = Phaser.Math.Between(p, W - p); y = H - p; }
        else if (edge === 2) { x = p; y = Phaser.Math.Between(p, H - p); }
        else { x = W - p; y = Phaser.Math.Between(p, H - p); }
        if (!this._inTowerRange(x, y)) { safe = true; break; }
      }
      if (!safe) { x = W / 2; y = H / 2; }
      creeps.push(new Creep(this, x, y));
    }
    return creeps;
  }

  getRandomGemPosition() {
    const margin = ARENA_SIZE.padding + 80;
    for (let i = 0; i < 200; i++) {
      const x = margin + Math.random() * (ARENA_SIZE.width - margin * 2);
      const y = margin + Math.random() * (ARENA_SIZE.height - margin * 2);
      if (this._inTowerRange(x, y)) continue;
      if (this.rocks?.some(r => Math.hypot(r.x - x, r.y - y) < 90)) continue;
      return { x, y };
    }
    return { x: ARENA_SIZE.width / 2, y: ARENA_SIZE.height / 2 };
  }

  update(_time, delta) {
    const velocity = this.calculateVelocity();
    this.player.move(velocity, delta / 1000, this.rocks);
    this.updatePlayerHUD();
    this.updateBars(this.player, this.playerBars);
    this.opponents.forEach((opp, i) => this.updateBars(opp, this.opponentBarsList[i]));
    this.player.tickAbilities(delta / 1000);
    if (this.isHost) {
      const allPlayers = [this.player, ...this.opponents];
      this.gemstones.forEach((gem) => {
        if (gem.checkPickup(this.player)) {
          const s = this.player.data.stats;
          s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.5);
          s.mana = Math.min(s.maxMana, s.mana + s.maxMana * 0.5);
          return;
        }
        for (const opp of this.opponents) {
          if (gem.checkPickup(opp) && this.gameSync) {
            this.gameSync.send({ type: "gem-heal", targetId: opp.data.id, roomId: this.roomId });
            break;
          }
        }
      });
      // Snapshot HP before AI updates so we can send hit messages for any guest that takes damage
      const hpBeforeAI = allPlayers.map(p => p.data.stats.health);
      this.creeps.forEach((creep) => creep.update(delta, allPlayers));
      this.twitches.forEach((t) => t.update(delta, allPlayers));
      this.casterMinions.forEach((m) => m.update(delta));
      // Send hit messages to any remote player that was damaged by AI this tick
      if (this.gameSync) {
        allPlayers.forEach((p, i) => {
          const dmg = hpBeforeAI[i] - p.data.stats.health;
          if (dmg > 0 && p !== this.player && p.data.id !== "peer_remote") {
            this.gameSync.send({ type: "hit", attackerId: "creep", targetId: p.data.id, damage: dmg, abilityKey: "q", roomId: this.roomId, timestamp: Date.now() });
          }
        });
      }

      // Tick all towers; local tower attacks opponents, opponent towers attack local player
      Object.entries(this.towersBySlot).forEach(([slotStr, tower]) => {
        const slot = Number(slotStr);
        let fired;
        let towerResult;
        const allies = this._playersForSlot(slot);
        // Build enemy list: all players except this tower's owner
        const ownerPlayers = this._playersForSlot(slot);
        const allPlayers = [this.player, ...this.opponents];
        const enemyPlayers = this.gameMode === "ffa"
          ? allPlayers.filter(p => !ownerPlayers.includes(p))
          : (slot === this.mySlot ? this.opponents : [this.player]);

        const hpBefore = allPlayers.map(p => p.data.stats.health);
        const enemyMinions = this.casterMinions.filter(m => m.owner !== `slot${slot}`);
        const creepTargets = [...this.creeps, ...enemyMinions];
        towerResult = tower.update(delta, creepTargets, enemyPlayers, allies);
        fired = towerResult?.fired ?? false;
        if (fired && this.gameSync) {
          this.gameSync.send({ type: "tower-attack", tower: `slot${slot}`, roomId: this.roomId });
        }
        // Send hit messages for any remote player damaged by this tower
        allPlayers.forEach((p, i) => {
          const dmg = hpBefore[i] - p.data.stats.health;
          if (dmg > 0 && p !== this.player && this.gameSync && p.data.id !== "peer_remote") {
            this.gameSync.send({ type: "hit", attackerId: "tower", attackerSlot: slot, targetId: p.data.id, damage: dmg, abilityKey: "tower", roomId: this.roomId, timestamp: Date.now() });
          }
        });
        if (this.isHost && towerResult?.killed) {
          this._handleTowerKill(slot, towerResult.targetType);
          if (this.gameSync) {
            this.gameSync.send({ type: "tower-kill", slot, targetType: towerResult.targetType, roomId: this.roomId });
          }
        }
      });
    }

    // Hide sprite and schedule respawn when local player just died
    if (!this.player.data.isAlive && !this.respawnScheduled) {
      this.respawnScheduled = true;
      this.player.sprite.setVisible(false);
      this.time.delayedCall(8000, () => this._tryRespawn());
    }

    this.checkGameOver();

    if (Phaser.Input.Keyboard.JustDown(this.ultimateKey)) {
      this._tryFireUltimate();
    }

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      const creepTarget = this.nearestCreepInRange("q");
      if (creepTarget) {
        const result = this.player.attackCreep(creepTarget, "q");
        if (result) {
          this.playAttackEffect({ sprite: creepTarget.sprite }, result.abilityKey);
          const creepType = this.twitches.includes(creepTarget) ? "twitch"
            : this.casterMinions.includes(creepTarget) ? "caster"
            : "creep";
          const idx = creepType === "twitch" ? this.twitches.indexOf(creepTarget)
            : creepType === "caster" ? this.casterMinions.indexOf(creepTarget)
            : this.creeps.indexOf(creepTarget);
          if (result.ability?.aoeRadius) {
            this._applyChampionAoE(creepTarget, result.ability, this.mySlot);
          }
          if (this.isHost && creepType === "caster" && this.gameSync) {
            // Host attacked a caster minion — broadcast authoritative health immediately
            const m = this.casterMinions[idx];
            if (m) this.gameSync.send({ type: "minion-hit", index: idx, health: m.health, isAlive: m.isAlive, roomId: this.roomId });
          } else if (!this.isHost && this.gameSync) {
            this.gameSync.send({
              type: "creep-hit",
              creepType,
              index: idx,
              damage: result.damage,
              abilityKey: result.abilityKey,
              aoeRadius: result.ability?.aoeRadius ?? 0,
              attackerSlot: this.mySlot,
              roomId: this.roomId
            });
          }
          if (!creepTarget.isAlive) {
            const isElite = this.twitches.includes(creepTarget) || this.casterMinions.includes(creepTarget);
            const pts = isElite ? 2 : 1;
            this.localKills += pts;
            if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: pts, opponent: 0 });
          }
        }
      } else {
        // Attack nearest living opponent or attackable tower — whichever is closer
        const nearestOpp = this._nearestLivingOpponent();
        const towerTarget = this._nearestAttackableTower();

        const oppDist = nearestOpp ? this.player.distanceTo(nearestOpp) : Infinity;
        const towerDist = towerTarget ? Math.hypot(towerTarget.tower.x - this.player.sprite.x, towerTarget.tower.y - this.player.sprite.y) : Infinity;

        if (towerTarget && towerDist <= oppDist) {
          this._attackTower(towerTarget.tower, towerTarget.slot);
        } else if (nearestOpp) {
          const attackResult = this.player.attack(nearestOpp, "q");
          if (attackResult && this.gameSync) {
            this.playAttackEffect(nearestOpp, attackResult.abilityKey);
            this.gameSync.send({
              type: "hit",
              attackerId: this.playerId,
              ...attackResult,
              roomId: this.roomId,
              timestamp: Date.now()
            });
            if (!nearestOpp.data.isAlive) {
              this.localKills += 3;
              if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
            }
            this.statusText.setText(`Room ${this.roomId} | Hit ${nearestOpp.data.id} for ${attackResult.damage}`);
            const oppIdx = this.opponents.indexOf(nearestOpp);
            if (oppIdx >= 0) this.updateBars(nearestOpp, this.opponentBarsList[oppIdx]);
          }
        }
      }
    }
  }

  _nearestLivingOpponent() {
    let nearest = null;
    let nearestDist = Infinity;
    for (const opp of this.opponents) {
      if (!opp.data.isAlive) continue;
      const dist = this.player.distanceTo(opp);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = opp;
      }
    }
    return nearest;
  }

  _isTowerOwnerDead(slot) {
    if (slot === this.mySlot) return !this.player.data.isAlive;
    const entry = this.opponentSlots.find(e => e.slot === slot);
    if (!entry) return false;
    const opp = this.opponents.find(o => o.data.id === entry.id);
    return opp ? !opp.data.isAlive : false;
  }

  _tryRespawn() {
    if (this.gameOverFired) return;
    const myTower = this.towersBySlot[this.mySlot];
    if (!myTower?.isAlive) {
      if (this.lastStandUsed) return; // already had last stand — permanent death
      this.lastStandUsed = true;     // grant one final respawn after tower falls
    }
    const spawnPos = PLAYER_SLOTS[this.mySlot].spawn;
    this.player.sprite.setPosition(spawnPos.x, spawnPos.y);
    this.player.data.position.x = spawnPos.x;
    this.player.data.position.y = spawnPos.y;
    this.player.data.isAlive = true;
    this.player.data.stats.health = this.player.data.stats.maxHealth;
    this.player.data.stats.mana = this.player.data.stats.maxMana;
    this.player.sprite.setVisible(true);
    this.respawnScheduled = false;
  }

  _nearestAttackableTower() {
    const range = this.player.data.abilities["q"]?.range ?? 80;
    let nearest = null;
    let nearestDist = range;
    for (const [slotStr, tower] of Object.entries(this.towersBySlot)) {
      const slot = Number(slotStr);
      if (slot === this.mySlot) continue;
      if (!tower.isAlive) continue;
      // In 1v1 towers are only attackable when the owner is dead; FFA towers are always attackable
      if (this.gameMode !== "ffa" && !this._isTowerOwnerDead(slot)) continue;
      const dx = tower.x - this.player.sprite.x;
      const dy = tower.y - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { tower, slot };
      }
    }
    return nearest;
  }

  _playersForSlot(slot) {
    if (slot === this.mySlot) return [this.player];
    const entryIndex = this.opponentSlots.findIndex(entry => entry.slot === slot);
    if (entryIndex >= 0) {
      const opponent = this.opponents[entryIndex];
      if (opponent) return [opponent];
    }
    return [];
  }

  _attackTower(tower, slot) {
    const ability = this.player.data.abilities["q"];
    if (!ability || !this.player.canUseAbility("q")) return;
    this.player.useAbility("q");
    const damage = ability.damage ?? 30;
    this.player._flashAttackSprite();
    this.playAttackEffect({ sprite: tower.sprite }, "q");
    if (this.isHost) {
      tower.takeDamage(damage);
      if (this.gameSync) {
        this.gameSync.send({ type: "tower-attack", tower: `slot${slot}`, roomId: this.roomId });
      }
    } else if (this.gameSync) {
      this.gameSync.send({ type: "tower-hit", slot, damage, roomId: this.roomId });
    }
  }

  _handleTowerKill(slot, targetType) {
    const points = this._towerKillPoints(targetType);
    if (points <= 0) return;
    if (slot === this.mySlot) {
      this.localKills += points;
      if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: points, opponent: 0 });
      return;
    }
    const owner = this.opponentSlots.find((entry) => entry.slot === slot);
    if (!owner) return;
    this.lastOpponentKillsMap[owner.id] = (this.lastOpponentKillsMap[owner.id] ?? 0) + points;
    if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 0, opponent: points, opponentId: owner.id });
  }

  _towerKillPoints(targetType) {
    if (!targetType) return 0;
    if (targetType === "twitch" || targetType === "caster") return 2;
    if (targetType === "creep") return 1;
    return 0;
  }

  nearestCreepInRange(abilityKey) {
    const range = this.player.data.abilities[abilityKey]?.range ?? 80;
    let nearest = null;
    let nearestDist = range;
    const myOwnerKey = `slot${this.mySlot}`;
    const enemyMinions = this.casterMinions.filter(m => m.owner !== myOwnerKey);
    const targets = [...this.creeps, ...this.twitches, ...enemyMinions];
    for (const t of targets) {
      if (!t.isAlive) continue;
      const dx = t.sprite.x - this.player.sprite.x;
      const dy = t.sprite.y - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = t;
      }
    }
    return nearest;
  }

  calculateVelocity() {
    const direction = { x: 0, y: 0 };

    if (this.cursors.W.isDown) direction.y -= 1;
    if (this.cursors.S.isDown) direction.y += 1;
    if (this.cursors.A.isDown) direction.x -= 1;
    if (this.cursors.D.isDown) direction.x += 1;

    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
      return { x: 0, y: 0 };
    }

    const speed = MOVE_SPEED * (this.player?.getMovementSpeedMultiplier?.() ?? 1);
    return {
      x: (direction.x / length) * speed,
      y: (direction.y / length) * speed
    };
  }

  createBars(_player, healthColor, manaColor) {
    const healthBar = this.add.rectangle(0, 0, 64, 6, healthColor).setOrigin(0.5);
    const manaBar = this.add.rectangle(0, 0, 64, 4, manaColor).setOrigin(0.5);
    healthBar.setDepth(20);
    manaBar.setDepth(20);
    this.bars.push(healthBar, manaBar);
    return { healthBar, manaBar };
  }

  updateBars(player, bars) {
    if (!player || !bars) return;
    const { healthBar, manaBar } = bars;
    const x = player.sprite.x;
    const y = player.sprite.y + 42;

    healthBar.setPosition(x, y);
    manaBar.setPosition(x, y + 8);
    const healthRatio = Math.max(0, Math.min(1, player.data.stats.health / player.data.stats.maxHealth));
    const manaRatio = Math.max(0, Math.min(1, player.data.stats.mana / player.data.stats.maxMana));

    healthBar.displayWidth = 64 * healthRatio;
    manaBar.displayWidth = 64 * manaRatio;
  }

  applyRemoteState(payload) {
    if (!payload || payload.roomId !== this.roomId) return;
    const { state } = payload;
    if (!state) return;
    if (state.playerId === this.playerId) return;

    // Find which opponent this state belongs to (match by id or placeholder)
    let oppIdx = this.opponents.findIndex(o => o.data.id === state.playerId);
    if (oppIdx === -1) {
      // Try to claim a placeholder slot that still has the default id
      oppIdx = this.opponents.findIndex(o => o.data.id === "peer_remote" || o.data.id.startsWith("peer_"));
      if (oppIdx === -1) return;
    }
    let opp = this.opponents[oppIdx];

    // Fix opponent ID
    if (state.playerId && opp.data.id !== state.playerId) {
      opp.data.id = state.playerId;
    }

    // Rebuild opponent sprite/stats when we learn their actual champion
    if (state.championKey && opp.data.championKey !== state.championKey) {
      const pos = { x: opp.sprite.x, y: opp.sprite.y };
      opp.sprite.destroy();
      this.opponentBarsList[oppIdx].healthBar.destroy();
      this.opponentBarsList[oppIdx].manaBar.destroy();
      const slotDef = PLAYER_SLOTS[this.opponentSlots[oppIdx].slot] ?? PLAYER_SLOTS[1];
      const newState = buildChampionState(state.championKey, state.playerId, pos);
      opp = new Player(this, { ...newState, tint: slotDef.tint });
      this.opponents[oppIdx] = opp;
      this.opponentBarsList[oppIdx] = this.createBars(opp, slotDef.tint, 0x3b82f6);
      if (oppIdx === 0) {
        this.opponent = opp;
        this.opponentBars = this.opponentBarsList[0];
      }
    }

    const { position, health, mana, isAlive, abilities } = state;
    if (position) {
      opp.sprite.setPosition(position.x, position.y);
      opp.data.position.x = position.x;
      opp.data.position.y = position.y;
    }
    if (typeof health === "number") opp.data.stats.health = health;
    if (typeof mana === "number") opp.data.stats.mana = mana;
    if (typeof isAlive === "boolean") {
      opp.data.isAlive = isAlive;
      opp.sprite.setVisible(isAlive);
      const bars = this.opponentBarsList[oppIdx];
      if (bars) {
        bars.healthBar.setVisible(isAlive);
        bars.manaBar.setVisible(isAlive);
      }
    }
    if (abilities) {
      Object.entries(abilities).forEach(([key, { cooldownRemaining }]) => {
        if (opp.data.abilities[key]) {
          opp.data.abilities[key].cooldownRemaining = cooldownRemaining;
        }
      });
    }
    if (!this.isHost && payload.world) {
      this.applyWorldState(payload.world);
    }

    if (typeof state.lastStandUsed === "boolean") opp.lastStandUsed = state.lastStandUsed;

    // Sync opponent score in real time from their broadcasted kills field
    const trackId = state.playerId ?? opp.data.id;
    const lastKills = this.lastOpponentKillsMap[trackId] ?? 0;
    if (typeof state.kills === "number" && state.kills > lastKills) {
      const delta = state.kills - lastKills;
      this.lastOpponentKillsMap[trackId] = state.kills;
      if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 0, opponent: delta, opponentId: trackId });
    }
  }

  getWorldState() {
    return {
      creeps: this.creeps.map((c, i) => ({
        index: i,
        x: c.isAlive ? c.sprite.x : 0,
        y: c.isAlive ? c.sprite.y : 0,
        health: c.health,
        isAlive: c.isAlive
      })),
      twitches: this.twitches.map((t, i) => ({
        index: i,
        x: t.isAlive ? t.sprite.x : 0,
        y: t.isAlive ? t.sprite.y : 0,
        health: t.health,
        isAlive: t.isAlive
      })),
      casterMinions: this.casterMinions.map((m, i) => ({
        index: i,
        x: m.isAlive ? m.sprite.x : 0,
        y: m.isAlive ? m.sprite.y : 0,
        health: m.health,
        isAlive: m.isAlive,
        owner: m.owner
      })),
      towers: Object.fromEntries(
        Object.entries(this.towersBySlot).map(([slot, tower]) => [
          `slot${slot}`,
          { health: tower.health, isAlive: tower.isAlive }
        ])
      ),
      gemstones: this.gemstones.map((g, i) => ({
        index: i,
        active: g.active,
        x: g.x,
        y: g.y
      }))
    };
  }

  applyWorldState(world) {
    if (!world) return;

    if (world.creeps && this.creeps) {
      world.creeps.forEach(({ index, x, y, health, isAlive }) => {
        if (!this.creeps[index]) {
          // Host spawned a new creep — create it on guest too
          if (isAlive) this.creeps[index] = new Creep(this, x, y);
          return;
        }
        const creep = this.creeps[index];
        if (!isAlive && creep.isAlive) {
          creep.takeDamage(creep.health);
        } else if (isAlive && creep.isAlive) {
          creep.sprite.setPosition(x, y);
          creep.healthBar.setPosition(x, y - 28);
          creep.healthBarBg.setPosition(x, y - 28);
          creep.health = health;
          creep.healthBar.displayWidth = 40 * Math.max(0, health / creep.maxHealth);
        }
      });
    }

    if (world.twitches && this.twitches) {
      world.twitches.forEach(({ index, x, y, health, isAlive }) => {
        const t = this.twitches[index];
        if (!t) return;
        if (!isAlive && t.isAlive) {
          t.takeDamage(t.health);
        } else if (isAlive && t.isAlive) {
          t.sprite.setPosition(x, y);
          t.healthBar.x = x; t.healthBar.y = y - 32;
          t.healthBarBg.x = x; t.healthBarBg.y = y - 32;
          t.health = health;
          t.healthBar.displayWidth = 44 * Math.max(0, health / t.maxHealth);
        }
      });
    }

    if (world.casterMinions) {
      world.casterMinions.forEach(({ index, x, y, health, isAlive, owner }) => {
        if (!this.casterMinions[index]) {
          if (isAlive) {
            const slotNum = Number(String(owner).replace("slot", ""));
            const tint = (PLAYER_SLOTS[slotNum] ?? PLAYER_SLOTS[0]).tint;
            this.casterMinions[index] = new CasterMinion(this, x, y, null, tint, owner);
          }
          return;
        }
        const m = this.casterMinions[index];
        if (!isAlive && m.isAlive) {
          m.takeDamage(m.health);
        } else if (isAlive && m.isAlive) {
          m.sprite.setPosition(x, y);
          m.healthBar.x = x; m.healthBar.y = y - 28;
          m.healthBarBg.x = x; m.healthBarBg.y = y - 28;
          m.health = health;
          m.healthBar.displayWidth = 40 * Math.max(0, health / m.maxHealth);
        }
      });
    }

    if (world.gemstones && this.gemstones) {
      world.gemstones.forEach(({ index, active, x, y }) => {
        if (!this.gemstones[index]) {
          if (active) this.gemstones[index] = new Gemstone(this, null);
          return;
        }
        this.gemstones[index].syncState(active, x, y);
      });
    }

    if (world.towers) {
      const syncTower = (tower, data) => {
        if (!data || !tower) return;
        tower.health = data.health;
        tower.healthBar.displayWidth = 60 * Math.max(0, data.health / tower.maxHealth);
        if (!data.isAlive && tower.isAlive) {
          tower.isAlive = false;
          tower.sprite.setAlpha(0.3);
          tower.label.setText("DESTROYED");
        }
      };
      // World tower keys are slot-based (e.g. "slot0", "slot1") — apply to matching local towers
      Object.entries(world.towers).forEach(([key, data]) => {
        const slot = Number(key.replace("slot", ""));
        const tower = this.towersBySlot[slot];
        if (tower) syncTower(tower, data);
      });
    }
  }

  handleNetworkMessage(payload) {
    if (!payload) return;
    if (payload.type === "game-over" && !this.isHost) {
      if (this.gameOverFired) return;
      this.gameOverFired = true;
      const result = payload.results?.[this.playerId] ?? "draw";
      if (this.options.onGameOver) this.options.onGameOver(result);
      return;
    }
    if (payload.type === "tower-kill" && !this.isHost) {
      this._handleTowerKill(payload.slot, payload.targetType);
      return;
    }
    if (payload.type === "twitch-group-respawn" && !this.isHost) {
      this._rebuildTwitchGroup(payload.groupIndex);
      return;
    }
    if (payload.type === "tower-attack") {
      // payload.tower is "slot0", "slot1", etc.
      const slot = Number(String(payload.tower).replace("slot", ""));
      const tower = this.towersBySlot[slot];
      if (tower) tower._flashAttackSprite();
      return;
    }
    if (payload.type === "gem-heal") {
      // If targetId matches local player, heal them; otherwise ignore (FFA: each client heals themselves)
      if (!payload.targetId || payload.targetId === this.playerId) {
        const s = this.player.data.stats;
        s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.5);
        s.mana = Math.min(s.maxMana, s.mana + s.maxMana * 0.5);
      }
      return;
    }
    if (payload.type === "tower-hit" && this.isHost) {
      const { slot, damage } = payload;
      const tower = this.towersBySlot[slot];
      const canAttack = this.gameMode === "ffa" || this._isTowerOwnerDead(slot);
      if (tower?.isAlive && canAttack) {
        tower.takeDamage(damage);
      }
      return;
    }
    if (payload.type === "creep-hit" && this.isHost) {
      const { creepType, index, damage, aoeRadius, attackerSlot } = payload;
      const target = creepType === "twitch" ? this.twitches[index]
        : creepType === "caster" ? this.casterMinions[index]
        : this.creeps[index];
      if (target?.isAlive) {
        target.takeDamage(damage);
        if (creepType === "caster" && this.gameSync) {
          // Broadcast authoritative health to all guests immediately
          this.gameSync.send({ type: "minion-hit", index, health: target.health, isAlive: target.isAlive, roomId: this.roomId });
        }
        if (aoeRadius > 0) {
          this._applyChampionAoE(target, { damage, aoeRadius }, attackerSlot);
        }
      }
      return;
    }
    if (payload.type === "minion-hit" && !this.isHost) {
      const m = this.casterMinions[payload.index];
      if (!m) return;
      if (!payload.isAlive && m.isAlive) {
        m.takeDamage(m.health);
      } else if (typeof payload.health === "number") {
        m.health = payload.health;
        m.healthBar.displayWidth = 40 * Math.max(0, m.health / m.maxHealth);
      }
      return;
    }
    if (payload.type === "ultimate" && this.isHost) {
      const { attackerId, targetId } = payload;
      const attackerEntry = this.opponentSlots.find(e => e.id === attackerId);
      const attacker = attackerEntry ? this.opponents.find(o => o.data.id === attackerId) : null;
      if (!attacker?.data.isAlive) return;
      const champKey = attacker.data.championKey ?? "mage";
      const abilityDef = CHAMPIONS[champKey]?.abilities?.r;
      if (!abilityDef) return;
      const damage = abilityDef.damage ?? 100;
      const isTrueDamage = abilityDef.trueDamage === true;
      const primaryTarget = targetId === this.playerId
        ? this.player
        : this.opponents.find(o => o.data.id === targetId);
      if (!primaryTarget?.data.isAlive) return;
      primaryTarget.takeDamage(damage, isTrueDamage);
      if (primaryTarget !== this.player && this.gameSync) {
        this.gameSync.send({ type: "hit", attackerId, targetId, damage, trueDamage: isTrueDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
      }
      // AoE to other players near primary target
      if (abilityDef.aoeRadius) {
        const cx = primaryTarget.sprite.x, cy = primaryTarget.sprite.y;
        const r2 = abilityDef.aoeRadius * abilityDef.aoeRadius;
        const allPlayers = [this.player, ...this.opponents];
        for (const p of allPlayers) {
          if (p === primaryTarget || p === attacker || !p.data.isAlive) continue;
          const dx = p.sprite.x - cx, dy = p.sprite.y - cy;
          if (dx * dx + dy * dy <= r2) {
            p.takeDamage(damage, isTrueDamage);
            if (p !== this.player && this.gameSync) {
              this.gameSync.send({ type: "hit", attackerId, targetId: p.data.id, damage, trueDamage: isTrueDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
            }
          }
        }
      }
      // AoE to creeps/minions
      this._applyChampionAoE(primaryTarget, abilityDef, attackerEntry.slot);
      return;
    }

    if (payload.type !== "hit") return;
    if (payload.attackerId !== "tower") {
      // Flash whichever opponent fired the attack
      const attacker = this.opponents.find(o => o.data.id === payload.attackerId);
      if (attacker) attacker._flashAttackSprite();
    }
    if (payload.targetId === this.playerId) {
      this.player.takeDamage(payload.damage, payload.trueDamage === true);
      this.statusText.setText(
        `Room ${this.roomId} | Hit by ${payload.attackerId} for ${payload.damage}`
      );
      if (payload.abilityKey === "r") {
        const attacker = this.opponents.find(o => o.data.id === payload.attackerId);
        if (attacker?.data.championKey === "saber") {
          this._playExcaliburEffect(attacker.sprite.x, attacker.sprite.y, this.player.sprite.x, this.player.sprite.y, 185);
        } else {
          this._playUltimateEffect(this.player.sprite.x, this.player.sprite.y, 150);
        }
      } else if (payload.abilityKey === "tower") {
        const towerTint = PLAYER_SLOTS[payload.attackerSlot]?.tint ?? 0xffffff;
        this.playAttackEffect(this.player, "q", towerTint);
      } else {
        this.playAttackEffect(this.player, payload.abilityKey);
      }
      this.updateBars(this.player, this.playerBars);
    }
  }

  checkGameOver() {
    if (this.gameOverFired) return;
    if (!this.isHost) return;

    // A player is permanently eliminated when: dead + tower gone + last stand already used
    const localTowerAlive = this.towersBySlot[this.mySlot]?.isAlive ?? false;
    const localPermaElim = !this.player.data.isAlive && !localTowerAlive && this.lastStandUsed;

    const oppPermaElim = this.opponents.filter(o => {
      const entry = this.opponentSlots.find(e => e.id === o.data.id);
      const tower = entry ? this.towersBySlot[entry.slot] : null;
      return !o.data.isAlive && !tower?.isAlive && (o.lastStandUsed ?? false);
    });

    if (this.gameMode === "ffa") {
      // FFA: game ends when only 1 player is not permanently eliminated
      const activePlayers = (localPermaElim ? 0 : 1) + (this.opponents.length - oppPermaElim.length);
      if (activePlayers > 1) return;
    } else {
      // 1v1: ends when either player is permanently eliminated
      const anyOppPermaElim = this.opponents.some(o => {
        const entry = this.opponentSlots.find(e => e.id === o.data.id);
        const tower = entry ? this.towersBySlot[entry.slot] : null;
        return !o.data.isAlive && !tower?.isAlive && (o.lastStandUsed ?? false);
      });
      if (!localPermaElim && !anyOppPermaElim) return;
    }

    this.gameOverFired = true;

    // Build score map for every player
    const allScores = { [this.playerId]: this.localKills, ...this.lastOpponentKillsMap };
    const maxScore = Math.max(...Object.values(allScores));
    const topCount = Object.values(allScores).filter(s => s === maxScore).length;
    const isDraw = topCount > 1;

    const results = {};
    for (const [id, score] of Object.entries(allScores)) {
      results[id] = isDraw ? "draw" : (score === maxScore ? "victory" : "defeat");
    }

    if (this.gameSync) {
      this.gameSync.send({ type: "game-over", results, roomId: this.roomId });
    }
    if (this.options.onGameOver) {
      this.options.onGameOver(results[this.playerId] ?? "draw");
    }
  }

  _applyChampionAoE(centerTarget, ability, attackerSlot) {
    if (!centerTarget || !ability) return;
    const radius = ability.aoeRadius ?? 0;
    if (radius <= 0) return;
    const cx = centerTarget.sprite?.x;
    const cy = centerTarget.sprite?.y;
    if (typeof cx !== "number" || typeof cy !== "number") return;

    const radiusSq = radius * radius;
    const damage = ability.damage ?? 0;
    const ignoreOwnerKey = typeof attackerSlot === "number" ? `slot${attackerSlot}` : null;

    const applyToCandidate = (candidate) => {
      if (!candidate || candidate === centerTarget || !candidate.isAlive) return;
      if (candidate.owner && ignoreOwnerKey && candidate.owner === ignoreOwnerKey) return;
      const dx = candidate.sprite.x - cx;
      const dy = candidate.sprite.y - cy;
      if (dx * dx + dy * dy <= radiusSq) {
        candidate.takeDamage(damage);
        if (!candidate.isAlive && attackerSlot === this.mySlot) {
          const isElite = this.twitches.includes(candidate) || this.casterMinions.includes(candidate);
          const pts = isElite ? 2 : 1;
          this.localKills += pts;
          if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: pts, opponent: 0 });
        }
      }
    };

    if (Array.isArray(this.creeps)) this.creeps.forEach(applyToCandidate);
    if (Array.isArray(this.twitches)) this.twitches.forEach(applyToCandidate);
    if (Array.isArray(this.casterMinions)) this.casterMinions.forEach(applyToCandidate);
  }

  _tryFireUltimate() {
    if (!this.player.data.isAlive) return;
    if (!this.player.canUseAbility("r")) return;
    const ability = this.player.data.abilities["r"];

    // Ridder R: self speed burst — no target needed
    if (ability.speedBoost) {
      this.player.useAbility("r");
      this.player.speedBoostActive = true;
      this.player._flashAttackSprite();
      this._playUltimateEffect(this.player.sprite.x, this.player.sprite.y, 80);
      this.time.delayedCall((ability.speedBoostDuration ?? 3) * 1000, () => {
        this.player.speedBoostActive = false;
      });
      return;
    }

    const target = this._nearestLivingOpponent();
    if (!target) return;
    const range = ability.range ?? 200;
    if (this.player.distanceTo(target) > range) return;

    this.player.useAbility("r");
    const damage = Math.round((ability.damage ?? 100) * (this.player._damageMultiplier?.() ?? 1));
    const trueDamage = ability.trueDamage === true;

    this.player._flashAttackSprite();
    if (this.player.data.championKey === "saber") {
      this._playExcaliburEffect(this.player.sprite.x, this.player.sprite.y, target.sprite.x, target.sprite.y, ability.aoeRadius ?? 185);
    } else {
      this._playUltimateEffect(target.sprite.x, target.sprite.y, ability.aoeRadius ?? 150);
    }

    if (this.isHost) {
      target.takeDamage(damage, trueDamage);
      if (this.gameSync) {
        this.gameSync.send({ type: "hit", attackerId: this.playerId, targetId: target.data.id, damage, trueDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
      }
      if (!target.data.isAlive) {
        this.localKills += 3;
        if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
      }
      // AoE to other opponents near the target
      if (ability.aoeRadius) {
        const cx = target.sprite.x, cy = target.sprite.y;
        const r2 = ability.aoeRadius * ability.aoeRadius;
        for (const opp of this.opponents) {
          if (opp === target || !opp.data.isAlive) continue;
          const dx = opp.sprite.x - cx, dy = opp.sprite.y - cy;
          if (dx * dx + dy * dy <= r2) {
            opp.takeDamage(damage);
            if (this.gameSync) {
              this.gameSync.send({ type: "hit", attackerId: this.playerId, targetId: opp.data.id, damage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
            }
            if (!opp.data.isAlive) {
              this.localKills += 3;
              if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
            }
          }
        }
      }
      // AoE splash to creeps/minions
      this._applyChampionAoE(target, ability, this.mySlot);
    } else {
      // Guest: apply to local copy for immediate feedback, host does the authoritative damage
      target.takeDamage(damage, trueDamage);
      if (!target.data.isAlive) {
        this.localKills += 3;
        if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
      }
      if (this.gameSync) {
        this.gameSync.send({ type: "ultimate", attackerId: this.playerId, targetId: target.data.id, roomId: this.roomId });
      }
    }
  }

  _playUltimateEffect(x, y, radius) {
    // Expanding ring from target outward
    const ring = this.add.graphics();
    ring.lineStyle(4, 0xff4500, 1);
    ring.strokeCircle(0, 0, radius);
    ring.setPosition(x, y);
    ring.setScale(0.05);
    ring.setDepth(25);
    this.tweens.add({
      targets: ring,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 500,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
    // Bright flash at center
    const flash = this.add.graphics();
    flash.fillStyle(0xff8c00, 0.6);
    flash.fillCircle(0, 0, 45);
    flash.setPosition(x, y);
    flash.setDepth(25);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 350,
      ease: "Cubic.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  _playExcaliburEffect(fromX, fromY, toX, toY, aoeRadius) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const beamLen = Math.hypot(toX - fromX, toY - fromY) + aoeRadius * 0.6;

    // --- core beam ---
    const beam = this.add.graphics();
    beam.setDepth(30);
    beam.setPosition(fromX, fromY);
    beam.setRotation(angle);
    // outer glow layer
    beam.fillStyle(0xffd700, 0.25);
    beam.fillRect(0, -22, beamLen, 44);
    // mid layer
    beam.fillStyle(0xffa500, 0.55);
    beam.fillRect(0, -12, beamLen, 24);
    // bright core
    beam.fillStyle(0xfffacd, 0.95);
    beam.fillRect(0, -5, beamLen, 10);
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeOut",
      onComplete: () => beam.destroy()
    });

    // --- origin flash (sword release point) ---
    const originFlash = this.add.graphics();
    originFlash.setDepth(31);
    originFlash.fillStyle(0xfffacd, 1);
    originFlash.fillCircle(fromX, fromY, 28);
    this.tweens.add({
      targets: originFlash,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 400,
      ease: "Cubic.easeOut",
      onComplete: () => originFlash.destroy()
    });

    // --- impact explosion at target ---
    const blast = this.add.graphics();
    blast.setDepth(31);
    blast.fillStyle(0xffd700, 0.9);
    blast.fillCircle(toX, toY, aoeRadius * 0.5);
    blast.fillStyle(0xffa500, 0.6);
    blast.fillCircle(toX, toY, aoeRadius * 0.8);
    this.tweens.add({
      targets: blast,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 550,
      ease: "Cubic.easeOut",
      onComplete: () => blast.destroy()
    });

    // --- expanding golden ring ---
    const ring = this.add.graphics();
    ring.lineStyle(5, 0xffd700, 1);
    ring.strokeCircle(0, 0, aoeRadius);
    ring.setPosition(toX, toY);
    ring.setScale(0.05);
    ring.setDepth(30);
    this.tweens.add({
      targets: ring,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });

    // --- second softer ring (trailing glow) ---
    const ring2 = this.add.graphics();
    ring2.lineStyle(10, 0xffa500, 0.4);
    ring2.strokeCircle(0, 0, aoeRadius);
    ring2.setPosition(toX, toY);
    ring2.setScale(0.05);
    ring2.setDepth(29);
    this.tweens.add({
      targets: ring2,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => ring2.destroy()
    });

    // --- light rays emanating from impact ---
    const RAY_COUNT = 10;
    for (let i = 0; i < RAY_COUNT; i++) {
      const rayAngle = (i / RAY_COUNT) * Math.PI * 2;
      const rayLen = aoeRadius * (0.6 + Math.random() * 0.6);
      const ray = this.add.graphics();
      ray.setDepth(29);
      ray.lineStyle(2 + Math.random() * 3, i % 2 === 0 ? 0xffd700 : 0xffa500, 0.8);
      ray.beginPath();
      ray.moveTo(toX, toY);
      ray.lineTo(toX + Math.cos(rayAngle) * rayLen, toY + Math.sin(rayAngle) * rayLen);
      ray.strokePath();
      this.tweens.add({
        targets: ray,
        alpha: 0,
        duration: 400 + Math.random() * 300,
        ease: "Cubic.easeOut",
        onComplete: () => ray.destroy()
      });
    }
  }

  playAttackEffect(target, abilityKey, overrideColor) {
    if (!target) return;
    const effect = this.add.graphics();
    const color = overrideColor ?? (abilityKey === "q" ? 0xfbbf24 : 0x38bdf8);
    effect.lineStyle(3, color);
    const radius = abilityKey === "q" ? 24 : 60;
    effect.strokeCircle(target.sprite.x, target.sprite.y, radius);
    effect.setDepth(20);
    this.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 0.5,
      duration: 250,
      ease: "Cubic.easeOut",
      onComplete: () => effect.destroy()
    });
  }

  destroy() {
    if (this.remoteSubscription) {
      this.remoteSubscription();
      this.remoteSubscription = null;
    }
    if (this.messageCleanup) {
      this.messageCleanup();
      this.messageCleanup = null;
    }
    super.destroy();
  }
}
