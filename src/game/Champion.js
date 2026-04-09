import { CHAMPIONS } from "../utils/constants";

export function buildChampionState(key, playerId, position) {
  const definition = CHAMPIONS[key] ?? CHAMPIONS.warrior;
  return {
    id: playerId,
    championKey: definition.key,
    stats: {
      health: definition.stats.health,
      mana: definition.stats.mana,
      armor: definition.stats.armor ?? 0,
      magicResist: definition.stats.magicResist ?? 0,
      movementSpeed: definition.stats.movementSpeed
      ,
      maxHealth: definition.stats.health,
      maxMana: definition.stats.mana
    },
    position: { ...position },
    abilities: Object.entries(definition.abilities).reduce((acc, [abilityKey, ability]) => {
      acc[abilityKey] = {
        cooldown: ability.cooldown,
        cooldownRemaining: 0,
        manaCost: ability.manaCost ?? 0,
        range: ability.range ?? 0,
        damage: ability.damage ?? 0,
        name: ability.name
      };
      return acc;
    }, {}),
    isAlive: true
  };
}
