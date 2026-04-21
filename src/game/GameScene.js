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
import bersUltImg from "../assets/bers ult.png";
import cloakedImg from "../assets/cloaked.jpg";
import speedImg from "../assets/speed.png";
import slowImg from "../assets/slow.png";
import armorBrokenImg from "../assets/armor broken.png";
import poisonImg from "../assets/poisoned.png";
import Creep from "./Creep";
import Tower from "./Tower";
import Rock from "./Rock";
import Gemstone from "./Gemstone";
import Twitch from "./Twitch";
import CasterMinion from "./CasterMinion";

const MOVE_SPEED = 250;
const GEM_HEAL_RATIO = 0.5;

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
    // 1=champions  2=towers  3=creeps/minions/twitches  4=closest
    this.targetMode = 4;
    // For FFA: track kills per opponent id
    this.lastOpponentKillsMap = {};
    this.opponentSlots.forEach(({ id }) => { this.lastOpponentKillsMap[id] = 0; });
    this.excaliburCharging = false;
    this.excaliburChargeStart = 0;
    this.excaliburChargeGraphic = null;
    this.excaliburChargeTimer = null;
    this.slowEndTime = 0;
    this.riderSpeedEndTime = 0;
    this.riderChains = [];
    this.armorBrokenEndTime = 0;
    this.poisonEndTime = 0;
    this.lancerSpears = [];
    this.gameDurationMs = 5 * 60 * 1000;
    this.gameStartTime = 0;
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
    this.load.image("bers-ult", bersUltImg);
    this.load.image("cloaked", cloakedImg);
    this.load.image("speed", speedImg);
    this.load.image("slow", slowImg);
    this.load.image("armor-broken", armorBrokenImg);
    this.load.image("poison", poisonImg);
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
    this.targetKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.targetKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.targetKey3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.targetKey4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);

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

    this._buildRangeIndicators();

    if (this.isHost) {
      this.rocks = this.placeRocks();
      if (this.gameSync) {
        this.gameSync.send({
          type: "rock-layout",
          positions: this.rocks.map(r => ({ x: r.x, y: r.y })),
          roomId: this.roomId
        });
      }
    } else {
      this.rocks = [];
      if (this.gameSync) {
        this.gameSync.send({ type: "rock-layout-request", roomId: this.roomId });
      }
    }
    const spawnGemstone = () => new Gemstone(this, () => this.getRandomGemPosition());
    this.gemstones = [spawnGemstone(), spawnGemstone()];
    this.creeps = [];
    this.twitches = this.spawnTwitches();
    this.casterMinions = [];

    if (this.isHost && this.gameMode !== "testing") {
      this._startTwitchGroupRespawnWatcher();
      this.time.addEvent({
        delay: 20000,
        loop: true,
        callback: () => {
          // Local tower sends 1 minion toward one opponent (prefer alive, fallback to any)
          const target = this.opponents.find(o => o.data.isAlive) ?? this.opponents[0];
          if (target) {
            const localTowerPos = PLAYER_SLOTS[this.mySlot].towerPos;
            this.casterMinions.push(new CasterMinion(this, localTowerPos.x, localTowerPos.y, target, PLAYER_SLOTS[this.mySlot].tint, `slot${this.mySlot}`, this.playerId));
          }
          // Each opponent tower sends a minion toward local player
          this.opponentSlots.forEach(({ id, slot }) => {
            const slotDef = PLAYER_SLOTS[slot] ?? PLAYER_SLOTS[1];
            this.casterMinions.push(new CasterMinion(this, slotDef.towerPos.x, slotDef.towerPos.y, this.player, slotDef.tint, `slot${slot}`, id));
          });
        }
      });
    }

    // Build towers — one per player slot (none for the testing dummy)
    const allSlots = [this.mySlot, ...this.opponentSlots.map(o => o.slot)];
    this.towersBySlot = {};
    allSlots.forEach((s) => {
      const def = PLAYER_SLOTS[s];
      if (!def || this.towersBySlot[s]) return;
      this.towersBySlot[s] = new Tower(this, def.towerPos.x, def.towerPos.y, def.tint);
    });
    this.localTower = this.towersBySlot[this.mySlot];
    this.remoteTower = this.towersBySlot[this.opponentSlots[0]?.slot] ?? this.localTower;

    this.gameStartTime = this.time.now;
    if (this.isHost && this.gameMode !== "testing") {
      this.time.addEvent({
        delay: this.gameDurationMs,
        callback: () => this._endGameByTimer(),
        callbackScope: this
      });
    }

    // Testing mode: add a single unkillable dummy berserker in the center of the map
    if (this.gameMode === "testing") {
      const dummyState = buildChampionState("warrior", "dummy", { x: ARENA_SIZE.width / 2, y: ARENA_SIZE.height / 2 });
      dummyState.stats.health = 999999;
      dummyState.stats.maxHealth = 999999;
      const dummy = new Player(this, { ...dummyState, tint: 0xff4444 });
      dummy.undyingActive = true;
      // Override move so the dummy never moves
      dummy.move = () => {};
      this.opponents = [dummy];
      this.opponent = dummy;
      this.opponentBarsList = [this.createBars(dummy, 0xff4444, 0x3b82f6)];
      this.opponentBars = this.opponentBarsList[0];
    }

    this.createPlayerHUD();
  }

  createPlayerHUD() {
    const d = 30;
    const barMaxW = 185;
    const barH = 12;
    const boxSize = 42;
    const hpY = -9;
    const mpY = 9;

    const items = [];

    // Background panel
    items.push(this.add.rectangle(0, 0, 660, 50, 0x000000, 0.82).setOrigin(0.5));

    // ── 1. HP / MP bars (far left) ────────────────────────────────────────
    const barLeft = -305;
    items.push(this.add.text(barLeft - 4, hpY, 'HP', { fontSize: '8px', color: '#86efac' }).setOrigin(1, 0.5));
    items.push(this.add.rectangle(barLeft + barMaxW / 2, hpY, barMaxW, barH, 0x1e293b).setOrigin(0.5));
    this.hudHpFill = this.add.rectangle(barLeft, hpY, barMaxW, barH, 0x22c55e).setOrigin(0, 0.5);
    items.push(this.hudHpFill);
    this.hudHpText = this.add.text(barLeft + barMaxW / 2, hpY, '', { fontSize: '9px', color: '#fff' }).setOrigin(0.5);
    items.push(this.hudHpText);

    items.push(this.add.text(barLeft - 4, mpY, 'MP', { fontSize: '8px', color: '#93c5fd' }).setOrigin(1, 0.5));
    items.push(this.add.rectangle(barLeft + barMaxW / 2, mpY, barMaxW, barH, 0x1e293b).setOrigin(0.5));
    this.hudMpFill = this.add.rectangle(barLeft, mpY, barMaxW, barH, 0x3b82f6).setOrigin(0, 0.5);
    items.push(this.hudMpFill);
    this.hudMpText = this.add.text(barLeft + barMaxW / 2, mpY, '', { fontSize: '9px', color: '#fff' }).setOrigin(0.5);
    items.push(this.hudMpText);

    // ── 2. Target mode indicator ──────────────────────────────────────────
    const div1X = barLeft + barMaxW + 8;          // –112
    items.push(this.add.rectangle(div1X, 0, 1, 38, 0xffffff, 0.12));

    const targetX = div1X + 8;                    // –104
    items.push(this.add.text(targetX, -10, 'TARGET', { fontSize: '7px', color: '#94a3b8' }).setOrigin(0, 0.5));
    this.hudTargetLabel = this.add.text(targetX, 4, '', { fontSize: '10px', color: '#fbbf24', fontStyle: 'bold' }).setOrigin(0, 0.5);
    items.push(this.hudTargetLabel);
    items.push(this.add.text(targetX, 16, '[1-4]', { fontSize: '7px', color: '#475569' }).setOrigin(0, 0.5));

    // ── 3. ATK (Space) + ULT (R) cooldown boxes ───────────────────────────
    const div2X = targetX + 68;                   // –36
    items.push(this.add.rectangle(div2X, 0, 1, 38, 0xffffff, 0.12));

    const qCx = div2X + 8 + boxSize / 2;          // –7
    items.push(this.add.rectangle(qCx, 0, boxSize, boxSize, 0x334155).setOrigin(0.5));
    const qBorder = this.add.graphics();
    qBorder.lineStyle(1, 0x64748b, 0.6);
    qBorder.strokeRect(qCx - boxSize / 2, -boxSize / 2, boxSize, boxSize);
    items.push(qBorder);
    this.hudQOverlay = this.add.rectangle(qCx - boxSize / 2, -boxSize / 2, boxSize, 0, 0x000000, 0.78).setOrigin(0, 0);
    items.push(this.hudQOverlay);
    items.push(this.add.text(qCx - boxSize / 2 + 3, -boxSize / 2 + 3, 'SPC', { fontSize: '7px', color: '#94a3b8' }).setOrigin(0, 0));
    this.hudQReadyLabel = this.add.text(qCx, 5, 'ATK', { fontSize: '10px', color: '#e2e8f0', fontStyle: 'bold' }).setOrigin(0.5);
    items.push(this.hudQReadyLabel);
    this.hudQTimer = this.add.text(qCx, 4, '', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    items.push(this.hudQTimer);

    const rCx = qCx + boxSize + 6;                // 41
    items.push(this.add.rectangle(rCx, 0, boxSize, boxSize, 0x3d1f0d).setOrigin(0.5));
    const rBorder = this.add.graphics();
    rBorder.lineStyle(1, 0xc2410c, 0.6);
    rBorder.strokeRect(rCx - boxSize / 2, -boxSize / 2, boxSize, boxSize);
    items.push(rBorder);
    this.hudROverlay = this.add.rectangle(rCx - boxSize / 2, -boxSize / 2, boxSize, 0, 0x000000, 0.78).setOrigin(0, 0);
    items.push(this.hudROverlay);
    items.push(this.add.text(rCx - boxSize / 2 + 3, -boxSize / 2 + 3, 'R', { fontSize: '7px', color: '#fb923c' }).setOrigin(0, 0));
    this.hudRReadyLabel = this.add.text(rCx, 5, 'ULT', { fontSize: '10px', color: '#ff8c3a', fontStyle: 'bold' }).setOrigin(0.5);
    items.push(this.hudRReadyLabel);
    this.hudRTimer = this.add.text(rCx, 4, '', { fontSize: '12px', color: '#ff8c3a', fontStyle: 'bold' }).setOrigin(0.5);
    items.push(this.hudRTimer);

    // ── 4. Status effect slots (packed left-to-right, no gaps) ────────────
    const div3X = rCx + boxSize / 2 + 8;          // 70
    items.push(this.add.rectangle(div3X, 0, 1, 38, 0xffffff, 0.12));

    const slotStep = 42;
    const slotStart = div3X + 8 + 20;             // 98 — center of first slot
    // slots: 98, 140, 182, 224, 266, 308  (right edge 328 — inside ±330 panel)
    this.hudStatusSlotStart = slotStart;
    this.hudStatusSlotStep = slotStep;

    const makeStatusSlot = ({ bgColor, borderColor, borderAlpha = 0.9, textureKey }) => {
      const bg = this.add.rectangle(0, 0, 40, 40, bgColor, 0.9).setOrigin(0.5).setVisible(false);
      const border = this.add.graphics().setVisible(false);
      border.lineStyle(2, borderColor, borderAlpha);
      border.strokeRect(-20, -20, 40, 40);
      const icon = this.add.image(0, 0, textureKey).setDisplaySize(36, 36).setOrigin(0.5).setVisible(false);
      const container = this.add.container(0, 0, [bg, border, icon]).setVisible(false);
      return { container, bg, border, icon };
    };

    const poisonSlot = makeStatusSlot({ bgColor: 0x0a1a00, borderColor: 0x4ade80, textureKey: "poison" });
    this.hudPoisonContainer = poisonSlot.container;
    this.hudPoisonBg = poisonSlot.bg;
    this.hudPoisonBorder = poisonSlot.border;
    this.hudPoisonIcon = poisonSlot.icon;

    const undyingSlot = makeStatusSlot({ bgColor: 0x4a0000, borderColor: 0xff2200, textureKey: "bers-ult" });
    this.hudStatusContainer = undyingSlot.container;
    this.hudStatusBg = undyingSlot.bg;
    this.hudStatusBorder = undyingSlot.border;
    this.hudStatusIcon = undyingSlot.icon;

    const cloakedSlot = makeStatusSlot({ bgColor: 0x001833, borderColor: 0x38bdf8, borderAlpha: 0.85, textureKey: "cloaked" });
    this.hudCloakedContainer = cloakedSlot.container;
    this.hudCloakedBg = cloakedSlot.bg;
    this.hudCloakedBorder = cloakedSlot.border;
    this.hudCloakedLabel = cloakedSlot.icon;

    const slowSlot = makeStatusSlot({ bgColor: 0x1a0033, borderColor: 0xa855f7, textureKey: "slow" });
    this.hudSlowContainer = slowSlot.container;
    this.hudSlowBg = slowSlot.bg;
    this.hudSlowBorder = slowSlot.border;
    this.hudSlowIcon = slowSlot.icon;

    const speedSlot = makeStatusSlot({ bgColor: 0x0d2b00, borderColor: 0x84cc16, textureKey: "speed" });
    this.hudSpeedContainer = speedSlot.container;
    this.hudSpeedBg = speedSlot.bg;
    this.hudSpeedBorder = speedSlot.border;
    this.hudSpeedIcon = speedSlot.icon;

    const armorBrokenSlot = makeStatusSlot({ bgColor: 0x2a0a00, borderColor: 0xf97316, textureKey: "armor-broken" });
    this.hudArmorBrokenContainer = armorBrokenSlot.container;
    this.hudArmorBrokenBg = armorBrokenSlot.bg;
    this.hudArmorBrokenBorder = armorBrokenSlot.border;
    this.hudArmorBrokenIcon = armorBrokenSlot.icon;

    items.push(
      this.hudPoisonContainer,
      this.hudStatusContainer,
      this.hudCloakedContainer,
      this.hudSlowContainer,
      this.hudSpeedContainer,
      this.hudArmorBrokenContainer
    );

    this.hudContainer = this.add.container(this.scale.width / 2, this.scale.height - 28, items);
    this.hudContainer.setDepth(d).setScrollFactor(0);

    this.hudTimerText = this.add
      .text(this.scale.width / 2, 18, "5:00", { fontSize: "16px", color: "#e2e8f0", fontStyle: "bold", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(d)
      .setScrollFactor(0);

    this.scale.on("resize", () => {
      if (this.hudContainer) {
        this.hudContainer.setPosition(this.scale.width / 2, this.scale.height - 28);
      }
      if (this.hudTimerText) {
        this.hudTimerText.setPosition(this.scale.width / 2, 18);
      }
    });
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

    // Undying Rage status icon
    const undying = this.player.undyingActive;
    if (this.hudStatusContainer) this.hudStatusContainer.setVisible(undying);
    this.hudStatusBg.setVisible(undying);
    this.hudStatusBorder.setVisible(undying);
    this.hudStatusIcon.setVisible(undying);
    if (undying && this.undyingRageEndTime) {
      const remaining = Math.max(0, (this.undyingRageEndTime - this.time.now) / 1000);
      // Fade icon from full brightness to near-black as duration expires (1.0 → 0.15)
      const progress = remaining / 5.0;
      this.hudStatusIcon.setAlpha(0.15 + progress * 0.85);
    }

    // Slow status (when local player is hit by Caster R)
    const slowed = this.player.slowActive;
    if (this.hudSlowContainer) this.hudSlowContainer.setVisible(slowed);
    this.hudSlowBg.setVisible(slowed);
    this.hudSlowBorder.setVisible(slowed);
    this.hudSlowIcon.setVisible(slowed);
    if (slowed && this.slowEndTime) {
      const progress = Math.max(0, (this.slowEndTime - this.time.now) / 3000);
      this.hudSlowIcon.setAlpha(0.15 + progress * 0.85);
    }

    // Cloaked + Speed buff status
    const cloaked = this.player.blindActive;
    const riderSpeed = this.player.riderSpeedBonus > 0;
    const speedActive = cloaked || riderSpeed;
    if (this.hudCloakedContainer) this.hudCloakedContainer.setVisible(cloaked);
    this.hudCloakedBg.setVisible(cloaked);
    this.hudCloakedBorder.setVisible(cloaked);
    this.hudCloakedLabel.setVisible(cloaked);
    if (this.hudSpeedContainer) this.hudSpeedContainer.setVisible(speedActive);
    this.hudSpeedBg.setVisible(speedActive);
    this.hudSpeedBorder.setVisible(speedActive);
    this.hudSpeedIcon.setVisible(speedActive);
    if (cloaked && this.blindEndTime) {
      const progress = Math.max(0, (this.blindEndTime - this.time.now) / 5000);
      const alpha = 0.15 + progress * 0.85;
      this.hudCloakedLabel.setAlpha(alpha);
      if (!riderSpeed) this.hudSpeedIcon.setAlpha(alpha);
    }
    if (riderSpeed && this.riderSpeedEndTime) {
      const progress = Math.max(0, (this.riderSpeedEndTime - this.time.now) / 2500);
      this.hudSpeedIcon.setAlpha(0.15 + progress * 0.85);
    }

    // Armor Broken status (when local player is hit by Lancer R)
    const armorBroken = this.player.armorBrokenActive;
    if (this.hudArmorBrokenContainer) this.hudArmorBrokenContainer.setVisible(armorBroken);
    this.hudArmorBrokenBg.setVisible(armorBroken);
    this.hudArmorBrokenBorder.setVisible(armorBroken);
    this.hudArmorBrokenIcon.setVisible(armorBroken);
    if (armorBroken && this.armorBrokenEndTime) {
      const progress = Math.max(0, (this.armorBrokenEndTime - this.time.now) / 5000);
      this.hudArmorBrokenIcon.setAlpha(0.15 + progress * 0.85);
    }

    // Poison status — local player poisoned
    const poisoned = this.player.poisonActive;
    if (this.hudPoisonContainer) this.hudPoisonContainer.setVisible(poisoned);
    this.hudPoisonBg.setVisible(poisoned);
    this.hudPoisonBorder.setVisible(poisoned);
    this.hudPoisonIcon.setVisible(poisoned);
    if (poisoned && this.poisonEndTime) {
      const progress = Math.max(0, (this.poisonEndTime - this.time.now) / 5000);
      this.hudPoisonIcon.setAlpha(0.15 + progress * 0.85);
    }

    // Reflow active status icons so they stay aligned (no gaps between fixed slots).
    const baseX = this.hudStatusSlotStart ?? 0;
    const stepX = this.hudStatusSlotStep ?? 44;
    const activeStatusContainers = [];
    if (poisoned) activeStatusContainers.push(this.hudPoisonContainer);
    if (undying) activeStatusContainers.push(this.hudStatusContainer);
    if (cloaked) activeStatusContainers.push(this.hudCloakedContainer);
    if (slowed) activeStatusContainers.push(this.hudSlowContainer);
    if (speedActive) activeStatusContainers.push(this.hudSpeedContainer);
    if (armorBroken) activeStatusContainers.push(this.hudArmorBrokenContainer);
    activeStatusContainers.forEach((container, index) => {
      if (!container) return;
      container.setPosition(baseX + index * stepX, 0);
    });

    // Target mode
    const modeLabels = { 1: 'Champions', 2: 'Towers', 3: 'Creeps', 4: 'Closest' };
    const modeColors = { 1: '#f87171', 2: '#60a5fa', 3: '#4ade80', 4: '#fbbf24' };
    const mode = this.targetMode ?? 4;
    this.hudTargetLabel.setText(modeLabels[mode] ?? 'Closest');
    this.hudTargetLabel.setColor(modeColors[mode] ?? '#fbbf24');

    // Countdown timer
    if (this.hudTimerText && this.gameStartTime && this.gameMode !== "testing") {
      const elapsed = this.time.now - this.gameStartTime;
      const remaining = Math.max(0, this.gameDurationMs - elapsed);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      this.hudTimerText.setText(`${mins}:${secs.toString().padStart(2, "0")}`);
      this.hudTimerText.setColor(remaining < 60000 ? "#ef4444" : "#e2e8f0");
    }
  }

  _buildRangeIndicators() {
    const abilities = this.player.data.abilities;
    const qRange = abilities?.q?.range ?? 0;
    const rRange = abilities?.r?.range ?? 0;

    this.qRangeIndicator = this.add.graphics().setDepth(3);
    if (qRange > 0) {
      this.qRangeIndicator.fillStyle(0xfbbf24, 0.06);
      this.qRangeIndicator.fillCircle(0, 0, qRange);
      this.qRangeIndicator.lineStyle(1, 0xfbbf24, 0.22);
      this.qRangeIndicator.strokeCircle(0, 0, qRange);
    }

    this.rRangeIndicator = this.add.graphics().setDepth(3);
    if (rRange > 0) {
      this.rRangeIndicator.fillStyle(0xa855f7, 0.06);
      this.rRangeIndicator.fillCircle(0, 0, rRange);
      this.rRangeIndicator.lineStyle(1, 0xa855f7, 0.22);
      this.rRangeIndicator.strokeCircle(0, 0, rRange);
    }
  }

  _updateRangeIndicators() {
    const alive = this.player.data.isAlive;
    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    if (this.qRangeIndicator) {
      this.qRangeIndicator.setPosition(x, y).setVisible(alive);
    }
    if (this.rRangeIndicator) {
      this.rRangeIndicator.setPosition(x, y).setVisible(alive);
    }
  }

  placeRocks(positions = null) {
    if (positions) {
      return positions.map(({ x, y }) => new Rock(this, x, y));
    }

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
      { x: 230, y: 120 },  // top-left
      { x: 970, y: 120 },  // top-right
      { x: 230, y: 660 },  // bottom-left
      { x: 970, y: 660 },  // bottom-right
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
    this._updateRangeIndicators();
    this._updateRiderChains();
    this._updateLancerSpears();
    this.updatePlayerHUD();
    this.updateBars(this.player, this.playerBars);
    this.opponents.forEach((opp, i) => this.updateBars(opp, this.opponentBarsList[i]));
    this.player.tickAbilities(delta / 1000);
    if (!this.isHost) {
      // Guest: check gem pickups for the local player only
      this.gemstones.forEach((gem, index) => {
        if (!gem.active || !this.player.data.isAlive) return;
        const dx = this.player.sprite.x - gem.x;
        const dy = this.player.sprite.y - gem.y;
        if (Math.hypot(dx, dy) <= 30) {
          // Hide locally; host will confirm heal via a gem-heal message.
          gem.active = false;
          gem.sprite.setVisible(false);
          if (this.gameSync) {
            this.gameSync.send({ type: "gem-pickup", index, targetId: this.playerId, roomId: this.roomId });
          }
        }
      });
    }
    if (this.isHost) {
      const allPlayers = [this.player, ...this.opponents];
      this.gemstones.forEach((gem) => {
        if (gem.checkPickup(this.player)) {
          this._applyGemHeal(this.player);
          return;
        }
        // Fallback: detect opponent pickup via synced position (guest-initiated pickup is preferred)
        for (const opp of this.opponents) {
          if (gem.checkPickup(opp) && this.gameSync) {
            this._applyGemHeal(opp);
            this.gameSync.send({ type: "gem-heal", targetId: opp.data.id, roomId: this.roomId });
            break;
          }
        }
      });
      // Snapshot HP before AI updates so we can send hit messages for any guest that takes damage
      const hpBeforeAI = allPlayers.map(p => p.data.stats.health);
      this.creeps.forEach((creep) => creep.update(delta, allPlayers));
      this.twitches.forEach((t) => t.update(delta, allPlayers));
      this.casterMinions.forEach((m) => m.update(delta, allPlayers));
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
        towerResult = tower.update(delta, creepTargets, enemyPlayers, allies, this.twitches);
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

    const JustDown = Phaser.Input.Keyboard.JustDown;
    if (JustDown(this.targetKey1)) { this.targetMode = 1; this.updatePlayerHUD(); }
    if (JustDown(this.targetKey2)) { this.targetMode = 2; this.updatePlayerHUD(); }
    if (JustDown(this.targetKey3)) { this.targetMode = 3; this.updatePlayerHUD(); }
    if (JustDown(this.targetKey4)) { this.targetMode = 4; this.updatePlayerHUD(); }

    if (JustDown(this.ultimateKey)) {
      this._tryFireUltimate();
    }

    // Saber charge-up: movement is locked during charge; cancel only on death/mana loss
    if (this.excaliburCharging) {
      if (!this.player.data.isAlive || !this.player.canUseAbility("r")) {
        this._cancelExcaliburCharge();
      } else if (this.time.now - this.excaliburChargeStart >= 1000) {
        this._cancelExcaliburCharge();
        this._excaliburChargeComplete = true;
        this._tryFireUltimate();
      }
    }

    if (JustDown(this.attackKey)) {
      const creepTarget = this.targetMode !== 1 && this.targetMode !== 2
        ? this.nearestCreepInRange("q")
        : null;
      if (creepTarget) {
        const result = this.player.attackCreep(creepTarget, "q");
        if (result) {
          this.playAttackEffect({ sprite: creepTarget.sprite }, result.abilityKey, undefined, { champKey: this.player.data.championKey, x: this.player.sprite.x, y: this.player.sprite.y });
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
        // Attack based on current targeting mode
        const nearestOpp = this.targetMode !== 2 && this.targetMode !== 3 ? this._nearestLivingOpponent() : null;
        const towerTarget = this.targetMode !== 1 && this.targetMode !== 3 ? this._nearestAttackableTower() : null;

        const oppDist = nearestOpp ? this.player.distanceTo(nearestOpp) : Infinity;
        const towerDist = towerTarget ? Math.hypot(towerTarget.tower.x - this.player.sprite.x, towerTarget.tower.y - this.player.sprite.y) : Infinity;

        // Mode 1: champions only — skip tower even if closer
        // Mode 2: towers only — handled by towerTarget being set, nearestOpp null
        // Mode 4: closest of champion/tower
        if (towerTarget && (this.targetMode === 2 || towerDist <= oppDist)) {
          this._attackTower(towerTarget.tower, towerTarget.slot);
        } else if (nearestOpp) {
          const attackResult = this.player.attack(nearestOpp, "q");
          if (attackResult && this.gameSync) {
            this.playAttackEffect(nearestOpp, attackResult.abilityKey, undefined, { champKey: this.player.data.championKey, x: this.player.sprite.x, y: this.player.sprite.y });
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
      // Towers are only attackable when the owner is dead (both 1v1 and FFA)
      if (!this._isTowerOwnerDead(slot)) continue;
      const dx = tower.x - this.player.sprite.x;
      const dy = tower.y - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      // Attacker must be standing inside the tower's own attack range
      if (dist > (tower.attackRange ?? 200)) continue;
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
    if (this.excaliburCharging) return { x: 0, y: 0 };

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

  _applyGemHeal(targetPlayer) {
    if (!targetPlayer?.data?.isAlive) return;
    const stats = targetPlayer.data.stats;
    if (!targetPlayer.poisonActive) {
      stats.health = Math.min(stats.maxHealth, stats.health + (stats.maxHealth - stats.health) * GEM_HEAL_RATIO);
    }
    stats.mana = Math.min(stats.maxMana, stats.mana + stats.maxMana * GEM_HEAL_RATIO);
  }

  _findPlayerById(peerId) {
    if (!peerId) return null;
    if (peerId === this.playerId) return this.player;

    const byExact = this.opponents?.find((opp) => opp?.data?.id === peerId);
    if (byExact) return byExact;

    // Claim a placeholder slot if we haven't learned the real id yet.
    const placeholder = this.opponents?.find(
      (opp) => opp?.data?.id === "peer_remote" || String(opp?.data?.id ?? "").startsWith("peer_")
    );
    if (placeholder) {
      placeholder.data.id = peerId;
      return placeholder;
    }

    return null;
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
    if (payload.type === "rock-layout" && !this.isHost) {
      this.rocks = this.placeRocks(payload.positions);
      return;
    }
    if (payload.type === "rock-layout-request" && this.isHost) {
      this.gameSync.send({
        type: "rock-layout",
        positions: this.rocks.map((r) => ({ x: r.x, y: r.y })),
        roomId: this.roomId,
      });
      return;
    }
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
    if (payload.type === "gem-pickup" && this.isHost) {
      const gem = this.gemstones[payload.index];
      if (!gem?.active) return;

      // Host-authoritative: apply heal once, then broadcast confirmation to the picker.
      gem._deactivate();
      const target = this._findPlayerById(payload.targetId);
      if (target) {
        this._applyGemHeal(target);
        if (this.gameSync) {
          this.gameSync.send({ type: "gem-heal", targetId: target.data.id, roomId: this.roomId });
        }
      }
      return;
    }
    if (payload.type === "gem-heal") {
      // If targetId matches local player, heal them; otherwise ignore (FFA: each client heals themselves)
      if (!payload.targetId || payload.targetId === this.playerId) {
        this._applyGemHeal(this.player);
      }
      return;
    }
    if (payload.type === "tower-hit" && this.isHost) {
      const { slot, damage } = payload;
      const tower = this.towersBySlot[slot];
      const canAttack = this._isTowerOwnerDead(slot);
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
      primaryTarget.takeDamage(damage, isTrueDamage, true, isTrueDamage);
      if (primaryTarget !== this.player && this.gameSync) {
        this.gameSync.send({ type: "hit", attackerId, targetId, damage, trueDamage: isTrueDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
      }
      if (abilityDef.slow) {
        const slowDur = abilityDef.slowDuration ?? 3;
        this._applySlowToPlayer(primaryTarget, slowDur);
        this._applyManaDrain(primaryTarget, attackerId);
        if (this.gameSync) {
          this.gameSync.send({ type: "slow", targetId: primaryTarget.data.id, duration: slowDur, roomId: this.roomId });
        }
      }
      if (abilityDef.armorBroken) {
        this._applyArmorBrokenToPlayer(primaryTarget, 5);
        if (this.gameSync) {
          this.gameSync.send({ type: "armor-broken", targetId: primaryTarget.data.id, duration: 5, roomId: this.roomId });
        }
      }
      if (abilityDef.poison && primaryTarget.data.isAlive) {
        const poisonDmg = abilityDef.poisonDamage ?? 75;
        const poisonDur = abilityDef.poisonDuration ?? 5;
        this._applyPoisonToPlayer(primaryTarget, poisonDmg, poisonDur);
        if (this.gameSync) {
          this.gameSync.send({ type: "poison", targetId: primaryTarget.data.id, totalDamage: poisonDmg, duration: poisonDur, roomId: this.roomId });
        }
      }
      // AoE to other players near primary target
      if (abilityDef.aoeRadius) {
        const cx = primaryTarget.sprite.x, cy = primaryTarget.sprite.y;
        const r2 = abilityDef.aoeRadius * abilityDef.aoeRadius;
        const aoeDmg = abilityDef.aoeDamage ?? damage;
        const allPlayers = [this.player, ...this.opponents];
        for (const p of allPlayers) {
          if (p === primaryTarget || p === attacker || !p.data.isAlive) continue;
          const dx = p.sprite.x - cx, dy = p.sprite.y - cy;
          if (dx * dx + dy * dy <= r2) {
            p.takeDamage(aoeDmg, isTrueDamage, true, isTrueDamage);
            if (p !== this.player && this.gameSync) {
              this.gameSync.send({ type: "hit", attackerId, targetId: p.data.id, damage, trueDamage: isTrueDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
            }
          }
        }
      }
      // AoE to creeps/minions
      this._applyChampionAoE(primaryTarget, abilityDef, attackerEntry.slot);
      // Play the visual effect on the host's screen
      if (champKey === "assassin") {
        this._playZabaniyaStrikeFlash(primaryTarget.sprite.x, primaryTarget.sprite.y);
      } else if (champKey === "saber") {
        this._cancelExcaliburChargeOnPlayer(attacker);
        this._playExcaliburEffect(attacker.sprite.x, attacker.sprite.y, primaryTarget.sprite.x, primaryTarget.sprite.y, abilityDef.aoeRadius ?? 185, primaryTarget);
      } else if (champKey === "mage") {
        this._playRuleBreakerEffect(primaryTarget.sprite.x, primaryTarget.sprite.y);
      } else if (champKey === "lancer") {
        this._playGaeBolgEffect(attacker.sprite.x, attacker.sprite.y, primaryTarget.sprite.x, primaryTarget.sprite.y);
      } else {
        this._playUltimateEffect(primaryTarget.sprite.x, primaryTarget.sprite.y, abilityDef.aoeRadius ?? 150);
      }
      return;
    }

    if (payload.type === "ult-fx") {
      const { champKey, attackerId, fromX, fromY, landX, landY, targetX, targetY, targetIds, slowDuration } = payload;
      if (champKey === "assassin") {
        this._playZabaniyaSmokeOut(fromX, fromY);
        const attacker = this.opponents.find(o => o.data.id === attackerId);
        if (attacker) {
          attacker.sprite.setPosition(landX, landY);
          attacker.data.position.x = landX;
          attacker.data.position.y = landY;
          attacker.sprite.setAlpha(0.25);
          this.time.delayedCall(500, () => {
            if (attacker?.sprite?.active) attacker.sprite.setAlpha(1.0);
          });
        }
        this._playZabaniyaSmokeIn(landX, landY, targetX, targetY);
      } else if (champKey === "ridder") {
        const attacker = this.opponents.find(o => o.data.id === attackerId);
        const targetObjects = (targetIds ?? [])
          .map(id => id === this.playerId ? this.player : this.opponents.find(o => o.data.id === id))
          .filter(Boolean);
        if (attacker && targetObjects.length > 0) {
          this._playChainJailEffect(targetObjects, slowDuration ?? 3, attacker);
        }
      } else if (champKey === "saber") {
        const attacker = this.opponents.find(o => o.data.id === attackerId);
        if (attacker) {
          if (payload.phase === "charge") {
            this._startExcaliburChargeEffectOnPlayer(attacker);
          } else if (payload.phase === "charge-end") {
            this._cancelExcaliburChargeOnPlayer(attacker);
          }
        }
      }
      return;
    }

    if (payload.type === "undying_rage") {
      const { playerId, active } = payload;
      const playerObj = playerId === this.playerId
        ? this.player
        : this.opponents.find(o => o.data.id === playerId);
      if (playerObj) {
        playerObj.undyingActive = active;
        if (active) this._startUndyingRageEffect(playerObj);
        else this._stopUndyingRageEffect(playerObj);
      }
      return;
    }
    if (payload.type === "mana-drain") {
      if (payload.targetId === this.playerId) {
        this.player.data.stats.mana = Math.max(0, this.player.data.stats.mana - payload.amount);
      }
      return;
    }
    if (payload.type === "slow") {
      const { targetId, duration, slowMult } = payload;
      if (targetId === this.playerId) {
        this._applySlowToPlayer(this.player, duration ?? 3, slowMult ?? 0.8);
      } else {
        const opp = this.opponents.find(o => o.data.id === targetId);
        if (opp) this._applySlowToPlayer(opp, duration ?? 3, slowMult ?? 0.8);
      }
      return;
    }
    if (payload.type === "armor-broken") {
      const { targetId, duration } = payload;
      const playerObj = targetId === this.playerId
        ? this.player
        : this.opponents.find(o => o.data.id === targetId);
      if (playerObj) this._applyArmorBrokenToPlayer(playerObj, duration ?? 5);
      return;
    }
    if (payload.type === "poison") {
      const { targetId, totalDamage, duration } = payload;
      const playerObj = targetId === this.playerId
        ? this.player
        : this.opponents.find(o => o.data.id === targetId);
      if (playerObj) this._applyPoisonToPlayer(playerObj, totalDamage ?? 75, duration ?? 5);
      return;
    }
    if (payload.type === "blind") {
      const { playerId, active } = payload;
      const playerObj = playerId === this.playerId
        ? this.player
        : this.opponents.find(o => o.data.id === playerId);
      if (playerObj) {
        playerObj.blindActive = active;
        playerObj.speedBoostActive = active;
        playerObj.sprite.setAlpha(active ? 0.4 : 1.0);
        if (active) this._playBlindActivateEffect(playerObj.sprite.x, playerObj.sprite.y);
      }
      return;
    }

    if (payload.type !== "hit") return;
    const hitAttacker = payload.attackerId !== "tower" && payload.attackerId !== "creep"
      ? this.opponents.find(o => o.data.id === payload.attackerId)
      : null;
    if (hitAttacker) hitAttacker._flashAttackSprite();
    if (payload.targetId === this.playerId) {
      const isChampionHit = payload.attackerId !== "tower" && payload.attackerId !== "creep";
      this.player.takeDamage(payload.damage, payload.trueDamage === true, isChampionHit, payload.trueDamage === true);
      this.statusText.setText(
        `Room ${this.roomId} | Hit by ${payload.attackerId} for ${payload.damage}`
      );
      if (payload.abilityKey === "r") {
        const attacker = hitAttacker;
        if (attacker?.data.championKey === "saber") {
          this._cancelExcaliburChargeOnPlayer(attacker);
          this._playExcaliburEffect(attacker.sprite.x, attacker.sprite.y, this.player.sprite.x, this.player.sprite.y, 185, this.player);
        } else if (attacker?.data.championKey === "mage") {
          this._playRuleBreakerEffect(this.player.sprite.x, this.player.sprite.y);
        } else if (attacker?.data.championKey === "lancer") {
          this._playGaeBolgEffect(attacker.sprite.x, attacker.sprite.y, this.player.sprite.x, this.player.sprite.y);
        } else {
          this._playUltimateEffect(this.player.sprite.x, this.player.sprite.y, 150);
        }
      } else if (payload.abilityKey === "tower") {
        const towerTint = PLAYER_SLOTS[payload.attackerSlot]?.tint ?? 0xffffff;
        this.playAttackEffect(this.player, "q", towerTint);
      } else {
        const attackerInfo = hitAttacker ? { champKey: hitAttacker.data.championKey, x: hitAttacker.sprite.x, y: hitAttacker.sprite.y } : null;
        this.playAttackEffect(this.player, payload.abilityKey, undefined, attackerInfo);
      }
      this.updateBars(this.player, this.playerBars);
    }
  }

  checkGameOver() {
    if (this.gameOverFired) return;
    if (!this.isHost) return;
    if (this.gameMode === "testing") return;

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

    // Winner = last standing player (not eliminated)
    const allIds = [this.playerId, ...this.opponentSlots.map(e => e.id)];
    const elimIds = new Set([
      ...(localPermaElim ? [this.playerId] : []),
      ...oppPermaElim.map(o => o.data.id)
    ]);
    const survivors = allIds.filter(id => !elimIds.has(id));

    const results = {};
    for (const id of allIds) {
      results[id] = elimIds.has(id) ? "defeat" : (survivors.length === 1 ? "victory" : "draw");
    }

    this._fireGameOver(results);
  }

  _endGameByTimer() {
    if (this.gameOverFired) return;
    this.gameOverFired = true;

    // Winner = highest score after time limit
    const allScores = { [this.playerId]: this.localKills, ...this.lastOpponentKillsMap };
    const maxScore = Math.max(...Object.values(allScores));
    const topCount = Object.values(allScores).filter(s => s === maxScore).length;
    const isDraw = topCount > 1;

    const results = {};
    for (const [id, score] of Object.entries(allScores)) {
      results[id] = isDraw ? "draw" : (score === maxScore ? "victory" : "defeat");
    }

    this._fireGameOver(results);
  }

  _fireGameOver(results) {
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
    const damage = ability.aoeDamage ?? ability.damage ?? 0;
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

  _applyManaDrain(target, casterId, sendMessage = true) {
    const drain = Math.floor(target.data.stats.mana * 0.3);
    if (drain <= 0) return;
    target.data.stats.mana = Math.max(0, target.data.stats.mana - drain);
    if (casterId === this.playerId) {
      this.player.data.stats.mana = Math.min(
        this.player.data.stats.maxMana,
        this.player.data.stats.mana + drain
      );
    }
    if (sendMessage && this.gameSync) {
      this.gameSync.send({ type: "mana-drain", casterId, targetId: target.data.id, amount: drain, roomId: this.roomId });
    }
  }

  _applyArmorBrokenToPlayer(playerObj, duration) {
    playerObj.armorBrokenActive = true;
    if (playerObj === this.player) {
      this.armorBrokenEndTime = this.time.now + duration * 1000;
    }
    this.time.delayedCall(duration * 1000, () => {
      playerObj.armorBrokenActive = false;
    });
  }

  _applyPoisonToPlayer(playerObj, totalDamage, duration) {
    playerObj.poisonActive = true;
    if (playerObj === this.player) {
      this.poisonEndTime = this.time.now + duration * 1000;
    }
    const ticks = 5;
    const tickDamage = Math.round(totalDamage / ticks);
    const tickMs = (duration * 1000) / ticks;
    let ticksFired = 0;
    const tickEvent = this.time.addEvent({
      delay: tickMs,
      repeat: ticks - 1,
      callback: () => {
        ticksFired++;
        if (playerObj.data?.isAlive) {
          playerObj.takeDamage(tickDamage, true, false);
          if (playerObj === this.player) {
            this.updateBars(this.player, this.playerBars);
          }
        }
        if (ticksFired >= ticks) {
          playerObj.poisonActive = false;
          tickEvent.remove();
        }
      }
    });
  }

  _applySlowToPlayer(playerObj, duration, slowMult = 0.8) {
    const slowMs = duration * 1000;
    playerObj.slowActive = true;
    playerObj.slowMult = slowMult;
    if (playerObj === this.player) {
      this.slowEndTime = this.time.now + slowMs;
    }
    this.time.delayedCall(slowMs, () => {
      playerObj.slowActive = false;
      playerObj.slowMult = 0.8;
    });
  }

  _playChainJailEffect(targets, duration, originPlayer) {
    const origin = originPlayer ?? this.player;
    const durationMs = duration * 1000;
    const shotMs = 420;
    const COLORS = [0xc084fc, 0xe879f9, 0xd946ef, 0xf9a8d4, 0xa855f7, 0xffffff, 0xf0abfc, 0xfb7185];

    const rndColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

    // Helper: spawn a radial burst of particles from a point
    const radialBurst = (ox, oy, count, minDist, maxDist, minSize, maxSize, minDur, maxDur) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const p = this.add.graphics();
        p.fillStyle(rndColor(), 1);
        p.fillCircle(0, 0, minSize + Math.random() * (maxSize - minSize));
        p.setPosition(ox, oy).setDepth(25);
        this.tweens.add({
          targets: p,
          x: ox + Math.cos(angle) * dist,
          y: oy + Math.sin(angle) * dist,
          alpha: 0, scaleX: 0.05, scaleY: 0.05,
          duration: minDur + Math.random() * (maxDur - minDur),
          ease: "Cubic.easeOut",
          onComplete: () => p.destroy()
        });
      }
    };

    // Helper: expanding ring at a point
    const spawnRing = (ox, oy, color, maxR, lineW, depth) => {
      const ring = this.add.graphics();
      ring.lineStyle(lineW, color, 1);
      ring.strokeCircle(0, 0, maxR);
      ring.setPosition(ox, oy).setScale(0.05).setDepth(depth);
      this.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, alpha: 0, duration: 500, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    };

    // Helper: particle attracted toward a point on the chain
    const spawnAttracted = (chainSx, chainSy, chainEx, chainEy) => {
      const t = Math.random();
      const tx = chainSx + t * (chainEx - chainSx);
      const ty = chainSy + t * (chainEy - chainSy);
      const cdx = chainEx - chainSx, cdy = chainEy - chainSy;
      const clen = Math.hypot(cdx, cdy) || 1;
      const px = -cdy / clen, py = cdx / clen;
      const side = Math.random() < 0.5 ? 1 : -1;
      const dist = 55 + Math.random() * 90;
      const p = this.add.graphics();
      p.fillStyle(rndColor(), 1);
      p.fillCircle(0, 0, 1 + Math.random() * 1.8);
      p.setPosition(tx + px * side * dist, ty + py * side * dist).setDepth(24);
      this.tweens.add({ targets: p, x: tx, y: ty, alpha: 0, duration: 380 + Math.random() * 320, ease: "Cubic.easeIn", onComplete: () => p.destroy() });
    };

    // Big origin explosion on cast (shared across all targets)
    const ox = origin.sprite.x, oy = origin.sprite.y;
    radialBurst(ox, oy, 60, 20, 90, 1.5, 4, 300, 600);
    spawnRing(ox, oy, 0xd946ef, 70, 4, 26);
    spawnRing(ox, oy, 0xffffff, 50, 2, 27);
    spawnRing(ox, oy, 0xa855f7, 90, 3, 25);

    targets.forEach(target => {
      // Dense travel stream: particles shoot out from rider toward target
      for (let i = 0; i < 70; i++) {
        const delay = (i / 70) * shotMs;
        this.time.delayedCall(delay, () => {
          if (!origin?.sprite?.active || !target.sprite?.active) return;
          const sx = origin.sprite.x, sy = origin.sprite.y;
          const tx = target.sprite.x, ty = target.sprite.y;
          const t = i / 70;
          const p = this.add.graphics();
          p.fillStyle(rndColor(), 1);
          p.fillCircle(0, 0, 1.5 + Math.random() * 3);
          p.setPosition(sx + (tx - sx) * t, sy + (ty - sy) * t).setDepth(25);
          const perpX = -(ty - sy), perpY = (tx - sx);
          const pLen = Math.hypot(perpX, perpY) || 1;
          const scatter = (Math.random() - 0.5) * 22;
          this.tweens.add({ targets: p, x: p.x + (perpX / pLen) * scatter, y: p.y + (perpY / pLen) * scatter, alpha: 0, scaleX: 0.1, scaleY: 0.1, duration: 200 + Math.random() * 180, ease: "Cubic.easeOut", onComplete: () => p.destroy() });
        });
      }

      // Impact explosion at target
      this.time.delayedCall(shotMs, () => {
        if (!target.sprite?.active) return;
        const ix = target.sprite.x, iy = target.sprite.y;
        radialBurst(ix, iy, 55, 15, 80, 1.5, 4, 350, 650);
        spawnRing(ix, iy, 0xe879f9, 80, 5, 26);
        spawnRing(ix, iy, 0xffffff, 55, 2, 27);
        spawnRing(ix, iy, 0xc084fc, 100, 3, 25);
      });

      // Attracted particles: spawn from sides of chain, fly toward the line — like Saber's gather effect
      const attractTimer = this.time.addEvent({
        delay: 22, loop: true,
        callback: () => {
          if (!origin?.sprite?.active || !target.sprite?.active) return;
          spawnAttracted(origin.sprite.x, origin.sprite.y, target.sprite.x, target.sprite.y);
          spawnAttracted(origin.sprite.x, origin.sprite.y, target.sprite.x, target.sprite.y);
          spawnAttracted(origin.sprite.x, origin.sprite.y, target.sprite.x, target.sprite.y);
          spawnAttracted(origin.sprite.x, origin.sprite.y, target.sprite.x, target.sprite.y);
        }
      });

      // Persistent chain graphic updated per-frame
      const chainG = this.add.graphics().setDepth(22);
      const chainData = { g: chainG, target, origin, startTime: this.time.now, durationMs, attractTimer };
      this.riderChains.push(chainData);

      // Big explosion at both ends when chain expires
      this.time.delayedCall(durationMs, () => {
        const chainExplosion = (bx, by) => {
          // Blinding white core — large filled circle that lingers briefly
          const blind = this.add.graphics();
          blind.fillStyle(0xffffff, 1);
          blind.fillCircle(0, 0, 55);
          blind.setPosition(bx, by).setDepth(31);
          this.tweens.add({ targets: blind, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 320, ease: "Cubic.easeOut", onComplete: () => blind.destroy() });

          // Second delayed white pulse for a double-flash blindness effect
          this.time.delayedCall(60, () => {
            const blind2 = this.add.graphics();
            blind2.fillStyle(0xffffff, 0.85);
            blind2.fillCircle(0, 0, 42);
            blind2.setPosition(bx, by).setDepth(31);
            this.tweens.add({ targets: blind2, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 250, ease: "Cubic.easeOut", onComplete: () => blind2.destroy() });
          });

          // Pink/magenta inner glow sitting right on the character
          const glow = this.add.graphics();
          glow.fillStyle(0xf0abfc, 0.9);
          glow.fillCircle(0, 0, 38);
          glow.setPosition(bx, by).setDepth(30);
          this.tweens.add({ targets: glow, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 380, ease: "Cubic.easeOut", onComplete: () => glow.destroy() });

          // Tight shockwave — expands but stays focused
          const shock = this.add.graphics();
          shock.lineStyle(10, 0xffffff, 1);
          shock.strokeCircle(0, 0, 40);
          shock.setPosition(bx, by).setScale(0.1).setDepth(30);
          this.tweens.add({ targets: shock, scaleX: 3, scaleY: 3, alpha: 0, duration: 380, ease: "Cubic.easeOut", onComplete: () => shock.destroy() });

          // Second wider shockwave (magenta, slightly delayed)
          this.time.delayedCall(40, () => {
            const shock2 = this.add.graphics();
            shock2.lineStyle(6, 0xd946ef, 0.9);
            shock2.strokeCircle(0, 0, 40);
            shock2.setPosition(bx, by).setScale(0.1).setDepth(29);
            this.tweens.add({ targets: shock2, scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 500, ease: "Cubic.easeOut", onComplete: () => shock2.destroy() });
          });

          // Staggered rings — tight radii, focused on the character
          [[0, 0xffffff, 45, 4], [40, 0xd946ef, 55, 5], [80, 0xf9a8d4, 40, 3], [120, 0xc084fc, 62, 4], [160, 0xe879f9, 50, 3]].forEach(([delay, color, r, w]) => {
            this.time.delayedCall(delay, () => spawnRing(bx, by, color, r, w, 28));
          });

          // Dense tight particle burst — mostly close to character
          radialBurst(bx, by, 70, 5, 35, 1.5, 3.5, 150, 300);
          // Outer sparse particles for reach
          radialBurst(bx, by, 30, 35, 75, 1, 2.5, 300, 500);
          // Third wave — very close, lingers
          this.time.delayedCall(70, () => radialBurst(bx, by, 40, 5, 28, 1, 2.5, 200, 380));
        };

        if (origin.sprite?.active) chainExplosion(origin.sprite.x, origin.sprite.y);
        if (target.sprite?.active) chainExplosion(target.sprite.x, target.sprite.y);
      });

      this.time.delayedCall(durationMs - 350, () => {
        attractTimer.remove();
        if (chainG.active) {
          this.tweens.add({
            targets: chainG, alpha: 0, duration: 350,
            onComplete: () => {
              chainG.destroy();
              this.riderChains = this.riderChains.filter(c => c !== chainData);
            }
          });
        }
      });
    });
  }

  _updateRiderChains() {
    if (!this.riderChains.length) return;
    const now = this.time.now;
    const shotMs = 420;
    const LINK_COLORS = [0xc084fc, 0xe879f9, 0xd946ef, 0xf9a8d4, 0xa855f7, 0xf0abfc];

    for (const chain of this.riderChains) {
      if (!chain.g.active) continue;
      chain.g.clear();

      const elapsed = now - chain.startTime;
      const shotProgress = Math.min(1, elapsed / shotMs);
      const timeLeft = chain.durationMs - elapsed;
      const alpha = timeLeft < 350 ? 0 : 1;

      const sx = (chain.origin ?? this.player).sprite.x;
      const sy = (chain.origin ?? this.player).sprite.y;
      const ex = chain.target.sprite.x;
      const ey = chain.target.sprite.y;
      const dx = ex - sx, dy = ey - sy;
      const totalDist = Math.hypot(dx, dy);
      if (totalDist < 1) continue;

      const nx = dx / totalDist, ny = dy / totalDist;
      const drawDist = totalDist * shotProgress;
      const angle = Math.atan2(dy, dx);
      const endX = sx + nx * drawDist, endY = sy + ny * drawDist;

      // Layered glowing backbone
      chain.g.lineStyle(10, 0xa855f7, alpha * 0.12);
      chain.g.beginPath(); chain.g.moveTo(sx, sy); chain.g.lineTo(endX, endY); chain.g.strokePath();
      chain.g.lineStyle(5, 0xd946ef, alpha * 0.4);
      chain.g.beginPath(); chain.g.moveTo(sx, sy); chain.g.lineTo(endX, endY); chain.g.strokePath();
      chain.g.lineStyle(2, 0xf9a8d4, alpha * 0.7);
      chain.g.beginPath(); chain.g.moveTo(sx, sy); chain.g.lineTo(endX, endY); chain.g.strokePath();
      chain.g.lineStyle(1, 0xffffff, alpha * 0.9);
      chain.g.beginPath(); chain.g.moveTo(sx, sy); chain.g.lineTo(endX, endY); chain.g.strokePath();

      // Chain links — alternating aligned/perpendicular, opacity fades near both endpoints
      const linkSpacing = 15;
      const numLinks = Math.floor(drawDist / linkSpacing);
      for (let i = 0; i < numLinks; i++) {
        const d = i * linkSpacing + linkSpacing * 0.5;
        const lx = sx + nx * d, ly = sy + ny * d;
        const linkAngle = (i % 2 === 0) ? angle : angle + Math.PI * 0.5;
        const lcos = Math.cos(linkAngle), lsin = Math.sin(linkAngle);
        const lw = 8, lh = 3.5;
        const corners = [
          { x: lx + lcos * lw - lsin * lh, y: ly + lsin * lw + lcos * lh },
          { x: lx - lcos * lw - lsin * lh, y: ly - lsin * lw + lcos * lh },
          { x: lx - lcos * lw + lsin * lh, y: ly - lsin * lw - lcos * lh },
          { x: lx + lcos * lw + lsin * lh, y: ly + lsin * lw - lcos * lh },
        ];
        // Sine gradient: 0.65 at endpoints, 1.0 at midpoint
        const t = numLinks > 1 ? i / (numLinks - 1) : 0.5;
        const fade = 0.65 + 0.35 * Math.sin(t * Math.PI);
        const linkColor = LINK_COLORS[i % LINK_COLORS.length];
        chain.g.lineStyle(4, linkColor, alpha * fade * 0.35);
        chain.g.strokePoints(corners, true);
        chain.g.lineStyle(2, linkColor, alpha * fade * 0.95);
        chain.g.strokePoints(corners, true);
        chain.g.lineStyle(1, 0xffffff, alpha * fade * 0.6);
        chain.g.strokePoints(corners, true);
      }

      // Pulsing anchor rings
      if (shotProgress >= 1) {
        const pulse = 0.65 + 0.35 * Math.sin(now * 0.009);
        chain.g.lineStyle(5, 0xd946ef, alpha * pulse * 0.5);
        chain.g.strokeCircle(sx, sy, 12); chain.g.strokeCircle(ex, ey, 12);
        chain.g.lineStyle(3, 0xe879f9, alpha * pulse);
        chain.g.strokeCircle(sx, sy, 9); chain.g.strokeCircle(ex, ey, 9);
        chain.g.lineStyle(1, 0xffffff, alpha * pulse * 0.8);
        chain.g.strokeCircle(sx, sy, 6); chain.g.strokeCircle(ex, ey, 6);
      }
    }
  }

  _playGaeBolgEffect(sx, sy, tx, ty) {
    const travelMs = 220;
    const COLORS = [0xff0000, 0xdc143c, 0xff4444, 0xffffff, 0xb22222, 0xff6666, 0x8b0000];
    const rndColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

    // Helper: radial particle burst
    const radialBurst = (ox, oy, count, minDist, maxDist, minSize, maxSize, minDur, maxDur) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const p = this.add.graphics();
        p.fillStyle(rndColor(), 1);
        p.fillCircle(0, 0, minSize + Math.random() * (maxSize - minSize));
        p.setPosition(ox, oy).setDepth(25);
        this.tweens.add({
          targets: p,
          x: ox + Math.cos(angle) * dist,
          y: oy + Math.sin(angle) * dist,
          alpha: 0, scaleX: 0.05, scaleY: 0.05,
          duration: minDur + Math.random() * (maxDur - minDur),
          ease: "Cubic.easeOut",
          onComplete: () => p.destroy()
        });
      }
    };

    // Helper: expanding ring
    const spawnRing = (ox, oy, color, maxR, lineW, depth) => {
      const ring = this.add.graphics();
      ring.lineStyle(lineW, color, 1);
      ring.strokeCircle(0, 0, maxR);
      ring.setPosition(ox, oy).setScale(0.05).setDepth(depth);
      this.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, alpha: 0, duration: 500, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    };

    // ---- Pre-compute zig-zag waypoints ----
    const dirX = tx - sx, dirY = ty - sy;
    const totalStraight = Math.hypot(dirX, dirY);
    if (totalStraight < 1) return;
    const perpX = -dirY / totalStraight, perpY = dirX / totalStraight;
    const N_ZIG = 9;
    const zigAmp = 30;

    const waypoints = [{ x: sx, y: sy }];
    for (let i = 1; i <= N_ZIG; i++) {
      const t = i / (N_ZIG + 1);
      const side = (i % 2 === 0) ? 1 : -1;
      // Amplitude decays slightly near the target for a focused strike
      const decay = 1 - t * 0.4;
      waypoints.push({
        x: sx + dirX * t + perpX * zigAmp * side * decay,
        y: sy + dirY * t + perpY * zigAmp * side * decay
      });
    }
    waypoints.push({ x: tx, y: ty });

    // Pre-compute cumulative segment lengths
    const segLengths = [];
    let totalLen = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const d = Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].y - waypoints[i - 1].y);
      segLengths.push(d);
      totalLen += d;
    }

    // ---- Origin burst ----
    radialBurst(sx, sy, 55, 15, 85, 1.5, 4, 280, 550);
    spawnRing(sx, sy, 0xdc143c, 70, 5, 26);
    spawnRing(sx, sy, 0xffffff, 50, 2, 27);
    spawnRing(sx, sy, 0x8b0000, 90, 3, 25);
    // Bright crimson core flash
    const originCore = this.add.graphics();
    originCore.fillStyle(0xffffff, 1);
    originCore.fillCircle(0, 0, 28);
    originCore.setPosition(sx, sy).setDepth(30);
    this.tweens.add({ targets: originCore, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 280, ease: "Cubic.easeOut", onComplete: () => originCore.destroy() });

    // ---- Zig-zag sparks: particles fly out from each zig-zag node perpendicular to the path ----
    waypoints.slice(1, -1).forEach((wp, idx) => {
      const delay = ((idx + 1) / (N_ZIG + 1)) * travelMs;
      this.time.delayedCall(delay, () => {
        for (let k = 0; k < 8; k++) {
          const angle = Math.random() * Math.PI * 2;
          const p = this.add.graphics();
          p.fillStyle(rndColor(), 1);
          p.fillCircle(0, 0, 1.5 + Math.random() * 2.5);
          p.setPosition(wp.x, wp.y).setDepth(26);
          this.tweens.add({
            targets: p,
            x: wp.x + Math.cos(angle) * (20 + Math.random() * 40),
            y: wp.y + Math.sin(angle) * (20 + Math.random() * 40),
            alpha: 0, scaleX: 0.1, scaleY: 0.1,
            duration: 220 + Math.random() * 180, ease: "Cubic.easeOut",
            onComplete: () => p.destroy()
          });
        }
        // Mini ring flash at each zig node
        const miniRing = this.add.graphics();
        miniRing.lineStyle(2, rndColor(), 0.9);
        miniRing.strokeCircle(0, 0, 12);
        miniRing.setPosition(wp.x, wp.y).setScale(0.2).setDepth(25);
        this.tweens.add({ targets: miniRing, scaleX: 1, scaleY: 1, alpha: 0, duration: 280, ease: "Cubic.easeOut", onComplete: () => miniRing.destroy() });
      });
    });

    // ---- Attracted particles that orbit the zig-zag path — spawn throughout travel ----
    const attractTimer = this.time.addEvent({
      delay: 25, loop: true,
      callback: () => {
        const elapsed = this.time.now - startTime;
        const progress = Math.min(1, elapsed / travelMs);
        // Pick a random point along the already-drawn path
        const targetDist = Math.random() * progress * totalLen;
        let rem = targetDist, px = waypoints[0].x, py = waypoints[0].y;
        for (let i = 0; i < segLengths.length; i++) {
          if (rem <= segLengths[i]) {
            const t2 = rem / segLengths[i];
            px = waypoints[i].x + t2 * (waypoints[i + 1].x - waypoints[i].x);
            py = waypoints[i].y + t2 * (waypoints[i + 1].y - waypoints[i].y);
            break;
          }
          rem -= segLengths[i];
        }
        const side = Math.random() < 0.5 ? 1 : -1;
        const offDist = 40 + Math.random() * 70;
        const offAngle = Math.random() * Math.PI * 2;
        const ap = this.add.graphics();
        ap.fillStyle(rndColor(), 1);
        ap.fillCircle(0, 0, 1 + Math.random() * 1.5);
        ap.setPosition(px + Math.cos(offAngle) * offDist * side, py + Math.sin(offAngle) * offDist).setDepth(24);
        this.tweens.add({ targets: ap, x: px, y: py, alpha: 0, duration: 320 + Math.random() * 280, ease: "Cubic.easeIn", onComplete: () => ap.destroy() });
      }
    });
    const startTime = this.time.now;

    // ---- Persistent spear graphic (redrawn per-frame via _updateLancerSpears) ----
    const spearG = this.add.graphics().setDepth(23);
    const spearData = { g: spearG, waypoints, segLengths, totalLen, startTime, travelMs };
    this.lancerSpears.push(spearData);

    // ---- Impact explosion when tip arrives ----
    this.time.delayedCall(travelMs, () => {
      attractTimer.remove();
      spearG.destroy();
      this.lancerSpears = this.lancerSpears.filter(s => s !== spearData);

      // Blinding white core
      const blind = this.add.graphics();
      blind.fillStyle(0xffffff, 1);
      blind.fillCircle(0, 0, 52);
      blind.setPosition(tx, ty).setDepth(31);
      this.tweens.add({ targets: blind, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 320, ease: "Cubic.easeOut", onComplete: () => blind.destroy() });

      // Delayed second white flash (strobe)
      this.time.delayedCall(55, () => {
        const blind2 = this.add.graphics();
        blind2.fillStyle(0xffffff, 0.8);
        blind2.fillCircle(0, 0, 40);
        blind2.setPosition(tx, ty).setDepth(31);
        this.tweens.add({ targets: blind2, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 260, ease: "Cubic.easeOut", onComplete: () => blind2.destroy() });
      });

      // Deep crimson glow core
      const crimsonCore = this.add.graphics();
      crimsonCore.fillStyle(0x8b0000, 0.95);
      crimsonCore.fillCircle(0, 0, 38);
      crimsonCore.setPosition(tx, ty).setDepth(30);
      this.tweens.add({ targets: crimsonCore, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 400, ease: "Cubic.easeOut", onComplete: () => crimsonCore.destroy() });

      // Tight red shockwave
      const shock1 = this.add.graphics();
      shock1.lineStyle(10, 0xff0000, 1);
      shock1.strokeCircle(0, 0, 45);
      shock1.setPosition(tx, ty).setScale(0.1).setDepth(30);
      this.tweens.add({ targets: shock1, scaleX: 3, scaleY: 3, alpha: 0, duration: 380, ease: "Cubic.easeOut", onComplete: () => shock1.destroy() });

      // White shockwave (slightly delayed)
      this.time.delayedCall(40, () => {
        const shock2 = this.add.graphics();
        shock2.lineStyle(6, 0xffffff, 0.85);
        shock2.strokeCircle(0, 0, 45);
        shock2.setPosition(tx, ty).setScale(0.1).setDepth(29);
        this.tweens.add({ targets: shock2, scaleX: 4.2, scaleY: 4.2, alpha: 0, duration: 480, ease: "Cubic.easeOut", onComplete: () => shock2.destroy() });
      });

      // Crimson shockwave (widest)
      this.time.delayedCall(80, () => {
        const shock3 = this.add.graphics();
        shock3.lineStyle(4, 0xdc143c, 0.7);
        shock3.strokeCircle(0, 0, 45);
        shock3.setPosition(tx, ty).setScale(0.1).setDepth(28);
        this.tweens.add({ targets: shock3, scaleX: 5.5, scaleY: 5.5, alpha: 0, duration: 600, ease: "Cubic.easeOut", onComplete: () => shock3.destroy() });
      });

      // Staggered rings
      [[0, 0xffffff, 50, 5], [40, 0xdc143c, 68, 6], [80, 0xff4444, 45, 4], [120, 0x8b0000, 78, 4], [160, 0xff6666, 55, 3]].forEach(([delay, color, r, w]) => {
        this.time.delayedCall(delay, () => spawnRing(tx, ty, color, r, w, 28));
      });

      // Dense inner burst
      radialBurst(tx, ty, 70, 5, 38, 1.5, 4, 180, 380);
      // Outer reach particles
      radialBurst(tx, ty, 35, 38, 80, 1, 2.5, 320, 580);
      // Third wave
      this.time.delayedCall(65, () => radialBurst(tx, ty, 45, 5, 30, 1, 3, 200, 360));
    });
  }

  _updateLancerSpears() {
    if (!this.lancerSpears.length) return;
    const now = this.time.now;

    for (const spear of this.lancerSpears) {
      if (!spear.g.active) continue;
      spear.g.clear();

      const elapsed = now - spear.startTime;
      const progress = Math.min(1, elapsed / spear.travelMs);
      const coveredDist = progress * spear.totalLen;
      const { waypoints, segLengths } = spear;

      // Find the current tip position and which segment it's in
      let remaining = coveredDist;
      let tipIdx = 0;
      let tipX = waypoints[0].x, tipY = waypoints[0].y;
      for (let i = 0; i < segLengths.length; i++) {
        if (remaining <= segLengths[i]) {
          const t = segLengths[i] > 0 ? remaining / segLengths[i] : 0;
          tipX = waypoints[i].x + t * (waypoints[i + 1].x - waypoints[i].x);
          tipY = waypoints[i].y + t * (waypoints[i + 1].y - waypoints[i].y);
          tipIdx = i;
          break;
        }
        remaining -= segLengths[i];
        tipIdx = i + 1;
      }

      // Draw each completed segment with layered glow
      const drawSeg = (ax, ay, bx, by) => {
        spear.g.lineStyle(9, 0x8b0000, 0.18);
        spear.g.beginPath(); spear.g.moveTo(ax, ay); spear.g.lineTo(bx, by); spear.g.strokePath();
        spear.g.lineStyle(5, 0xdc143c, 0.55);
        spear.g.beginPath(); spear.g.moveTo(ax, ay); spear.g.lineTo(bx, by); spear.g.strokePath();
        spear.g.lineStyle(2, 0xff4444, 0.85);
        spear.g.beginPath(); spear.g.moveTo(ax, ay); spear.g.lineTo(bx, by); spear.g.strokePath();
        spear.g.lineStyle(1, 0xffffff, 0.95);
        spear.g.beginPath(); spear.g.moveTo(ax, ay); spear.g.lineTo(bx, by); spear.g.strokePath();
      };

      for (let i = 0; i < tipIdx; i++) {
        drawSeg(waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y);
      }
      if (tipIdx < waypoints.length - 1) {
        drawSeg(waypoints[tipIdx].x, waypoints[tipIdx].y, tipX, tipY);
      }

      // Glowing tip: pulsing red/white orb
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.025);
      spear.g.fillStyle(0xdc143c, pulse * 0.45);
      spear.g.fillCircle(tipX, tipY, 13);
      spear.g.fillStyle(0xff4444, pulse * 0.75);
      spear.g.fillCircle(tipX, tipY, 8);
      spear.g.fillStyle(0xffffff, pulse);
      spear.g.fillCircle(tipX, tipY, 4);
    }
  }

  _tryFireUltimate() {
    if (!this.player.data.isAlive) return;
    if (!this.player.canUseAbility("r")) return;
    const ability = this.player.data.abilities["r"];

    // Undying Rage (Berserker R): invulnerability buff — self-cast, no target needed
    if (ability.undyingRage) {
      this.player.useAbility("r");
      this.player.undyingActive = true;
      this.undyingRageEndTime = this.time.now + 5000;
      this._startUndyingRageEffect(this.player);
      if (this.gameSync) {
        this.gameSync.send({ type: "undying_rage", playerId: this.playerId, active: true, roomId: this.roomId });
      }
      const maxHp = this.player.data.stats.maxHealth ?? 700;
      this.time.delayedCall(5000, () => {
        this.player.undyingActive = false;
        this._stopUndyingRageEffect(this.player);
        if (!this.player.poisonActive && this.player.data.stats.health < maxHp * 0.10) {
          this.player.data.stats.health = Math.min(maxHp, this.player.data.stats.health + maxHp * 0.10);
        }
        if (this.gameSync) {
          this.gameSync.send({ type: "undying_rage", playerId: this.playerId, active: false, roomId: this.roomId });
        }
      });
      return;
    }

    // Blind (Archer R): cloak + speed boost — self-cast, no target needed
    if (ability.blind) {
      this.player.useAbility("r");
      this.player.blindActive = true;
      this.player.speedBoostActive = true;
      this.player.sprite.setAlpha(0.4);
      this.blindEndTime = this.time.now + 5000;
      this._playBlindActivateEffect(this.player.sprite.x, this.player.sprite.y);
      const originalQCooldown = this.player.data.abilities.q.cooldown;
      this.player.data.abilities.q.cooldown = 2;
      if (this.gameSync) {
        this.gameSync.send({ type: "blind", playerId: this.playerId, active: true, roomId: this.roomId });
      }
      this.time.delayedCall(5000, () => {
        this.player.blindActive = false;
        this.player.speedBoostActive = false;
        this.player.sprite.setAlpha(1.0);
        this.player.data.abilities.q.cooldown = originalQCooldown;
        if (this.gameSync) {
          this.gameSync.send({ type: "blind", playerId: this.playerId, active: false, roomId: this.roomId });
        }
      });
      return;
    }

    // Rider (Bellerophon): AoE around self — damages + slows all enemies in range, +20% speed per enemy hit for 5s
    if (this.player.data.championKey === "ridder") {
      const speedDuration = ability.speedBoostDuration ?? 5;
      const slowDuration = 3;
      const aoeRadius = ability.aoeRadius ?? 300;
      const aoeDamage = ability.damage ?? 0;
      const targets = this.opponents.filter(opp => {
        if (!opp.data.isAlive) return false;
        const dx = opp.sprite.x - this.player.sprite.x;
        const dy = opp.sprite.y - this.player.sprite.y;
        return Math.hypot(dx, dy) <= aoeRadius;
      });
      if (targets.length === 0) return;

      this.player.useAbility("r");
      this.player._flashAttackSprite();
      this.player.riderSpeedBonus = targets.length * 0.2;
      this.player.speedBoostActive = true;
      this.riderSpeedEndTime = this.time.now + speedDuration * 1000;
      this._playChainJailEffect(targets, slowDuration);

      if (this.gameSync) {
        this.gameSync.send({ type: "ult-fx", champKey: "ridder", attackerId: this.playerId, attackerX: this.player.sprite.x, attackerY: this.player.sprite.y, targetIds: targets.map(t => t.data.id), slowDuration, roomId: this.roomId });
      }

      targets.forEach(target => {
        if (aoeDamage > 0) {
          target.takeDamage(aoeDamage, false, true, false);
          if (target !== this.player && this.gameSync) {
            this.gameSync.send({ type: "hit", attackerId: this.playerId, targetId: target.data.id, damage: aoeDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
          }
        }
        this._applySlowToPlayer(target, slowDuration, 0.2);
        if (this.gameSync) {
          this.gameSync.send({ type: "slow", targetId: target.data.id, duration: slowDuration, slowMult: 0.2, roomId: this.roomId });
        }
      });

      this.time.delayedCall(speedDuration * 1000, () => {
        this.player.speedBoostActive = false;
        this.player.riderSpeedBonus = 0;
      });
      return;
    }
    // Speed boost + damage (Bellerophon): apply boost then fall through to hit target
    if (ability.speedBoost && ability.damage > 0) {
      this.player.speedBoostActive = true;
      this.time.delayedCall((ability.speedBoostDuration ?? 3) * 1000, () => {
        this.player.speedBoostActive = false;
      });
    }

    // Assassin (Zabaniya): teleport behind lowest-HP enemy within 250 range, wait 0.5s, then strike
    if (this.player.data.championKey === "assassin") {
      const teleportRange = 250;
      const assassinTarget = this.opponents
        .filter(opp => opp.data.isAlive && this.player.distanceTo(opp) <= teleportRange)
        .sort((a, b) => a.data.stats.health - b.data.stats.health)[0];
      if (!assassinTarget) return;

      this.player.useAbility("r");
      const fromX = this.player.sprite.x, fromY = this.player.sprite.y;
      const toX = assassinTarget.sprite.x, toY = assassinTarget.sprite.y;

      // Position 50px past the target, in the same approach direction
      const dx = toX - fromX, dy = toY - fromY;
      const dist = Math.hypot(dx, dy) || 1;
      const bx = Phaser.Math.Clamp(toX + (dx / dist) * 50, ARENA_SIZE.padding, ARENA_SIZE.width - ARENA_SIZE.padding);
      const by = Phaser.Math.Clamp(toY + (dy / dist) * 50, ARENA_SIZE.padding, ARENA_SIZE.height - ARENA_SIZE.padding);

      // Black smoke erupts at origin — assassin vanishes
      this._playZabaniyaSmokeOut(fromX, fromY);
      // Snap behind target and go semi-transparent (stealth)
      this.player.sprite.setPosition(bx, by);
      this.player.data.position.x = bx;
      this.player.data.position.y = by;
      // Smoke appears at landing, then gets sucked into the target
      this._playZabaniyaSmokeIn(bx, by, toX, toY);
      this.player.sprite.setAlpha(0.25);
      // Tell the other player to play the smoke effect on their screen
      if (this.gameSync) {
        this.gameSync.send({ type: "ult-fx", champKey: "assassin", attackerId: this.playerId, fromX, fromY, landX: bx, landY: by, targetX: toX, targetY: toY, roomId: this.roomId });
      }

      const damage = Math.round((ability.damage ?? 100) * (this.player._damageMultiplier?.() ?? 1));
      const trueDamage = ability.trueDamage === true;

      // Strike after 500ms delay
      this.time.delayedCall(500, () => {
        if (!this.player?.sprite?.active) return;
        this.player.sprite.setAlpha(1.0);
        this.player._flashAttackSprite();
        this._playZabaniyaStrikeFlash(assassinTarget.sprite.x, assassinTarget.sprite.y);

        if (this.isHost) {
          assassinTarget.takeDamage(damage, trueDamage, true, trueDamage);
          if (this.gameSync) {
            this.gameSync.send({ type: "hit", attackerId: this.playerId, targetId: assassinTarget.data.id, damage, trueDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
          }
          if (!assassinTarget.data.isAlive) {
            this.localKills += 3;
            if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
          }
          if (ability.poison && assassinTarget.data.isAlive) {
            this._applyPoisonToPlayer(assassinTarget, ability.poisonDamage ?? 75, ability.poisonDuration ?? 5);
            if (this.gameSync) {
              this.gameSync.send({ type: "poison", targetId: assassinTarget.data.id, totalDamage: ability.poisonDamage ?? 75, duration: ability.poisonDuration ?? 5, roomId: this.roomId });
            }
          }
        } else {
          assassinTarget.takeDamage(damage, trueDamage, true, trueDamage);
          if (!assassinTarget.data.isAlive) {
            this.localKills += 3;
            if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
          }
          if (ability.poison && assassinTarget.data.isAlive) {
            this._applyPoisonToPlayer(assassinTarget, ability.poisonDamage ?? 75, ability.poisonDuration ?? 5);
          }
          if (this.gameSync) {
            this.gameSync.send({ type: "ultimate", attackerId: this.playerId, targetId: assassinTarget.data.id, roomId: this.roomId });
          }
        }
      });
      return;
    }

    // Saber (Excalibur): requires 1-second charge-up; only starts if an enemy is in range
    if (this.player.data.championKey === "saber" && !this._excaliburChargeComplete) {
      if (!this.excaliburCharging) {
        const chargeTarget = this._nearestLivingOpponent();
        const chargeRange = ability.range ?? 350;
        if (!chargeTarget || this.player.distanceTo(chargeTarget) > chargeRange) return;
        this.excaliburCharging = true;
        this.excaliburLockedTarget = chargeTarget;
        this.excaliburChargeStart = this.time.now;
        this._startExcaliburChargeEffect();
        if (this.gameSync) {
          this.gameSync.send({ type: "ult-fx", champKey: "saber", phase: "charge", attackerId: this.playerId, roomId: this.roomId });
        }
      }
      return;
    }
    this._excaliburChargeComplete = false;

    const target = (this.excaliburLockedTarget?.data?.isAlive ? this.excaliburLockedTarget : null)
      ?? this._nearestLivingOpponent();
    this.excaliburLockedTarget = null;
    if (!target) return;

    this.player.useAbility("r");
    let damage = Math.round((ability.damage ?? 100) * (this.player._damageMultiplier?.() ?? 1));
    const trueDamage = ability.trueDamage === true;

    // Excalibur: +1% damage per 1% missing health on the target, capped at +65%
    if (this.player.data.championKey === "saber") {
      const { health, maxHealth } = target.data.stats;
      const missingPct = Math.max(0, (maxHealth - health) / maxHealth);
      const bonusMult = 1 + Math.min(missingPct, 0.65);
      damage = Math.round(damage * bonusMult);
    }

    this.player._flashAttackSprite();

    const applyDamage = () => {
      if (this.isHost) {
        target.takeDamage(damage, trueDamage, true, trueDamage);
        if (this.gameSync) {
          this.gameSync.send({ type: "hit", attackerId: this.playerId, targetId: target.data.id, damage, trueDamage, abilityKey: "r", roomId: this.roomId, timestamp: Date.now() });
        }
        if (!target.data.isAlive) {
          this.localKills += 3;
          if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
        }
        if (ability.slow) {
          this._applySlowToPlayer(target, ability.slowDuration ?? 3);
          this._applyManaDrain(target, this.playerId);
          if (this.gameSync) {
            this.gameSync.send({ type: "slow", targetId: target.data.id, duration: ability.slowDuration ?? 3, roomId: this.roomId });
          }
        }
        if (ability.armorBroken) {
          this._applyArmorBrokenToPlayer(target, 5);
          if (this.gameSync) {
            this.gameSync.send({ type: "armor-broken", targetId: target.data.id, duration: 5, roomId: this.roomId });
          }
        }
        if (ability.aoeRadius) {
          const cx = target.sprite.x, cy = target.sprite.y;
          const r2 = ability.aoeRadius * ability.aoeRadius;
          for (const opp of this.opponents) {
            if (opp === target || !opp.data.isAlive) continue;
            const dx = opp.sprite.x - cx, dy = opp.sprite.y - cy;
            if (dx * dx + dy * dy <= r2) {
              opp.takeDamage(damage, false, true, false);
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
        this._applyChampionAoE(target, ability, this.mySlot);
      } else {
        target.takeDamage(damage, trueDamage, true, trueDamage);
        if (!target.data.isAlive) {
          this.localKills += 3;
          if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
        }
        if (ability.slow) {
          this._applySlowToPlayer(target, ability.slowDuration ?? 3);
          this._applyManaDrain(target, this.playerId, false);
        }
        if (ability.armorBroken) {
          this._applyArmorBrokenToPlayer(target, 5);
        }
        if (this.gameSync) {
          this.gameSync.send({ type: "ultimate", attackerId: this.playerId, targetId: target.data.id, roomId: this.roomId });
        }
      }
    };

    if (this.player.data.championKey === "saber") {
      this._playExcaliburEffect(this.player.sprite.x, this.player.sprite.y, target.sprite.x, target.sprite.y, ability.aoeRadius ?? 185, target);
      this.time.delayedCall(380, applyDamage);
    } else if (this.player.data.championKey === "mage") {
      this._playRuleBreakerEffect(target.sprite.x, target.sprite.y);
      applyDamage();
    } else if (this.player.data.championKey === "lancer") {
      this._playGaeBolgEffect(this.player.sprite.x, this.player.sprite.y, target.sprite.x, target.sprite.y);
      applyDamage();
    } else {
      this._playUltimateEffect(target.sprite.x, target.sprite.y, ability.aoeRadius ?? 150);
      applyDamage();
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

  // Assassin Zabaniya — Phase 1: dark smoke erupts at the origin (assassin vanishes)
  _playZabaniyaSmokeOut(x, y) {
    const depth = 30;
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.4, 0.4);
      const dist  = Phaser.Math.FloatBetween(35, 75);
      const r     = Phaser.Math.FloatBetween(10, 22);
      const gray  = Phaser.Math.Between(6, 28);
      const color = (gray << 16) | (gray << 8) | gray;
      const delay = Phaser.Math.Between(0, 100);
      const g = this.add.graphics().setDepth(depth);
      g.fillStyle(color, 0.85);
      g.fillCircle(0, 0, r);
      g.setPosition(x, y);
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        scaleX: Phaser.Math.FloatBetween(1.3, 2.0),
        scaleY: Phaser.Math.FloatBetween(1.3, 2.0),
        alpha: 0,
        delay,
        duration: Phaser.Math.Between(380, 580),
        ease: "Cubic.easeOut",
        onComplete: () => g.destroy()
      });
    }
    const ring = this.add.graphics().setDepth(depth);
    ring.lineStyle(3, 0x0a0a0a, 1);
    ring.strokeCircle(0, 0, 38);
    ring.setPosition(x, y);
    ring.setScale(0.1);
    this.tweens.add({
      targets: ring,
      scaleX: 1.8, scaleY: 1.8, alpha: 0,
      duration: 420, ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  // Assassin Zabaniya — Phase 2: smoke appears at landing spot, then gets sucked into suckX/suckY
  _playZabaniyaSmokeIn(landX, landY, suckX, suckY) {
    const depth = 30;
    const puffs = [];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      const outDist = Phaser.Math.FloatBetween(25, 55);
      const r      = Phaser.Math.FloatBetween(12, 24);
      const gray   = Phaser.Math.Between(6, 22);
      const color  = (gray << 16) | (gray << 8) | gray;
      const delay  = Phaser.Math.Between(0, 60);
      const g = this.add.graphics().setDepth(depth);
      g.fillStyle(color, 0.9);
      g.fillCircle(0, 0, r);
      g.setPosition(landX, landY);
      g.setAlpha(0);
      puffs.push(g);
      this.tweens.add({
        targets: g,
        x: landX + Math.cos(angle) * outDist,
        y: landY + Math.sin(angle) * outDist,
        alpha: 0.9, delay, duration: 180, ease: "Cubic.easeOut"
      });
    }
    // At 280ms: suck all puffs back toward target
    this.time.delayedCall(280, () => {
      puffs.forEach(g => {
        if (!g.active) return;
        this.tweens.add({
          targets: g,
          x: suckX, y: suckY,
          scaleX: 0.15, scaleY: 0.15, alpha: 0,
          duration: 200, ease: "Cubic.easeIn",
          onComplete: () => g.destroy()
        });
      });
      // Converging dark rings
      for (let i = 0; i < 3; i++) {
        const startR = 50 + i * 18;
        const rg = this.add.graphics().setDepth(depth + 1);
        rg.lineStyle(2, 0x1a0a2e, 0.8 - i * 0.15);
        rg.strokeCircle(0, 0, startR);
        rg.setPosition(suckX, suckY);
        this.time.delayedCall(i * 35, () => {
          this.tweens.add({
            targets: rg,
            scaleX: 0.05, scaleY: 0.05, alpha: 0,
            duration: 210, ease: "Cubic.easeIn",
            onComplete: () => rg.destroy()
          });
        });
      }
    });
  }

  // Assassin Zabaniya — Phase 3: dark implosion + stab burst at target position
  _playZabaniyaStrikeFlash(x, y) {
    const depth = 30;
    // Dark burst
    const burst = this.add.graphics().setDepth(depth + 3);
    burst.fillStyle(0x0d0208, 0.85);
    burst.fillCircle(0, 0, 45);
    burst.setPosition(x, y);
    burst.setScale(0.05);
    this.tweens.add({
      targets: burst,
      scaleX: 1.6, scaleY: 1.6, alpha: 0,
      duration: 380, ease: "Cubic.easeOut",
      onComplete: () => burst.destroy()
    });
    // Dark outer ring
    const ring = this.add.graphics().setDepth(depth + 3);
    ring.lineStyle(4, 0x2d0050, 1);
    ring.strokeCircle(0, 0, 55);
    ring.setPosition(x, y);
    ring.setScale(0.05);
    this.tweens.add({
      targets: ring,
      scaleX: 1.5, scaleY: 1.5, alpha: 0,
      duration: 450, ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
    // Blood-red sparks
    for (let i = 0; i < 7; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const d = Phaser.Math.FloatBetween(12, 55);
      const spark = this.add.graphics().setDepth(depth + 4);
      spark.fillStyle(0x8b0000, 0.9);
      spark.fillCircle(0, 0, Phaser.Math.FloatBetween(3, 7));
      spark.setPosition(x, y);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        alpha: 0,
        duration: Phaser.Math.Between(300, 520),
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy()
      });
    }
  }

  _playBlindActivateEffect(x, y) {
    const depth = 25;

    // Blinding white-silver core flash — sharp overexposure burst
    const core = this.add.graphics().setDepth(depth + 3);
    core.fillStyle(0xffffff, 1);
    core.fillCircle(0, 0, 48);
    core.setPosition(x, y).setScale(0.3);
    this.tweens.add({ targets: core, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 280, ease: "Cubic.easeOut", onComplete: () => core.destroy() });

    // Second delayed silver pulse — double-flash for impact
    this.time.delayedCall(70, () => {
      const pulse = this.add.graphics().setDepth(depth + 3);
      pulse.fillStyle(0xe0e0e0, 0.75);
      pulse.fillCircle(0, 0, 38);
      pulse.setPosition(x, y).setScale(0.2);
      this.tweens.add({ targets: pulse, scaleX: 2.4, scaleY: 2.4, alpha: 0, duration: 320, ease: "Cubic.easeOut", onComplete: () => pulse.destroy() });
    });

    // Expanding white shockwave ring
    const ring = this.add.graphics().setDepth(depth + 1);
    ring.lineStyle(5, 0xffffff, 0.9);
    ring.strokeCircle(0, 0, 90);
    ring.setPosition(x, y).setScale(0.1);
    this.tweens.add({ targets: ring, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 500, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });

    // Secondary gold-tinted ring — sharper and faster
    const ring2 = this.add.graphics().setDepth(depth + 1);
    ring2.lineStyle(3, 0xf0d080, 0.8);
    ring2.strokeCircle(0, 0, 70);
    ring2.setPosition(x, y).setScale(0.1);
    this.tweens.add({ targets: ring2, scaleX: 2.6, scaleY: 2.6, alpha: 0, duration: 380, ease: "Cubic.easeOut", onComplete: () => ring2.destroy() });

    // 16 blade streaks radiating outward — Reality Marble projection burst
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const len = 18 + Math.random() * 14;
      const dist = 80 + Math.random() * 70;
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist;
      const streak = this.add.graphics().setDepth(depth + 2);
      streak.fillStyle(0xd4d4d4, 1);
      streak.fillRect(-2, -len, 4, len);
      streak.lineStyle(1, 0xffffff, 0.9);
      streak.strokeRect(-2, -len, 4, len);
      streak.setPosition(x, y);
      streak.setRotation(angle - Math.PI / 2);
      this.tweens.add({
        targets: streak,
        x: tx,
        y: ty,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 320 + Math.random() * 180,
        ease: "Cubic.easeOut",
        onComplete: () => streak.destroy()
      });
    }

    // Silver sparkle dots — precision glints
    for (let i = 0; i < 14; i++) {
      this.time.delayedCall(i * 10, () => {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 60;
        const dot = this.add.graphics().setDepth(depth + 2);
        const col = [0xffffff, 0xe8e8e8, 0xf0d080][Math.floor(Math.random() * 3)];
        dot.fillStyle(col, 0.95);
        dot.fillCircle(0, 0, 3 + Math.random() * 3.5);
        dot.setPosition(x + Math.cos(a) * r * 0.08, y + Math.sin(a) * r * 0.08);
        this.tweens.add({
          targets: dot,
          x: x + Math.cos(a) * r,
          y: y + Math.sin(a) * r,
          alpha: 0,
          scaleX: 0.2,
          scaleY: 0.2,
          duration: 400 + Math.random() * 200,
          ease: "Cubic.easeOut",
          onComplete: () => dot.destroy()
        });
      });
    }
  }

  _playRuleBreakerEffect(x, y) {
    const depth = 25;

    // Central white-violet implosion flash — large blinding burst
    const core = this.add.graphics().setDepth(depth + 3);
    core.fillStyle(0xffffff, 1);
    core.fillCircle(0, 0, 55);
    core.setPosition(x, y);
    this.tweens.add({ targets: core, alpha: 0, scaleX: 0.1, scaleY: 0.1, duration: 220, ease: "Cubic.easeIn", onComplete: () => core.destroy() });

    // Second white pulse — slightly delayed so the flash has two beats
    this.time.delayedCall(80, () => {
      const pulse = this.add.graphics().setDepth(depth + 3);
      pulse.fillStyle(0xff88ff, 0.8);
      pulse.fillCircle(0, 0, 45);
      pulse.setPosition(x, y).setScale(0.2);
      this.tweens.add({ targets: pulse, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 300, ease: "Cubic.easeOut", onComplete: () => pulse.destroy() });
    });

    // Inner violet bloom — big and saturated
    const bloom = this.add.graphics().setDepth(depth + 2);
    bloom.fillStyle(0xcc00ff, 0.75);
    bloom.fillCircle(0, 0, 90);
    bloom.setPosition(x, y).setScale(0.08);
    this.tweens.add({ targets: bloom, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 500, ease: "Cubic.easeOut", onComplete: () => bloom.destroy() });

    // Outer violet shockwave ring — thick and wide
    const ring = this.add.graphics().setDepth(depth + 1);
    ring.lineStyle(8, 0x9b00ff, 1);
    ring.strokeCircle(0, 0, 130);
    ring.setPosition(x, y).setScale(0.04);
    this.tweens.add({ targets: ring, scaleX: 1.1, scaleY: 1.1, alpha: 0, duration: 600, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });

    // Secondary cyan shockwave ring
    const ring2 = this.add.graphics().setDepth(depth + 1);
    ring2.lineStyle(5, 0x00d4ff, 0.9);
    ring2.strokeCircle(0, 0, 100);
    ring2.setPosition(x, y).setScale(0.05);
    this.tweens.add({ targets: ring2, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 520, ease: "Cubic.easeOut", onComplete: () => ring2.destroy() });

    // Third thin fast ring — snappy leading edge
    const ring3 = this.add.graphics().setDepth(depth + 1);
    ring3.lineStyle(3, 0xffffff, 0.7);
    ring3.strokeCircle(0, 0, 80);
    ring3.setPosition(x, y).setScale(0.05);
    this.tweens.add({ targets: ring3, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 350, ease: "Cubic.easeOut", onComplete: () => ring3.destroy() });

    // Shards — 20 large sharp fragments flying outward
    const palette = [0xcc00ff, 0x9b00ff, 0x00d4ff, 0xffffff, 0xff66ff, 0xaa44ff];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 100 + Math.random() * 80;
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist;
      const len = 14 + Math.random() * 16;
      const color = palette[Math.floor(Math.random() * palette.length)];
      const shard = this.add.graphics().setDepth(depth + 2);
      shard.fillStyle(color, 1);
      shard.fillTriangle(0, -len, len * 0.3, len * 0.6, -len * 0.3, len * 0.6);
      // Bright white core line on each shard for extra pop
      shard.lineStyle(1.5, 0xffffff, 0.8);
      shard.strokeTriangle(0, -len, len * 0.3, len * 0.6, -len * 0.3, len * 0.6);
      shard.setPosition(x, y);
      shard.setRotation(angle + Math.PI / 2);
      this.tweens.add({
        targets: shard,
        x: tx,
        y: ty,
        alpha: 0,
        scaleX: 0.15,
        scaleY: 0.15,
        duration: 350 + Math.random() * 200,
        ease: "Cubic.easeOut",
        onComplete: () => shard.destroy()
      });
    }

    // Sparkle burst — 20 large glowing dots fanning outward
    for (let i = 0; i < 20; i++) {
      this.time.delayedCall(i * 12, () => {
        const angle = Math.random() * Math.PI * 2;
        const r = 30 + Math.random() * 70;
        const dot = this.add.graphics().setDepth(depth + 1);
        dot.fillStyle(palette[Math.floor(Math.random() * palette.length)], 0.95);
        dot.fillCircle(0, 0, 4 + Math.random() * 5);
        dot.setPosition(x + Math.cos(angle) * r * 0.1, y + Math.sin(angle) * r * 0.1);
        this.tweens.add({
          targets: dot,
          x: x + Math.cos(angle) * r,
          y: y + Math.sin(angle) * r,
          alpha: 0,
          scaleX: 0.3,
          scaleY: 0.3,
          duration: 450 + Math.random() * 250,
          ease: "Cubic.easeOut",
          onComplete: () => dot.destroy()
        });
      });
    }
  }

  _startUndyingRageEffect(player) {
    const x = player.sprite.x, y = player.sprite.y;
    const depth = 20;

    // Core flash — bright white-red centre
    const core = this.add.graphics().setDepth(depth + 2);
    core.fillStyle(0xffffff, 0.9);
    core.fillCircle(0, 0, 28);
    core.setPosition(x, y);
    this.tweens.add({ targets: core, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 200, ease: "Cubic.easeIn", onComplete: () => core.destroy() });

    // Inner blast — deep red, expands fast
    const inner = this.add.graphics().setDepth(depth + 1);
    inner.fillStyle(0xcc0000, 0.75);
    inner.fillCircle(0, 0, 45);
    inner.setPosition(x, y).setScale(0.1);
    this.tweens.add({ targets: inner, scaleX: 1, scaleY: 1, alpha: 0, duration: 350, ease: "Cubic.easeOut", onComplete: () => inner.destroy() });

    // Mid ring — orange-red expanding ring
    const mid = this.add.graphics().setDepth(depth);
    mid.lineStyle(5, 0xff4400, 1);
    mid.strokeCircle(0, 0, 70);
    mid.setPosition(x, y).setScale(0.05);
    this.tweens.add({ targets: mid, scaleX: 1, scaleY: 1, alpha: 0, duration: 500, ease: "Cubic.easeOut", onComplete: () => mid.destroy() });

    // Outer shockwave — thin fast ring
    const outer = this.add.graphics().setDepth(depth);
    outer.lineStyle(2, 0xff2200, 0.7);
    outer.strokeCircle(0, 0, 110);
    outer.setPosition(x, y).setScale(0.05);
    this.tweens.add({ targets: outer, scaleX: 1, scaleY: 1, alpha: 0, duration: 700, ease: "Cubic.easeOut", onComplete: () => outer.destroy() });

    // Ground scorch — fades slowly
    const scorch = this.add.graphics().setDepth(depth - 1);
    scorch.fillStyle(0x330000, 0.55);
    scorch.fillEllipse(0, 0, 90, 45);
    scorch.setPosition(x, y);
    this.tweens.add({ targets: scorch, alpha: 0, duration: 1200, ease: "Linear", onComplete: () => scorch.destroy() });
  }

  _stopUndyingRageEffect(player) {
    // Small dissipating flash when the buff expires
    const x = player.sprite.x, y = player.sprite.y;
    const fade = this.add.graphics().setDepth(20);
    fade.lineStyle(3, 0xff2200, 0.8);
    fade.strokeCircle(0, 0, 40);
    fade.setPosition(x, y);
    this.tweens.add({ targets: fade, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 400, ease: "Cubic.easeOut", onComplete: () => fade.destroy() });
  }

  _startExcaliburChargeEffect() {
    // Pulsing golden glow at Saber's position
    const glow = this.add.graphics();
    glow.fillStyle(0xffd700, 0.18);
    glow.fillCircle(0, 0, 32);
    glow.setPosition(this.player.sprite.x, this.player.sprite.y).setDepth(19);
    this.excaliburChargeGraphic = glow;
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.18, to: 0.55 },
      scaleX: { from: 0.6, to: 1.3 },
      scaleY: { from: 0.6, to: 1.3 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Particles fly inward toward Saber from a surrounding ring
    const spawnParticle = () => {
      if (!this.excaliburCharging) return;
      const tx = this.player.sprite.x;
      const ty = this.player.sprite.y;
      const angle = Math.random() * Math.PI * 2;
      const dist = 85 + Math.random() * 75;
      const sx = tx + Math.cos(angle) * dist;
      const sy = ty + Math.sin(angle) * dist;
      const size = 1.5 + Math.random() * 2.5;
      const palette = [0xffd700, 0xfffacd, 0xffa500, 0xffffff, 0xffe066];
      const color = palette[Math.floor(Math.random() * palette.length)];
      const p = this.add.graphics();
      p.fillStyle(color, 1);
      p.fillCircle(0, 0, size);
      p.setPosition(sx, sy).setDepth(21);
      this.tweens.add({
        targets: p,
        x: tx,
        y: ty,
        alpha: 0,
        duration: 450 + Math.random() * 350,
        ease: "Cubic.easeIn",
        onComplete: () => p.destroy()
      });
    };

    // Initial burst so the effect is immediately visible
    for (let i = 0; i < 30; i++) {
      this.time.delayedCall(i * 15, spawnParticle);
    }

    // Spawn 3 particles per tick for a dense stream
    this.excaliburChargeTimer = this.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => { spawnParticle(); spawnParticle(); spawnParticle(); }
    });
  }

  _cancelExcaliburCharge() {
    this.excaliburCharging = false;
    this.excaliburLockedTarget = null;
    if (this.gameSync) {
      this.gameSync.send({ type: "ult-fx", champKey: "saber", phase: "charge-end", attackerId: this.playerId, roomId: this.roomId });
    }
    if (this.excaliburChargeTimer) {
      this.excaliburChargeTimer.remove();
      this.excaliburChargeTimer = null;
    }
    if (this.excaliburChargeGraphic) {
      this.tweens.killTweensOf(this.excaliburChargeGraphic);
      this.excaliburChargeGraphic.destroy();
      this.excaliburChargeGraphic = null;
    }
  }

  _startExcaliburChargeEffectOnPlayer(player) {
    const glow = this.add.graphics();
    glow.fillStyle(0xffd700, 0.18);
    glow.fillCircle(0, 0, 32);
    glow.setPosition(player.sprite.x, player.sprite.y).setDepth(19);
    player._excaliburChargeGraphic = glow;
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.18, to: 0.55 },
      scaleX: { from: 0.6, to: 1.3 },
      scaleY: { from: 0.6, to: 1.3 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    const spawnParticle = () => {
      if (!player._excaliburCharging || !player.sprite?.active) return;
      const tx = player.sprite.x;
      const ty = player.sprite.y;
      glow.setPosition(tx, ty);
      const angle = Math.random() * Math.PI * 2;
      const dist = 85 + Math.random() * 75;
      const sx = tx + Math.cos(angle) * dist;
      const sy = ty + Math.sin(angle) * dist;
      const size = 1.5 + Math.random() * 2.5;
      const palette = [0xffd700, 0xfffacd, 0xffa500, 0xffffff, 0xffe066];
      const color = palette[Math.floor(Math.random() * palette.length)];
      const p = this.add.graphics();
      p.fillStyle(color, 1);
      p.fillCircle(0, 0, size);
      p.setPosition(sx, sy).setDepth(21);
      this.tweens.add({
        targets: p,
        x: tx,
        y: ty,
        alpha: 0,
        duration: 450 + Math.random() * 350,
        ease: "Cubic.easeIn",
        onComplete: () => p.destroy()
      });
    };

    player._excaliburCharging = true;
    for (let i = 0; i < 30; i++) {
      this.time.delayedCall(i * 15, spawnParticle);
    }
    player._excaliburChargeTimer = this.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => { spawnParticle(); spawnParticle(); spawnParticle(); }
    });
  }

  _cancelExcaliburChargeOnPlayer(player) {
    player._excaliburCharging = false;
    if (player._excaliburChargeTimer) {
      player._excaliburChargeTimer.remove();
      player._excaliburChargeTimer = null;
    }
    if (player._excaliburChargeGraphic) {
      this.tweens.killTweensOf(player._excaliburChargeGraphic);
      player._excaliburChargeGraphic.destroy();
      player._excaliburChargeGraphic = null;
    }
  }

  _playExcaliburEffect(fromX, fromY, toX, toY, aoeRadius, targetRef) {
    const travelMs = 380;

    // --- origin flash (immediate, sword release) ---
    const originFlash = this.add.graphics();
    originFlash.setPosition(fromX, fromY).setDepth(31);
    originFlash.fillStyle(0xfffacd, 1);
    originFlash.fillCircle(0, 0, 32);
    this.tweens.add({
      targets: originFlash,
      alpha: 0, scaleX: 2.8, scaleY: 2.8,
      duration: 420, ease: "Cubic.easeOut",
      onComplete: () => originFlash.destroy()
    });

    // Small burst of golden sparks at origin
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = this.add.graphics();
      sp.fillStyle(i % 3 === 0 ? 0xffffff : 0xffd700, 1);
      sp.fillCircle(0, 0, 1.5 + Math.random() * 2);
      sp.setPosition(fromX, fromY).setDepth(31);
      this.tweens.add({
        targets: sp,
        x: fromX + Math.cos(a) * (20 + Math.random() * 45),
        y: fromY + Math.sin(a) * (20 + Math.random() * 45),
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 260 + Math.random() * 180, ease: "Cubic.easeOut",
        onComplete: () => sp.destroy()
      });
    }

    // Helper: resolve live target position (tracks the champion if targetRef provided)
    const getLiveTarget = () => {
      if (targetRef?.sprite?.active) return { x: targetRef.sprite.x, y: targetRef.sprite.y };
      return { x: toX, y: toY };
    };

    // --- traveling beam — re-aims each frame so it chases the target ---
    const initAngle = Math.atan2(toY - fromY, toX - fromX);
    const beamG = this.add.graphics().setDepth(30).setPosition(fromX, fromY).setRotation(initAngle);
    const beamState = { progress: 0 };

    this.tweens.add({
      targets: beamState,
      progress: 1,
      duration: travelMs,
      ease: "Quartic.easeIn",
      onUpdate: () => {
        const { x: curToX, y: curToY } = getLiveTarget();
        const curAngle = Math.atan2(curToY - fromY, curToX - fromX);
        const curBeamLen = Math.hypot(curToX - fromX, curToY - fromY) + aoeRadius * 0.6;
        const drawLen = curBeamLen * beamState.progress;
        beamG.setRotation(curAngle);
        beamG.clear();
        // outer golden glow
        beamG.fillStyle(0xffd700, 0.22);
        beamG.fillRect(0, -22, drawLen, 44);
        // mid warm layer
        beamG.fillStyle(0xffa500, 0.52);
        beamG.fillRect(0, -12, drawLen, 24);
        // bright core
        beamG.fillStyle(0xfffacd, 0.95);
        beamG.fillRect(0, -5, drawLen, 10);
        // blazing white tip
        if (drawLen > 4) {
          beamG.fillStyle(0xffffff, 0.9);
          beamG.fillRect(drawLen - 4, -8, 8, 16);
        }
      },
      onComplete: () => {
        // Snap beam to final target position for the linger fade
        const { x: finalX, y: finalY } = getLiveTarget();
        const finalAngle = Math.atan2(finalY - fromY, finalX - fromX);
        const finalLen = Math.hypot(finalX - fromX, finalY - fromY) + aoeRadius * 0.6;
        beamG.setRotation(finalAngle);
        beamG.clear();
        beamG.fillStyle(0xffd700, 0.22); beamG.fillRect(0, -22, finalLen, 44);
        beamG.fillStyle(0xffa500, 0.52); beamG.fillRect(0, -12, finalLen, 24);
        beamG.fillStyle(0xfffacd, 0.95); beamG.fillRect(0, -5, finalLen, 10);

        // Beam lingers then fades out
        this.tweens.add({
          targets: beamG,
          alpha: 0,
          duration: 550,
          ease: "Cubic.easeOut",
          onComplete: () => beamG.destroy()
        });

        // Resolve impact position at the moment the beam arrives
        const impactX = finalX, impactY = finalY;

        // --- impact explosion ---
        const blast = this.add.graphics();
        blast.setPosition(impactX, impactY).setDepth(31);
        blast.fillStyle(0xffffff, 1);
        blast.fillCircle(0, 0, 45);
        this.tweens.add({
          targets: blast,
          alpha: 0, scaleX: 1.8, scaleY: 1.8,
          duration: 320, ease: "Cubic.easeOut",
          onComplete: () => blast.destroy()
        });

        this.time.delayedCall(50, () => {
          const blast2 = this.add.graphics();
          blast2.setPosition(impactX, impactY).setDepth(30);
          blast2.fillStyle(0xffd700, 0.9);
          blast2.fillCircle(0, 0, aoeRadius * 0.5);
          blast2.fillStyle(0xffa500, 0.6);
          blast2.fillCircle(0, 0, aoeRadius * 0.8);
          this.tweens.add({
            targets: blast2,
            alpha: 0, scaleX: 1.6, scaleY: 1.6,
            duration: 550, ease: "Cubic.easeOut",
            onComplete: () => blast2.destroy()
          });
        });

        // --- expanding rings ---
        [[0, 0xffffff, 5, aoeRadius * 0.6], [40, 0xffd700, 5, aoeRadius], [100, 0xffa500, 10, aoeRadius]].forEach(([delay, color, lw, r]) => {
          this.time.delayedCall(delay, () => {
            const ring = this.add.graphics();
            ring.lineStyle(lw, color, delay === 100 ? 0.4 : 1);
            ring.strokeCircle(0, 0, r);
            ring.setPosition(impactX, impactY).setScale(0.05).setDepth(delay === 100 ? 29 : 30);
            this.tweens.add({
              targets: ring, scaleX: 1, scaleY: 1, alpha: 0,
              duration: delay === 100 ? 900 : 650, ease: "Cubic.easeOut",
              onComplete: () => ring.destroy()
            });
          });
        });

        // --- light rays ---
        const RAY_COUNT = 12;
        for (let i = 0; i < RAY_COUNT; i++) {
          const rayAngle = (i / RAY_COUNT) * Math.PI * 2;
          const rayLen = aoeRadius * (0.55 + Math.random() * 0.7);
          const ray = this.add.graphics();
          ray.setDepth(29);
          ray.lineStyle(2 + Math.random() * 3, i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xffd700 : 0xffa500, 0.85);
          ray.beginPath();
          ray.moveTo(impactX, impactY);
          ray.lineTo(impactX + Math.cos(rayAngle) * rayLen, impactY + Math.sin(rayAngle) * rayLen);
          ray.strokePath();
          this.tweens.add({
            targets: ray,
            alpha: 0,
            duration: 380 + Math.random() * 320, ease: "Cubic.easeOut",
            onComplete: () => ray.destroy()
          });
        }

        // --- particle burst at impact ---
        for (let i = 0; i < 45; i++) {
          const a = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * 70;
          const gp = this.add.graphics();
          gp.fillStyle([0xffffff, 0xffd700, 0xffa500, 0xfffacd][Math.floor(Math.random() * 4)], 1);
          gp.fillCircle(0, 0, 1.5 + Math.random() * 3);
          gp.setPosition(impactX, impactY).setDepth(31);
          this.tweens.add({
            targets: gp,
            x: impactX + Math.cos(a) * dist,
            y: impactY + Math.sin(a) * dist,
            alpha: 0, scaleX: 0.1, scaleY: 0.1,
            duration: 250 + Math.random() * 300, ease: "Cubic.easeOut",
            onComplete: () => gp.destroy()
          });
        }
      }
    });
  }

  playAttackEffect(target, abilityKey, overrideColor, attackerInfo = null) {
    if (!target) return;
    if (attackerInfo?.champKey === "saber" && abilityKey === "q") {
      this._playSaberSlashEffect(attackerInfo.x, attackerInfo.y, target.sprite.x, target.sprite.y);
      return;
    }
    if (attackerInfo?.champKey === "warrior" && abilityKey === "q") {
      this._playBerserkerSlashEffect(attackerInfo.x, attackerInfo.y, target.sprite.x, target.sprite.y);
      return;
    }
    if (attackerInfo?.champKey === "archer" && abilityKey === "q") {
      this._playArcherProjectileEffect(attackerInfo.x, attackerInfo.y, target.sprite.x, target.sprite.y);
      return;
    }
    if (attackerInfo?.champKey === "assassin" && abilityKey === "q") {
      this._playAssassinShadowEffect(target.sprite.x, target.sprite.y, attackerInfo.x, attackerInfo.y);
      return;
    }
    if (attackerInfo?.champKey === "ridder" && abilityKey === "q") {
      this._playRiderChainEffect(attackerInfo.x, attackerInfo.y, target.sprite.x, target.sprite.y);
      return;
    }
    if (attackerInfo?.champKey === "lancer" && abilityKey === "q") {
      this._playLancerSpearEffect(attackerInfo.x, attackerInfo.y, target.sprite.x, target.sprite.y);
      return;
    }
    if (attackerInfo?.champKey === "mage" && abilityKey === "q") {
      this._playCasterFireballEffect(attackerInfo.x, attackerInfo.y, target.sprite.x, target.sprite.y);
      return;
    }
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

  _playLancerSpearEffect(fromX, fromY, toX, toY) {
    const depth = 22;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const rotation = angle - Math.PI / 2;
    const perpAngle = angle + Math.PI / 2;

    // Spear shaft — long, thin, crimson
    const spear = this.add.graphics().setDepth(depth + 3);
    // Shaft
    spear.fillStyle(0xcc1111, 1);
    spear.fillRect(-2.5, -42, 5, 36);
    // Bright core line
    spear.fillStyle(0xff6644, 1);
    spear.fillRect(-0.8, -42, 1.6, 36);
    // Long pointed tip
    spear.fillStyle(0xff2200, 1);
    spear.fillTriangle(0, -54, 4, -42, -4, -42);
    // Bright edge on tip
    spear.lineStyle(1, 0xff8866, 0.8);
    spear.strokeTriangle(0, -54, 4, -42, -4, -42);
    // Butt end — small dark nub
    spear.fillStyle(0x660000, 1);
    spear.fillRect(-3, -6, 6, 6);
    spear.setPosition(fromX, fromY);
    spear.setRotation(rotation);

    let trailFrame = 0;
    this.tweens.add({
      targets: spear,
      x: toX,
      y: toY,
      duration: 140,
      ease: "Cubic.easeIn",
      onUpdate: () => {
        trailFrame++;
        if (trailFrame % 2 !== 0) return;
        const trail = this.add.graphics().setDepth(depth + 1);
        trail.fillStyle(0xcc1111, 0.45);
        trail.fillRect(-2, -38, 4, 38);
        trail.fillStyle(0xff4422, 0.3);
        trail.fillRect(-0.5, -38, 1, 38);
        trail.setPosition(spear.x, spear.y);
        trail.setRotation(rotation);
        this.tweens.add({ targets: trail, alpha: 0, duration: 110, ease: "Linear", onComplete: () => trail.destroy() });
      },
      onComplete: () => {
        spear.destroy();

        // Piercing spike — thin crimson shape pointing forward from impact
        const spike = this.add.graphics().setDepth(depth + 4);
        spike.fillStyle(0xff2200, 0.95);
        spike.fillTriangle(0, -28, 3, 0, -3, 0);
        spike.lineStyle(1, 0xff8866, 0.8);
        spike.strokeTriangle(0, -28, 3, 0, -3, 0);
        spike.setPosition(toX, toY);
        spike.setRotation(rotation);
        this.tweens.add({ targets: spike, alpha: 0, scaleY: 1.4, duration: 220, ease: "Cubic.easeOut", onComplete: () => spike.destroy() });

        // Brief crimson flash at impact
        const flash = this.add.graphics().setDepth(depth + 5);
        flash.fillStyle(0xff4422, 0.85);
        flash.fillCircle(0, 0, 12);
        flash.setPosition(toX, toY).setScale(0.4);
        this.tweens.add({ targets: flash, scaleX: 1.9, scaleY: 1.9, alpha: 0, duration: 170, ease: "Cubic.easeOut", onComplete: () => flash.destroy() });

        // 8 blood droplets scatter in a forward cone — in the direction of the thrust
        for (let i = 0; i < 8; i++) {
          const sp = this.add.graphics().setDepth(depth + 3);
          sp.fillStyle([0xff2200, 0xcc0000, 0xff4422, 0x990000][i % 4], 1);
          sp.fillCircle(0, 0, 2 + Math.random() * 2.5);
          sp.setPosition(toX, toY);
          // Cone biased forward along the spear direction — tight spread
          const spread = (Math.random() - 0.5) * Math.PI * 0.7;
          const dropAngle = angle + spread;
          const dist = 20 + Math.random() * 40;
          this.tweens.add({
            targets: sp,
            x: toX + Math.cos(dropAngle) * dist,
            y: toY + Math.sin(dropAngle) * dist,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.2,
            duration: 200 + Math.random() * 140,
            ease: "Cubic.easeOut",
            onComplete: () => sp.destroy()
          });
        }

        // 2 thin perpendicular sparks — like the spear skimmed through
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 1 : -1;
          const sk = this.add.graphics().setDepth(depth + 3);
          sk.fillStyle(0xff6644, 0.9);
          sk.fillRect(-1, -12, 2, 12);
          sk.setPosition(toX, toY);
          sk.setRotation(perpAngle);
          this.tweens.add({
            targets: sk,
            x: toX + Math.cos(perpAngle) * side * 18,
            y: toY + Math.sin(perpAngle) * side * 18,
            alpha: 0,
            duration: 180,
            ease: "Cubic.easeOut",
            onComplete: () => sk.destroy()
          });
        }
      }
    });
  }

  _playCasterFireballEffect(fromX, fromY, toX, toY) {
    const depth = 22;
    const aoeRadius = 110;

    // Orb body — smaller (radius 5 core, 8 glow ring)
    const orb = this.add.graphics().setDepth(depth + 3);
    orb.fillStyle(0xcc44ff, 0.9);
    orb.fillCircle(0, 0, 5);
    orb.fillStyle(0xee99ff, 0.75);
    orb.fillCircle(0, 0, 3);
    orb.fillStyle(0xffffff, 0.9);
    orb.fillCircle(0, 0, 1.5);
    orb.lineStyle(3, 0x9900cc, 0.4);
    orb.strokeCircle(0, 0, 8);
    orb.setPosition(fromX, fromY);

    let trailFrame = 0;
    this.tweens.add({
      targets: orb,
      x: toX,
      y: toY,
      duration: 80,
      ease: "Cubic.easeIn",
      onUpdate: () => {
        trailFrame++;
        if (trailFrame % 2 !== 0) return;
        const trail = this.add.graphics().setDepth(depth + 1);
        trail.fillStyle(0xaa33ee, 0.5);
        trail.fillCircle(0, 0, 4);
        trail.fillStyle(0xdd88ff, 0.3);
        trail.fillCircle(0, 0, 2.5);
        trail.setPosition(orb.x, orb.y);
        this.tweens.add({ targets: trail, alpha: 0, scale: 0.2, duration: 110, ease: "Linear", onComplete: () => trail.destroy() });
      },
      onComplete: () => {
        orb.destroy();

        // AOE bloom ring — smaller, expands to 45px
        const bloom = this.add.graphics().setDepth(depth + 2);
        bloom.lineStyle(2.5, 0xcc44ff, 0.9);
        bloom.strokeCircle(0, 0, 1);
        bloom.setPosition(toX, toY);
        this.tweens.add({
          targets: bloom,
          scaleX: 45,
          scaleY: 45,
          alpha: 0,
          duration: 300,
          ease: "Cubic.easeOut",
          onComplete: () => bloom.destroy()
        });

        // Inner flash — smaller
        const flash = this.add.graphics().setDepth(depth + 5);
        flash.fillStyle(0xee88ff, 0.85);
        flash.fillCircle(0, 0, 10);
        flash.setPosition(toX, toY).setScale(0.5);
        this.tweens.add({ targets: flash, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 180, ease: "Cubic.easeOut", onComplete: () => flash.destroy() });

        // 6 purple sparks — tighter spread
        for (let i = 0; i < 6; i++) {
          const sp = this.add.graphics().setDepth(depth + 3);
          sp.fillStyle([0xcc44ff, 0xaa00ee, 0xff88ff, 0x9900cc][i % 4], 0.9);
          sp.fillCircle(0, 0, 1.5 + Math.random() * 2);
          sp.setPosition(toX, toY);
          const a = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.5;
          const dist = 12 + Math.random() * 28;
          this.tweens.add({ targets: sp, x: toX + Math.cos(a) * dist, y: toY + Math.sin(a) * dist, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 200 + Math.random() * 80, ease: "Cubic.easeOut", onComplete: () => sp.destroy() });
        }

        // Lightning chains to any target within aoeRadius
        const allTargets = [
          ...this.opponents.filter(o => o.data.isAlive),
          ...this.creeps.filter(c => c.isAlive),
          ...this.twitches.filter(t => t.isAlive),
          ...this.casterMinions.filter(c => c.isAlive),
        ];
        const nearby = allTargets.filter(t => {
          const tx = t.sprite.x, ty = t.sprite.y;
          return Math.hypot(tx - toX, ty - toY) <= aoeRadius && (tx !== toX || ty !== toY);
        });

        nearby.forEach((tgt, idx) => {
          this.time.delayedCall(30 + idx * 20, () => {
            const tx = tgt.sprite.x, ty = tgt.sprite.y;
            const segments = 8;
            const dx = (tx - toX) / segments;
            const dy = (ty - toY) / segments;

            // Build shared zigzag points so glow + core follow the same path
            const pts = [{ x: toX, y: toY }];
            for (let s = 1; s <= segments; s++) {
              const jitter = s < segments ? (Math.random() - 0.5) * 22 : 0;
              const perpX = -dy / segments;
              const perpY = dx / segments;
              const len = Math.hypot(perpX, perpY) || 1;
              pts.push({
                x: toX + dx * s + (perpX / len) * jitter,
                y: toY + dy * s + (perpY / len) * jitter,
              });
            }

            const bolt = this.add.graphics().setDepth(depth + 4);
            // Thick outer glow
            bolt.lineStyle(6, 0xaa00ff, 0.55);
            bolt.beginPath();
            bolt.moveTo(pts[0].x, pts[0].y);
            for (let s = 1; s < pts.length; s++) bolt.lineTo(pts[s].x, pts[s].y);
            bolt.strokePath();
            // Mid purple layer
            bolt.lineStyle(3, 0xdd66ff, 0.85);
            bolt.beginPath();
            bolt.moveTo(pts[0].x, pts[0].y);
            for (let s = 1; s < pts.length; s++) bolt.lineTo(pts[s].x, pts[s].y);
            bolt.strokePath();
            // Bright white core
            bolt.lineStyle(1.5, 0xffffff, 1.0);
            bolt.beginPath();
            bolt.moveTo(pts[0].x, pts[0].y);
            for (let s = 1; s < pts.length; s++) bolt.lineTo(pts[s].x, pts[s].y);
            bolt.strokePath();

            // Spark burst at chain endpoint
            const spark = this.add.graphics().setDepth(depth + 5);
            spark.fillStyle(0xffffff, 1);
            spark.fillCircle(0, 0, 4);
            spark.fillStyle(0xdd66ff, 0.9);
            spark.fillCircle(0, 0, 7);
            spark.setPosition(tx, ty).setScale(0.4);
            this.tweens.add({ targets: spark, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 220, ease: "Cubic.easeOut", onComplete: () => spark.destroy() });

            // Hold bolt briefly then fade
            this.tweens.add({ targets: bolt, alpha: 0, duration: 260, delay: 60, ease: "Cubic.easeIn", onComplete: () => bolt.destroy() });
          });
        });
      }
    });
  }

  _playRiderChainEffect(fromX, fromY, toX, toY) {
    const depth = 22;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const perpAngle = angle + Math.PI / 2;
    const totalDist = Math.hypot(toX - fromX, toY - fromY);
    const linkCount = 6;

    // Chain links — spawn sequentially from attacker toward target
    for (let i = 0; i < linkCount; i++) {
      this.time.delayedCall(i * 18, () => {
        const t = (i + 1) / linkCount;
        const lx = fromX + Math.cos(angle) * totalDist * t;
        const ly = fromY + Math.sin(angle) * totalDist * t;

        const link = this.add.graphics().setDepth(depth + 2);
        // Outer link rectangle — steel grey
        link.fillStyle(0xa0a8b8, 0.5);
        link.fillRect(-5, -3, 10, 6);
        // Inner hole — dark gap to sell the chain link shape
        link.fillStyle(0x1a1a2e, 0.45);
        link.fillRect(-2.5, -1.5, 5, 3);
        // Slight purple tint highlight on top edge
        link.lineStyle(1, 0xcc88ff, 0.6);
        link.strokeRect(-5, -3, 10, 6);
        link.setPosition(lx, ly);
        link.setRotation(angle);

        this.tweens.add({
          targets: link,
          alpha: 0,
          duration: 160,
          ease: "Cubic.easeOut",
          onComplete: () => link.destroy()
        });
      });
    }

    // Impact fires after chain reaches the target
    this.time.delayedCall(linkCount * 18 + 10, () => {
      // Primary purple-pink slash — bright and wide
      const slash1 = this.add.graphics().setDepth(depth + 4);
      slash1.fillStyle(0xdd22bb, 0.95);
      slash1.fillRect(-30, -5, 60, 10);
      slash1.lineStyle(1.5, 0xff88ee, 0.9);
      slash1.strokeRect(-30, -5, 60, 10);
      slash1.setPosition(toX, toY);
      slash1.setRotation(perpAngle);
      this.tweens.add({ targets: slash1, alpha: 0, scaleX: 1.5, scaleY: 0.08, duration: 210, ease: "Cubic.easeOut", onComplete: () => slash1.destroy() });

      // Secondary slash — deeper magenta, counter-angled
      const slash2 = this.add.graphics().setDepth(depth + 3);
      slash2.fillStyle(0x880066, 0.85);
      slash2.fillRect(-20, -3, 40, 6);
      slash2.setPosition(toX - Math.cos(angle) * 7, toY - Math.sin(angle) * 7);
      slash2.setRotation(perpAngle + 0.3);
      this.tweens.add({ targets: slash2, alpha: 0, scaleX: 1.2, scaleY: 0.05, duration: 250, ease: "Cubic.easeOut", onComplete: () => slash2.destroy() });

      // Small pink-white impact flash
      const flash = this.add.graphics().setDepth(depth + 5);
      flash.fillStyle(0xff99ee, 0.9);
      flash.fillCircle(0, 0, 14);
      flash.setPosition(toX, toY).setScale(0.3);
      this.tweens.add({ targets: flash, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 180, ease: "Cubic.easeOut", onComplete: () => flash.destroy() });

      // 7 pink sparks scatter off
      for (let i = 0; i < 7; i++) {
        const sp = this.add.graphics().setDepth(depth + 3);
        sp.fillStyle([0xff44cc, 0xdd22bb, 0xff88ee, 0xffffff][i % 4], 1);
        sp.fillCircle(0, 0, 2 + Math.random() * 2.5);
        sp.setPosition(toX, toY);
        const sparkAngle = perpAngle + (Math.random() - 0.5) * Math.PI;
        const dist = 16 + Math.random() * 24;
        this.tweens.add({
          targets: sp,
          x: toX + Math.cos(sparkAngle) * dist,
          y: toY + Math.sin(sparkAngle) * dist,
          alpha: 0,
          duration: 190 + Math.random() * 110,
          ease: "Cubic.easeOut",
          onComplete: () => sp.destroy()
        });
      }
    });
  }

  _playAssassinShadowEffect(x, y, fromX, fromY) {
    const depth = 22;
    const angle = Math.atan2(y - fromY, x - fromX);
    const perpAngle = angle + Math.PI / 2;

    // 14 dark smoke wisps spawn around the target and pull INWARD
    for (let i = 0; i < 14; i++) {
      this.time.delayedCall(i * 8, () => {
        const wispAngle = Math.random() * Math.PI * 2;
        const startDist = 40 + Math.random() * 30;
        const wisp = this.add.graphics().setDepth(depth + 1);
        const col = [0x1a001a, 0x2d0044, 0x3b0066, 0x0d000d][Math.floor(Math.random() * 4)];
        wisp.fillStyle(col, 0.5);
        wisp.fillCircle(0, 0, 5 + Math.random() * 5);
        wisp.setPosition(x + Math.cos(wispAngle) * startDist, y + Math.sin(wispAngle) * startDist);
        this.tweens.add({
          targets: wisp,
          x,
          y,
          scaleX: 0.2,
          scaleY: 0.2,
          alpha: 0,
          duration: 160 + Math.random() * 60,
          ease: "Cubic.easeIn",
          onComplete: () => wisp.destroy()
        });
      });
    }

    // Slash fires after smoke converges (~200ms)
    this.time.delayedCall(190, () => {
      // Brief void flash at impact — dark, not bright
      const flash = this.add.graphics().setDepth(depth + 4);
      flash.fillStyle(0x220033, 0.95);
      flash.fillCircle(0, 0, 22);
      flash.setPosition(x, y).setScale(0.4);
      this.tweens.add({ targets: flash, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 200, ease: "Cubic.easeOut", onComplete: () => flash.destroy() });

      // Primary slash — dark purple, wide
      const slash1 = this.add.graphics().setDepth(depth + 5);
      slash1.fillStyle(0x5500aa, 0.95);
      slash1.fillRect(-32, -5, 64, 10);
      slash1.lineStyle(1.5, 0xaa44ff, 0.8);
      slash1.strokeRect(-32, -5, 64, 10);
      slash1.setPosition(x, y);
      slash1.setRotation(perpAngle);
      this.tweens.add({ targets: slash1, alpha: 0, scaleX: 1.5, scaleY: 0.08, duration: 220, ease: "Cubic.easeOut", onComplete: () => slash1.destroy() });

      // Secondary slash — near-black, counter-angled
      const slash2 = this.add.graphics().setDepth(depth + 4);
      slash2.fillStyle(0x1a0033, 0.9);
      slash2.fillRect(-22, -3, 44, 6);
      slash2.setPosition(x - Math.cos(angle) * 7, y - Math.sin(angle) * 7);
      slash2.setRotation(perpAngle - 0.3);
      this.tweens.add({ targets: slash2, alpha: 0, scaleX: 1.3, scaleY: 0.05, duration: 260, ease: "Cubic.easeOut", onComplete: () => slash2.destroy() });

      // 6 purple sparks scatter off the slash
      for (let i = 0; i < 6; i++) {
        const sp = this.add.graphics().setDepth(depth + 4);
        sp.fillStyle(i % 2 === 0 ? 0x9900ff : 0x6600cc, 1);
        sp.fillCircle(0, 0, 2 + Math.random() * 2);
        sp.setPosition(x, y);
        const sparkAngle = perpAngle + (Math.random() - 0.5) * Math.PI;
        const dist = 14 + Math.random() * 22;
        this.tweens.add({
          targets: sp,
          x: x + Math.cos(sparkAngle) * dist,
          y: y + Math.sin(sparkAngle) * dist,
          alpha: 0,
          duration: 200 + Math.random() * 100,
          ease: "Cubic.easeOut",
          onComplete: () => sp.destroy()
        });
      }
    });
  }

  _playArcherProjectileEffect(fromX, fromY, toX, toY) {
    const depth = 22;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    // Shape is drawn pointing up, so offset rotation by -90°
    const rotation = angle - Math.PI / 2;

    // Outer glow layer — soft wide halo so the blade is visible against any background
    const glow = this.add.graphics().setDepth(depth + 2);
    glow.fillStyle(0xaabcff, 0.35);
    glow.fillRect(-6, -40, 12, 36);
    glow.fillTriangle(0, -48, 6, -40, -6, -40);
    glow.setPosition(fromX, fromY);
    glow.setRotation(rotation);

    // Blade graphic — larger and brighter
    const blade = this.add.graphics().setDepth(depth + 3);
    // Shaft — wider and longer
    blade.fillStyle(0xe8eeff, 1);
    blade.fillRect(-3, -36, 6, 30);
    // Bright white core line down the shaft
    blade.fillStyle(0xffffff, 1);
    blade.fillRect(-1, -36, 2, 30);
    // Pointed tip — bigger
    blade.fillStyle(0xffffff, 1);
    blade.fillTriangle(0, -46, 5, -36, -5, -36);
    // Crossguard
    blade.fillStyle(0x8899cc, 1);
    blade.fillRect(-8, -4, 16, 3);
    // Crossguard center gem
    blade.fillStyle(0xffffff, 1);
    blade.fillRect(-2, -5, 4, 5);
    blade.setPosition(fromX, fromY);
    blade.setRotation(rotation);

    let trailFrame = 0;
    this.tweens.add({
      targets: [blade, glow],
      x: toX,
      y: toY,
      duration: 160,
      ease: "Cubic.easeIn",
      onUpdate: () => {
        // Spawn a fading silver trail mark every 2 frames
        trailFrame++;
        if (trailFrame % 2 !== 0) return;
        const trail = this.add.graphics().setDepth(depth + 2);
        trail.fillStyle(0xaabcff, 0.6);
        trail.fillRect(-2, -28, 4, 28);
        trail.fillStyle(0xffffff, 0.5);
        trail.fillRect(-0.5, -28, 1, 28);
        trail.setPosition(blade.x, blade.y);
        trail.setRotation(rotation);
        this.tweens.add({ targets: trail, alpha: 0, duration: 120, ease: "Linear", onComplete: () => trail.destroy() });
      },
      onComplete: () => {
        blade.destroy();
        glow.destroy();

        // Impact starburst — 8 thin silver rays radiating outward
        for (let i = 0; i < 8; i++) {
          const rayAngle = (i / 8) * Math.PI * 2;
          const len = 14 + (i % 2 === 0 ? 8 : 0); // alternate long/short
          const ray = this.add.graphics().setDepth(depth + 3);
          ray.fillStyle(i % 2 === 0 ? 0xffffff : 0xc8d0e0, 0.95);
          ray.fillRect(-1, -len, 2, len);
          ray.setPosition(toX, toY);
          ray.setRotation(rayAngle);
          this.tweens.add({ targets: ray, alpha: 0, scaleY: 0.1, duration: 200, ease: "Cubic.easeOut", onComplete: () => ray.destroy() });
        }

        // Brief white flash at impact point
        const flash = this.add.graphics().setDepth(depth + 4);
        flash.fillStyle(0xffffff, 0.9);
        flash.fillCircle(0, 0, 10);
        flash.setPosition(toX, toY).setScale(0.5);
        this.tweens.add({ targets: flash, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 180, ease: "Cubic.easeOut", onComplete: () => flash.destroy() });

        // 5 silver sparks flying off
        for (let i = 0; i < 5; i++) {
          const sp = this.add.graphics().setDepth(depth + 2);
          sp.fillStyle(i % 2 === 0 ? 0xffffff : 0xe8e8e8, 1);
          sp.fillCircle(0, 0, 1.5 + Math.random() * 2);
          sp.setPosition(toX, toY);
          const sparkAngle = Math.random() * Math.PI * 2;
          const dist = 14 + Math.random() * 22;
          this.tweens.add({
            targets: sp,
            x: toX + Math.cos(sparkAngle) * dist,
            y: toY + Math.sin(sparkAngle) * dist,
            alpha: 0,
            duration: 180 + Math.random() * 100,
            ease: "Cubic.easeOut",
            onComplete: () => sp.destroy()
          });
        }
      }
    });
  }

  _playSaberSlashEffect(fromX, fromY, toX, toY) {
    const depth = 22;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const perpAngle = angle + Math.PI / 2;

    // Gold impact flash at target
    const flash = this.add.graphics().setDepth(depth + 2);
    flash.fillStyle(0xfffacd, 1);
    flash.fillCircle(0, 0, 20);
    flash.setPosition(toX, toY).setScale(0.4);
    this.tweens.add({ targets: flash, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 200, ease: "Cubic.easeOut", onComplete: () => flash.destroy() });

    // Primary slash — thick gold bar perpendicular to attack direction
    const slash1 = this.add.graphics().setDepth(depth + 3);
    slash1.fillStyle(0xffd700, 0.95);
    slash1.fillRect(-30, -4, 60, 8);
    slash1.lineStyle(1.5, 0xffffff, 0.9);
    slash1.strokeRect(-30, -4, 60, 8);
    slash1.setPosition(toX, toY);
    slash1.setRotation(perpAngle);
    this.tweens.add({ targets: slash1, alpha: 0, scaleX: 1.4, scaleY: 0.1, duration: 220, ease: "Cubic.easeOut", onComplete: () => slash1.destroy() });

    // Secondary slash — slightly offset backward, warm orange, angled
    const s2x = toX - Math.cos(angle) * 8;
    const s2y = toY - Math.sin(angle) * 8;
    const slash2 = this.add.graphics().setDepth(depth + 2);
    slash2.fillStyle(0xffa500, 0.8);
    slash2.fillRect(-22, -2.5, 44, 5);
    slash2.setPosition(s2x, s2y);
    slash2.setRotation(perpAngle + 0.22);
    this.tweens.add({ targets: slash2, alpha: 0, scaleX: 1.2, scaleY: 0.05, duration: 260, ease: "Cubic.easeOut", onComplete: () => slash2.destroy() });

    // 6 golden sparks flying off perpendicular to the slash
    for (let i = 0; i < 6; i++) {
      const sp = this.add.graphics().setDepth(depth + 1);
      sp.fillStyle(i % 2 === 0 ? 0xffd700 : 0xfffacd, 1);
      sp.fillCircle(0, 0, 2 + Math.random() * 2);
      sp.setPosition(toX, toY);
      const sparkAngle = perpAngle + (Math.random() - 0.5) * Math.PI;
      const dist = 18 + Math.random() * 28;
      this.tweens.add({
        targets: sp,
        x: toX + Math.cos(sparkAngle) * dist,
        y: toY + Math.sin(sparkAngle) * dist,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 200 + Math.random() * 120,
        ease: "Cubic.easeOut",
        onComplete: () => sp.destroy()
      });
    }
  }

  _playBerserkerSlashEffect(fromX, fromY, toX, toY) {
    const depth = 22;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const perpAngle = angle + Math.PI / 2;

    // 3 overlapping slashes at wild angles — rage-fueled, not precise
    const slashDefs = [
      { rot: perpAngle - 0.15, w: 80, h: 10, col: 0xee1100, alpha: 1.0,   ox: 0,  oy: 0  },
      { rot: perpAngle + 0.42, w: 64, h:  7, col: 0xaa0000, alpha: 0.9,   ox: -Math.cos(angle) * 8, oy: -Math.sin(angle) * 8 },
      { rot: perpAngle - 0.62, w: 52, h:  5, col: 0xff4400, alpha: 0.75,  ox:  Math.cos(angle) * 6, oy:  Math.sin(angle) * 6 },
    ];
    slashDefs.forEach(({ rot, w, h, col, alpha: a, ox, oy }) => {
      const s = this.add.graphics().setDepth(depth + 3);
      s.fillStyle(col, a);
      s.fillRect(-w / 2, -h / 2, w, h);
      s.lineStyle(1.5, 0xff6644, 0.7);
      s.strokeRect(-w / 2, -h / 2, w, h);
      s.setPosition(toX + ox, toY + oy);
      s.setRotation(rot);
      this.tweens.add({ targets: s, alpha: 0, scaleX: 1.6, scaleY: 0.08, duration: 200 + Math.random() * 60, ease: "Cubic.easeOut", onComplete: () => s.destroy() });
    });

    // 14 blood-red droplets scattered in the attack direction — like impact spray
    for (let i = 0; i < 14; i++) {
      this.time.delayedCall(i * 8, () => {
        const sp = this.add.graphics().setDepth(depth + 2);
        sp.fillStyle([0xff1100, 0xcc0000, 0x990000, 0xff3300][i % 4], 1);
        sp.fillCircle(0, 0, 2 + Math.random() * 3.5);
        sp.setPosition(toX, toY);
        // Spray cone biased in the attack direction (forward from attacker)
        const spread = (Math.random() - 0.5) * Math.PI * 1.6;
        const spAngle = angle + spread;
        const dist = 25 + Math.random() * 50;
        this.tweens.add({
          targets: sp,
          x: toX + Math.cos(spAngle) * dist,
          y: toY + Math.sin(spAngle) * dist,
          alpha: 0,
          scaleX: 0.15,
          scaleY: 0.15,
          duration: 220 + Math.random() * 160,
          ease: "Cubic.easeOut",
          onComplete: () => sp.destroy()
        });
      });
    }
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
