import Phaser from "phaser";
import { ARENA_SIZE } from "../utils/constants";

export default class Player {
  constructor(scene, data) {
    this.scene = scene;
    this.data = { ...data };
    this.sprite = scene.add
      .rectangle(data.position.x, data.position.y, 32, 32, data.tint || 0xffffff)
      .setOrigin(0.5);
  }

  move(velocity, delta) {
    if (!this.data.isAlive) return;
    const nextX = Phaser.Math.Clamp(
      this.sprite.x + velocity.x * delta,
      ARENA_SIZE.padding,
      ARENA_SIZE.width - ARENA_SIZE.padding
    );
    const nextY = Phaser.Math.Clamp(
      this.sprite.y + velocity.y * delta,
      ARENA_SIZE.padding,
      ARENA_SIZE.height - ARENA_SIZE.padding
    );
    this.sprite.setPosition(nextX, nextY);
    this.data.position.x = nextX;
    this.data.position.y = nextY;
  }

  takeDamage(amount) {
    this.data.stats.health -= amount;
    if (this.data.stats.health <= 0) {
      this.data.stats.health = 0;
      this.data.isAlive = false;
    }
  }

  getState() {
    return {
      playerId: this.data.id,
      position: { x: this.sprite.x, y: this.sprite.y },
      health: this.data.stats.health,
      mana: this.data.stats.mana,
      isAlive: this.data.isAlive
    };
  }
}
