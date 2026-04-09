import { ARENA_SIZE } from "../utils/constants";

const GOBLIN = {
  health: 100,
  speed: 120,
  damage: 15,
  attackRange: 45,
  attackCooldown: 2
};

export default class Creep {
  constructor(scene, x, y) {
    this.scene = scene;
    this.health = GOBLIN.health;
    this.maxHealth = GOBLIN.health;
    this.attackCooldown = 0;
    this.isAlive = true;

    if (scene.textures.exists("goblin")) {
      this.sprite = scene.add
        .image(x, y, "goblin")
        .setOrigin(0.5)
        .setDisplaySize(36, 36);
    } else {
      this.sprite = scene.add
        .rectangle(x, y, 36, 36, 0x22c55e)
        .setOrigin(0.5);
    }
    this.sprite.setDepth(5);

    this.healthBar = scene.add.rectangle(x, y - 28, 40, 5, 0xef4444).setOrigin(0.5).setDepth(20);
    this.healthBarBg = scene.add.rectangle(x, y - 28, 40, 5, 0x4b0000).setOrigin(0.5).setDepth(19);
  }

  update(delta, target) {
    if (!this.isAlive) return;

    const sec = delta / 1000;
    if (this.attackCooldown > 0) this.attackCooldown -= sec;

    if (target && target.data.isAlive) {
      const dx = target.sprite.x - this.sprite.x;
      const dy = target.sprite.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);

      if (dist > GOBLIN.attackRange) {
        const nx = (dx / dist) * GOBLIN.speed * sec;
        const ny = (dy / dist) * GOBLIN.speed * sec;
        this.sprite.x = Phaser.Math.Clamp(this.sprite.x + nx, ARENA_SIZE.padding, ARENA_SIZE.width - ARENA_SIZE.padding);
        this.sprite.y = Phaser.Math.Clamp(this.sprite.y + ny, ARENA_SIZE.padding, ARENA_SIZE.height - ARENA_SIZE.padding);
      } else if (this.attackCooldown <= 0) {
        target.takeDamage(GOBLIN.damage);
        this.attackCooldown = GOBLIN.attackCooldown;
      }
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
    }
  }
}
