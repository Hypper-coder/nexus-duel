import Phaser from "phaser";
import { ARENA_SIZE } from "../utils/constants";

const STATS = {
  health: 120,
  speed: 140,
  damage: 18,
  attackRange: 120,
  attackCooldown: 2.0
};

export default class CasterMinion {
  constructor(scene, x, y, target, tint, owner, ownerId) {
    this.scene = scene;
    this.target = target;
    this.owner = owner;
    this.ownerId = ownerId ?? null;
    this.health = STATS.health;
    this.maxHealth = STATS.health;
    this.attackCooldown = 0;
    this.isAlive = true;

    this.sprite = scene.textures.exists("caster mini")
      ? scene.add.image(x, y, "caster mini").setOrigin(0.5).setDisplaySize(56, 56).setTint(tint).setDepth(5)
      : scene.add.rectangle(x, y, 56, 56, tint).setOrigin(0.5).setDepth(5);

    this.healthBarBg = scene.add.rectangle(x, y - 28, 40, 4, 0x1a1a2e).setOrigin(0.5).setDepth(19);
    this.healthBar = scene.add.rectangle(x, y - 28, 40, 4, tint).setOrigin(0.5).setDepth(20);
  }

  update(delta, allPlayers) {
    if (!this.isAlive) return;

    const sec = delta / 1000;
    if (this.attackCooldown > 0) this.attackCooldown -= sec;

    // In FFA (allPlayers provided), always chase the nearest enemy; in 1v1 fall back to locked target
    let current = this.target;
    if (allPlayers?.length > 1) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const p of allPlayers) {
        if (!p?.data?.isAlive) continue;
        // skip the player who owns this minion's tower
        if (p.data.id && this.ownerId && p.data.id === this.ownerId) continue;
        const dist = Math.hypot(p.sprite.x - this.sprite.x, p.sprite.y - this.sprite.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = p; }
      }
      if (nearest) current = nearest;
    }

    if (!current?.data?.isAlive) return;

    const dx = current.sprite.x - this.sprite.x;
    const dy = current.sprite.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);

    if (dist > STATS.attackRange) {
      const d = Math.max(dist, 1);
      this.sprite.x = Phaser.Math.Clamp(this.sprite.x + (dx / d) * STATS.speed * sec, ARENA_SIZE.padding, ARENA_SIZE.width - ARENA_SIZE.padding);
      this.sprite.y = Phaser.Math.Clamp(this.sprite.y + (dy / d) * STATS.speed * sec, ARENA_SIZE.padding, ARENA_SIZE.height - ARENA_SIZE.padding);
    } else if (this.attackCooldown <= 0) {
      this.attackCooldown = STATS.attackCooldown;
      current.takeDamage(STATS.damage);
      this._shootEffect(current);
    }

    this.healthBar.x = this.sprite.x;
    this.healthBar.y = this.sprite.y - 28;
    this.healthBarBg.x = this.sprite.x;
    this.healthBarBg.y = this.sprite.y - 28;
    this.healthBar.displayWidth = 40 * Math.max(0, this.health / this.maxHealth);
  }

  takeDamage(amount) {
    if (!this.isAlive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.sprite.destroy();
      this.healthBar.destroy();
      this.healthBarBg.destroy();
      return;
    }
    this.healthBar.displayWidth = 40 * Math.max(0, this.health / this.maxHealth);
  }

  _shootEffect(target) {
    const bolt = this.scene.add.graphics();
    bolt.lineStyle(2, 0x60a5fa, 1);
    bolt.beginPath();
    bolt.moveTo(this.sprite.x, this.sprite.y);
    bolt.lineTo(target.sprite.x, target.sprite.y);
    bolt.strokePath();
    bolt.setDepth(25);
    this.scene.tweens.add({
      targets: bolt,
      alpha: 0,
      duration: 250,
      ease: "Linear",
      onComplete: () => bolt.destroy()
    });
  }
}
