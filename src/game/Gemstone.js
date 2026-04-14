const PICKUP_RADIUS = 30;
const HEAL_RATIO = 0.5; // 50% of max HP and mana
const RESPAWN_DELAY = 30000;
const GEM_SIZE = 72;

export default class Gemstone {
  constructor(scene, getSpawnPosition) {
    this.scene = scene;
    this.getSpawnPosition = typeof getSpawnPosition === "function" ? getSpawnPosition : null;
    this.active = true;

    const { x, y } = this._chooseSpawnPosition();
    this.x = x;
    this.y = y;

    this.sprite = scene.textures.exists("gemstone")
      ? scene.add.image(x, y, "gemstone").setOrigin(0.5).setDisplaySize(GEM_SIZE, GEM_SIZE).setDepth(3)
      : scene.add.circle(x, y, GEM_SIZE / 2, 0xa855f7).setDepth(3);

    this._restingScale = this.sprite.scaleX;
    this._pulse();
  }

  // Returns true if player picked up the gem, false otherwise.
  // Does NOT apply the heal — caller is responsible (host-authoritative).
  checkPickup(player) {
    if (!this.active || !player.data.isAlive) return false;
    const dx = player.sprite.x - this.x;
    const dy = player.sprite.y - this.y;
    if (Math.hypot(dx, dy) > PICKUP_RADIUS) return false;
    this._deactivate();
    return true;
  }

  // Called on guest to mirror host world state without triggering a local respawn timer.
  syncState(active, x, y) {
    const wasActive = this.active;
    this.active = active;
    if (active) {
      this.x = x;
      this.y = y;
      this.sprite.setPosition(x, y);
      this.sprite.setVisible(true);
      if (!wasActive) this._pulse();
    } else if (wasActive) {
      this.sprite.setVisible(false);
    }
  }

  _deactivate() {
    this.active = false;
    this.sprite.setVisible(false);
    this.scene.time.delayedCall(RESPAWN_DELAY, () => {
      this.active = true;
      this._relocateSprite();
      this.sprite.setVisible(true);
      this._pulse();
    });
    this._pulse();
  }

  _pulse() {
    if (!this.sprite.active) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(this._restingScale);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this._restingScale * 1.4,
      scaleY: this._restingScale * 1.4,
      duration: 200,
      yoyo: true,
      ease: "Sine.easeOut"
    });
  }

  _chooseSpawnPosition() {
    if (this.getSpawnPosition) {
      const position = this.getSpawnPosition();
      if (position && typeof position.x === "number" && typeof position.y === "number") {
        return position;
      }
    }
    return {
      x: this.scene.scale.width / 2,
      y: this.scene.scale.height / 2
    };
  }

  _relocateSprite() {
    const { x, y } = this._chooseSpawnPosition();
    this.x = x;
    this.y = y;
    this.sprite.setPosition(x, y);
  }
}
