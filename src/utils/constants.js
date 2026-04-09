export const ARENA_SIZE = {
  width: 1200,
  height: 800,
  padding: 50,
  playerOneSpawn: { x: 150, y: 400 },
  playerTwoSpawn: { x: 1050, y: 400 }
};

export const SYNC_INTERVAL_MS = 100;

export const CHAMPIONS = {
  warrior: {
    key: "warrior",
    name: "Warrior",
    description: "A melee bruiser with sustain and shields.",
    stats: {
      health: 500,
      mana: 200,
      armor: 20,
      magicResist: 5,
      movementSpeed: 250,
      manaRegen: 8
    },
    abilities: {
      q: { name: "Slash", damage: 50, cooldown: 1.5, range: 64, manaCost: 20 },
      w: { name: "Stun", damage: 0, cooldown: 10, range: 150, manaCost: 60 },
      e: { name: "Shield", cooldown: 8, reduction: 0.3, duration: 4, manaCost: 40 },
      r: { name: "Ultimate", damage: 120, cooldown: 45, aoeRadius: 200, manaCost: 150 }
    }
  },
  archer: {
    key: "archer",
    name: "Archer",
    description: "A swift ranged fighter that kites enemies from a distance.",
    stats: {
      health: 350,
      mana: 300,
      armor: 10,
      magicResist: 8,
      movementSpeed: 310,
      manaRegen: 10
    },
    abilities: {
      q: { name: "Arrow Shot", damage: 60, cooldown: 1.0, range: 400, manaCost: 15 },
      w: { name: "Multi-Shot", damage: 35, cooldown: 6, range: 350, manaCost: 50 },
      e: { name: "Roll", cooldown: 10, range: 180, manaCost: 40 },
      r: { name: "Rain of Arrows", damage: 150, cooldown: 40, aoeRadius: 180, manaCost: 130 }
    }
  },
  mage: {
    key: "mage",
    name: "Mage",
    description: "A ranged caster that trades durability for burst.",
    stats: {
      health: 300,
      mana: 400,
      armor: 5,
      magicResist: 15,
      movementSpeed: 280,
      manaRegen: 15
    },
    abilities: {
      q: { name: "Fireball", damage: 80, cooldown: 2, range: 350, manaCost: 50 },
      w: { name: "Mana Shield", cooldown: 0, manaCost: 30, passive: true },
      e: { name: "Blink", cooldown: 12, range: 200, manaCost: 80 },
      r: { name: "Meteor", damage: 200, cooldown: 50, aoeRadius: 220, manaCost: 200 }
    }
  }
};

export const GAME_STATES = {
  waiting: "waiting",
  playing: "playing",
  finished: "finished"
};

export function randomRoomId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 3; i += 1) {
    id += letters[Math.floor(Math.random() * letters.length)];
  }
  return id;
}

export function randomPlayerId() {
  return `peer_${Math.random().toString(36).slice(2, 9)}`;
}
