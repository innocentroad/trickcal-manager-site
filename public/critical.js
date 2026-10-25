(async function(){
  'use strict';
  const boot=await window.TRICKCAL_STORAGE_BOOT;
  const storageReady=boot?.ok===true&&!!window.TRICKCAL_STORAGE_FACADE;
  const core=window.TRICKCAL_CRITICAL,math=window.TRICKCAL_DPS_SIMULATOR,$=id=>document.getElementById(id);
  document.querySelectorAll('[data-critical-icon]').forEach(image=>{image.src=window.TRICKCAL_PUBLIC_SITE?.assetUrl(image.dataset.criticalIcon)||'../'+image.dataset.criticalIcon;});
  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const critMultiplierLower=math.clampCombatCritMultiplier(Number.NEGATIVE_INFINITY),critMultiplierUpper=math.clampCombatCritMultiplier(Number.POSITIVE_INFINITY);
  const multiplierLimit=value=>{if(!Number.isFinite(value))return '';if(Math.abs(value-critMultiplierLower)<1e-9)return '下限';if(Math.abs(value-critMultiplierUpper)<1e-9)return '上限';return '';};
  const measureResult=()=>document.documentElement.style.setProperty('--critical-result-height',$('critical-results').getBoundingClientRect().height+'px');
  new ResizeObserver(measureResult).observe($('critical-results'));
  const fitViewport=()=>{document.documentElement.style.setProperty('--critical-keyboard-offset',Math.max(0,innerHeight-(window.visualViewport?.height||innerHeight)-(window.visualViewport?.offsetTop||0))+'px');measureResult();};
  window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);window.addEventListener('resize',fitViewport);fitViewport();
  const positionHelp=details=>{const popup=details.querySelector(':scope > p'),anchor=details.querySelector(':scope > summary');if(!details.open||!popup||!anchor)return;const margin=8,viewportHeight=window.visualViewport?.height||innerHeight;popup.style.left=margin+'px';popup.style.top=margin+'px';const anchorRect=anchor.getBoundingClientRect(),popupRect=popup.getBoundingClientRect(),left=Math.max(margin,Math.min(anchorRect.left,innerWidth-margin-popupRect.width));let top=anchorRect.bottom+4;if(top+popupRect.height>viewportHeight-margin)top=anchorRect.top-popupRect.height-4;if(top<margin)top=margin;popup.style.left=left+'px';popup.style.top=top+'px';details.dataset.helpPositioned='true';};
  const helpItems=[...document.querySelectorAll('.boost-help')];helpItems.forEach(details=>details.addEventListener('toggle',()=>{if(details.open)positionHelp(details);else{delete details.dataset.helpPositioned;const popup=details.querySelector(':scope > p');if(popup){popup.style.left='';popup.style.top='';}}}));
  const repositionOpenHelp=()=>helpItems.filter(details=>details.open).forEach(positionHelp);window.addEventListener('resize',repositionOpenHelp);window.addEventListener('scroll',repositionOpenHelp,true);window.visualViewport?.addEventListener('resize',repositionOpenHelp);
  const KEY='trickcal_tool_critical_settings_v1',LOCK='trickcal-tool-critical-input-v1',writer=crypto.randomUUID();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=p=>window.TRICKCAL_PUBLIC_SITE?.assetUrl(p)||'../'+p;
  const nfmt=(v,d=2)=>Number(v).toLocaleString('ja-JP',{maximumFractionDigits:d});
  const percent=v=>nfmt(v*100)+'%';
  const boosts=()=>s.side==='self'?['会心率アップ','会心ダメージ量アップ']:['会心抵抗アップ','会心ダメージ抵抗アップ'];
  const activeKeys=()=>s.side==='self'?core.KEYS.slice(0,2):core.KEYS.slice(2);
  const oppositeKeys=()=>s.side==='self'?core.KEYS.slice(2):core.KEYS.slice(0,2);
  let s=core.defaults(),revision=null,timer=null,dirty=false,blocked=false,frozen=false,epoch=0,manager={},cardIndex={},cardLibrary=null;
  let leaseHeld=false,leaseRelease=null,leasePending=null;
  const loads=new Map();
  function loadScript(file){if(!loads.has(file))loads.set(file,new Promise((resolve,reject)=>{const e=document.createElement('script');e.src=asset(file);e.onload=resolve;e.onerror=()=>{loads.delete(file);reject(Error('データを読み込めませんでした。再度お試しください。'));};document.head.append(e);}));return loads.get(file);}
  async function ensureCards(){if(cardLibrary)return;await loadScript('cards.js');cardIndex=window.TRICKCAL_CARD_INDEX;cardLibrary=window.TRICKCAL_CARD_LIBRARY;}
  async function ensureStats(){await loadScript('statData.js');await loadScript('public-release-config.js');await loadScript('stat-engine.js');}
  async function ensureApostles(){await loadScript('apostles.js');if(typeof APOSTLE_INDEX==='undefined')throw Error('使徒の効果データを読み込めませんでした。');}
  function readManager(){try{if(!storageReady)throw Error();const raw=window.TRICKCAL_STORAGE_FACADE.localStorage.getItem('trickcal_stat_prototype_v1');manager=raw?JSON.parse(raw):{};if(!manager||typeof manager!=='object'||Array.isArray(manager))throw Error();if(typeof migrateCardStateMap==='function')manager.cards=migrateCardStateMap(manager.cards||{});return manager;}catch{throw Error('管理の保存値を読み込めませんでした。');}}
  const cardById=id=>Object.prototype.hasOwnProperty.call(cardIndex,id)?cardIndex[id]:null;
  const preset=()=>Object.prototype.hasOwnProperty.call(ENEMY_PRESETS,s.enemy.key)?ENEMY_PRESETS[s.enemy.key]:null;
  const metadata=()=>preset()?getEnemyPresetMetadata(preset(),s.enemy.key):null;
  const rules=()=>metadata()?.rules||{};
  const mode=()=>s.modes[s.side];
  const cardRows=()=>s.cards[mode()]||[];
  const activeCardRows=()=>mode()==='direct'?[]:cardRows();
  const result=changed=>core.calculate(s,preset(),cardIndex,math,{spellsDisabled:rules().disabledEffectSources?.includes('spell'),changed});
  function status(message=''){const e=$('save-status');e.hidden=!message;e.querySelector('span').textContent=message;}
  function error(e){$('calculation-note').textContent=e.message||String(e);$('calculation-note').classList.add('error');}
  function storedEnvelope(raw){if(raw==null)return null;const v=JSON.parse(raw);if(v.version!==1||!Number.isSafeInteger(v.revision)||v.revision<1||typeof v.writer!=='string')throw Error('保存形式を確認できません。書き出しか初期化を選んでください。');core.encode(v.settings);return {revision:v.revision,writer:v.writer,settings:core.normalize(v.settings)};}
  async function hydrate(){clearTimeout(timer);timer=null;epoch++;if(!storageReady)return;try{const v=storedEnvelope(window.TRICKCAL_STORAGE_FACADE.localStorage.getItem(KEY));revision=v?.revision??null;s=v?.settings||core.defaults();$('growth-panel').open=!!s.growth.enabled;if(s.enemy.key){s.enemy.key=resolveEnemyPresetKey(s.enemy.key);s.enemy.key=ENEMY_PRESETS[s.enemy.key]?.selectionAliasOf||s.enemy.key;}
      if(Object.values(s.modes).some(v=>v!=='direct'))await ensureCards();if(cardLibrary)for(const rows of Object.values(s.cards)){for(const row of rows)row.id=resolveCardIdAlias(row.id);normalizeArtifactSlots(rows);}
      dirty=false;blocked=false;status();await prepareMode();render();
    }catch(e){blocked=true;status(e.message||'保存内容を確認できません。');render();}}
  function acquireLease(){
    if(leaseHeld)return Promise.resolve(true);if(leasePending)return leasePending;if(!navigator.locks)return Promise.resolve(false);
    const requestEpoch=epoch;
    leasePending=new Promise(resolve=>{
      navigator.locks.request(LOCK,{ifAvailable:true},async lock=>{
        if(!lock||requestEpoch!==epoch){resolve(false);return;}
        leaseHeld=true;let release;const held=new Promise(r=>release=r);leaseRelease=release;resolve(true);await held;leaseHeld=false;leaseRelease=null;
      }).catch(()=>resolve(false));
    }).then(value=>{leasePending=null;return value;});return leasePending;
  }
  function saveNow(force=false){
    clearTimeout(timer);timer=null;if(!dirty)return {ok:true};
    if(!storageReady||!leaseHeld){status('別タブを閉じて再保存するか、入力を書き出してください。');return {ok:false,code:'busy'};}
    if(blocked&&!force)return {ok:false,code:'busy'};
    try{
      const raw=window.TRICKCAL_STORAGE_FACADE.localStorage.getItem(KEY);let old;try{old=storedEnvelope(raw);}catch(e){blocked=true;status(e.message);return {ok:false,code:'invalid-data'};}
      if(!force&&(old?.revision??null)!==revision){blocked=true;status('別タブで更新されました。読込か、この内容で保存を選べます。');return {ok:false,code:'busy'};}
      const settings=JSON.parse(core.encode(s)).settings,next=(old?.revision||0)+1;
      window.TRICKCAL_STORAGE_FACADE.localStorage.setItem(KEY,JSON.stringify({version:1,revision:next,writer,settings}));revision=next;dirty=false;blocked=false;status();return {ok:true};
    }catch(e){status('未保存：入力を書き出すか、保存を再試行してください。');return {ok:false,code:e.result?.code||'write-failed'};}
  }
  async function save(force=false){const requestEpoch=epoch;if(frozen)return {ok:false,code:'busy'};await acquireLease();if(requestEpoch!==epoch)return {ok:true};return saveNow(force);}
  function changed(){dirty=true;clearTimeout(timer);if(!blocked&&!frozen)timer=setTimeout(()=>save(),500);renderResult();}
  function inputField(label,value,attributes=''){return `<label>${esc(label)}<input type="number" step="any" inputmode="decimal" value="${esc(value)}" ${attributes}></label>`;}
  function growthDelta(fields){if(fields.current===''||fields.next===''||!Number.isFinite(Number(fields.current))||!Number.isFinite(Number(fields.next)))return '';return String(Number((Number(fields.next)-Number(fields.current)).toPrecision(15)));}
  function growthNumber(value){return String(Number(Number(value).toPrecision(15)));}
  function updateGrowthProjection(key,{clearDelta=false}={}){
    const row=$('growth-fields').querySelector(`[data-growth-row="${key}"]`),current=row?.querySelector('[data-growth-field="current"]'),delta=row?.querySelector('[data-growth-field="delta"]'),sign=row?.querySelector('[data-growth-sign]'),preview=row?.querySelector('[data-growth-preview]'),feedback=row?.querySelector('[data-growth-feedback]'),fields=s.growth.fields[key];
    if(!row||!current||!delta||!sign||!preview||!feedback)return;
    if(clearDelta){delta.value='';}
    delta.disabled=current.value==='';
    sign.textContent=delta.value!==''&&Number(delta.value)>=0?'+':'';
    feedback.textContent='';feedback.classList.remove('error');
    if(current.value===''){fields.next='';feedback.textContent='現在値を入力';return;}
    if(delta.value===''||!Number.isFinite(Number(current.value))||!Number.isFinite(Number(delta.value))){fields.next='';if(delta.value==='')feedback.textContent='変更量を入力';return;}
    const target=Number(current.value)+Number(delta.value);
    if(!Number.isFinite(target)||target<0){fields.next='';feedback.textContent='変更後の合計は0%以上にしてください。';feedback.classList.add('error');return;}
    fields.next=growthNumber(target);preview.textContent=`（${nfmt(target)}%）`;
  }
  function normalizeArtifactSlots(rows){
    const used=new Set();
    for(const row of rows){if(cardById(row.id)?.kind!=='artifact'){delete row.slot;continue;}if(Number.isInteger(row.slot)&&row.slot>=0&&row.slot<3&&!used.has(row.slot)){used.add(row.slot);continue;}const free=[0,1,2].find(slot=>!used.has(slot));if(free==null){delete row.slot;continue;}row.slot=free;used.add(free);}
  }
  function cardTotals(rows){return rows.reduce((a,row)=>{const card=cardById(row.id);if(!card||rules().disabledEffectSources?.includes('spell')&&card.kind==='spell')return a;const b=core.cardBonuses(card,row);a[0]+=s.side==='self'?b.critRateP||0:b.critResAddP||0;a[1]+=s.side==='self'?b.critDmgAddP||0:b.critDmgResAddP||0;return a;},[0,0]);}
  function displayedBoosts(){const active=cardTotals(activeCardRows()),personal=core.personalDirect(s,s.side);return [0,1].map(i=>Number((Number(s.direct[s.side][i?'damage':'rate']||0)+active[i]+(i?personal.damage:personal.rate)).toFixed(6)));}
  function buildFields(){
    const calculated=s.inputModel===4&&s.inputMode==='calculated',legacyFormation=s.inputModel===3&&s.inputMode==='formation',resolved=calculated||legacyFormation?core.resolveAllyStats(s,math,{index:cardIndex}):s.ally;
    $('ally-inputs').innerHTML=activeKeys().map(k=>calculated?`<div class="critical-stat-output"><span>${esc(core.LABELS[k])}</span><strong>${resolved[k]==null?'—':esc(nfmt(resolved[k],2))}</strong></div>`:inputField(core.LABELS[k],resolved[k]??'',`min="0" data-ally="${k}"${legacyFormation?' readonly aria-readonly="true"':''}`)).join('');
    $('stat-buffs').innerHTML=activeKeys().map(k=>inputField(core.LABELS[k]+'（%）',s.buffs[k],`min="-100" data-buff="${k}"`)).join('');
    const fields=boosts().map((label,i)=>inputField(label+'（%）',displayedBoosts()[i],`data-direct="${i?'damage':'rate'}"`)).join('');
    $('direct-inputs').innerHTML=fields;
    const enemy=core.enemyStats(preset(),s.enemy.phase);
    $('enemy-overrides').innerHTML=oppositeKeys().map(k=>inputField(core.LABELS[k],s.enemy.overrides[k]??'',`min="0" data-enemy-stat="${k}" placeholder="${esc(enemy[k]??'未設定')}"`)).join('');
    $('enemy-stat-display').innerHTML=oppositeKeys().map(k=>{const value=own(s.enemy.overrides,k)?s.enemy.overrides[k]:enemy[k];return `<div class="enemy-stat"><span>${esc(core.LABELS[k])}</span><strong>${value==null||value===''?'—':esc(nfmt(value,2))}</strong></div>`;}).join('');
    const keys=activeKeys();
    $('growth-fields').innerHTML=`<div class="growth-table" role="table" aria-label="全体強化値の比較"><div class="growth-row growth-header" role="row"><span role="columnheader">項目</span><span role="columnheader">現在合計（%）</span><span role="columnheader">変更量（%）</span></div>${keys.map(k=>{const fields=s.growth.fields[k],delta=growthDelta(fields),preview=fields.current!==''&&fields.next!==''?`（${nfmt(fields.next)}%）`:'';return `<div class="growth-row" role="row" data-growth-row="${k}"><span class="growth-name" role="rowheader">${esc(core.LABELS[k])}</span><label class="growth-input-cell" role="cell"><span class="visually-hidden">${esc(core.LABELS[k])}の現在合計（%）</span><input type="number" min="0" step="any" inputmode="decimal" value="${esc(fields.current)}" data-growth="${k}" data-growth-field="current" aria-label="${esc(core.LABELS[k])}の現在合計（%）"></label><div class="growth-delta-cell" role="cell"><label class="growth-input-cell"><span class="visually-hidden">${esc(core.LABELS[k])}の変更量（%）</span><span class="growth-delta-input"><span data-growth-sign aria-hidden="true">${delta!==''&&Number(delta)>=0?'+':''}</span><input type="number" step="any" inputmode="decimal" value="${esc(delta)}" data-growth="${k}" data-growth-field="delta" aria-label="${esc(core.LABELS[k])}の変更量（%）"${fields.current===''?' disabled':''}><span data-growth-preview aria-label="変更後の合計">${preview}</span></span></label><small data-growth-feedback role="status">${fields.current===''?'現在値を入力':fields.next===''?'変更量を入力':''}</small></div></div>`;}).join('')}</div>`;
  }
  function buildCompositionFields(){
    const c=s.composition,wrap=$('composition-controls');wrap.hidden=s.inputMode!=='calculated';if(!c||s.inputMode!=='calculated')return;
    $('composition-grade').value=String(c.grade);$('composition-follow').checked=core.KEYS.every(key=>Number(c.follow[key])>0);$('composition-follow').disabled=!c.followAllowed;
    const rows=[['baseBeforeGrade','本人の基礎値（学年前）'],['ownAdditions','本人の加算'],['globalAdditions','全体の加算'],['globalRates','全体強化（%）']];
    $('composition-fields').innerHTML=`<div class="composition-grid"><div class="composition-grid-head"><span>項目</span>${activeKeys().map(key=>`<span>${esc(core.LABELS[key])}</span>`).join('')}</div>${rows.map(([part,label])=>`<div class="composition-grid-row"><strong>${label}</strong>${activeKeys().map(key=>`<label class="visually-hidden">${esc(label)}・${esc(core.LABELS[key])}${part==='globalRates'?'（%）':''}</label><input type="number" min="${part==='baseBeforeGrade'||part==='globalRates'?0:-1000000000}" step="any" inputmode="decimal" value="${esc(c[part][key])}" data-composition-part="${part}" data-composition-key="${key}" aria-label="${esc(label)}・${esc(core.LABELS[key])}${part==='globalRates'?'（%）':''}">`).join('')}</div>`).join('')}</div>`;
  }
  function renderInputMode(){
    const calculated=s.inputModel===4&&s.inputMode==='calculated',legacyFormation=s.inputModel===3&&s.inputMode==='formation',manualBattleValue=s.inputModel===4&&s.inputMode==='manual';document.querySelectorAll('[data-input-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.inputMode===(calculated||legacyFormation?'calculated':'manual'))));
    $('manual-input-note').hidden=calculated||legacyFormation;$('legacy-formation-note').hidden=!legacyFormation;$('stat-buff-controls').hidden=manualBattleValue;
  }
  function render(){
    document.documentElement.dataset.criticalReady='true';$('direction').textContent=s.side==='self'?'味方 → 敵':'敵 → 味方';$('direction').setAttribute('aria-label',s.side==='self'?'敵から味方への会心計算に切り替える':'味方から敵への会心計算に切り替える');
    const allyCombatRole=s.side==='self'?'attacker':'defender';$('enemy-panel').dataset.combatRole=allyCombatRole==='attacker'?'defender':'attacker';$('ally-stats-panel').dataset.combatRole=allyCombatRole;$('ally-boost-panel').dataset.combatRole=allyCombatRole;
    $('source-note').hidden=!s.source;$('source-note').textContent=s.source?(s.formation?`${s.source.name}・${s.composition?.grade||s.source.grade}年生・${s.formation.statMode==='planned'?'予定':'現在'}${s.formation.requestedStatMode!==s.formation.statMode?'（予定データなし）':''}${s.inputMode==='calculated'?'・基礎値から計算':'・手入力'}`:`${s.source.name}・${s.source.grade}年生`):'';
    const p=preset(),meta=metadata();enemyOptions();
    $('phase-wrap').hidden=!(p?.phases?.length);$('enemy-phase').innerHTML=(p?.phases||[]).map((v,i)=>`<option value="${i}">${esc(v.name||v.label||'Phase '+i)}</option>`).join('');$('enemy-phase').value=String(s.enemy.phase);
    const notes=[meta?.rules.disabledEffectSources?.includes('spell')?'この敵ではスペル効果は適用されません':''].filter(Boolean);$('content-note').textContent=notes.join(' / ');$('content-note').hidden=!notes.length;
    $('growth-enabled').checked=s.growth.enabled;
    $('growth-panel').classList.toggle('is-comparing',s.growth.enabled);$('growth-active-label').hidden=!s.growth.enabled;
    renderInputMode();buildFields();buildCompositionFields();renderPresetSummary();renderFormation();renderFormationDetails();renderResult();
  }
  function renderResult(){
    const r=result(false),comp=s.growth.enabled?result(true):null;
    $('chance-label').textContent=s.side==='self'?'会心率':'受ける攻撃の会心率';
    $('chance').textContent=r.error?'—':percent(r.rate);$('multiplier').textContent=r.error?'—':percent(r.multiplier);
    $('chance').dataset.value=r.error?'':String(r.rate);$('multiplier').dataset.value=r.error?'':String(r.multiplier);
    $('chance-change').textContent='';$('multiplier-note').textContent=r.error?'':multiplierLimit(r.multiplier);
    const rateLimit=value=>value>=.75?'上限':value<=Math.fround(.05)?'下限':'';
    if(!r.error)$('chance-change').textContent=rateLimit(r.rate);
    if(comp&&!r.error&&!comp.error){
      const rateLimits=[rateLimit(r.rate)&&`現在${rateLimit(r.rate)}`,rateLimit(comp.rate)&&`変更後${rateLimit(comp.rate)}`].filter(Boolean);
      $('chance-change').textContent=[`→ ${percent(comp.rate)}（${nfmt((comp.rate-r.rate)*100)}pt）${comp.approximate?' · 概算':''}`,...rateLimits].join(' · ');
      const baseLimit=multiplierLimit(r.multiplier),changedLimit=multiplierLimit(comp.multiplier),limits=[baseLimit&&`現在${baseLimit}`,changedLimit&&`変更後${changedLimit}`].filter(Boolean);
      $('multiplier-note').textContent=[`→ ${percent(comp.multiplier)}（${nfmt((comp.multiplier-r.multiplier)*100)}pt）${comp.approximate?' · 概算':''}`, ...limits].join(' · ');
    }
    const partial=s.formation?.effects?.some(row=>row.status==='needs-level'||row.status==='unresolved'),approximate=r.approximate||comp?.approximate,notices=[partial?'未設定・未確認の本人効果を除いた参考値です。':'',approximate?'育成内訳の再構成または全体強化値の比較は概算です。':''].filter(Boolean);
    $('calculation-note').textContent=r.error||comp?.error||notices.join(' ');$('calculation-note').classList.toggle('error',!!(r.error||comp?.error));
  }
  const options=(max,value,prefix)=>Array.from({length:max},(_,i)=>`<option value="${i+1}"${value===i+1?' selected':''}>${prefix}${i+1}</option>`).join('');
  function cardImage(card){return asset(`img/Card/${card.kind==='spell'?'Spell':'Artifact'}/${card.name}.webp`);}
  function bonusText(card,row){const b=core.cardBonuses(card,row),v=s.side==='self'?[b.critRateP,b.critDmgAddP]:[b.critResAddP,b.critDmgResAddP];return v.map((value,i)=>value?`${boosts()[i]} +${nfmt(value)}%`:'').filter(Boolean).join(' / ')||'この方向の率・倍率への補正なし';}
  function spellEffectChips(card,row){const b=core.cardBonuses(card,{...row,qty:1}),effects=s.side==='self'?[[b.critRateP,'会心','img/会心.webp','critRateP'],[b.critDmgAddP,'会心DMG','img/会心ダメージ.webp','critDmgAddP']]:[[b.critResAddP,'会心抵抗','img/会心抵抗.webp','critResAddP'],[b.critDmgResAddP,'会心DMG抵抗','img/会心DMG抵抗.webp','critDmgResAddP']];return effects.filter(([value])=>Number.isFinite(Number(value))&&Number(value)!==0).map(([raw,label,icon,key])=>{const value=Number(raw),formatted=`${value>0?'+':''}${nfmt(value)}%`;return `<span class="spell-effect-chip" data-spell-bonus="${key}" data-bonus-value="${value}" title="${esc(`${label} ${formatted}（1枚あたり）`)}"><img src="${esc(asset(icon))}" alt=""><b>${formatted}</b></span>`;}).join('');}
  let modalRows=null;
  let modalKind='artifact';
  let artifactPickerOpen=false;
  let artifactTargetSlot=null;
  let modalSpellDrafts=new Map();
  function cardInfo(card,row){return `<button type="button" class="card-image-button" data-card-info="${esc(card.id)}" data-card-star="${row.star}" data-card-solder="${row.solder}" data-card-qty="${row.qty}" aria-label="${esc(card.name)}の効果を表示"><img src="${esc(cardImage(card))}" alt=""></button>`;}
  function initializeSpellDrafts(){
    modalSpellDrafts=new Map();const defaults=core.initialCardState(manager.cards||{},s.cardDefault);
    for(const card of Object.values(cardIndex).filter(item=>item.kind==='spell')){
      const existing=modalRows.find(row=>row.id===card.id),initial=defaults.get(card.id);
      modalSpellDrafts.set(card.id,existing||{id:card.id,...initial,qty:0,conditions:{}});
    }
  }
  function artifactSlotRow(slot,entry){
    const label=`遺物${slot+1}`;
    if(!entry)return `<div class="artifact-equip-slot empty" data-artifact-slot-row="${slot}"><button type="button" class="artifact-equip-icon" data-artifact-slot-open="${slot}" aria-label="${label}を選ぶ"><span>＋</span></button><div class="artifact-equip-main"><strong>${label}</strong><small>未装備</small></div><button type="button" class="artifact-equip-select" data-artifact-slot-open="${slot}">選ぶ</button></div>`;
    const {row,index}=entry,card=cardById(row.id);
    if(!card)return `<div class="artifact-equip-slot" data-artifact-slot-row="${slot}"><span class="artifact-equip-icon">${slot+1}</span><div class="artifact-equip-main"><strong>${label}</strong><small>カードを確認できません</small></div><button type="button" data-remove="${index}" aria-label="${label}を解除">×</button></div>`;
    return `<div class="artifact-equip-slot filled" data-artifact-slot-row="${slot}"><div class="artifact-equip-icon">${cardInfo(card,row)}</div><div class="artifact-equip-main"><div class="artifact-equip-heading"><strong>${label}</strong><span title="${esc(card.name)}">${esc(card.name)}</span></div><div class="artifact-equip-growth"><label>★<select data-artifact-slot="${slot}" data-artifact-field="star">${options(5,row.star,'★')}</select></label><label>はんだ<select data-artifact-slot="${slot}" data-artifact-field="solder"${row.star<5?' disabled':''}>${[0,1,2].map(v=>`<option value="${v}"${row.solder===v?' selected':''}>+${v}</option>`).join('')}</select></label></div></div><div class="artifact-equip-actions"><button type="button" data-artifact-slot-open="${slot}" aria-label="${label}を変更" title="変更">↻</button><button type="button" data-remove-slot="${slot}" aria-label="${label}を解除" title="解除">×</button></div></div>`;
  }
  function renderPresetRows(){
    const rows=modalRows||[];
    const artifacts=rows.map((row,i)=>({row,i})).filter(v=>cardById(v.row.id)?.kind==='artifact');
    $('selected-artifacts').innerHTML=Array.from({length:3},(_,slot)=>artifactSlotRow(slot,artifacts.find(v=>v.row.slot===slot))).join('');
    const overflow=artifacts.filter(v=>!Number.isInteger(v.row.slot)||v.row.slot<0||v.row.slot>2);$('artifact-overflow').hidden=!overflow.length;$('artifact-overflow').innerHTML=overflow.length?`<p>以前の保存内容に3枠を超える遺物があります。不要なものを外してください。</p>${overflow.map(({row,i})=>`<div class="artifact-overflow-row"><span>${esc(cardById(row.id)?.name||'遺物')}</span><button type="button" data-remove="${i}" aria-label="${esc(cardById(row.id)?.name||'遺物')}を外す">×</button></div>`).join('')}`:'';
    $('selected-cards').innerHTML=Object.values(cardIndex).filter(card=>card.kind==='spell'&&core.relevant(card,s.side)).map(card=>{
      const row=modalSpellDrafts.get(card.id)||{id:card.id,qty:0,star:5,solder:0,conditions:{}},selected=row.qty>0,disabled=rules().disabledEffectSources?.includes('spell');
      return `<article class="spell-option${selected?' selected':''}" data-spell-option="${esc(card.id)}"><span class="spell-card-art">${cardInfo(card,row)}<b>★${row.star}</b><span class="spell-effect-chips">${spellEffectChips(card,row)}</span></span><strong class="spell-card-name" title="${esc(card.name)}">${esc(card.name)}</strong><div class="spell-growth-controls"><label><span>★</span><select data-spell-field="star" data-spell-id="${esc(card.id)}">${options(5,row.star,'★')}</select></label><label><span>はんだ</span><select data-spell-field="solder" data-spell-id="${esc(card.id)}"${row.star<5?' disabled':''}>${[0,1,2].map(v=>`<option value="${v}"${v===row.solder?' selected':''}>+${v}</option>`).join('')}</select></label></div><div class="spell-quantity" aria-label="${esc(card.name)}の枚数"><span class="quantity-stepper"><button type="button" class="qty-step" data-spell-step="-1" aria-label="${esc(card.name)}を1枚減らす"${row.qty<=0?' disabled':''}>−</button><input type="number" min="0" max="99" step="1" value="${row.qty}" data-spell-qty="${esc(card.id)}" aria-label="${esc(card.name)}の枚数"><button type="button" class="qty-step" data-spell-step="1" aria-label="${esc(card.name)}を1枚増やす"${row.qty>=99?' disabled':''}>＋</button></span></div>${disabled?'<small class="spell-disabled-note">この敵では適用されません</small>':''}</article>`;
    }).join('')||'<p class="hint">該当するスペルはありません。</p>';
    renderPresetSummary(rows,false);
  }
  function renderPresetSummary(rows=activeCardRows(),updateMain=true){const artifacts=rows.filter(row=>cardById(row.id)?.kind==='artifact'&&Number.isInteger(row.slot)&&row.slot>=0&&row.slot<3),spells=rows.filter(row=>cardById(row.id)?.kind==='spell'),artifactCount=`${Math.min(3,artifacts.length)}/3`,counts=`遺物 ${artifactCount}・スペル ${spells.length}`;if(updateMain)$('preset-counts').textContent=counts;$('artifact-count').textContent=artifactCount;$('spell-count').textContent=String(spells.length);}
  function commitPresetDraft(){if(!modalRows)return;if(s.formation&&mode()==='formation'){
      const next=structuredClone(s);next.cards.formation=structuredClone(modalRows);const basic=(window.TRICKCAL_STAT_DATA?.sheets?.basicInfo||[]).find(row=>row.id===next.formation.id),apostle=typeof APOSTLE_INDEX==='undefined'?null:APOSTLE_INDEX[next.formation.id.toLowerCase()];
      const compiled=compilePersonalEffects({apostle,basic,asideRank:next.formation.asideRank,asideLevel:next.formation.asideLevel,skillLevels:next.formation.skillLevels,cards:next.cards.formation,previousEffects:next.formation.effects});next.formation.effects=compiled.effects;next.formation.warnings=compiled.warnings;core.encode(next);s=core.normalize(next);
    }else{s.cards.card=structuredClone(modalRows);s.modes[s.side]='card';}changed();render();}
  function syncSpellQtyControls(id){const option=[...document.querySelectorAll('.spell-option')].find(item=>item.querySelector('[data-spell-qty]')?.dataset.spellQty===id),row=modalSpellDrafts.get(id);if(!option||!row)return;const input=option.querySelector('[data-spell-qty]'),qty=Math.max(0,Math.min(99,Math.trunc(Number(row.qty)||0)));row.qty=qty;input.value=String(qty);option.querySelector('[data-spell-step="-1"]').disabled=qty<=0;option.querySelector('[data-spell-step="1"]').disabled=qty>=99;option.classList.toggle('selected',qty>0);const index=modalRows.findIndex(item=>item.id===id);if(qty>0&&index<0)modalRows.push(row);else if(qty===0&&index>=0)modalRows.splice(index,1);renderPresetSummary(modalRows,false);}
  function renderCatalog(){
    const rows=modalRows||[];
    if(modalKind!=='artifact'||!artifactPickerOpen||!Number.isInteger(artifactTargetSlot)||artifactTargetSlot<0||artifactTargetSlot>2){ $('card-catalog').replaceChildren();return; }
    $('card-catalog').innerHTML=Object.values(cardIndex).filter(card=>card.kind==='artifact'&&core.relevant(card,s.side)).map(card=>{
      const selected=rows.some(row=>row.id===card.id&&row.slot===artifactTargetSlot&&cardById(row.id)?.kind==='artifact');
      return `<div class="catalog-card${selected?' selected':''}"><button type="button" class="artifact-choice" data-add="${esc(card.id)}" aria-label="${esc(card.name)}を${selected?'選択中':'選ぶ'}"><img src="${esc(cardImage(card))}" alt=""><span>${esc(card.name)}</span></button></div>`;
    }).join('')||'<p class="hint">該当するカードはありません。</p>';
  }
  function setPresetKind(kind){modalKind=kind;artifactPickerOpen=false;$('artifact-management').hidden=kind!=='artifact';$('spell-management').hidden=kind!=='spell';$('clear-selected-cards').textContent=kind==='artifact'?'遺物全解除':'スペル全解除';document.querySelectorAll('[data-preset-kind]').forEach(button=>{button.setAttribute('aria-selected',String(button.dataset.presetKind===kind));});renderPresetRows();renderCatalog();}
  function formations(){return [{id:'',name:'現在の編成',formation:manager.formation||{}},...(manager.savedFormations||[]).filter(v=>v&&typeof v.id==='string'&&v.formation)];}
  function selectedFormation(){return formations().find(v=>v.id===s.formationId)?.formation||null;}
  function renderFormation(){
    $('formation-select').innerHTML=formations().map(v=>`<option value="${esc(v.id)}">${esc(v.name||v.label||'保存編成')}</option>`).join('');$('formation-select').value=s.formationId;
    const f=selectedFormation(),ids=[...new Set((f?.rows||[]).flatMap(r=>r.apostles||[]).filter(Boolean))],data=window.TRICKCAL_STAT_DATA;
    const basics=data?.sheets?.basicInfo||[];$('member-select').innerHTML='<option value="">使徒を選択</option>'+ids.map(id=>`<option value="${esc(id)}">${esc(basics.find(b=>b.id===id)?.使徒名||'使徒')}</option>`).join('');$('member-select').value=s.memberId;$('load-member').disabled=!ids.includes(s.memberId);
  }
  async function prepareMode(){if(Object.values(s.modes).some(value=>value!=='direct')){await ensureCards();try{readManager();}catch(e){error(e);}for(const rows of Object.values(s.cards))normalizeArtifactSlots(rows);}const legacyFormation=s.inputModel===3&&s.inputMode==='formation',calculated=s.inputModel===4&&s.inputMode==='calculated';if(mode()==='formation'||legacyFormation||calculated)await ensureStats();if(legacyFormation||calculated||s.formation)await ensureApostles();}
  const PERSONAL_LABELS={critP:'会心ステータス',critDmgP:'会心DMGステータス',critResP:'会心抵抗ステータス',critDmgResP:'会心DMG抵抗ステータス',critRateP:'会心率',critDmgAddP:'会心ダメージ',critResAddP:'会心抵抗',critDmgResAddP:'会心DMG抵抗',enemyCritResDownP:'敵の会心抵抗低下',enemyCritDmgResDownP:'敵の会心DMG抵抗低下'};
  const PERSONAL_STAT_KEYS=new Set(['critP','critDmgP','critResP','critDmgResP']);
  const isAsideEnabled=id=>typeof window.TRICKCAL_PUBLIC_RELEASE?.isAsideEnabled==='function'&&window.TRICKCAL_PUBLIC_RELEASE.isAsideEnabled(id);
  function effectCondition(effect){if(effect.condition||effect.displayCondition)return String(effect.condition||effect.displayCondition);if(effect.conditionType||effect.conditionValue||effect.triggerType||effect.triggerSourceId)return '発動条件あり';return '';}
  function effectValue(effect,level){
    if(effect.fixedValue!==undefined&&effect.fixedValue!==''){const value=Number(effect.fixedValue);return Number.isFinite(value)?{status:'resolved',value}:{status:'unresolved',value:null};}
    if(effect.levels&&typeof effect.levels==='object'){
      if(!Number.isInteger(level)||level<1)return {status:'needs-level',value:null};
      const keys=Object.keys(effect.levels).map(Number).filter(Number.isFinite).sort((a,b)=>a-b),selected=keys.includes(level)?level:(keys.filter(value=>value<=level).pop()??keys[0]);
      if(selected===undefined)return {status:'unresolved',value:null};const value=Number(effect.levels[String(selected)]);return Number.isFinite(value)?{status:'resolved',value}:{status:'unresolved',value:null};
    }
    return {status:'unresolved',value:null};
  }
  function criticalTarget(effect){
    const target=String(effect.effectTarget||''),type=String(effect.effectType||''),kind=String(effect.valueKind||'');
    if(/自身|自分|本人/.test(target))return 'self';
    if(/敵/.test(target)&&(/デバフ/.test(type)||/減少|低下/.test(kind)))return 'enemy';
    return '';
  }
  function makeCriticalRows(effects,{sourceLabel,sourceKind,level=0,previous,warningSet}){
    const rows=[];
    for(const effect of effects||[]){
      if(!window.TRICKCAL_CRITICAL_EFFECTS?.isCriticalEffect(effect))continue;
      if(effect.valueClass&&effect.valueClass!=='倍率')continue;
      const target=criticalTarget(effect);if(!target){warningSet.add('本人以外への効果は自動反映しません。');continue;}
      const resolved=window.TRICKCAL_CRITICAL_EFFECTS.normalizeEffect(effect,effectValue(effect,level).value);
      if(!resolved?.handled){warningSet.add('一部の会心効果は未対応です。');continue;}
      if(!Object.keys(resolved.bonuses||{}).length){warningSet.add('一部の会心効果は未対応です。');continue;}
      const valueInfo=resolved.unresolved?{status:'unresolved',value:null}:effectValue(effect,level);
      const conditional=!!(effect.conditionType||effect.conditionValue||effect.condition||effect.displayCondition||effect.triggerType||effect.triggerSourceId);
      const condition=effectCondition(effect);
      for(const [bonusKey,value] of Object.entries(resolved.bonuses||{})){
        const enemyBonus=bonusKey.startsWith('enemy');if((target==='enemy')!==enemyBonus){warningSet.add('敵への会心低下以外の敵向け効果は自動反映しません。');continue;}
        const id=`${sourceKind}:${effect.effectId||effect.skillId||sourceLabel}:${bonusKey}`,old=previous.get(id),label=PERSONAL_LABELS[bonusKey];if(!label)continue;
        const status=valueInfo.status==='resolved'?'resolved':valueInfo.status;
        rows.push({id,label,sourceLabel,target,bonusKey,value:status==='resolved'?Number(value):null,status,
          defaultEnabled:status==='resolved'&&!conditional,enabled:old?.status==='resolved'?old.enabled:status==='resolved'&&!conditional,condition});
      }
    }
    return rows;
  }
  function favoriteStarFor(apostle,basic,cards,warningSet){
    if(!apostle.favoriteCard?.name)return 0;
    const metadata=(window.TRICKCAL_STAT_DATA.sheets.favoriteCards||[]).filter(row=>row.id===basic.id&&row['カード種別']==='遺物'&&row['カード名']===apostle.favoriteCard.name);
    if(!metadata.length)return 0;
    const catalogMatches=Object.values(cardIndex).filter(card=>card.kind==='artifact'&&card.name===apostle.favoriteCard.name);if(catalogMatches.length!==1){warningSet.add('愛用品のカード対応を一意に確認できないため、効果を反映しません。');return 0;}
    const equipped=(cards||[]).filter(row=>{const card=cardById(row.id);return card?.kind==='artifact'&&card.name===apostle.favoriteCard.name;});
    if(!equipped.length)return 0;
    return Math.max(0,...equipped.map(row=>Number(row.star)||0));
  }
  function compilePersonalEffects({apostle,basic,asideRank,asideLevel,skillLevels,cards,previousEffects=[]}){
    const warningSet=new Set(),previous=new Map(previousEffects.map(row=>[row.id,row])),rows=[];
    if(!apostle){warningSet.add('使徒の効果データを確認できないため、本人効果は自動反映しません。');return {effects:[],warnings:[...warningSet]};}
    for(const skill of apostle.skills||[])if(skill.skillType==='パッシブ'){
      const level=Number(skillLevels.passive)||0;rows.push(...makeCriticalRows(skill.effects,{sourceLabel:'パッシブ',sourceKind:'passive',level,previous,warningSet}));
    }
    if(asideRank>0){
      for(let rank=1;rank<=asideRank;rank++){
        const aside=apostle.aside?.levels?.[String(rank)];if(!aside)continue;
        const label=`アサイド A${rank}`;
        for(const stat of aside.stats||[]){
          const normalized=window.TRICKCAL_CRITICAL_EFFECTS?.normalizeStat(stat);if(!normalized)continue;
          const bonusKey=`${normalized.statKey}P`,id=`aside:${stat.effectId||stat.skillId||rank}:${bonusKey}`,old=previous.get(id),condition=effectCondition(stat);
          const conditional=!!(stat.conditionType||stat.conditionValue||stat.condition||stat.triggerType),value=Number(normalized.value);
          rows.push({id,label:PERSONAL_LABELS[bonusKey],sourceLabel:label,target:'self',bonusKey,value,status:'resolved',defaultEnabled:!conditional,enabled:old?old.enabled:!conditional,condition});
        }
        const level=Number(asideLevel)||0;rows.push(...makeCriticalRows(aside.effects,{sourceLabel:label,sourceKind:`aside-${rank}`,level,previous,warningSet}));
      }
    }
    const favoriteStar=favoriteStarFor(apostle,basic,cards,warningSet),favoriteRows=window.TRICKCAL_STAT_DATA.sheets.favoriteCards||[];
    for(const [rankText,skills] of Object.entries(apostle.favoriteCard?.levels||{})){
      const rank=Number(rankText);if(!Number.isInteger(rank)||rank>favoriteStar)continue;
      for(const skill of Array.isArray(skills)?skills:[]){
        const exists=favoriteRows.some(row=>row.id===basic.id&&row['カード種別']==='遺物'&&row['カード名']===apostle.favoriteCard.name&&row.skillId===skill.skillId&&Number(row['解放Lv'])===rank);
        if(!exists){warningSet.add('愛用品の効果対応を確認できないため、一部の本人効果は未反映です。');continue;}
        rows.push(...makeCriticalRows(skill.effects,{sourceLabel:`愛用品 Lv${rank}`,sourceKind:`favorite-${rank}`,level:0,previous,warningSet}));
      }
    }
    warningSet.add('別の使徒から受ける支援・全体効果・特定技だけの効果は自動反映しません。');
    return {effects:rows,warnings:[...warningSet]};
  }
  function renderFormationDetails(){
    const formation=s.formation,wrap=$('formation-controls');wrap.hidden=!formation;
    if(!formation){$('personal-effects').replaceChildren();return;}
    $('formation-readout').textContent=`${formation.name}・${formation.statMode==='planned'?'予定':'現在'}・${s.composition?.grade||formation.grade}年生${formation.requestedStatMode!==formation.statMode?'（予定データなしのため現在）':''}`;
    $('reimport-formation').hidden=false;
    const available=isAsideEnabled(formation.id),rank=formation.asideRank,cap=[0,30,40,50][rank]||0;
    const levelsEditable=s.inputModel===3&&s.inputMode==='formation'||s.inputModel===4&&s.inputMode==='calculated';
    $('aside-rank').innerHTML='<option value="0">未発現</option>'+[1,2,3].map(value=>`<option value="${value}"${rank===value?' selected':''}>A${value}</option>`).join('');$('aside-rank').value=String(rank);$('aside-rank').disabled=!available||!levelsEditable;
    $('aside-level').innerHTML='<option value="0">未設定</option>'+Array.from({length:cap},(_,i)=>`<option value="${i+1}"${formation.asideLevel===i+1?' selected':''}>Lv ${i+1}</option>`).join('');$('aside-level').value=String(formation.asideLevel||0);$('aside-level').disabled=!available||!rank||!levelsEditable;
    const skillCap=12+Math.min(3,rank),passive=Number(formation.skillLevels?.passive)||0;
    $('passive-level').innerHTML='<option value="0">未設定</option>'+Array.from({length:skillCap},(_,i)=>`<option value="${i+1}"${passive===i+1?' selected':''}>Lv ${i+1}</option>`).join('');$('passive-level').value=String(passive);$('passive-level').disabled=!levelsEditable;
    const effects=formation.effects||[];$('personal-effects').innerHTML=effects.map(row=>{
      const statEffect=PERSONAL_STAT_KEYS.has(row.bonusKey),baked=s.inputMode==='manual'&&statEffect;
      const statusLabel=row.status==='needs-level'?'Lvを選択':row.status==='unresolved'?'値を確認中':baked?'ステータスに反映済み':row.target==='enemy'?'敵へ適用':'本人へ適用';
      const value=row.status==='resolved'?`${Number(row.value)>0?'+':''}${nfmt(row.value)}%`:statusLabel;
      const detail=[row.sourceLabel,row.label,row.condition,statusLabel].filter(Boolean).join(' · ');
      return `<label class="formation-effect-row"><input type="checkbox" data-personal-effect="${esc(row.id)}"${row.enabled?' checked':''}${row.status!=='resolved'||baked?' disabled':''}><span class="formation-effect-copy"><strong>${esc(row.sourceLabel)} · ${esc(row.label)}</strong>${row.condition?`<small>${esc(row.condition)}</small>`:''}</span><span class="formation-effect-value" title="${esc(detail)}">${esc(value)}</span></label>`;
    }).join('')||'<p class="hint">会心系の本人効果はありません。</p>';
    const warnings=[...(formation.warnings||[])];if(effects.some(row=>row.status==='needs-level'))warnings.unshift('パッシブLvまたはアサイドLvを選ぶと反映できる効果があります。');if(effects.some(row=>row.status==='unresolved'))warnings.unshift('数値を確定できない効果は計算に含めていません。');
    $('formation-warnings').textContent=[...new Set(warnings)].join(' ');$('formation-warnings').hidden=!warnings.length;
  }
  function commitFormationEffectSettings(patch){
    if(!s.formation)return;const next=structuredClone(s),formation=next.formation;Object.assign(formation,patch);
    if(patch.asideRank!==undefined){const cap=[0,30,40,50][formation.asideRank]||0;if(!cap)formation.asideLevel=0;else if(formation.asideLevel>cap)formation.asideLevel=0;const skillCap=12+Math.min(3,formation.asideRank);if(formation.skillLevels.passive>skillCap)formation.skillLevels.passive=skillCap;}
    const basic=(window.TRICKCAL_STAT_DATA.sheets.basicInfo||[]).find(row=>row.id===formation.id),apostle=typeof APOSTLE_INDEX==='undefined'?null:APOSTLE_INDEX[formation.id.toLowerCase()];
    const compiled=compilePersonalEffects({apostle,basic,asideRank:formation.asideRank,asideLevel:formation.asideLevel,skillLevels:formation.skillLevels,cards:next.cards.formation,previousEffects:formation.effects});
    formation.effects=compiled.effects;formation.warnings=compiled.warnings;core.encode(next);s=core.normalize(next);changed();render();
  }
  function snapshotGlobalRate(snapshot,key){const value=snapshot.globalPercentRates?.[key];return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
  function sumSnapshotSources(breakdown,key,sources){return sources.reduce((sum,source)=>sum+Number(breakdown?.[source]?.[key]),0);}
  function manualComposition(){
    const data=window.TRICKCAL_STAT_DATA,gradeRates=Object.fromEntries(core.KEYS.map(key=>[key,Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,window.TRICKCAL_SHARED_STAT_ENGINE.getGradeStatBonusRate(data,i+1,key,{})]))]));
    const empty=Object.fromEntries(core.KEYS.map(key=>[key,'']));return {kind:'manual',grade:Number(s.grade)>=1&&Number(s.grade)<=6?Number(s.grade):1,dataVersion:data.generatedAt||'',baseBeforeGrade:{...empty},ownAdditions:{...empty},globalAdditions:{...empty},globalRates:{...empty},follow:Object.fromEntries(core.KEYS.map(key=>[key,0])),followAllowed:true,gradeRates,exactTotals:{}};
  }
  function invalidateCompositionStat(composition,key){for(const grade of Object.values(composition.exactTotals||{}))grade[key]='';}
  async function loadMember(){
    await ensureStats();await ensureCards();await ensureApostles();readManager();const f=selectedFormation(),id=s.memberId,basic=window.TRICKCAL_STAT_DATA.sheets.basicInfo.find(b=>b.id===id),unit=manager.apostles?.[id];
    if(!basic||!unit||(f?.rows||[]).every(r=>!r.apostles?.includes(id)))throw Error('管理の使徒と編成を選び直してください。');
    const grade=Number($('grade').value),requestedMode=$('stat-mode').value;if(!Number.isInteger(grade)||grade<1||grade>6)throw Error('読み込む学年を選択してください。');
    let actualMode=requestedMode,snapshot=unit.statSnapshots?.[actualMode];if(!snapshot?.stats&&requestedMode==='planned'&&unit.statSnapshots?.current?.stats){actualMode='current';snapshot=unit.statSnapshots.current;}
    if(!snapshot?.stats)throw Error('保存されたステータスがありません。管理で保存するか、戦闘時の数値を入力してください。');
    const engine=window.TRICKCAL_SHARED_STAT_ENGINE;
    if(!engine.hasCompleteBreakdown(snapshot))throw Error('ステータスの内訳が不足しています。管理で保存し直すか、戦闘時の数値を入力してください。');
    if(Number(snapshot.calculationVersion)!==engine.snapshotCalculationVersion){
      if(!engine.canRebuildLegacySnapshot(window.TRICKCAL_STAT_DATA,basic,unit,snapshot,{mode:s.statMode,research:manager.research}))throw Error('古いステータスを再計算できません。管理で保存し直すか、戦闘時の数値を入力してください。');
      snapshot=engine.applyApostleOverridesToSnapshot(window.TRICKCAL_STAT_DATA,basic,unit,{snapshot,mode:s.statMode});if(!snapshot)throw Error('管理のステータスを再計算できませんでした。');
    }
    if(Number(snapshot.overrideState?.grade||unit.grade||1)!==grade){
      snapshot=engine.applyGradeOverrideToSnapshot(window.TRICKCAL_STAT_DATA,basic,unit,{snapshot,mode:s.statMode,grade});if(!snapshot)throw Error('学年を合わせたステータスを取得できません。戦闘時の値を入力してください。');
    }
    const values={};for(const key of core.KEYS){const v=snapshot.internalTotals?.[key]??snapshot.stats[key];if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('保存された会心系ステータスを確認できません。');values[key]=String(v);}
    const row=(f.rows||[]).find(r=>r.apostles?.includes(id)),formationSlot=row.apostles.indexOf(id),rawIds=[...(row.artifacts?.[formationSlot]||[]),...(f.spells||[])].filter(Boolean).map(resolveCardIdAlias),counts=new Map();for(const cardId of rawIds){if(!cardById(cardId))throw Error('編成にあるカードを確認できません。カードデータを更新してから再読込してください。');counts.set(cardId,(counts.get(cardId)||0)+1);}
    const artifactCopies=[...counts].reduce((total,[cardId,qty])=>total+(cardById(cardId)?.kind==='artifact'?qty:0),0);if(artifactCopies>3)throw Error('この編成の遺物が3枠を超えているため、自動読込できません。強化プリセットから遺物を選び直してください。');
    const init=core.initialCardState(manager.cards||{},s.cardDefault);let nextSlot=0;const importedCards=[...counts].flatMap(([cardId,qty])=>{const card=cardById(cardId),growth=init.get(cardId);if(card.kind==='artifact')return Array.from({length:qty},()=>({id:cardId,qty:1,...growth,conditions:{},slot:nextSlot++}));return [{id:cardId,qty,...growth,conditions:{}}];});
    const rawAsideRank=Number(unit.asideRank)||0,asideRank=isAsideEnabled(basic.id)?Math.max(0,Math.min(3,rawAsideRank)):0,asideLevelCap=[0,30,40,50][asideRank]||0,rawAsideLevel=Number(unit.asideLevel)||0,asideLevel=asideLevelCap&&rawAsideLevel>0?Math.min(asideLevelCap,rawAsideLevel):0;
    const skillSource=unit.skillLevels||unit.skills||{},savedPassive=Number(skillSource.passive),passiveLevel=Number.isInteger(savedPassive)&&savedPassive>0?Math.min(12+Math.min(3,asideRank),savedPassive):0;
    const apostle=APOSTLE_INDEX[basic.id.toLowerCase()],compiled=compilePersonalEffects({apostle,basic,asideRank,asideLevel,skillLevels:{low:Number(skillSource.low)||1,high:Number(skillSource.high)||1,passive:passiveLevel},cards:importedCards});
    const sourceBases={},globalRates={},snapshotState=snapshot.overrideState||unit;let rebuilt=null;
    if(snapshot.breakdown&&snapshot.globalPercentRates)rebuilt=engine.calculateFinalInternalTotals(window.TRICKCAL_STAT_DATA,basic,snapshotState,snapshot.breakdown,snapshot.globalPercentRates);
    const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
    const exactBase=!!rebuilt&&core.KEYS.every(key=>close(rebuilt.totals[key],snapshot.internalTotals?.[key]));
    if(!exactBase)compiled.warnings.push('保存されたステータス内訳を再現できず、育成内訳の変更後は概算です。');
    for(const key of core.KEYS){const rate=snapshotGlobalRate(snapshot,key);if(rate==null)throw Error(`${core.LABELS[key]}の全体強化値が保存されていません。`);globalRates[key]=rate;if(exactBase){const base=rebuilt.preGlobalTotals[key],follow=engine.followFraction(snapshotState,key);if(Number.isFinite(base)&&base>=0&&Number.isFinite(follow)&&follow>=0)sourceBases[key]={base,rate,follow};} }
    const baseBeforeGrade=engine.calculateBaseTotals(window.TRICKCAL_STAT_DATA,basic,snapshotState,{}, {includeGrade:false}),ownAdditions={},globalAdditions={},gradeRates={},exactTotals={};
    for(const key of core.KEYS){ownAdditions[key]=sumSnapshotSources(snapshot.breakdown,key,['rankUp','equipment','boardBasic','bond','asideManifest','asideLevel']);globalAdditions[key]=sumSnapshotSources(snapshot.breakdown,key,['research','rankGlobal','boardAdvanced']);gradeRates[key]=Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,engine.getGradeStatBonusRate(window.TRICKCAL_STAT_DATA,i+1,key,basic)]));}
    if(exactBase)for(let targetGrade=1;targetGrade<=6;targetGrade++){
      const baseAtGrade=engine.calculateBaseTotals(window.TRICKCAL_STAT_DATA,basic,snapshotState,{grade:targetGrade}),breakdownAtGrade=structuredClone(snapshot.breakdown);breakdownAtGrade.base=baseAtGrade;
      const totals=engine.calculateFinalInternalTotals(window.TRICKCAL_STAT_DATA,basic,snapshotState,breakdownAtGrade,snapshot.globalPercentRates);
      if(!totals||!core.KEYS.every(key=>Number.isFinite(totals.totals[key])))throw Error('学年別のステータスを計算できません。');
      exactTotals[targetGrade]=Object.fromEntries(core.KEYS.map(key=>[key,totals.totals[key]]));
    }
    const composition={kind:'formation',grade,dataVersion:window.TRICKCAL_STAT_DATA.generatedAt||'',baseBeforeGrade,ownAdditions,globalAdditions,globalRates:Object.fromEntries(core.KEYS.map(key=>[key,globalRates[key]??''])),follow:Object.fromEntries(core.KEYS.map(key=>[key,engine.followFraction(snapshotState,key)])),followAllowed:!basic.エルダイン,gradeRates,exactTotals};
    const next=structuredClone(s);next.inputModel=4;next.inputMode='calculated';next.composition=composition;next.ally=values;next.buffs=Object.fromEntries(core.KEYS.map(key=>[key,'0']));next.direct={self:{rate:'0',damage:'0'},enemy:{rate:'0',damage:'0'}};next.extra={self:{rate:'0',damage:'0'},enemy:{rate:'0',damage:'0'}};next.cards={card:[],formation:importedCards};next.modes={self:'formation',enemy:'formation'};next.source={id,name:basic.使徒名,grade,bases:sourceBases,bakedRates:{}};
    next.formation={id:basic.id,name:basic.使徒名,grade,statMode:actualMode,requestedStatMode:requestedMode,dataVersion:window.TRICKCAL_STAT_DATA.generatedAt||'',asideRank,asideLevel,skillLevels:{low:Number(skillSource.low)||1,high:Number(skillSource.high)||1,passive:passiveLevel},effects:compiled.effects,warnings:compiled.warnings};
    next.formationId=$('formation-select').value;next.memberId=basic.id;next.statMode=actualMode;next.grade=String(grade);
    for(const key of core.KEYS){if(globalRates[key]===undefined){next.growth.fields[key]={current:'',next:''};continue;}next.growth.fields[key]={current:String(globalRates[key]),next:String(globalRates[key])};}
    core.encode(next);s=core.normalize(next);changed();render();$('formation-dialog').close();
  }
  const entries=Object.entries(ENEMY_PRESETS).filter(([k,p])=>!p.hideInSelection&&!p.selectionAliasOf&&!ENEMY_PRESET_CONTENTS[getEnemyPresetMetadata(p,k).type]?.hideInSelection).sort(compareEnemyPresetEntries);
  const group=(k,p)=>{const m=getEnemyPresetMetadata(p,k);return m.type+':'+m.mode;};
  const stageKey=(k,p)=>{const m=getEnemyPresetMetadata(p,k);return JSON.stringify([m.difficulty,m.world,m.stage,m.personality]);};
  let pendingGroup='',pendingStage='';
  function enemyOptions(){
    const groups=new Map(entries.map(([k,p])=>{const m=getEnemyPresetMetadata(p,k);return [group(k,p),m.modeLabel||m.contentLabel||'その他'];}));
    if(preset()){pendingGroup=group(s.enemy.key,preset());pendingStage=stageKey(s.enemy.key,preset());}
    $('enemy-content').innerHTML='<option value="">選択</option>'+[...groups].map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');$('enemy-content').value=pendingGroup;stageOptions();
  }
  function stageOptions(){
    const candidates=entries.filter(([k,p])=>group(k,p)===pendingGroup);
    if(pendingGroup.startsWith('eliasFrontier:'))candidates.sort(([ka,a],[kb,b])=>getEnemyPresetMetadata(b,kb).stage-getEnemyPresetMetadata(a,ka).stage);
    const stages=new Map(candidates.map(([k,p])=>{const m=getEnemyPresetMetadata(p,k);return [stageKey(k,p),[m.difficultyLabel,m.worldLabel,m.stageLabel,m.personality].filter(Boolean).join(' / ')||'通常'];}));
    if(!stages.has(pendingStage))pendingStage=stages.keys().next().value||'';
    $('enemy-stage').innerHTML=[...stages].map(([k,label])=>`<option value="${esc(k)}">${esc(label)}</option>`).join('');$('enemy-stage').value=pendingStage;$('enemy-stage').disabled=!candidates.length;nameOptions();
  }
  function nameOptions(){const candidates=entries.filter(([k,p])=>group(k,p)===pendingGroup&&stageKey(k,p)===pendingStage);
    $('enemy-name').innerHTML='<option value="">敵を選択</option>'+candidates.map(([k,p])=>`<option value="${esc(k)}">${esc(getEnemyPresetMetadata(p,k).name)}</option>`).join('');$('enemy-name').value=candidates.some(([k])=>k===s.enemy.key)?s.enemy.key:'';$('enemy-name').disabled=!candidates.length;
  }
  function editPresetCard(el){const i=Number(el.dataset.cardIndex),row=modalRows?.[i];if(!row)return;const key=el.dataset.cardField;row[key]=Math.max(key==='solder'?0:1,Math.min(key==='star'?5:key==='solder'?2:99,Math.trunc(Number(el.value)||0)));if(row.star<5)row.solder=0;renderPresetRows();renderCatalog();commitPresetDraft();}
  function editArtifactSlot(el){const slot=Number(el.dataset.artifactSlot),row=modalRows?.find(item=>cardById(item.id)?.kind==='artifact'&&item.slot===slot);if(!row)return;const key=el.dataset.artifactField;row[key]=Math.max(key==='solder'?0:1,Math.min(key==='star'?5:2,Math.trunc(Number(el.value)||0)));if(row.star<5)row.solder=0;renderPresetRows();renderCatalog();commitPresetDraft();}
  document.querySelector('main').addEventListener('input',e=>{
    const t=e.target;if(t.dataset.compositionPart){const {compositionPart:part,compositionKey:key}=t.dataset;if(!s.composition||!['baseBeforeGrade','ownAdditions','globalAdditions','globalRates'].includes(part)||!core.KEYS.includes(key))return;const c=s.composition,fields=s.growth.fields[key];
      if(part==='globalRates'){const delta=growthDelta(fields);c.globalRates[key]=t.value;fields.current=t.value;fields.next=t.value===''?'':delta===''?t.value:(Number(t.value)+Number(delta)>=0?growthNumber(Number(t.value)+Number(delta)):t.value);invalidateCompositionStat(c,key);buildFields();}
      else{c[part][key]=t.value;invalidateCompositionStat(c,key);buildFields();}
      changed();return;
    }
    if(t.dataset.ally){s.ally[t.dataset.ally]=t.value;s.source=null;$('source-note').hidden=true;}
    else if(t.dataset.buff)s.buffs[t.dataset.buff]=t.value;
    else if(t.dataset.direct){const index=t.dataset.direct==='rate'?0:1,cardBonus=cardTotals(activeCardRows())[index],personal=core.personalDirect(s,s.side),personalBonus=index?personal.damage:personal.rate;s.direct[s.side][t.dataset.direct]=String((Number(t.value)||0)-cardBonus-personalBonus);}
    else if(t.dataset.enemyStat)s.enemy.overrides[t.dataset.enemyStat]=t.value;
    else if(t.dataset.growth){const key=t.dataset.growth,field=t.dataset.growthField,values=s.growth.fields[key];if(field==='current'){values.current=t.value;updateGrowthProjection(key,{clearDelta:t.value===''});if(s.inputModel===4&&s.inputMode==='calculated'){s.composition.globalRates[key]=t.value;invalidateCompositionStat(s.composition,key);buildCompositionFields();}}else if(field==='delta')updateGrowthProjection(key);changed();return;}
    else return;changed();
  });
  $('card-dialog').addEventListener('change',e=>{
    const target=e.target;
    if(target.dataset.artifactSlot!==undefined){editArtifactSlot(target);return;}
    if(target.dataset.cardIndex!==undefined){editPresetCard(target);return;}
    if(target.dataset.spellId){const row=modalSpellDrafts.get(target.dataset.spellId);if(!row)return;if(target.dataset.spellField==='star'){row.star=Math.max(1,Math.min(5,Math.trunc(Number(target.value)||1)));if(row.star<5)row.solder=0;}else if(target.dataset.spellField==='solder')row.solder=row.star===5?Math.max(0,Math.min(2,Math.trunc(Number(target.value)||0))):0;renderPresetRows();if(modalRows.includes(row))commitPresetDraft();return;}
    if(target.dataset.spellQty){const row=modalSpellDrafts.get(target.dataset.spellQty);if(row){const wasSelected=modalRows.includes(row);row.qty=Math.max(0,Math.min(99,Math.trunc(Number(target.value)||0)));syncSpellQtyControls(row.id);if(wasSelected||row.qty>0)commitPresetDraft();}}
  });
  $('card-dialog').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
    if(button.dataset.spellStep){const option=button.closest('.spell-option'),input=option?.querySelector('[data-spell-qty]'),id=input?.dataset.spellQty,row=id&&modalSpellDrafts.get(id);if(!row)return;const wasSelected=modalRows.includes(row);row.qty=Math.max(0,Math.min(99,row.qty+Number(button.dataset.spellStep)));syncSpellQtyControls(id);if(wasSelected||row.qty>0)commitPresetDraft();return;}
    if(button.dataset.presetKind){setPresetKind(button.dataset.presetKind);return;}
    if(button.dataset.artifactSlotOpen!==undefined){if(modalKind!=='artifact')return;artifactTargetSlot=Number(button.dataset.artifactSlotOpen);if(!Number.isInteger(artifactTargetSlot)||artifactTargetSlot<0||artifactTargetSlot>2)return;$('artifact-picker-title').textContent=`遺物${artifactTargetSlot+1}を選ぶ`;artifactPickerOpen=true;renderCatalog();$('artifact-picker-dialog').showModal();return;}
    if(button.dataset.removeSlot!==undefined){const slot=Number(button.dataset.removeSlot);modalRows=modalRows.filter(row=>!(cardById(row.id)?.kind==='artifact'&&row.slot===slot));renderPresetRows();renderCatalog();commitPresetDraft();return;}
    if(button.dataset.remove!==undefined){modalRows.splice(Number(button.dataset.remove),1);renderPresetRows();renderCatalog();commitPresetDraft();}
  });
  $('direction').onclick=async()=>{s.side=s.side==='self'?'enemy':'self';try{await prepareMode();changed();render();}catch(e){error(e);}};
  function changeEnemyFilter(){const oldName=metadata()?.name;const next=entries.find(([k,p])=>group(k,p)===pendingGroup&&stageKey(k,p)===pendingStage&&getEnemyPresetMetadata(p,k).name===oldName);s.enemy={key:next?.[0]||'',phase:0,overrides:{}};changed();render();}
  $('enemy-content').onchange=()=>{pendingGroup=$('enemy-content').value;pendingStage='';stageOptions();changeEnemyFilter();};
  $('enemy-stage').onchange=()=>{pendingStage=$('enemy-stage').value;nameOptions();changeEnemyFilter();};
  $('enemy-name').onchange=()=>{s.enemy={key:$('enemy-name').value,phase:0,overrides:{}};changed();render();};
  $('enemy-phase').onchange=()=>{s.enemy.phase=Number($('enemy-phase').value);s.enemy.overrides={};changed();render();};
  $('reset-enemy').onclick=()=>{s.enemy.overrides={};changed();render();};
  $('open-presets').onclick=async()=>{try{await ensureCards();try{readManager();}catch{}modalRows=structuredClone(cardRows());normalizeArtifactSlots(modalRows);initializeSpellDrafts();artifactPickerOpen=false;$('preset-warning').textContent='';setPresetKind('artifact');$('card-dialog').showModal();}catch(e){error(e);}};
  $('artifact-picker-dialog').addEventListener('click',e=>{const button=e.target.closest('button');if(!button?.dataset.add)return;const id=button.dataset.add,card=cardById(id),slot=artifactTargetSlot;if(card?.kind!=='artifact'||!Number.isInteger(slot)||slot<0||slot>2)return;const existingIndex=modalRows.findIndex(row=>cardById(row.id)?.kind==='artifact'&&row.slot===slot),existing=existingIndex>=0?modalRows[existingIndex]:null;if(existing?.id===id)return;const growth=core.initialCardState(manager.cards||{},s.cardDefault).get(id);const replacement={id,...growth,qty:1,conditions:{},slot};if(existingIndex>=0)modalRows.splice(existingIndex,1,replacement);else modalRows.push(replacement);$('preset-warning').textContent='';renderPresetRows();renderCatalog();commitPresetDraft();});
  document.addEventListener('click',e=>{const button=e.target.closest('[data-card-info]');if(!button)return;const card=cardById(button.dataset.cardInfo);if(!card)return;const row={id:card.id,qty:Number(button.dataset.cardQty)||1,star:Number(button.dataset.cardStar)||5,solder:Number(button.dataset.cardSolder)||0,conditions:{}};$('card-info-name').textContent=card.name;$('card-info-kind').textContent=card.kind==='artifact'?'遺物':'スペル';$('card-info-effect').textContent=bonusText(card,row);$('card-info-dialog').showModal();});
  $('clear-selected-cards').onclick=()=>{if(modalKind==='spell')for(const row of modalSpellDrafts.values())row.qty=0;modalRows=modalRows.filter(row=>cardById(row.id)?.kind!==modalKind);renderPresetRows();renderCatalog();commitPresetDraft();};
  $('bulk-star').onchange=()=>{if(!$('bulk-star').value)return;for(const row of modalRows)if(cardById(row.id)?.kind===modalKind){row.star=Number($('bulk-star').value);if(row.star<5)row.solder=0;}renderPresetRows();renderCatalog();commitPresetDraft();};
  $('bulk-solder').onchange=()=>{if($('bulk-solder').value==='')return;for(const row of modalRows)if(cardById(row.id)?.kind===modalKind&&row.star===5)row.solder=Number($('bulk-solder').value);renderPresetRows();renderCatalog();commitPresetDraft();};
  $('formation-fab').onclick=async()=>{try{await ensureStats();readManager();renderFormation();$('grade').value=String(s.formation?.grade||s.source?.grade||'');$('stat-mode').value=s.formation?.requestedStatMode||s.statMode;$('formation-dialog').showModal();}catch(e){error(e);}};
  $('reimport-formation').onclick=()=>$('formation-fab').click();
  async function changeInputMode(nextMode){
    if(nextMode===s.inputMode&&s.inputModel===4)return;
    try{
      if(nextMode==='calculated'){
        if(s.inputModel===3&&s.inputMode==='formation')throw Error('旧形式の編成データは内訳がありません。編成から再読込してください。');
        if(!s.composition){await ensureStats();s.composition=manualComposition();for(const key of core.KEYS){const current=s.growth.fields[key].current;if(current!=='')s.composition.globalRates[key]=current;}}
        s.inputModel=4;s.inputMode='calculated';await prepareMode();
      }else{
        if(s.inputModel===4&&s.inputMode==='calculated'||s.inputModel===3&&s.inputMode==='formation'){
          const resolved=core.resolveAllyStats(s,math,{index:cardIndex});
          for(const key of activeKeys())if(resolved[key]==null)throw Error(`${core.LABELS[key]}の内訳が未入力です。基礎値から計算するか、必要な内訳を入力してください。`);
          s.ally=Object.fromEntries(core.KEYS.map(key=>[key,resolved[key]==null?'':String(resolved[key])]));
        }
        s.inputModel=4;s.inputMode='manual';
      }
      core.encode(s);changed();render();
    }catch(e){error(e);}
  }
  document.querySelectorAll('[data-input-mode]').forEach(button=>button.addEventListener('click',()=>changeInputMode(button.dataset.inputMode)));
  $('composition-grade').onchange=()=>{const grade=Number($('composition-grade').value);if(!Number.isInteger(grade)||grade<1||grade>6)return;s.composition.grade=grade;s.grade=String(grade);if(s.formation)s.formation.grade=grade;if(s.source)s.source.grade=grade;changed();render();};
  $('composition-follow').onchange=()=>{const enabled=$('composition-follow').checked&&s.composition.followAllowed,engine=window.TRICKCAL_SHARED_STAT_ENGINE;s.composition.follow=Object.fromEntries(core.KEYS.map(key=>[key,enabled?engine.followFraction({follow:true},key):0]));s.composition.exactTotals={};changed();render();};
  $('personal-effects').addEventListener('change',e=>{const id=e.target.dataset.personalEffect;if(!id||!s.formation)return;const row=s.formation.effects.find(item=>item.id===id);if(!row||row.status!=='resolved'||s.inputMode==='manual'&&PERSONAL_STAT_KEYS.has(row.bonusKey))return;row.enabled=e.target.checked;changed();render();});
  $('passive-level').onchange=()=>{const value=Number($('passive-level').value);commitFormationEffectSettings({skillLevels:{...s.formation?.skillLevels,passive:Number.isInteger(value)&&value>=1?value:0}});};
  $('aside-rank').onchange=()=>commitFormationEffectSettings({asideRank:Number($('aside-rank').value)||0});
  $('aside-level').onchange=()=>commitFormationEffectSettings({asideLevel:Number($('aside-level').value)||0});
  $('formation-select').onchange=()=>{s.formationId=$('formation-select').value;s.memberId='';changed();renderFormation();};$('member-select').onchange=()=>{s.memberId=$('member-select').value;changed();renderFormation();};
  $('stat-mode').onchange=()=>{s.statMode=$('stat-mode').value;};$('grade').onchange=()=>{s.grade=$('grade').value;};$('load-member').onclick=()=>loadMember().catch(error);
  $('growth-enabled').onchange=()=>{s.growth.enabled=$('growth-enabled').checked;$('growth-panel').classList.toggle('is-comparing',s.growth.enabled);$('growth-active-label').hidden=!s.growth.enabled;changed();};
  $('link-growth').onclick=()=>{const [a,b]=activeKeys();s.growth.fields[b]={...s.growth.fields[a]};changed();buildFields();};
  $('export-input').onclick=()=>{try{const blob=new Blob([core.encode(s)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='trickcal-critical-input.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){error(e);}};
  $('import-input').onclick=()=>$('input-file').click();$('input-file').onchange=async()=>{const file=$('input-file').files[0];if(!file)return;try{if(file.size>65536)throw Error('入力ファイルが大きすぎます。');const imported=core.decode(await file.text());if(!confirm('会心チェックの入力を、ファイルの内容で置き換えますか？'))return;epoch++;clearTimeout(timer);s=imported;$('growth-panel').open=!!s.growth.enabled;await prepareMode();changed();render();}catch(e){error(e);}finally{$('input-file').value='';}};
  $('reset-input').onclick=async()=>{if(!confirm('会心チェックの入力だけを初期化しますか？'))return;if(storageReady&&!await acquireLease()){status('別タブを閉じてから初期化してください。');return;}epoch++;clearTimeout(timer);s=core.defaults();$('growth-panel').open=false;dirty=false;blocked=false;try{if(storageReady){window.TRICKCAL_STORAGE_FACADE.localStorage.removeItem(KEY);revision=null;}status();}catch{status('初期化を保存できませんでした。');}render();};
  $('retry-save').onclick=()=>{dirty=true;save(true);};$('reload-input').onclick=async()=>{if(dirty&&!confirm('編集中の入力を保存済みの内容へ戻しますか？'))return;await hydrate();};
  for(const dialog of [$('card-dialog'),$('artifact-picker-dialog'),$('formation-dialog'),$('card-info-dialog')]){dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-cancel]')?.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{if(dialog.open)return;if(dialog.id==='card-dialog'){if($('artifact-picker-dialog').open)$('artifact-picker-dialog').close();modalRows=null;}if(dialog.id==='artifact-picker-dialog'){artifactPickerOpen=false;artifactTargetSlot=null;$('card-catalog').replaceChildren();}});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
  if(boot?.ok){try{readManager();}catch{}await hydrate();await acquireLease();
    window.TRICKCAL_STORAGE_RUNTIME_INSTANCE?.registerParticipant({flush:()=>saveNow(),freeze(){clearTimeout(timer);epoch++;frozen=true;return {ok:true};},async resume(){
      frozen=false;
                                                                               
      if(dirty){await acquireLease();return saveNow();}
      await hydrate();await acquireLease();return {ok:true};
    }});
  }else{render();status('自動保存は利用できません。入力を書き出して保管できます。');}
  window.addEventListener('storage',e=>{if(e.key!==KEY&&e.key!==null)return;if(dirty){blocked=true;clearTimeout(timer);status('別タブで更新されました。読込か、この内容で保存を選べます。');}else hydrate();});
  window.addEventListener('pagehide',()=>{saveNow();epoch++;clearTimeout(timer);leaseRelease?.();});
})();
