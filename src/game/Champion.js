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
      maxMana: definition.stats.mana,
      manaRegen: definition.stats.manaRegen ?? 8,
      healthRegen: definition.stats.healthRegen ?? 2
    },
    position: { ...position },
    abilities: Object.entries(definition.abilities).reduce((acc, [abilityKey, ability]) => {
      acc[abilityKey] = {
        cooldown: ability.cooldown,
        cooldownRemaining: 0,
        manaCost: ability.manaCost ?? 0,
        range: ability.range ?? 0,
        damage: ability.damage ?? 0,
        aoeRadius: ability.aoeRadius ?? 0,
        name: ability.name,
        ...(ability.speedBoost !== undefined && { speedBoost: ability.speedBoost, speedBoostDuration: ability.speedBoostDuration ?? 3 }),
        ...(ability.trueDamage !== undefined && { trueDamage: ability.trueDamage }),
        ...(ability.undyingRage !== undefined && { undyingRage: ability.undyingRage }),
        ...(ability.blind !== undefined && { blind: ability.blind }),
        ...(ability.slow !== undefined && { slow: ability.slow, slowDuration: ability.slowDuration ?? 3 }),
        ...(ability.armorBroken !== undefined && { armorBroken: ability.armorBroken }),
        ...(ability.poison !== undefined && { poison: ability.poison, poisonDamage: ability.poisonDamage ?? 75, poisonDuration: ability.poisonDuration ?? 5 })
      };
      return acc;
    }, {}),
    isAlive: true
  };
}
