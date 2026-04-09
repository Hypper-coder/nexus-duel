const ATTACK_RANGE = 220;
const ATTACK_DAMAGE = 40;
const ATTACK_COOLDOWN = 1.2;

export default class Tower {
  constructor(scene, x, y, tint) {
    this.scene = scene;
    this.health = 1000;
    this.maxHealth = 1000;
    this.isAlive = true;
    this.x = x;
    this.y = y;
    this.tint = tint;
    this.attackCooldown = 0;

    if (scene.textures.exists("tower")) {
      this.sprite = scene.add
        .image(x, y, "tower")
        .setOrigin(0.5)
        .setDisplaySize(96, 96);
    } else {
      this.sprite = scene.add
        .rectangle(x, y, 96, 96, tint)
        .setOrigin(0.5);
    }
    this.sprite.setDepth(4);

    this.healthBarBg = scene.add.rectangle(x, y - 38, 60, 7, 0x1f1f1f).setOrigin(0.5).setDepth(19);
    this.healthBar = scene.add.rectangle(x, y - 38, 60, 7, tint).setOrigin(0.5).setDepth(20);

    this.label = scene.add
      .text(x, y + 34, "BASE", { fontSize: "10px", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(21);
  }

  update(delta, creeps) {
    if (!this.isAlive) return;

    const sec = delta / 1000;
    if (this.attackCooldown > 0) {
      this.attackCooldown -= sec;
      return;
    }

    const target = this._nearestCreep(creeps);
    if (!target) return;

    target.takeDamage(ATTACK_DAMAGE);
    this.attackCooldown = ATTACK_COOLDOWN;
    this._shootEffect(target);
  }

  _nearestCreep(creeps) {
    let nearest = null;
    let nearestDist = ATTACK_RANGE;
    for (const creep of creeps) {
      if (!creep.isAlive) continue;
      const dx = creep.sprite.x - this.x;
      const dy = creep.sprite.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = creep;
      }
    }
    return nearest;
  }

  _shootEffect(target) {
    const line = this.scene.add.graphics();
    line.lineStyle(2, this.tint, 1);
    line.beginPath();
    line.moveTo(this.x, this.y);
    line.lineTo(target.sprite.x, target.sprite.y);
    line.strokePath();
    line.setDepth(25);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration: 200,
      ease: "Linear",
      onComplete: () => line.destroy()
    });
  }

  takeDamage(amount) {
    if (!this.isAlive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.sprite.setAlpha(0.3);
      this.label.setText("DESTROYED");
    }
    this.healthBar.displayWidth = 60 * Math.max(0, this.health / this.maxHealth);
  }
}
