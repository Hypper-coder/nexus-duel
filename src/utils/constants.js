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
      movementSpeed: 250
    },
    abilities: {
      q: { name: "Slash", damage: 50, cooldown: 1.5, range: 64, manaCost: 20 },
      w: { name: "Stun", damage: 0, cooldown: 10, range: 150, manaCost: 60 },
      e: { name: "Shield", cooldown: 8, reduction: 0.3, duration: 4, manaCost: 40 },
      r: { name: "Ultimate", damage: 120, cooldown: 45, aoeRadius: 200, manaCost: 150 }
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
      movementSpeed: 280
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
