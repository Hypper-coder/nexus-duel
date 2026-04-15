
const STATS = {
  health: 150,
  speed: 80,
  damage: 20,
  attackRange: 280,
  attackCooldown: 2.5
};

export default class Twitch {
  constructor(scene, x, y) {
    this.scene = scene;
    this.health = STATS.health;
    this.maxHealth = STATS.health;
    this.attackCooldown = 0;
    this.isAlive = true;
    this.aggroed = false;
    this.onAggro = null;

    this.sprite = scene.textures.exists("twitch")
      ? scene.add.image(x, y, "twitch").setOrigin(0.5).setDisplaySize(60, 60).setDepth(5)
      : scene.add.rectangle(x, y, 60, 60, 0xf59e0b).setOrigin(0.5).setDepth(5);

    this.healthBarBg = scene.add.rectangle(x, y - 32, 44, 5, 0x4b0000).setOrigin(0.5).setDepth(19);
    this.healthBar = scene.add.rectangle(x, y - 32, 44, 5, 0xef4444).setOrigin(0.5).setDepth(20);
  }

  update(delta, targets) {
    if (!this.isAlive || !this.aggroed) return;

    const sec = delta / 1000;
    if (this.attackCooldown > 0) this.attackCooldown -= sec;

    const candidates = Array.isArray(targets) ? targets : [targets];
    let nearest = null;
    let nearestDist = Infinity;

    for (const t of candidates) {
      if (!t?.data?.isAlive) continue;
      const dist = Math.hypot(t.sprite.x - this.sprite.x, t.sprite.y - this.sprite.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = t; }
    }

    if (!nearest) return;

    if (nearestDist > STATS.attackRange) {
      const nx = (nearest.sprite.x - this.sprite.x) / nearestDist;
      const ny = (nearest.sprite.y - this.sprite.y) / nearestDist;
      this.sprite.x += nx * STATS.speed * sec;
      this.sprite.y += ny * STATS.speed * sec;
    } else if (this.attackCooldown <= 0) {
      nearest.takeDamage(STATS.damage);
      this.attackCooldown = STATS.attackCooldown;
      this._shootEffect(nearest);
    }

    this.healthBar.x = this.sprite.x;
    this.healthBar.y = this.sprite.y - 32;
    this.healthBarBg.x = this.sprite.x;
    this.healthBarBg.y = this.sprite.y - 32;
    this.healthBar.displayWidth = 44 * Math.max(0, this.health / this.maxHealth);
  }

  takeDamage(amount) {
    if (!this.isAlive) return;
    if (!this.aggroed) {
      this.aggroed = true;
      if (this.onAggro) this.onAggro();
    }
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.sprite.destroy();
      this.healthBar.destroy();
      this.healthBarBg.destroy();
      return;
    }
    this.healthBar.displayWidth = 44 * Math.max(0, this.health / this.maxHealth);
  }

  _shootEffect(target) {
    const line = this.scene.add.graphics();
    line.lineStyle(2, 0xf59e0b, 1);
    line.beginPath();
    line.moveTo(this.sprite.x, this.sprite.y);
    line.lineTo(target.sprite.x, target.sprite.y);
    line.strokePath();
    line.setDepth(25);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration: 300,
      ease: "Linear",
      onComplete: () => line.destroy()
    });
  }
}
