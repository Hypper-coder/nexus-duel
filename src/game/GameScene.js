import Phaser from "phaser";
import Player from "./Player";
import { ARENA_SIZE, GAME_STATES, CHAMPIONS } from "../utils/constants";
import { buildChampionState } from "./Champion";
import warriorImg from "../assets/warrior.png";
import mageImg from "../assets/mage.png";
import archerImg from "../assets/archer.png";
import goblinImg from "../assets/goblin.png";
import towerImg from "../assets/tower.png";
import mapaImg from "../assets/mapa.png";
import Creep from "./Creep";
import Tower from "./Tower";

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
  }

  preload() {
    this.load.image("warrior", warriorImg);
    this.load.image("mage", mageImg);
    this.load.image("archer", archerImg);
    this.load.image("goblin", goblinImg);
    this.load.image("tower", towerImg);
    this.load.image("mapa", mapaImg);
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
          state: this.player.getState(),
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

    this.creeps = this.spawnCreeps(4);

    this.localTower = new Tower(this, this.localSpawn.x, this.localSpawn.y - 80, 0x7c3aed);
    this.remoteTower = new Tower(this, this.remoteSpawn.x, this.remoteSpawn.y - 80, 0x0ea5e9);
  }

  spawnCreeps(count) {
    const creeps = [];
    const margin = ARENA_SIZE.padding + 60;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(margin, ARENA_SIZE.width - margin);
      const y = Phaser.Math.Between(margin, ARENA_SIZE.height - margin);
      creeps.push(new Creep(this, x, y));
    }
    return creeps;
  }

  update(_time, delta) {
    const velocity = this.calculateVelocity();
    this.player.move(velocity, delta / 1000);
    this.updateBars(this.player, this.playerBars);
    this.updateBars(this.opponent, this.opponentBars);
    this.player.tickAbilities(delta / 1000);
    if (this.isHost) {
      this.creeps.forEach((creep) => creep.update(delta, this.player));
      this.localTower.update(delta, this.creeps);
      this.remoteTower.update(delta, this.creeps);
    }

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      const creepTarget = this.nearestCreepInRange("q");
      if (creepTarget) {
        const result = this.player.attackCreep(creepTarget, "q");
        if (result) this.playAttackEffect({ sprite: creepTarget.sprite }, result.abilityKey);
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
    for (const creep of this.creeps) {
      if (!creep.isAlive) continue;
      const dx = creep.sprite.x - this.player.sprite.x;
      const dy = creep.sprite.y - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = creep;
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
      towers: {
        local: { health: this.localTower.health, isAlive: this.localTower.isAlive },
        remote: { health: this.remoteTower.health, isAlive: this.remoteTower.isAlive }
      }
    };
  }

  applyWorldState(world) {
    if (!world) return;

    if (world.creeps && this.creeps) {
      world.creeps.forEach(({ index, x, y, health, isAlive }) => {
        const creep = this.creeps[index];
        if (!creep) return;
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
    if (!payload || payload.type !== "hit") return;
    if (payload.targetId === this.playerId) {
      this.player.takeDamage(payload.damage);
      this.statusText.setText(
        `Room ${this.roomId} | Hit by ${payload.attackerId} for ${payload.damage}`
      );
      this.playAttackEffect(this.player, payload.abilityKey);
      this.updateBars(this.player, this.playerBars);
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
