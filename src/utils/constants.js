export const ARENA_SIZE = {
  width: 1200,
  height: 800,
  padding: 50,
  playerOneSpawn: { x: 150, y: 400 },
  playerTwoSpawn: { x: 1050, y: 400 }
};

export const GAME_MODES = {
  DUEL: "1v1",
  FFA: "ffa"
};

// One entry per player slot — order must be stable (slot 0 = host)
export const PLAYER_SLOTS = [
  { tint: 0x7c3aed, spawn: { x: 150,  y: 400 }, towerPos: { x: 150,  y: 400 } }, // purple – left
  { tint: 0x0ea5e9, spawn: { x: 1050, y: 400 }, towerPos: { x: 1050, y: 400 } }, // blue   – right
  { tint: 0xfbbf24, spawn: { x: 600,  y: 80  }, towerPos: { x: 600,  y: 80  } }, // yellow – top
  { tint: 0x22c55e, spawn: { x: 600,  y: 720 }, towerPos: { x: 600,  y: 720 } }, // green  – bottom
];

export const SYNC_INTERVAL_MS = 50;

export const CHAMPIONS = {
  warrior: {
    key: "warrior",
    name: "Berserker",
    description: "Heracles in his rage-locked form. Immense strength and endurance — grows even more deadly as he nears death.",
    stats: {
      health: 700,
      mana: 140,
      armor: 32,
      magicResist: 5,
      movementSpeed: 215,
      manaRegen: 5,
      healthRegen: 3
    },
    abilities: {
      q: { name: "Berserk Strike", damage: 90, cooldown: 1.2, range: 130, manaCost: 15 },
      r: { name: "Undying Rage", cooldown: 55, manaCost: 100, undyingRage: true }
    }
  },
  archer: {
    key: "archer",
    name: "Archer",
    description: "EMIYA — a tactical ranged fighter who wins through preparation. His Reality Marble unleashes a storm of replicated weapons.",
    stats: {
      health: 500,
      mana: 360,
      armor: 10,
      magicResist: 15,
      movementSpeed: 285,
      manaRegen: 14,
      healthRegen: 4
    },
    abilities: {
      q: { name: "Arrow Shot", damage: 58, cooldown: 1.0, range: 290, manaCost: 18 },
      r: { name: "Unlimited Blade Works", damage: 175, cooldown: 50, range: 310, aoeRadius: 260, manaCost: 200 }
    }
  },
  saber: {
    key: "saber",
    name: "Saber",
    description: "Artoria Pendragon — a balanced and versatile powerhouse with unmatched magic resistance. Excalibur levels everything in its path.",
    stats: {
      health: 590,
      mana: 280,
      armor: 22,
      magicResist: 22,
      movementSpeed: 290,
      manaRegen: 10,
      healthRegen: 8
    },
    abilities: {
      q: { name: "Blade Strike", damage: 78, cooldown: 1.0, range: 165, manaCost: 25 },
      r: { name: "Excalibur", damage: 230, cooldown: 45, range: 350, aoeRadius: 185, manaCost: 190 }
    }
  },
  assassin: {
    key: "assassin",
    name: "Assassin",
    description: "Cursed Arm Hassan — weak in open combat but lethal in assassination. Zabaniya delivers a cursed death that bypasses all protection.",
    stats: {
      health: 480,
      mana: 270,
      armor: 10,
      magicResist: 10,
      movementSpeed: 320,
      manaRegen: 10,
      healthRegen: 5
    },
    abilities: {
      q: { name: "Shadow Strike", damage: 58, cooldown: 1.0, range: 130, manaCost: 22 },
      r: { name: "Zabaniya", damage: 160, cooldown: 35, range: 160, manaCost: 130, trueDamage: true }
    }
  },
  ridder: {
    key: "ridder",
    name: "Rider",
    description: "Medusa — the fastest Servant on the field. Bellerophon channels Pegasus into a devastating charge that obliterates everything in its wake.",
    stats: {
      health: 470,
      mana: 230,
      armor: 8,
      magicResist: 8,
      movementSpeed: 380,
      manaRegen: 9,
      healthRegen: 4
    },
    abilities: {
      q: { name: "Nail", damage: 52, cooldown: 0.9, range: 115, manaCost: 18 },
      r: { name: "Bellerophon", damage: 0, cooldown: 30, range: 0, manaCost: 160, speedBoost: 2.5, speedBoostDuration: 2.5 }
    }
  },
  lancer: {
    key: "lancer",
    name: "Lancer",
    description: "Cú Chulainn — one of the best pure fighters in the war. Fastest after Rider, with unmatched reach. Gáe Bolg reverses causality to pierce the heart, ignoring all armor.",
    stats: {
      health: 520,
      mana: 220,
      armor: 12,
      magicResist: 8,
      movementSpeed: 360,
      manaRegen: 9,
      healthRegen: 6
    },
    abilities: {
      q: { name: "Lance Thrust", damage: 65, cooldown: 1.0, range: 225, manaCost: 20 },
      r: { name: "Gae Bolg", damage: 185, cooldown: 35, range: 260, manaCost: 130, trueDamage: true }
    }
  },
  mage: {
    key: "mage",
    name: "Caster",
    description: "Medea — physically frail but the most dangerous strategist. Rule Breaker is a conceptual weapon that shatters magical protection entirely.",
    stats: {
      health: 450,
      mana: 500,
      armor: 4,
      magicResist: 22,
      movementSpeed: 250,
      manaRegen: 22,
      healthRegen: 3
    },
    abilities: {
      q: { name: "Fireball", damage: 72, cooldown: 1.5, range: 280, manaCost: 55, aoeRadius: 110 },
      r: { name: "Rule Breaker", damage: 155, cooldown: 45, range: 300, manaCost: 250, trueDamage: true }
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
