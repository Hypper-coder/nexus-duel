import Phaser from "phaser";
import Player from "./Player";
import { ARENA_SIZE, GAME_STATES, CHAMPIONS } from "../utils/constants";
import { buildChampionState } from "./Champion";
import warriorImg from "../assets/warrior.png";
import fateCasterImg from "../assets/fate caster.png";
import fateCasterAttackImg from "../assets/fate caster attack.png";
import fateArcherImg from "../assets/fate archer.png";
import fateArcherAttackImg from "../assets/fate archer attack.png";
import saberImg from "../assets/saber.png";
import saberAttackImg from "../assets/saber attack.png";
import goblinImg from "../assets/goblin.png";
import grailImg from "../assets/grail.png";
import grailAttackImg from "../assets/grail attack.png";
import rockImg from "../assets/rock.png";
import gemstoneImg from "../assets/gemstone.png";
import mapaImg from "../assets/mapa.png";
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
    this.gameOverFired = false;
    this.localKills = 0;
    this.lastOpponentKills = 0;
  }

  preload() {
    this.load.image("warrior", warriorImg);
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

    const opponentState = buildChampionState("mage", "peer_remote", this.remoteSpawn);
    this.opponent = new Player(this, {
      ...opponentState,
      tint: this.remoteTint
    });

    this.statusText = this.add
      .text(16, 16, `Room ${this.roomId} | Champion ${championDef.name}`)
      .setDepth(10);

    this.cursors = this.input.keyboard.addKeys("W,S,A,D");
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    if (this.gameSync) {
      this.remoteSubscription = this.gameSync.onRemoteState((payload) => this.applyRemoteState(payload));
      this.messageCleanup = this.gameSync.onMessage((payload) => this.handleNetworkMessage(payload));

      this.gameSync.start(() => {
        const payload = {
          roomId: this.roomId,
          state: { ...this.player.getState(), kills: this.localKills },
          status: GAME_STATES.playing
        };
        if (this.isHost) {
          payload.world = this.getWorldState();
        }
        return payload;
      });
    }

    this.playerBars = this.createBars(this.player, 0x7c3aed, 0x60a5fa);
    this.opponentBars = this.createBars(this.opponent, 0x0ea5e9, 0x3b82f6);

    this.rocks = this.placeRocks();
    const spawnGemstone = () => new Gemstone(this, () => this.getRandomGemPosition());
    this.gemstones = [spawnGemstone(), spawnGemstone()];
    this.creeps = this.spawnCreeps(4);
    this.twitches = this.spawnTwitches(2);
    this.casterMinions = [];

    if (this.isHost) {
      this.time.addEvent({
        delay: 15000,
        loop: true,
        callback: () => {
          const newCreeps = this.spawnCreeps(2);
          this.creeps.push(...newCreeps);
        }
      });
      this.time.addEvent({
        delay: 20000,
        loop: true,
        callback: () => {
          // Spawn one caster minion per tower targeting the opposing player
          this.casterMinions.push(new CasterMinion(this, this.localSpawn.x, this.localSpawn.y, this.opponent, 0x7c3aed, "local"));
          this.casterMinions.push(new CasterMinion(this, this.remoteSpawn.x, this.remoteSpawn.y, this.player, 0x0ea5e9, "remote"));
        }
      });
    }

    this.localTower = new Tower(this, this.localSpawn.x, this.localSpawn.y - 80, 0x7c3aed);
    this.remoteTower = new Tower(this, this.remoteSpawn.x, this.remoteSpawn.y - 80, 0x0ea5e9);
  }

  placeRocks() {
    const positions = [
      { x: 300, y: 200 }, { x: 900, y: 200 },
      { x: 300, y: 600 }, { x: 900, y: 600 },
      { x: 600, y: 300 }, { x: 600, y: 500 },
      { x: 450, y: 400 }, { x: 750, y: 400 }
    ];
    return positions.map(({ x, y }) => new Rock(this, x, y));
  }

  spawnTwitches(count) {
    const twitches = [];
    const cx = ARENA_SIZE.width / 2;
    const cy = ARENA_SIZE.height / 2;
    const offsets = [{ x: -150, y: -100 }, { x: 150, y: 100 }, { x: -150, y: 100 }, { x: 150, y: -100 }];
    for (let i = 0; i < count; i++) {
      const off = offsets[i % offsets.length];
      twitches.push(new Twitch(this, cx + off.x, cy + off.y));
    }
    return twitches;
  }

  spawnCreeps(count) {
    const creeps = [];
    const p = ARENA_SIZE.padding;
    const W = ARENA_SIZE.width;
    const H = ARENA_SIZE.height;

    for (let i = 0; i < count; i++) {
      let x, y;
      const edge = Phaser.Math.Between(0, 3);
      if (edge === 0) { x = Phaser.Math.Between(p, W - p); y = p; }
      else if (edge === 1) { x = Phaser.Math.Between(p, W - p); y = H - p; }
      else if (edge === 2) { x = p; y = Phaser.Math.Between(p, H - p); }
      else { x = W - p; y = Phaser.Math.Between(p, H - p); }
      creeps.push(new Creep(this, x, y));
    }
    return creeps;
  }

  getRandomGemPosition() {
    const margin = ARENA_SIZE.padding + 80;
    const minX = margin;
    const maxX = ARENA_SIZE.width - margin;
    const minY = margin;
    const maxY = ARENA_SIZE.height - margin;

    return {
      x: Phaser.Math.Between(minX, maxX),
      y: Phaser.Math.Between(minY, maxY)
    };
  }

  update(_time, delta) {
    const velocity = this.calculateVelocity();
    this.player.move(velocity, delta / 1000, this.rocks);
    this.updateBars(this.player, this.playerBars);
    this.updateBars(this.opponent, this.opponentBars);
    this.player.tickAbilities(delta / 1000);
    if (this.isHost) {
      this.gemstones.forEach((gem) => {
        if (gem.checkPickup(this.player)) {
          const s = this.player.data.stats;
          s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.5);
          s.mana = Math.min(s.maxMana, s.mana + s.maxMana * 0.5);
          return;
        }
        if (gem.checkPickup(this.opponent) && this.gameSync) {
          this.gameSync.send({ type: "gem-heal", roomId: this.roomId });
        }
      });
      this.creeps.forEach((creep) => creep.update(delta, [this.player, this.opponent]));
      this.twitches.forEach((t) => t.update(delta, [this.player, this.opponent]));
      this.casterMinions.forEach((m) => m.update(delta));

      // Track opponent health before tower ticks so we can detect tower damage
      const opponentHealthBefore = this.opponent.data.stats.health;
      const localFired = this.localTower.update(delta, this.creeps, this.opponent);
      const remoteFired = this.remoteTower.update(delta, this.creeps, this.player);
      if (this.gameSync) {
        if (localFired) this.gameSync.send({ type: "tower-attack", tower: "local", roomId: this.roomId });
        if (remoteFired) this.gameSync.send({ type: "tower-attack", tower: "remote", roomId: this.roomId });
      }
      const opponentHealthAfter = this.opponent.data.stats.health;
      if (opponentHealthAfter < opponentHealthBefore && this.gameSync && this.opponent.data.id !== "peer_remote") {
        this.gameSync.send({
          type: "hit",
          attackerId: "tower",
          targetId: this.opponent.data.id,
          damage: opponentHealthBefore - opponentHealthAfter,
          abilityKey: "tower",
          roomId: this.roomId,
          timestamp: Date.now()
        });
      }
    }

    this.checkGameOver();

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      const creepTarget = this.nearestCreepInRange("q");
      if (creepTarget) {
        const result = this.player.attackCreep(creepTarget, "q");
        if (result) {
          this.playAttackEffect({ sprite: creepTarget.sprite }, result.abilityKey);
          if (!this.isHost && this.gameSync) {
            const creepType = this.twitches.includes(creepTarget) ? "twitch"
              : this.casterMinions.includes(creepTarget) ? "caster"
              : "creep";
            const idx = creepType === "twitch" ? this.twitches.indexOf(creepTarget)
              : creepType === "caster" ? this.casterMinions.indexOf(creepTarget)
              : this.creeps.indexOf(creepTarget);
            this.gameSync.send({
              type: "creep-hit",
              creepType,
              index: idx,
              damage: result.damage,
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
        const attackResult = this.player.attack(this.opponent, "q");
        if (attackResult && this.gameSync) {
          this.playAttackEffect(this.opponent, attackResult.abilityKey);
          this.gameSync.send({
            type: "hit",
            attackerId: this.playerId,
            ...attackResult,
            roomId: this.roomId,
            timestamp: Date.now()
          });
          if (!this.opponent.data.isAlive) {
            this.localKills += 3;
            if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 3, opponent: 0 });
          }
          this.statusText.setText(`Room ${this.roomId} | Hit ${this.opponent.data.id} for ${attackResult.damage}`);
          this.updateBars(this.opponent, this.opponentBars);
        }
      }
    }
  }

  nearestCreepInRange(abilityKey) {
    const range = this.player.data.abilities[abilityKey]?.range ?? 80;
    let nearest = null;
    let nearestDist = range;
    const myOwner = this.isHost ? "local" : "remote";
    const enemyMinions = this.casterMinions.filter(m => m.owner !== myOwner);
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

    return {
      x: (direction.x / length) * MOVE_SPEED,
      y: (direction.y / length) * MOVE_SPEED
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
    const y = player.sprite.y - 32;

    healthBar.setPosition(x, y);
    manaBar.setPosition(x, y + 6);
    const healthRatio = Math.max(0, Math.min(1, player.data.stats.health / player.data.stats.maxHealth));
    const manaRatio = Math.max(0, Math.min(1, player.data.stats.mana / player.data.stats.maxMana));

    healthBar.displayWidth = 64 * healthRatio;
    manaBar.displayWidth = 64 * manaRatio;
  }

  applyRemoteState(payload) {
    if (!payload || payload.roomId !== this.roomId) return;
    const { state } = payload;
    if (!state || !this.opponent) return;
    if (state.playerId === this.playerId) return;

    // Fix opponent ID — initialised as "peer_remote" placeholder, which breaks
    // hit messages because targetId never matches the real remote playerId
    if (state.playerId && this.opponent.data.id !== state.playerId) {
      this.opponent.data.id = state.playerId;
    }

    // Rebuild opponent sprite/stats when we learn their actual champion
    if (state.championKey && this.opponent.data.championKey !== state.championKey) {
      const pos = { x: this.opponent.sprite.x, y: this.opponent.sprite.y };
      this.opponent.sprite.destroy();
      this.opponentBars.healthBar.destroy();
      this.opponentBars.manaBar.destroy();
      const newState = buildChampionState(state.championKey, state.playerId, pos);
      this.opponent = new Player(this, { ...newState, tint: this.remoteTint });
      this.opponentBars = this.createBars(this.opponent, 0x0ea5e9, 0x3b82f6);
    }

    const { position, health, mana, isAlive, abilities } = state;
    if (position) {
      this.opponent.sprite.setPosition(position.x, position.y);
      this.opponent.data.position.x = position.x;
      this.opponent.data.position.y = position.y;
    }
    if (typeof health === "number") {
      this.opponent.data.stats.health = health;
    }
    if (typeof mana === "number") {
      this.opponent.data.stats.mana = mana;
    }
    if (typeof isAlive === "boolean") {
      this.opponent.data.isAlive = isAlive;
    }
    if (abilities) {
      Object.entries(abilities).forEach(([key, { cooldownRemaining }]) => {
        if (this.opponent.data.abilities[key]) {
          this.opponent.data.abilities[key].cooldownRemaining = cooldownRemaining;
        }
      });
    }
    if (!this.isHost && payload.world) {
      this.applyWorldState(payload.world);
    }

    // Sync opponent score in real time from their broadcasted kills field
    if (typeof state.kills === "number" && state.kills > this.lastOpponentKills) {
      const delta = state.kills - this.lastOpponentKills;
      this.lastOpponentKills = state.kills;
      if (this.options.onScoreUpdate) this.options.onScoreUpdate({ local: 0, opponent: delta });
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
      towers: {
        local: { health: this.localTower.health, isAlive: this.localTower.isAlive },
        remote: { health: this.remoteTower.health, isAlive: this.remoteTower.isAlive }
      },
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
            const isMyMinion = this.isHost ? owner === "local" : owner === "remote";
            const tint = isMyMinion ? 0x7c3aed : 0x0ea5e9;
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
      // From host: "local" = host's base = guest's remoteTower
      syncTower(this.remoteTower, world.towers.local);
      // From host: "remote" = guest's base = guest's localTower
      syncTower(this.localTower, world.towers.remote);
    }
  }

  handleNetworkMessage(payload) {
    if (!payload) return;
    if (payload.type === "game-over" && !this.isHost) {
      if (this.gameOverFired) return;
      this.gameOverFired = true;
      // Flip result: host's victory = guest's defeat and vice versa
      const flip = { victory: "defeat", defeat: "victory", draw: "draw" };
      if (this.options.onGameOver) this.options.onGameOver(flip[payload.result] ?? "draw");
      return;
    }
    if (payload.type === "tower-attack") {
      // Guest mirrors the attack animation
      const tower = payload.tower === "local" ? this.remoteTower : this.localTower;
      tower._flashAttackSprite();
      return;
    }
    if (payload.type === "gem-heal") {
      const s = this.player.data.stats;
      s.health = Math.min(s.maxHealth, s.health + s.maxHealth * 0.5);
      s.mana = Math.min(s.maxMana, s.mana + s.maxMana * 0.5);
      return;
    }
    if (payload.type === "creep-hit" && this.isHost) {
      const { creepType, index, damage } = payload;
      const target = creepType === "twitch" ? this.twitches[index]
        : creepType === "caster" ? this.casterMinions[index]
        : this.creeps[index];
      if (target?.isAlive) target.takeDamage(damage);
      return;
    }
    if (payload.type !== "hit") return;
    if (payload.attackerId !== "tower") {
      this.opponent._flashAttackSprite();
    }
    if (payload.targetId === this.playerId) {
      this.player.takeDamage(payload.damage);
      this.statusText.setText(
        `Room ${this.roomId} | Hit by ${payload.attackerId} for ${payload.damage}`
      );
      if (payload.abilityKey !== "tower") this.playAttackEffect(this.player, payload.abilityKey);
      this.updateBars(this.player, this.playerBars);
    }
  }

  checkGameOver() {
    if (this.gameOverFired) return;
    if (!this.isHost) return; // guest waits for game-over message from host

    const localDead = !this.player.data.isAlive;
    const opponentDead = !this.opponent.data.isAlive;
    if (!localDead && !opponentDead) return;

    this.gameOverFired = true;
    // result is from host's perspective — winner is whoever has more points
    const result = this.localKills > this.lastOpponentKills ? "victory"
      : this.localKills < this.lastOpponentKills ? "defeat"
      : "draw";

    if (this.gameSync) {
      this.gameSync.send({ type: "game-over", result, roomId: this.roomId });
    }
    if (this.options.onGameOver) {
      this.options.onGameOver(result);
    }
  }

  playAttackEffect(target, abilityKey) {
    if (!target) return;
    const effect = this.add.graphics();
    const color = abilityKey === "q" ? 0xfbbf24 : 0x38bdf8;
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
