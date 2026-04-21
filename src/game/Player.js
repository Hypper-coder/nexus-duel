import Phaser from "phaser";
import { ARENA_SIZE } from "../utils/constants";

export default class Player {
  constructor(scene, data) {
    this.scene = scene;
    this.data = { ...data };
    const textureKey = data.championKey;
    if (textureKey && scene.textures.exists(textureKey)) {
      this.sprite = scene.add
        .image(data.position.x, data.position.y, textureKey)
        .setOrigin(0.5)
        .setDisplaySize(72, 72);
    } else {
      this.sprite = scene.add
        .rectangle(data.position.x, data.position.y, 32, 32, data.tint || 0xffffff)
        .setOrigin(0.5);
    }

    this.attackCooldown = 0;
    this.undyingActive = false;
    this.slowActive = false;
    this.slowMult = 0.8;
    this.riderSpeedBonus = 0;
    this.armorBrokenActive = false;
    this.poisonActive = false;
  }

  move(velocity, delta, rocks = []) {
    if (!this.data.isAlive) return;
    let x = Phaser.Math.Clamp(
      this.sprite.x + velocity.x * delta,
      ARENA_SIZE.padding,
      ARENA_SIZE.width - ARENA_SIZE.padding
    );
    let y = Phaser.Math.Clamp(
      this.sprite.y + velocity.y * delta,
      ARENA_SIZE.padding,
      ARENA_SIZE.height - ARENA_SIZE.padding
    );

    const playerRadius = 16;
    for (const rock of rocks) {
      const dx = x - rock.x;
      const dy = y - rock.y;
      const dist = Math.hypot(dx, dy);
      const minDist = playerRadius + rock.radius;
      if (dist < minDist && dist > 0) {
        const push = (minDist - dist) / dist;
        x += dx * push;
        y += dy * push;
      }
    }

    this.sprite.setPosition(x, y);
    this.data.position.x = x;
    this.data.position.y = y;
  }

  takeDamage(amount, trueDamage = false, fromChampion = false, bypassBlind = false) {
    if (!this.data.isAlive) return;
    if (this.blindActive && fromChampion && !bypassBlind) return;
    const armor = (trueDamage || this.armorBrokenActive) ? 0 : (this.data.stats.armor ?? 0);
    const effective = Math.round(amount * (100 / (100 + armor)));
    if (this.undyingActive) {
      const minHp = 1;
      this.data.stats.health = Math.max(minHp, this.data.stats.health - effective);
      return;
    }
    this.data.stats.health -= effective;
    if (this.data.stats.health <= 0) {
      this.data.stats.health = 0;
      this.data.isAlive = false;
    }
  }

  canUseAbility(abilityKey) {
    const ability = this.data.abilities[abilityKey];
    if (!ability || this.attackCooldown > 0 || !this.data.isAlive) return false;
    if ((ability.cooldownRemaining ?? 0) > 0) return false;
    if ((ability.manaCost ?? 0) > this.data.stats.mana) return false;
    return true;
  }

  tickAbilities(delta) {
    Object.values(this.data.abilities).forEach((ability) => {
      if (ability.cooldownRemaining > 0) {
        ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - delta);
      }
    });

    const { mana, maxMana, manaRegen, health, maxHealth, healthRegen } = this.data.stats;
    if (mana < maxMana) {
      this.data.stats.mana = Math.min(maxMana, mana + manaRegen * delta);
    }
    if (health < maxHealth && healthRegen && !this.poisonActive) {
      this.data.stats.health = Math.min(maxHealth, health + healthRegen * delta);
    }
  }

  useAbility(abilityKey) {
    const ability = this.data.abilities[abilityKey];
    if (!ability) return null;
    ability.cooldownRemaining = ability.cooldown;
    this.data.stats.mana = Math.max(0, this.data.stats.mana - (ability.manaCost ?? 0));
    return ability;
  }

  _flashAttackSprite() {
    const key = this.data.championKey;
    const attackKey = `${key} attack`;
    if (!this.scene.textures.exists(attackKey)) return;
    this.sprite.setTexture(attackKey).setDisplaySize(72, 72);
    this.scene.time.delayedCall(300, () => {
      if (this.sprite?.active) this.sprite.setTexture(key).setDisplaySize(72, 72);
    });
  }

  attackCreep(creep, abilityKey) {
    if (!creep || !creep.isAlive) return null;
    if (!this.canUseAbility(abilityKey)) return null;
    const ability = this.data.abilities[abilityKey];
    this.useAbility(abilityKey);
    const damage = Math.round((ability.damage ?? 30) * this._damageMultiplier());
    creep.takeDamage(damage);
    this._flashAttackSprite();
    return { abilityKey, damage, ability };
  }

  attack(target, abilityKey) {
    if (!target || !target.data.isAlive) return null;
    const ability = this.data.abilities[abilityKey];
    if (!ability || !this.canUseAbility(abilityKey)) return null;

    const distance = this.distanceTo(target);
    const range = ability.range ?? 80;
    if (distance > range) return null;

    this.useAbility(abilityKey);
    const damage = Math.round((ability.damage ?? 30) * this._damageMultiplier());
    target.takeDamage(damage, false, true);
    this._flashAttackSprite();
    return {
      damage,
      targetId: target.data.id,
      abilityKey,
      ability
    };
  }

  distanceTo(target) {
    if (!target) return Infinity;
    const dx = this.sprite.x - target.sprite.x;
    const dy = this.sprite.y - target.sprite.y;
    return Math.hypot(dx, dy);
  }

  getState() {
    return {
      playerId: this.data.id,
      championKey: this.data.championKey,
      position: { x: this.sprite.x, y: this.sprite.y },
      health: this.data.stats.health,
      mana: this.data.stats.mana,
      isAlive: this.data.isAlive,
      abilities: Object.fromEntries(
        Object.entries(this.data.abilities).map(([key, ab]) => [key, { cooldownRemaining: ab.cooldownRemaining }])
      )
    };
  }

  getMovementSpeedMultiplier() {
    if (this.speedBoostActive) {
      if (this.riderSpeedBonus > 0) return 1.5 + this.riderSpeedBonus;
      return this.data.abilities?.r?.speedBoost ?? 2.0;
    }
    let mult = 1;
    if (this.data.championKey === "warrior") {
      const ratio = this._healthRatio();
      if (ratio <= 0.25) mult = 1.15;
    }
    if (this.slowActive) mult *= (this.slowMult ?? 0.8);
    return mult;
  }

  _damageMultiplier() {
    if (this.data.championKey !== "warrior") return 1;
    const ratio = this._healthRatio();
    if (ratio <= 0.25) return 1.25;
    if (ratio <= 0.5) return 1.1;
    return 1;
  }

  _healthRatio() {
    if (!this.data?.stats?.maxHealth) return 0;
    return Math.max(0, Math.min(1, this.data.stats.health / this.data.stats.maxHealth));
  }
}
