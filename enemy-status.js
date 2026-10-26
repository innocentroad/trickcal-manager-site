(() => {
  'use strict';

  const storageBoot = window.TRICKCAL_STORAGE_BOOT || Promise.resolve({ ok: true });
  storageBoot.then(bootResult => {
    if (!bootResult?.ok) return;
    const storageFacade = window.TRICKCAL_STORAGE_FACADE;
    if (!storageFacade) throw new Error('storage facade unavailable');
    const storageLocal = storageFacade.localStorage;

    const presets = typeof ENEMY_PRESETS === 'undefined' ? {} : ENEMY_PRESETS;
    const entries = Object.entries(presets)
      .filter(([key, preset]) => !isHiddenPreset(key, preset))
      .map(([key, preset]) => ({ key, preset, metadata: getEnemyPresetMetadata(preset, key) }))
      .sort((a, b) => compareEnemyPresetEntries([a.key, a.preset], [b.key, b.preset]));
    const entryByKey = new Map(entries.map(entry => [entry.key, entry]));
    const { contents, groupsByContent } = indexEntries(entries);
    const params = new URLSearchParams(location.search);
    const rawRequestedKey = params.get('preset');
    const requestedKey = typeof resolveEnemyPresetKey === 'function' ? resolveEnemyPresetKey(rawRequestedKey) : rawRequestedKey;
    const canonicalKey = presets[requestedKey]?.selectionAliasOf || requestedKey;
    const requestedEntry = entryByKey.get(canonicalKey) || null;
    const firstEntry = entries[0] || null;
    const seed = requestedEntry || firstEntry;
    const seedGroup = seed ? findGroup(seed.contentKey, seed.monsterKey) : null;
    const initialEntry = requestedEntry || seedGroup?.variants[0] || null;
    const requestedPhase = Math.max(0, Number(params.get('phase')) || 0);
    const initialPhase = requestedEntry
      ? Math.min(requestedPhase, Math.max(0, (requestedEntry.preset.phases?.length || 1) - 1))
      : 0;
    const state = {
      key: initialEntry?.key || '',
      contentKey: initialEntry?.contentKey || '',
      monsterKey: initialEntry?.monsterKey || '',
      phase: initialPhase,
      openKey: (initialEntry?.preset.phases?.length || 0) > 1 ? initialEntry.key : ''
    };
    const numberFormat = new Intl.NumberFormat('ja-JP');
    const publicAttackCategories = new Set(['基本攻撃', '強化攻撃', 'スキル', '状態異常', 'SPスキル']);
    const publicAttackCategoryCandidates = new Set(['CTスキル', 'HP条件スキル']);
    const publicWeaknessStatuses = new Set(['感電', '苦痛']);
    const publicStatusTypes = new Set(['火傷']);
    const el = {
      content: document.getElementById('enemy-status-content'),
      monster: document.getElementById('enemy-status-monster'),
      variants: document.getElementById('enemy-status-variants'),
      detail: document.getElementById('enemy-status-detail'),
      theme: document.getElementById('enemy-status-theme')
    };

    initTheme();
    bindEvents();
    render();

    function indexEntries(sourceEntries) {
      const contentMap = new Map();
      const grouped = new Map();
      sourceEntries.forEach(entry => {
        const { key, preset, metadata } = entry;
        const contentKey = metadata.type === 'dungeon'
          ? `${metadata.type}:${metadata.mode}`
          : metadata.type || 'other';
        const monsterKey = JSON.stringify([
          metadata.type,
          metadata.mode,
          metadata.world,
          metadata.name,
          metadata.personality
        ]);
        entry.contentKey = contentKey;
        entry.monsterKey = monsterKey;
        if (!contentMap.has(contentKey)) {
          contentMap.set(contentKey, {
            key: contentKey,
            label: getContentLabel(metadata),
            monsters: []
          });
          grouped.set(contentKey, new Map());
        }
        const monsterMap = grouped.get(contentKey);
        if (!monsterMap.has(monsterKey)) {
          monsterMap.set(monsterKey, {
            key: monsterKey,
            contentKey,
            metadata,
            variants: []
          });
        }
        monsterMap.get(monsterKey).variants.push(entry);
      });
      grouped.forEach((monsterMap, contentKey) => {
        const monsters = Array.from(monsterMap.values());
        monsters.forEach(monster => monster.variants.sort(compareVariants));
        contentMap.get(contentKey).monsters = monsters;
      });
      return { contents: contentMap, groupsByContent: grouped };
    }

    function findGroup(contentKey, monsterKey) {
      return groupsByContent.get(contentKey)?.get(monsterKey) || null;
    }

    function getContentLabel(metadata) {
      return metadata.type === 'dungeon'
        ? metadata.modeLabel || metadata.contentLabel || 'ダンジョン'
        : metadata.contentLabel || metadata.selectionContentLabel || metadata.contentShortLabel || 'その他';
    }

    function compareVariants(a, b) {
      const difficultyKeys = Object.keys(ENEMY_PRESET_CONTENTS?.[a.metadata.type]?.difficulties || {});
      if (a.metadata.difficulty !== b.metadata.difficulty && difficultyKeys.length) {
        const rank = value => {
          const index = difficultyKeys.indexOf(value);
          return index < 0 ? -1 : index;
        };
        const rankDifference = rank(b.metadata.difficulty) - rank(a.metadata.difficulty);
        if (rankDifference) return rankDifference;
      }
      if (['dimensionalClash', 'eliasFrontier'].includes(a.metadata.type)
        && a.metadata.stage !== b.metadata.stage) {
        return b.metadata.stage - a.metadata.stage;
      }
      return compareEnemyPresetEntries([a.key, a.preset], [b.key, b.preset]);
    }

    function bindEvents() {
      el.content?.addEventListener('change', () => {
        const contentKey = el.content.value;
        const firstMonster = contents.get(contentKey)?.monsters[0];
        state.contentKey = contentKey;
        state.monsterKey = firstMonster?.key || '';
        selectVariant(firstMonster?.variants[0] || null, 0);
      });
      el.monster?.addEventListener('change', () => {
        const nextGroup = findGroup(state.contentKey, el.monster.value);
        if (!nextGroup) return;
        const current = entryByKey.get(state.key);
        const preserved = current && nextGroup.variants.find(candidate =>
          candidate.metadata.difficulty === current.metadata.difficulty
          && candidate.metadata.world === current.metadata.world
          && candidate.metadata.stage === current.metadata.stage
        );
        state.monsterKey = nextGroup.key;
        selectVariant(preserved || nextGroup.variants[0] || null, 0);
      });
      el.variants?.addEventListener('click', event => {
        const toggle = event.target.closest('[data-enemy-phase-toggle]');
        if (toggle && el.variants.contains(toggle)) {
          const key = toggle.dataset.enemyPhaseToggle;
          const entry = entryByKey.get(key);
          if ((entry?.preset.phases?.length || 0) <= 1) return;
          const interaction = captureVariantInteraction(toggle, 'toggle', key);
          state.openKey = state.openKey === key ? '' : key;
          renderVariants(interaction);
          return;
        }
        const phaseButton = event.target.closest('[data-enemy-phase-key]');
        if (phaseButton && el.variants.contains(phaseButton)) {
          const entry = entryByKey.get(phaseButton.dataset.enemyPhaseKey);
          if (!entry) return;
          state.monsterKey = entry.monsterKey;
          const phaseIndex = Number(phaseButton.dataset.enemyPhaseIndex) || 0;
          selectVariant(entry, phaseIndex, captureVariantInteraction(phaseButton, 'phase', entry.key, phaseIndex));
          return;
        }
        const variantButton = event.target.closest('[data-enemy-select-key]');
        if (variantButton && el.variants.contains(variantButton)) {
          const entry = entryByKey.get(variantButton.dataset.enemySelectKey);
          if (!entry) return;
          state.monsterKey = entry.monsterKey;
          selectVariant(entry, 0, captureVariantInteraction(variantButton, 'variant', entry.key));
        }
      });
      el.theme?.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try { storageLocal.setItem('trickcal_theme', next); } catch (error) {
          if (error?.name === 'StorageRuntimeError') document.documentElement.dataset.storageError = error.result?.code || 'failed';
        }
      });
    }

    function selectVariant(entry, phaseIndex, interaction = null) {
      if (!entry) {
        state.key = '';
        state.phase = 0;
        state.openKey = '';
      } else {
        state.key = entry.key;
        const phaseCount = Array.isArray(entry.preset.phases) ? entry.preset.phases.length : 0;
        state.phase = Math.min(Math.max(0, phaseIndex), Math.max(0, phaseCount - 1));
        state.openKey = phaseCount > 1 ? entry.key : '';
      }
      updateUrl();
      render(interaction);
    }

    function captureVariantInteraction(button, kind, key, phaseIndex = null) {
      const table = el.variants?.querySelector('.enemy-variant-table-wrap');
      return {
        kind,
        key,
        phaseIndex,
        hadFocus: document.activeElement === button,
        scrollLeft: table?.scrollLeft ?? 0
      };
    }

    function restoreVariantInteraction(interaction) {
      if (!interaction || !el.variants) return;
      const table = el.variants.querySelector('.enemy-variant-table-wrap');
      if (table) table.scrollLeft = interaction.scrollLeft;

      if (!interaction.hadFocus) return;
      const controls = Array.from(el.variants.querySelectorAll(
        '[data-enemy-phase-toggle], [data-enemy-select-key], [data-enemy-phase-key]'
      ));
      const target = controls.find(button => {
        if (interaction.kind === 'toggle') return button.dataset.enemyPhaseToggle === interaction.key;
        if (interaction.kind === 'variant') return button.dataset.enemySelectKey === interaction.key;
        return button.dataset.enemyPhaseKey === interaction.key
          && Number(button.dataset.enemyPhaseIndex) === interaction.phaseIndex;
      });
      target?.focus({ preventScroll: true });
    }

    function render(interaction = null) {
      renderSelectors();
      renderVariants(interaction);
      renderDetail();
    }

    function renderSelectors() {
      if (!el.content || !el.monster) return;
      const contentOptions = Array.from(contents.values());
      el.content.innerHTML = contentOptions.length
        ? contentOptions.map(content => `<option value="${escapeAttr(content.key)}">${escapeHtml(content.label)}</option>`).join('')
        : '<option value="">コンテンツがありません</option>';
      el.content.value = state.contentKey;
      const monsters = contents.get(state.contentKey)?.monsters || [];
      const nameCounts = new Map();
      monsters.forEach(group => {
        const name = group.metadata.name || '';
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      });
      el.monster.innerHTML = monsters.length
        ? monsters.map(group => `<option value="${escapeAttr(group.key)}">${escapeHtml(getMonsterLabel(group, nameCounts))}</option>`).join('')
        : '<option value="">該当する敵がありません</option>';
      el.monster.value = state.monsterKey;
      el.monster.disabled = monsters.length === 0;
      el.content.disabled = contentOptions.length === 0;
    }

    function getMonsterLabel(group, nameCounts) {
      const metadata = group.metadata;
      const base = metadata.name || '名称未設定';
      const context = nameCounts.get(metadata.name || '') > 1
        ? [metadata.worldLabel, metadata.personality, metadata.modeLabel].filter(Boolean)
        : [];
      const custom = group.variants.some(item => item.preset.isCustom) ? ['保存済み'] : [];
      return [base, ...context, ...custom].join(' / ');
    }

    function renderVariants(interaction = null) {
      if (!el.variants) return;
      const group = findGroup(state.contentKey, state.monsterKey);
      if (!group?.variants.length) {
        el.variants.innerHTML = '<section class="enemy-variant-panel"><div class="empty-state">このコンテンツに表示できる敵がありません。</div></section>';
        restoreVariantInteraction(interaction);
        return;
      }
      const rows = group.variants.map(entry => {
        const { key, preset, metadata } = entry;
        const phases = Array.isArray(preset.phases) ? preset.phases : [];
        const expanded = state.openKey === key && phases.length > 1;
        const scaled = scalePreset(preset, getPhase(preset, 0));
        const selected = key === state.key && state.phase === 0;
        const label = getVariantLabel(metadata);
        const firstPhaseLabel = phases.length ? phases[0].name || 'フェーズ1' : '';
        const selectedPhaseHint = key === state.key && state.phase > 0 && !expanded
          ? phases[state.phase]?.name || `フェーズ${state.phase + 1}`
          : '';
        const phaseRows = expanded ? phases.slice(1).map((phase, offset) => {
          const index = offset + 1;
          const phaseStats = scalePreset(preset, phase);
          const phaseSelected = key === state.key && index === state.phase;
          const phaseLabel = phase.name || `フェーズ${index + 1}`;
          return `
            <tr class="enemy-phase-row${phaseSelected ? ' is-selected' : ''}">
              <th scope="row">
                <button type="button" class="enemy-phase-select" data-enemy-phase-key="${escapeAttr(key)}" data-enemy-phase-index="${index}" aria-pressed="${phaseSelected}">
                  <span aria-hidden="true">↳</span><span>${escapeHtml(phaseLabel)}</span>
                </button>
              </th>
              ${renderStatCells(phaseStats)}
            </tr>`;
        }).join('') : '';
        return `
          <tr class="enemy-difficulty-row${selected ? ' is-selected' : ''}">
            <th scope="row">
              <div class="enemy-variant-actions">
                <button type="button" class="enemy-variant-select" data-enemy-select-key="${escapeAttr(key)}" aria-pressed="${selected}">
                  <span>${escapeHtml(label)}</span>${firstPhaseLabel ? `<small>${escapeHtml(firstPhaseLabel)}</small>` : ''}${selectedPhaseHint ? `<small class="enemy-selected-phase-hint">選択中：${escapeHtml(selectedPhaseHint)}</small>` : ''}
                </button>
                ${phases.length > 1 ? `<button type="button" class="enemy-phase-toggle" data-enemy-phase-toggle="${escapeAttr(key)}" aria-expanded="${expanded}" aria-label="${escapeAttr(`${label}のフェーズを${expanded ? '閉じる' : '開く'}`)}">${expanded ? '▾' : '▸'}</button>` : ''}
              </div>
            </th>
            ${renderStatCells(scaled)}
          </tr>${phaseRows}`;
      }).join('');
      el.variants.innerHTML = `
        <section class="enemy-variant-panel" aria-labelledby="enemy-variant-heading">
          <div class="enemy-variant-heading">
            <div class="enemy-variant-heading-main">
              <h2 id="enemy-variant-heading">難易度別ステータス</h2>
              <details class="enemy-variant-info">
                <summary aria-label="難易度別ステータスの説明" title="説明">i</summary>
                <div class="enemy-variant-info-content">
                  <p>難易度行には第1フェーズの数値を表示しています。</p>
                  <p>行を選ぶと、下の敵詳細が切り替わります。</p>
                  <p>ステータスには予測値が含まれます。</p>
                </div>
              </details>
            </div>
            <span>${group.variants.length}件</span>
          </div>
          <div class="enemy-variant-table-wrap" role="region" aria-label="難易度別ステータス表。横にスクロールできます" tabindex="0">
            <table class="enemy-variant-table" aria-label="難易度別ステータス">
              <thead><tr>
                <th scope="col">難易度・段階</th>
                <th scope="col">HP</th><th scope="col">物理攻撃</th><th scope="col">魔法攻撃</th>
                <th scope="col">物理防御</th><th scope="col">魔法防御</th>
                <th scope="col">会心</th><th scope="col">会心DMG</th>
                <th scope="col">会心抵抗</th><th scope="col">会心DMG抵抗</th><th scope="col">敵用補正</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>`;
      restoreVariantInteraction(interaction);
    }

    function getVariantLabel(metadata) {
      return [metadata.difficultyLabel, metadata.worldLabel, metadata.stageLabel]
        .filter(Boolean)
        .join(' / ') || '難易度未設定';
    }

    function renderStatCells(scaled) {
      const columns = [
        ['hp', 'hp'], ['atk_p', 'attack'], ['atk_m', 'attack'],
        ['def_p', 'defense'], ['def_m', 'defense'], ['crit', 'critical'],
        ['critDmg', 'critical'], ['critRes', 'resist'], ['critDmgRes', 'resist']
      ];
      return columns.map(([key, tone]) => `<td data-tone="${tone}">${formatNumber(scaled[key])}</td>`).join('')
        + `<td class="enemy-special-cell">${formatPercentCell(scaled.special)}</td>`;
    }

    function formatPercentCell(value) {
      const formatted = formatNumber(value);
      return formatted === '—' ? formatted : `${formatted}%`;
    }

    function renderDetail() {
      if (!el.detail) return;
      const entry = entryByKey.get(state.key);
      if (!entry) {
        el.detail.innerHTML = '<div class="empty-state">選択中の敵データがありません。</div>';
        return;
      }
      const { key, preset, metadata } = entry;
      const phases = Array.isArray(preset.phases) ? preset.phases : [];
      state.phase = Math.min(state.phase, Math.max(0, phases.length - 1));
      const ruleLabels = formatContentRules(metadata.rules, metadata);
      const weakness = formatWeakness(preset.weakness);
      const modifiers = formatModifiers(preset.modifiers);
      const contextItems = [
        { label: getContentLabel(metadata), primary: true },
        { label: metadata.modeLabel },
        { label: metadata.difficultyLabel },
        { label: metadata.worldLabel },
        { label: metadata.stageLabel }
      ].filter(item => item.label);
      const skills = Array.isArray(preset.skills) ? preset.skills : [];
      el.detail.innerHTML = `
        <div class="detail-head">
          <div class="detail-title-row">
            <h2>${escapeHtml(metadata.name || '名称未設定')}</h2>
            ${contextItems.length ? `<div class="detail-context" aria-label="敵の分類">${contextItems.map(item => `<span class="detail-context-item${item.primary ? ' is-primary' : ''}"${item.title ? ` title="${escapeAttr(item.title)}"` : ''}>${escapeHtml(item.label)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="detail-chips">
          ${metadata.personality ? `<span class="detail-chip">${escapeHtml(metadata.personality)}</span>` : ''}
          ${metadata.sizeLabel ? `<span class="detail-chip">${escapeHtml(metadata.sizeLabel)}</span>` : ''}
          <span class="detail-chip ${preset.dmgType === 'mag' ? 'is-magic' : 'is-physical'}">${formatDamageType(preset.dmgType)}</span>
          ${weakness.map(item => `<span class="detail-chip">${escapeHtml(item)}</span>`).join('')}
        </div>
        ${ruleLabels.length ? `
          <div class="detail-rules" aria-label="ステージ設定">
            ${ruleLabels.map(label => `<span class="detail-rule">${escapeHtml(label)}</span>`).join('')}
          </div>` : ''}
        ${modifiers.length ? `
          <section class="detail-section">
            <h3>固有バフ/デバフ</h3>
            <div class="note-list">${modifiers.map(item => `<span class="note-item">${escapeHtml(item)}</span>`).join('')}</div>
          </section>` : ''}
        <section class="detail-section">
          <h3>行動・命中内訳</h3>
          ${skills.length ? `
            <div class="enemy-skill-list">${skills.map(renderEnemySkill).join('')}</div>` : '<div class="note-item">登録された行動はありません。</div>'}
        </section>`;
    }

    function renderEnemySkill(skill) {
      const hits = Array.isArray(skill.hits) ? skill.hits : [];
      const actionLabels = { '攻撃': '攻撃', attack: '攻撃', DoT: '継続ダメージ' };
      const actionLabel = actionLabels[skill.action] || '';
      const damageTypeLabel = skill.damageType === 'physical' ? '物理' : skill.damageType === 'magic' ? '魔法' : '';
      const classification = summarizeClassification(skill, hits);
      const hitCount = finiteNumber(skill.hitCount);
      const hitCountLabel = hitCount == null ? '' : `${formatPlainNumber(hitCount)}回`;
      const breakdownLabel = [hits.length ? `${hits.length}区間` : '', hitCountLabel].filter(Boolean).join('・');
      return `
        <article class="enemy-skill-card">
          <div class="enemy-skill-card-heading">
            <div class="enemy-skill-title-group">
              <div class="enemy-skill-tags">
                ${actionLabel ? `<span class="enemy-skill-tag is-action">行動：${escapeHtml(actionLabel)}</span>` : ''}
                ${classification ? `<span class="enemy-skill-tag is-category">判定：${escapeHtml(classification)}</span>` : ''}
                ${damageTypeLabel ? `<span class="enemy-skill-tag is-damage-type">属性：${damageTypeLabel}</span>` : ''}
                ${publicStatusTypes.has(skill.statusType) ? `<span class="enemy-skill-tag is-status-type">状態：${escapeHtml(skill.statusType)}</span>` : ''}
              </div>
              <h4 class="enemy-skill-name">${escapeHtml(skill.name || '名称未設定')}</h4>
            </div>
            <strong class="enemy-skill-multiplier">${formatSkillMultiplier(skill)}</strong>
          </div>
          ${skill.description ? `<p class="enemy-skill-description">${escapeHtml(skill.description)}</p>` : ''}
          ${hits.length ? `
            <details class="enemy-skill-breakdown">
              <summary>命中内訳${breakdownLabel ? `（${escapeHtml(breakdownLabel)}）` : ''}</summary>
              <div class="enemy-hit-list" aria-label="${escapeAttr(`${skill.name || '技'}の命中内訳`)}">${hits.map((hit, index) => renderEnemyHit(hit, index)).join('')}</div>
            </details>` : ''}
        </article>`;
    }

    function renderEnemyHit(hit, index) {
      const coefficient = finiteNumber(hit.coefficientP);
      const count = finiteNumber(hit.count);
      const total = coefficient == null || count == null ? null : coefficient * count;
      const damageTypeLabels = { physical: '物理', magic: '魔法' };
      const tags = [
        damageTypeLabels[hit.damageType] ? `属性：${damageTypeLabels[hit.damageType]}` : '',
        hit.intervalSeconds == null ? '' : `間隔：${formatSeconds(hit.intervalSeconds)}`
      ].filter(Boolean);
      const rateParts = [];
      if (coefficient != null) rateParts.push(`${formatNumber(coefficient)}%/発`);
      if (count != null) rateParts.push(`× ${formatPlainNumber(count)}回`);
      if (total != null) rateParts.push(`計 ${formatNumber(total)}%`);
      return `
        <article class="enemy-hit-segment">
          <div class="enemy-hit-segment-heading">
            <strong>${escapeHtml(hit.label || `区間${index + 1}`)}</strong>
            ${rateParts.length ? `<span>${escapeHtml(rateParts.join('　'))}</span>` : ''}
          </div>
          ${tags.length ? `<div class="enemy-hit-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </article>`;
    }

    function hasClassification(value) {
      return !!(value?.classificationMode || value?.attackCategory
        || (Array.isArray(value?.attackCategoryCandidates) && value.attackCategoryCandidates.length));
    }

    function summarizeClassification(skill, hits) {
      if (hasClassification(skill) && (skill.classificationMode !== 'unconfirmed' || !hits.length)) {
        return renderClassification(skill);
      }
      const classifications = hits.map(hit => {
        const source = hasClassification(hit) ? hit : skill;
        return { label: renderClassification(source), registered: hasClassification(source) };
      });
      const recognized = [...new Set(classifications
        .map(item => item.label)
        .filter(label => label && label !== '判定未確認'))];
      const hasUnconfirmed = classifications.some(item =>
        item.label === '判定未確認' || (!item.label && item.registered)
      );
      if (!recognized.length) return hasUnconfirmed ? '判定未確認' : '';
      const summary = recognized.join('・');
      const hasMissing = classifications.some(item => !item.label);
      return hasUnconfirmed || hasMissing ? `${summary}（一部未確認）` : summary;
    }

    function renderClassification(value) {
      if (value.classificationMode === 'unconfirmed') return '判定未確認';
      if (value.classificationMode === 'entry-dependent') {
        const candidates = (Array.isArray(value.attackCategoryCandidates) ? value.attackCategoryCandidates : [])
          .filter(candidate => publicAttackCategoryCandidates.has(candidate));
        return `条件で変化${candidates.length ? `（${candidates.join('・')}）` : ''}`;
      }
      if (Array.isArray(value.attackCategoryCandidates) && value.attackCategoryCandidates.length) {
        const candidates = value.attackCategoryCandidates.filter(candidate => publicAttackCategoryCandidates.has(candidate));
        return candidates.length ? `候補：${candidates.join('・')}` : '';
      }
      return publicAttackCategories.has(value.attackCategory) ? value.attackCategory : '';
    }

    function formatSkillMultiplier(skill) {
      const multiplier = finiteNumber(skill.mult);
      const hitCount = finiteNumber(skill.hitCount);
      if (multiplier == null) return hitCount == null ? '—' : `${formatPlainNumber(hitCount)}回`;
      const value = `${formatNumber(multiplier)}%`;
      if (skill.multiplierBasis === 'hit') {
        return `${value}/発${hitCount == null ? '' : ` × ${formatPlainNumber(hitCount)}回`}`;
      }
      return `合計 ${value}${hitCount == null ? '' : ` ・ ${formatPlainNumber(hitCount)}回`}`;
    }

    function finiteNumber(value) {
      if (value == null || (typeof value === 'string' && !value.trim())) return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }

    function formatSeconds(value) {
      const numeric = finiteNumber(value);
      return numeric == null ? '—' : `${formatPlainNumber(numeric)}秒`;
    }

    function getPhase(preset, index) {
      const phases = Array.isArray(preset?.phases) ? preset.phases : [];
      return phases[Math.min(Math.max(0, index), Math.max(0, phases.length - 1))] || null;
    }

    function scalePreset(preset, phase) {
      if (!phase) return { ...preset };
      const result = { ...preset };
      if (phase.stats && typeof phase.stats === 'object') {
        for (const key of ['hp', 'atk_p', 'atk_m', 'def_p', 'def_m', 'crit', 'critDmg', 'critRes', 'critDmgRes', 'special']) {
          const value = phase.stats[key];
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0) result[key] = value;
        }
        return result;
      }
      const multiplier = Number(phase.mult) || 1;
      (phase.scaleStats || []).forEach(key => {
        result[key] = Math.round((Number(preset[key]) || 0) * multiplier);
      });
      return result;
    }

    function isHiddenPreset(key, preset) {
      return !!preset?.selectionAliasOf || !!preset?.hideInSelection
        || `${key} ${preset?.name || ''}`.toLocaleLowerCase('en-US').includes('dummy');
    }

    function formatContentRules(rules = {}, metadata = {}) {
      const isEliasFrontier = metadata.type === 'eliasFrontier';
      return [
        !isEliasFrontier && rules.fixedGrade ? `${rules.fixedGrade}年生固定` : '',
        !isEliasFrontier && rules.disabledEffectSources?.includes('synergy') ? 'シナジー無効' : '',
        rules.disabledEffectSources?.includes('spell') ? 'スペル使用不可' : '',
        rules.artifactLimit ? `遺物上限 ${rules.artifactLimit}` : ''
      ].filter(Boolean);
    }

    function formatWeakness(weakness = {}) {
      return Object.entries(weakness || {}).map(([key, value]) => {
        if (key === 'statusDamage') return `状態異常ダメージ弱点 その他倍率+${formatNumber(value?.otherP)}%`;
        if (key === 'statusTakenDamage') {
          if (!publicWeaknessStatuses.has(value?.status)) return '';
          return `${value.status}状態弱点 被ダメージ量+${formatNumber(value?.add)}%`;
        }
        const labels = { phys: '物理弱点', mag: '魔法弱点' };
        const label = labels[key];
        return label ? `${label} +${formatNumber(value?.add)}%` : '';
      }).filter(Boolean);
    }

    function formatModifiers(modifiers = {}) {
      const labels = {
        anger: '怒り',
        takenDmg: '被ダメージ',
        painTakenDmg: '苦痛被ダメージ',
        breakTakenDmg: '破壊被ダメージ'
      };
      const groups = { buffs: '敵バフ', debuffs: '敵側', targetDebuffs: '対象側' };
      const result = [];
      Object.entries(modifiers || {}).forEach(([groupKey, values]) => {
        const groupLabel = groups[groupKey];
        if (!groupLabel) return;
        Object.entries(values || {}).forEach(([key, value]) => {
          const label = labels[key];
          if (!label) return;
          if ((key === 'anger' || key === 'breakTakenDmg') && value && typeof value === 'object') {
            const perStack = finiteNumber(value.perStack);
            const maxStacks = finiteNumber(value.maxStacks);
            const effectLabel = key === 'anger' ? '与ダメージ' : '被ダメージ量';
            const stackEffect = `${groupLabel}: ${label} 1スタックごとに${effectLabel}+${formatNumber(perStack)}%`;
            if (maxStacks === 99) {
              result.push(`${stackEffect} / 最大スタック不明`);
              return;
            }
            const maxLabel = maxStacks == null
              ? ''
              : ` / 最大${formatPlainNumber(maxStacks)}スタック (+${formatNumber(perStack == null ? null : perStack * maxStacks)}%)`;
            result.push(`${stackEffect}${maxLabel}`);
            return;
          }
          if (finiteNumber(value) == null) return;
          result.push(`${groupLabel}: ${label} ${formatSignedPercent(value)}`);
        });
      });
      return result;
    }

    function formatDamageType(value) {
      return value === 'mag' ? '魔法攻撃' : value === 'phys' ? '物理攻撃' : '攻撃種別不明';
    }

    function formatNumber(value) {
      if (value == null || (typeof value === 'string' && !value.trim())) return '—';
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '—';
      return Number.isInteger(numeric) ? numberFormat.format(numeric) : formatPlainNumber(numeric);
    }

    function formatPlainNumber(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '0';
      return numeric.toLocaleString('ja-JP', { maximumFractionDigits: 3 });
    }

    function formatSignedPercent(value) {
      const numeric = Number(value) || 0;
      return `${numeric > 0 ? '+' : ''}${formatPlainNumber(numeric)}%`;
    }

    function updateUrl() {
      const next = new URL(location.href);
      if (state.key) next.searchParams.set('preset', state.key);
      else next.searchParams.delete('preset');
      if (state.phase) next.searchParams.set('phase', String(state.phase));
      else next.searchParams.delete('phase');
      history.replaceState(null, '', next);
    }

    function initTheme() {
      let theme = 'dark';
      try { theme = storageLocal.getItem('trickcal_theme') || 'dark'; } catch (error) {
        if (error?.name === 'StorageRuntimeError') throw error;
      }
      applyTheme(theme === 'light' ? 'light' : 'dark');
    }

    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      if (el.theme) {
        el.theme.setAttribute('aria-pressed', String(theme !== 'light'));
        el.theme.setAttribute('aria-label', theme === 'light' ? 'ダークモードに切替' : 'ライトモードに切替');
      }
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }
  }).catch(error => {
    if (error?.name === 'StorageRuntimeError') {
      document.documentElement?.setAttribute('data-storage-error', error.result?.code || 'failed');
      return;
    }
    console.error(error);
  });
})();
