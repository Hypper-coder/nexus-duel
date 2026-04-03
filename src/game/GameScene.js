import Phaser from "phaser";
import Player from "./Player";
import { ARENA_SIZE, GAME_STATES, CHAMPIONS } from "../utils/constants";
import { buildChampionState } from "./Champion";

const MOVE_SPEED = 250;

export default class GameScene extends Phaser.Scene {
  constructor(options = {}) {
    super({ key: "GameScene" });
    this.options = options;
  }

  init() {
    this.playerId = this.options.playerId ?? "peer_local";
    this.championKey = this.options.championKey ?? "warrior";
    this.roomId = this.options.roomId || "ROOM_UNKNOWN";
    this.gameSync = this.options.gameSync;
  }

  create() {
    const championDef = CHAMPIONS[this.championKey] ?? CHAMPIONS.warrior;

    const playerState = buildChampionState(
      championDef.key,
      this.playerId,
      ARENA_SIZE.playerOneSpawn
    );

    this.player = new Player(this, {
      ...playerState,
      tint: 0x7c3aed
    });

    const opponentState = buildChampionState("mage", "peer_remote", ARENA_SIZE.playerTwoSpawn);
    this.opponent = new Player(this, {
      ...opponentState,
      tint: 0x0ea5e9
    });

    this.statusText = this.add
      .text(16, 16, `Room ${this.roomId} | Champion ${championDef.name}`)
      .setDepth(10);

    this.cursors = this.input.keyboard.addKeys("W,S,A,D");

    if (this.gameSync) {
      this.gameSync.start(() => ({
        roomId: this.roomId,
        state: this.player.getState(),
        status: GAME_STATES.playing
      }));
    }
  }

  update(time, delta) {
    const velocity = this.calculateVelocity();
    this.player.move(velocity, delta / 1000);
  }

  calculateVelocity() {
    const direction = { x: 0, y: 0 };

    if (this.cursors.W.isDown) direction.y -= 1;
    if (this.cursors.S.isDown) direction.y += 1;
    if (this.cursors.A.isDown) direction.x -= 1;
    if (this.cursors.D.isDown) direction.x += 1;

    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: (direction.x / length) * MOVE_SPEED,
      y: (direction.y / length) * MOVE_SPEED
    };
  }
}
