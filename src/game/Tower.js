const ATTACK_RANGE = 200;
const ATTACK_DAMAGE = 50;
const ATTACK_COOLDOWN = 1.2;

export default class Tower {
  constructor(scene, x, y, tint) {
    this.scene = scene;
    this.health = 600;
    this.maxHealth = 600;
    this.isAlive = true;
    this.x = x;
    this.y = y;
    this.tint = tint;
    this.attackCooldown = 0;
    this.attackRange = ATTACK_RANGE;

    if (scene.textures.exists("grail")) {
      this.sprite = scene.add
        .image(x, y, "grail")
        .setOrigin(0.5)
        .setDisplaySize(96, 96);
    } else {
      this.sprite = scene.add
        .rectangle(x, y, 96, 96, tint)
        .setOrigin(0.5);
    }
    this.sprite.setDepth(4);

    const rangeCircle = scene.add.graphics();
    rangeCircle.lineStyle(2, 0xff2222, 0.35);
    rangeCircle.strokeCircle(x, y, ATTACK_RANGE);
    rangeCircle.fillStyle(0xff2222, 0.08);
    rangeCircle.fillCircle(x, y, ATTACK_RANGE);
    rangeCircle.setDepth(2);

    this.healthBarBg = scene.add.rectangle(x, y - 38, 60, 7, 0x1f1f1f).setOrigin(0.5).setDepth(19);
    this.healthBar = scene.add.rectangle(x, y - 38, 60, 7, tint).setOrigin(0.5).setDepth(20);

    this.label = scene.add
      .text(x, y + 34, "", { fontSize: "10px", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(21);
  }

  update(delta, creeps, enemyPlayer, alliedPlayers = [], twitches = []) {
    if (!this.isAlive) return;

    const sec = delta / 1000;
    if (this.attackCooldown > 0) {
      this.attackCooldown -= sec;
      return;
    }

    const pick = this._pickTarget(creeps, enemyPlayer, twitches);
    if (!pick) return { fired: false };
    const { target, targetType } = pick;
    const damage = this._calculateDamage(target, targetType, alliedPlayers);
    target.takeDamage(damage, true);
    this.attackCooldown = ATTACK_COOLDOWN;
    this._shootEffect(target);
    this._flashAttackSprite();
    const killed = this._wasTargetKilled(target);
    return { fired: true, target, targetType, killed };
  }

  _pickTarget(creeps, enemyPlayers, twitches = []) {
    const players = Array.isArray(enemyPlayers) ? enemyPlayers : [enemyPlayers];

    // Priority 1: enemy champions
    let nearest = null;
    let nearestDist = ATTACK_RANGE;
    let currentType = null;
    for (const ep of players) {
      if (!ep?.data?.isAlive) continue;
      const dist = Math.hypot(ep.sprite.x - this.x, ep.sprite.y - this.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = ep; currentType = "player"; }
    }
    if (nearest) return { target: nearest, targetType: currentType };

    // Priority 2: caster minions and twitches
    const elites = [...creeps.filter(c => c.constructor?.name === "CasterMinion"), ...twitches];
    for (const e of elites) {
      if (!e.isAlive) continue;
      const dist = Math.hypot(e.sprite.x - this.x, e.sprite.y - this.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = e; currentType = "creep"; }
    }
    if (nearest) return { target: nearest, targetType: currentType };

    // Priority 3: regular creeps
    for (const c of creeps) {
      if (!c.isAlive || c.constructor?.name === "CasterMinion") continue;
      const dist = Math.hypot(c.sprite.x - this.x, c.sprite.y - this.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = c; currentType = "creep"; }
    }
    return nearest ? { target: nearest, targetType: currentType } : null;
  }

  _calculateDamage(target, targetType, alliedPlayers) {
    if (targetType !== "player") return ATTACK_DAMAGE;
    const ownerAlive = Array.isArray(alliedPlayers) && alliedPlayers.some(a => a?.data?.isAlive);
    if (!ownerAlive) return 40;
    const hasAlly = this._hasAllyInRange(alliedPlayers);
    if (!hasAlly) return ATTACK_DAMAGE;
    const maxHealth = target?.data?.stats?.maxHealth ?? target?.data?.stats?.health ?? 0;
    return ATTACK_DAMAGE + Math.round(maxHealth * 0.30);
  }

  _hasAllyInRange(alliedPlayers = []) {
    if (!Array.isArray(alliedPlayers)) return false;
    return alliedPlayers.some((ally) => {
      if (!ally?.data?.isAlive) return false;
      const dx = ally.sprite.x - this.x;
      const dy = ally.sprite.y - this.y;
      return Math.hypot(dx, dy) <= ATTACK_RANGE;
    });
  }

  _wasTargetKilled(target) {
    if (!target) return false;
    if (typeof target.isAlive === "boolean") return !target.isAlive;
    if (target?.data) return !target.data.isAlive;
    return false;
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

  _flashAttackSprite() {
    if (!this.scene.textures.exists("grail attack")) return;
    this.sprite.setTexture("grail attack");
    this.scene.time.delayedCall(300, () => {
      if (this.sprite?.active) this.sprite.setTexture("grail");
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
