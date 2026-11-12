(function (root) {
  'use strict';
  root.createStageEnemyBrowser = function (el, data) {
    const resolver = root.TRICKCAL_STAGE_ENEMY_RESOLVER.createResolver(data);
    const panel = document.createElement('div');
    panel.className = 'enemy-selection-grid';
    el.monster.closest('.enemy-selection-panel').append(panel);
    const state = { content: '', world: 1, stage: 1, difficulty: 3, strength: 1, monster: '', personality: '' };
    const openStages = new Set();
    let previousMonster;
    const labels = { crusade: '進軍', yggdrasilDigSite: '世界樹採掘基地' };
    const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const unique = (rows, key) => [...new Set(rows.map(row => row[key]))].sort((a, b) => a - b);
    const fields = ['hp', 'atk_p', 'atk_m', 'def_p', 'def_m', 'crit', 'critDmg', 'critRes', 'critDmgRes'];
    const headings = ['HP', '物理攻撃', '魔法攻撃', '物理防御', '魔法防御', '会心', '会心DMG', '会心抵抗', '会心DMG抵抗'];
    const tones = ['hp', 'attack', 'attack', 'defense', 'defense', 'critical', 'critical', 'resist', 'resist'];

    function select(key, label, values, names = {}) {
      if (!values.includes(state[key])) state[key] = values[0];
      return `<label class="enemy-select-field"><span>${label}</span><select data-stage-field="${key}">${values.map(value => `<option value="${escape(value)}" ${value === state[key] ? 'selected' : ''}>${escape(names[value] || value)}</option>`).join('')}</select></label>`;
    }

    function render(content) {
      panel.hidden = !labels[content];
      if (panel.hidden) return false;
      state.content = content;
      let conditions = resolver.conditions.filter(row => row.content === content);
      let html = select('world', content === 'crusade' ? 'ワールド' : '性格', unique(conditions, 'world'),
        content === 'crusade' ? {} : { 1: '純粋', 2: '冷静', 3: '狂気', 4: '活発', 5: '憂鬱' });
      conditions = conditions.filter(row => row.world === state.world);
      if (content === 'crusade') {
        html += select('difficulty', '難易度', unique(conditions, 'difficulty').reverse(), { 1: '微辛', 2: '中辛', 3: '激辛' });
        conditions = conditions.filter(row => row.difficulty === state.difficulty);
      } else {
        html += select('stage', '階層', unique(conditions, 'stage'));
        conditions = conditions.filter(row => row.stage === state.stage);
      }
      const available = resolver.monsters.filter(row => row.contents.includes(content));
      html += select('strength', '敵強度', unique(available, 'strength'), { 0: '小型', 1: '通常', 2: '強敵', 3: 'ボス' });
      const monsters = available.filter(row => row.strength === state.strength);
      const groups = new Map();
      monsters.forEach(monster => {
        const baseKey = monster.groupKey || monster.key;
        const key = /ウイスパー/.test(monster.baseName || monster.name)
          ? `${baseKey}:${monster.personality}` : baseKey;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(monster);
      });
      if (!groups.has(state.monster)) {
        const matching = [...groups].find(([, variants]) => variants.some(monster =>
          monster.baseName === previousMonster?.baseName && monster.personality === previousMonster?.personality
          && JSON.stringify(monster.skills) === JSON.stringify(previousMonster?.skills)));
        state.monster = matching?.[0] || groups.keys().next().value || '';
      }
      const variants = groups.get(state.monster) || [];
      const personalities = [...new Set(variants.map(monster => monster.personality))];
      if (personalities.length) html += select('personality', '敵の性格', personalities);
      panel.innerHTML = html;
      const personalityInput = panel.querySelector('[data-stage-field="personality"]');
      if (personalityInput) personalityInput.disabled = personalities.length <= 1;
      const nameCounts = new Map();
      groups.forEach(variants => {
        const name = variants[0].baseName || variants[0].name;
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      });
      el.monster.innerHTML = [...groups].map(([key, variants]) => {
        const monster = variants[0];
        const baseName = monster.baseName || monster.name;
        const groupPersonalities = [...new Set(variants.map(variant => variant.personality).filter(Boolean))];
        const name = (nameCounts.get(baseName) > 1 || /ウイスパー/.test(baseName)) && groupPersonalities.length
          ? `${baseName}（${groupPersonalities.join('・')}）` : baseName;
        return `<option value="${escape(key)}">${escape(name)}</option>`;
      }).join('');
      el.monster.value = state.monster;
      el.monster.disabled = !monsters.length;
      const selectedMonster = variants.find(monster => monster.personality === state.personality);
      previousMonster = selectedMonster;
      const rows = conditions.slice().sort((a, b) => a.stage - b.stage || a.wave - b.wave);
      const numbers = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });
      const firstWaves = new Map();
      rows.forEach(row => { if (!firstWaves.has(row.stage)) firstWaves.set(row.stage, row.wave); });
      const title = content === 'crusade' ? 'ステージ別ステータス' : '階層ステータス';
      el.variants.innerHTML = `<section class="enemy-variant-panel" aria-labelledby="stage-variant-heading">
        <div class="enemy-variant-heading"><div class="enemy-variant-heading-main">
          <h2 id="stage-variant-heading">${title}</h2>
          <details class="enemy-variant-info"><summary aria-label="ステータス表の説明" title="説明">i</summary>
            <div class="enemy-variant-info-content"><p>${content === 'crusade' ? '各ステージ行にはウェーブ1の数値を表示しています。右のボタンで残りのウェーブを表示できます。' : '選択した階層の数値を表示しています。'}</p><p>選択したステージに登場しない敵も選べます。</p></div>
          </details></div><span>${firstWaves.size}件</span></div>
        <div class="enemy-variant-table-wrap" role="region" aria-label="${title}表。横にスクロールできます" tabindex="0"><table class="enemy-variant-table" aria-label="${title}"><thead><tr><th scope="col">${content === 'crusade' ? 'ステージ' : '階層'}</th>${headings.map(label => `<th scope="col">${label}</th>`).join('')}<th scope="col">敵ダメージ補正</th></tr></thead><tbody>${rows.map(condition => {
        const result = resolver.resolve({ conditionKey: condition.key, monsterKey: selectedMonster?.key });
        if (!result) return '';
        const parent = condition.wave === firstWaves.get(condition.stage);
        const open = openStages.has(condition.stage);
        const label = content === 'crusade'
          ? parent ? `<div class="enemy-variant-actions"><span class="enemy-variant-select"><span>${state.world}-${condition.stage}</span><small>ウェーブ${condition.wave}</small></span><button type="button" class="enemy-phase-toggle" data-stage-toggle="${condition.stage}" aria-expanded="${open}" aria-label="${state.world}-${condition.stage}のウェーブを${open ? '閉じる' : '開く'}">${open ? '▾' : '▸'}</button></div>` : `<span class="enemy-phase-select"><span aria-hidden="true">↳</span><span>ウェーブ${condition.wave}</span></span>`
          : `${condition.stage}階`;
        const hidden = content === 'crusade' && !parent && !open;
        return `<tr class="${parent ? 'enemy-difficulty-row' : 'enemy-phase-row'}" data-stage-row="${condition.stage}" ${!parent ? 'data-stage-child' : ''} ${hidden ? 'hidden' : ''}><th scope="row">${label}</th>${fields.map((field, index) => `<td data-tone="${tones[index]}">${numbers.format(result[field])}</td>`).join('')}<td class="enemy-special-cell">${numbers.format(result.special)}%</td></tr>`;
      }).join('')}</tbody></table></div></section>`;
      const skills = selectedMonster?.skills || [];
      const features = selectedMonster?.features || [];
      el.detail.innerHTML = `<div class="detail-head"><div class="detail-title-row"><h2>${escape(selectedMonster?.baseName || selectedMonster?.name || '')}</h2>
        <div class="detail-context"><span class="detail-context-item">${labels[content]}</span><span class="detail-context-item">${escape(selectedMonster?.personality || '')}</span></div></div></div>
        <div class="detail-chips">${selectedMonster?.projected ? '<span class="detail-chip" title="このコンテンツ・強度での能力値は生成式による推定です。攻撃と特徴は元のモンスターを引き継いでいます。">推定値</span>' : ''}<span class="detail-chip ${selectedMonster?.dmgType === 'magic' ? 'is-magic' : 'is-physical'}">${selectedMonster?.dmgType === 'magic' ? '魔法攻撃' : '物理攻撃'}</span>
          ${features.map(feature => `<span class="detail-chip">${escape(feature.label)}</span>`).join('')}</div>
        ${features.length ? '<details class="enemy-variant-info"><summary aria-label="特徴の計算対応について" title="計算対応">i</summary><div class="enemy-variant-info-content"><p>これらの特徴は説明表示のみ対応しています。</p></div></details>' : ''}
        <div class="enemy-variant-heading"><div class="enemy-variant-heading-main"><h2>攻撃</h2>
          <details class="enemy-variant-info"><summary aria-label="攻撃倍率の説明" title="説明">i</summary><div class="enemy-variant-info-content"><p>倍率は効果ごとに表示しています。</p></div></details></div></div>
        <div class="enemy-skill-list">${skills.map(skill => `<article class="enemy-skill-card"><div class="enemy-skill-card-heading"><div class="enemy-skill-title-group"><h3 class="enemy-skill-name">${escape(skill.name)}</h3></div></div>
          <div class="enemy-skill-card-heading">${skill.multipliers.map(value => value == null ? '—' : `${numbers.format(value)}%`).join(' / ')}</div></article>`).join('')}</div>`;
      return true;
    }

    panel.addEventListener('change', event => {
      const key = event.target.dataset.stageField;
      if (!key) return;
      state[key] = key === 'personality' ? event.target.value : Number(event.target.value);
      render(state.content);
    });
    el.variants.addEventListener('click', event => {
      const button = event.target.closest('[data-stage-toggle]');
      if (!button) return;
      const stage = Number(button.dataset.stageToggle);
      if (openStages.has(stage)) openStages.delete(stage);
      else openStages.add(stage);
      const open = openStages.has(stage);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', `${state.world}-${stage}のウェーブを${open ? '閉じる' : '開く'}`);
      button.textContent = button.textContent.replace(/^[▾▸]/, open ? '▾' : '▸');
      el.variants.querySelectorAll(`[data-stage-row="${stage}"][data-stage-child]`).forEach(row => { row.hidden = !open; });
    });
    el.monster.addEventListener('change', () => {
      if (!labels[el.content.value]) return;
      state.monster = el.monster.value;
      render(el.content.value);
    });
    return { render };
  };
})(globalThis);
