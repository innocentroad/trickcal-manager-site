(function (root) {
  'use strict';

  function publicKey(kind, value) {
    let hash = 2166136261;
    for (const character of `${kind}:${value}`) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    return `${kind}-${hash.toString(36)}`;
  }

  function createResolver(data) {
    const monsters = new Map(data.monsters.map(monster => [monster.key, monster]));
    const conditions = new Map(data.conditions.map(condition => [condition.key, condition]));
    const displayNames = new Map();
    function displayName(monster, content) {
      const key = `${content}:${monster.key}`;
      if (displayNames.has(key)) return displayNames.get(key);
      const baseName = monster.baseName || monster.name;
      const siblings = data.monsters.filter(row => row.contents.includes(content)
        && row.strength === monster.strength && (row.baseName || row.name) === baseName);
      const whisper = /ウイスパー/.test(baseName);
      const groups = new Set(siblings.map(row => whisper
        ? `${row.groupKey || row.key}:${row.personality}` : row.groupKey || row.key));
      const variants = siblings.filter(row => (row.groupKey || row.key) === (monster.groupKey || monster.key)
        && (!whisper || row.personality === monster.personality));
      const personalities = [...new Set(variants.map(row => row.personality).filter(Boolean))];
      const name = (groups.size > 1 || whisper) && personalities.length
        ? `${baseName}（${personalities.join('・')}）` : baseName;
      displayNames.set(key, name);
      return name;
    }
    const normalizeKey = (map, kind, value) => map.has(value) || data.keyFormat !== 2
      ? value : publicKey(kind, value);

    function resolve(selection) {
      const monster = monsters.get(normalizeKey(monsters, 'm', selection.monsterKey));
      const condition = conditions.get(normalizeKey(conditions, 'c', selection.conditionKey));
      if (!monster || !condition || !monster.contents.includes(condition.content)) return null;
      const steps = Math.max(condition.level - 1, 0);
      const values = monster.base.map((base, index) => base + monster.growth[index] * steps);
      const factor = raw => Math.fround(1 + Math.fround(Math.fround(raw) * Math.fround(0.0001)));
      const rawHp = values[0] * factor(condition.hpBonus);
      const lower = Math.floor(rawHp);
      values[0] = rawHp - lower === 0.5 ? lower + lower % 2 : Math.round(rawHp);
      const fields = ['hp', 'atk_p', 'atk_m', 'def_p', 'def_m', 'crit', 'critDmg', 'critRes', 'critDmgRes'];
      const stats = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
      const damageType = selection.damageType === 'magic' || selection.damageType === 'physical'
        ? selection.damageType : monster.dmgType;
      return {
        ...stats, name: displayName(monster, condition.content), dmgType: damageType === 'magic' ? 'mag' : 'phys',
        projected: !!monster.projected,
        personality: monster.personality, strength: monster.strength,
        content: { type: condition.content, world: condition.world, stage: condition.stage,
          difficulty: condition.difficulty,
          ...(condition.content === 'crusade' ? {
            stageLabel: `${({1:'微',2:'中',3:'激'})[condition.difficulty] || ''}${condition.world}-${condition.stage}`
          } : {}) },
        special: factor(damageType === 'magic' ? condition.magicBonus : condition.physicalBonus) * 100,
        stageSelection: { conditionKey: condition.key, monsterKey: monster.key },
        skills: (monster.skills || []).flatMap(skill => skill.multipliers
          .filter(value => Number.isFinite(value))
          .map(mult => ({ name: skill.name, mult: Number(mult.toFixed(2)), multiplierBasis: 'hit' }))),
      };
    }

    function selectionKey(selection) {
      return 'stage:' + encodeURIComponent(JSON.stringify([
        normalizeKey(conditions, 'c', selection.conditionKey),
        normalizeKey(monsters, 'm', selection.monsterKey)
      ]));
    }

    function resolveKey(key, damageType) {
      if (typeof key !== 'string' || !key.startsWith('stage:')) return null;
      try {
        const values = JSON.parse(decodeURIComponent(key.slice(6)));
        if (!Array.isArray(values) || values.length !== 2 || values.some(value => typeof value !== 'string')) return null;
        return resolve({ conditionKey: values[0], monsterKey: values[1], damageType });
      } catch (_) {
        return null;
      }
    }

    function personalityVariants(key) {
      const preset = resolveKey(key);
      if (!preset) return [];
      const original = monsters.get(preset.stageSelection.monsterKey);
      return data.monsters.filter(monster => monster.contents.includes(preset.content.type)
        && (original.groupKey ? monster.groupKey === original.groupKey : monster.key === original.key)
        && (!/ウイスパー/.test(original.baseName || original.name) || monster.personality === original.personality));
    }

    function changePersonality(key, personality) {
      const preset = resolveKey(key);
      const originalKey = preset?.stageSelection.monsterKey;
      const variants = personalityVariants(key);
      const monster = variants.find(row => row.key === originalKey && row.personality === personality)
        || variants.find(row => row.personality === personality);
      return monster ? selectionKey({ ...preset.stageSelection, monsterKey: monster.key }) : null;
    }

    function getDefaultPersonality(key) {
      const preset = resolveKey(key);
      if (!preset) return '';
      const world = preset.content.world;
                                                                                       
                                                                                       
      if (preset.content.type === 'crusade' && world >= 6 && world <= 32) {
        return ['純粋', '冷静', '狂気', '活発', '憂鬱'][(world - 6) % 5];
      }
      return preset.personality || '';
    }

    return { resolve, selectionKey, resolveKey, personalityVariants, changePersonality, getDefaultPersonality, monsters: data.monsters, conditions: data.conditions };
  }

  const api = { createResolver };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TRICKCAL_STAGE_ENEMY_RESOLVER = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
