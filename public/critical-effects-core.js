(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TRICKCAL_CRITICAL_EFFECTS = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function isCriticalEffect(effect = {}) {
    const valueKind = String(effect.valueKind || '');
    return /会心/.test(valueKind)
      && !/確定会心|会心不可|会心判定/.test(valueKind);
  }

                                                                        
  function normalizeEffect(effect, rawValue) {
    if (!isCriticalEffect(effect)) return { handled: false, bonuses: {} };
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return { handled: true, unresolved: true, bonuses: {} };
    const valueKind = String(effect.valueKind || '');
    const effectType = String(effect.effectType || '');
    const effectTarget = String(effect.effectTarget || '');
    const text = `${valueKind} ${effectType} ${effectTarget}`;
    const targetEnemy = /敵/.test(effectTarget) || /デバフ/.test(effectType);
    const decrease = /減少|低下/.test(text);
    const bonuses = {};
    const add = key => { bonuses[key] = (bonuses[key] || 0) + value; };
    const addSigned = key => { bonuses[key] = (bonuses[key] || 0) + (decrease ? -value : value); };
    const addDamageTakenMod = key => { bonuses[key] = (bonuses[key] || 0) + (decrease ? value : -value); };

    if (/会心被(?:ダメージ量|DMG量)|被会心(?:ダメージ量|DMG量)|被会心.*ダメージ量|被会心.*DMG量/.test(valueKind)) {
      addDamageTakenMod('critDmgResAddP');
    } else if (/被会心率|被会心/.test(valueKind)) {
      addDamageTakenMod('critResAddP');
    } else if (/会心DMG抵抗|会心ダメージ抵抗/.test(valueKind)) {
      if (targetEnemy && decrease) add('enemyCritDmgResDownP');
      else if (!targetEnemy) addSigned('critDmgResP');
    } else if (/会心抵抗/.test(valueKind)) {
      if (targetEnemy && decrease) add('enemyCritResDownP');
      else if (!targetEnemy) addSigned('critResP');
    } else if (/会心(?:ダメージ量|DMG量)/.test(valueKind)) {
      add('critDmgAddP');
    } else if (/会心ダメージ|会心DMG/.test(valueKind)) {
      add('critDmgP');
    } else if (/会心率/.test(valueKind)) {
      add('critRateP');
    } else {
      add('critP');
    }
    return { handled: true, bonuses };
  }

  function normalizeStat(stat = {}) {
    const applyTo = String(stat.statApplyTo || '本人');
    if (/全体|味方/.test(applyTo) || !/本人|自身/.test(applyTo)) return null;
    const value = Number(stat.increaseP ?? stat.increase ?? stat.value);
    if (!Number.isFinite(value)) return null;
    const name = String(stat.statName || '');
    let statKey = '';
    if (/会心DMG抵抗|会心ダメージ抵抗/.test(name)) statKey = 'critDmgRes';
    else if (/会心抵抗/.test(name)) statKey = 'critRes';
    else if (/会心DMG|会心ダメージ/.test(name)) statKey = 'critDmg';
    else if (/^会心$/.test(name)) statKey = 'crit';
    return statKey ? { statKey, value } : null;
  }

  return Object.freeze({ isCriticalEffect, normalizeEffect, normalizeStat });
});
