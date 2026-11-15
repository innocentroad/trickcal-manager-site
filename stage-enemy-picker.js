(function (root) {
  'use strict';
  root.openStageEnemyPicker = function (dialog, resolver, initialKey, content, apply, changeContent, contentMarkup = '') {
    const resolvedInitial = resolver.resolveKey(initialKey);
    const initial = resolvedInitial?.content.type === content ? resolvedInitial : null;
    const saved = initial && resolver.conditions.find(row => row.key === initial.stageSelection.conditionKey);
    const state = { world: saved?.world || 1, stage: saved?.stage || 1, difficulty: saved?.difficulty || 3,
      search: '', wave: saved?.wave || 1, strength: initial?.strength ?? 1, monster: initial?.stageSelection.monsterKey || '' };
    const groupKey = monster => /ウイスパー/.test(monster.baseName || monster.name)
      ? `${monster.groupKey || monster.key}:${monster.personality}` : monster.groupKey || monster.key;
    const initialMonster = resolver.monsters.find(monster => monster.key === state.monster);
    state.monster = initialMonster ? groupKey(initialMonster) : '';
    const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    let selection;
    function field(key, label, values, names = {}) {
      if (!values.includes(state[key])) state[key] = values[0];
      return `<label class="fdc-field${key === 'monster' ? ' fdc-stage-monster-field' : ''}"><span>${label}</span><select data-stage-pick="${key}">${values.map(value => `<option value="${escape(value)}" ${state[key] === value ? 'selected' : ''}>${escape(names[value] || value)}</option>`).join('')}</select></label>`;
    }
    function render() {
      const unique = (rows, key) => [...new Set(rows.map(row => row[key]))].sort((a, b) => a - b);
      let rows = resolver.conditions.filter(row => row.content === content);
      let controls = contentMarkup ? `<label class="fdc-field"><span>コンテンツ</span><select data-enemy-content>${contentMarkup}</select></label>` : '';
      if (content === 'crusade') {
        controls += field('difficulty', '難易度', unique(rows, 'difficulty').reverse(), { 1: '微辛', 2: '中辛', 3: '激辛' });
        rows = rows.filter(row => row.difficulty === state.difficulty);
      }
      controls += field('world', content === 'crusade' ? 'ワールド' : '性格（ステージ）', unique(rows, 'world'),
        content === 'crusade' ? {} : { 1: '純粋', 2: '冷静', 3: '狂気', 4: '活発', 5: '憂鬱' });
      rows = rows.filter(row => row.world === state.world);
      controls += field('stage', content === 'crusade' ? 'ステージ' : '階層', unique(rows, 'stage'));
      rows = rows.filter(row => row.stage === state.stage);
      if (content === 'crusade') controls += field('wave', 'ウェーブ', unique(rows, 'wave'));
      else state.wave = 1;
      const monsters = resolver.monsters.filter(row => row.contents.includes(content));
      controls += field('strength', '敵強度', unique(monsters, 'strength'), { 0: '小型', 1: '通常', 2: '強敵', 3: 'ボス' });
      const available = monsters.filter(row => row.strength === state.strength);
      const groups = new Map();
      available.forEach(monster => {
        const key = groupKey(monster);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(monster);
      });
      const counts = new Map();
      groups.forEach(variants => {
        const name = variants[0].baseName || variants[0].name;
        counts.set(name, (counts.get(name) || 0) + 1);
      });
      const names = Object.fromEntries([...groups].map(([key, variants]) => {
        const name = variants[0].baseName || variants[0].name;
        const personalities = [...new Set(variants.map(monster => monster.personality).filter(Boolean))];
        const label = (counts.get(name) > 1 || /ウイスパー/.test(name)) && personalities.length
          ? `${name}（${personalities.join('・')}）` : name;
        return [key, label];
      }));
      const matchingKeys = [...groups.keys()].filter(key => names[key].toLocaleLowerCase().includes(state.search.trim().toLocaleLowerCase()));
      controls += field('monster', 'モンスター', matchingKeys, names);
      controls += `<div class="fdc-stage-monster-fullname">${escape(names[state.monster] || '').replace('（', '<span>（').replace('）', '）</span>')}</div>`;
      const condition = rows.find(row => row.wave === state.wave);
      const variants = groups.get(state.monster) || [];
      const selectedMonster = variants.find(monster => monster.key === initialMonster?.key)
        || variants.find(monster => monster.personality === initialMonster?.personality) || variants[0];
      selection = condition && selectedMonster ? { conditionKey: condition.key, monsterKey: selectedMonster.key } : null;
      dialog.innerHTML = `<header><h2 id="fdc-enemy-preset-title">モンスターを選択</h2><button type="button" data-stage-cancel aria-label="閉じる">×</button></header><label class="fdc-field"><span>検索</span><input data-stage-search type="search" placeholder="敵名・性格" value="${escape(state.search)}"></label><div class="fdc-enemy-preset-filters">${controls}</div><footer><button type="button" data-stage-cancel>取消</button><button type="button" data-stage-apply ${selection ? '' : 'disabled'}>反映</button></footer>`;
      dialog.querySelector('[data-stage-search]').addEventListener('input', event => {
        if (event.isComposing) return;
        const caret = event.target.selectionStart;
        state.search = event.target.value;
        render();
        const search = dialog.querySelector('[data-stage-search]');
        search.focus();
        search.setSelectionRange(caret, caret);
      });
      dialog.querySelectorAll('[data-stage-pick]').forEach(input => input.addEventListener('change', () => {
        state[input.dataset.stagePick] = input.dataset.stagePick === 'monster' ? input.value : Number(input.value);
        if (input.dataset.stagePick === 'strength' && selectedMonster) {
          const next = monsters.find(monster => monster.strength === state.strength
            && monster.baseName === selectedMonster.baseName
            && monster.personality === selectedMonster.personality
            && JSON.stringify(monster.skills) === JSON.stringify(selectedMonster.skills));
          if (next) state.monster = groupKey(next);
        }
        render();
        dialog.querySelector(`[data-stage-pick="${input.dataset.stagePick}"]`)?.focus();
      }));
      if (contentMarkup) {
        const contentSelect = dialog.querySelector('[data-enemy-content]');
        contentSelect.value = content;
        contentSelect.addEventListener('change', () => changeContent(contentSelect.value));
      }
      dialog.querySelectorAll('[data-stage-cancel]').forEach(button => button.addEventListener('click', () => dialog.close()));
      dialog.querySelector('[data-stage-apply]').addEventListener('click', () => {
        if (selection) { apply(resolver.selectionKey(selection)); dialog.close(); }
      });
    }
    render();
    if (!dialog.open) dialog.showModal();
  };
})(globalThis);
