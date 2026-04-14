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

  takeDamage(amount) {
    if (!this.data.isAlive) return;
    this.data.stats.health -= amount;
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

    const { mana, maxMana, manaRegen } = this.data.stats;
    if (mana < maxMana) {
      this.data.stats.mana = Math.min(maxMana, mana + manaRegen * delta);
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
    this.sprite.setTexture(attackKey);
    this.scene.time.delayedCall(300, () => {
      if (this.sprite?.active) this.sprite.setTexture(key);
    });
  }

  attackCreep(creep, abilityKey) {
    if (!creep || !creep.isAlive) return null;
    if (!this.canUseAbility(abilityKey)) return null;
    const ability = this.data.abilities[abilityKey];
    this.useAbility(abilityKey);
    creep.takeDamage(ability.damage ?? 30);
    this._flashAttackSprite();
    return { abilityKey, damage: ability.damage ?? 30 };
  }

  attack(target, abilityKey) {
    if (!target || !target.data.isAlive) return null;
    const ability = this.data.abilities[abilityKey];
    if (!ability || !this.canUseAbility(abilityKey)) return null;

    const distance = this.distanceTo(target);
    const range = ability.range ?? 80;
    if (distance > range) return null;

    this.useAbility(abilityKey);
    const damage = ability.damage ?? 30;
    target.takeDamage(damage);
    this._flashAttackSprite();
    return {
      damage,
      targetId: target.data.id,
      abilityKey
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
}
