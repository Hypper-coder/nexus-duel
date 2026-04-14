export const ROCK_RADIUS = 28;

export default class Rock {
  constructor(scene, x, y) {
    this.x = x;
    this.y = y;
    this.radius = ROCK_RADIUS;

    if (scene.textures.exists("rock")) {
      scene.add.image(x, y, "rock").setOrigin(0.5).setDisplaySize(ROCK_RADIUS * 2, ROCK_RADIUS * 2).setDepth(3);
    } else {
      scene.add.circle(x, y, ROCK_RADIUS, 0x6b7280).setDepth(3);
    }
  }
}
