(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.TrickcalPvpRange=api;api.mount(document);}})(globalThis,function(){
  'use strict';
                                                              
  const prefix=new Int32Array(3002);for(let r=1;r<=3000;r++)prefix[r]=prefix[r-1]+(r<=50?70:r<=200?30:r<=500?15:r<=1000?10:8);
  function normalize(value){const rank=Math.floor(Number(value));return Math.max(1,Math.min(3001,Number.isFinite(rank)?rank:3001));}
  function limit(rank){return Math.max(1,Math.floor(rank*(rank>=100?92:35)/100));}
  function reward(current,target,bestRank=current){const upper=Math.min(current,bestRank);return target>=upper?0:Math.floor((prefix[upper-1]-prefix[target-1])/10);}
  function calculate(value){const current=normalize(value),target=limit(current);return {current,target,eliph:reward(current,target)};}
  function plan(value,{mode='reward',bestRank=value}={}){
    const current=normalize(value),best=Math.min(current,normalize(bestRank)),next=new Uint16Array(current+1);
    if(mode==='reward'){
      const gains=new Int32Array(current+1),steps=new Uint16Array(current+1);
      for(let r=2;r<=current;r++){
        let gain=-1,count=Infinity;
        for(let t=limit(r);t<r;t++){
          const candidate=reward(r,t,best)+gains[t],battles=1+steps[t];
          if(candidate>gain||(candidate===gain&&battles<count)){gain=candidate;count=battles;next[r]=t;}
        }
        gains[r]=gain;steps[r]=count;
      }
    }else if(mode==='rank'){for(let r=2;r<=current;r++)next[r]=limit(r);}else throw new Error('Unknown PvP mode');
    const rows=[];let rank=current,total=0;
    while(rank>1){const target=next[rank],eliph=reward(rank,target,best);total+=eliph;rows.push({current:rank,target,eliph,total});rank=target;}
    return {current,bestRank:best,mode,rows,total,battles:rows.length};
  }
  function schedule(battles,free=5){free=Math.max(0,Math.min(5,Math.floor(Number(free)||0)));const purchases=Math.ceil(Math.max(0,battles-free)/5);return {days:battles===0?0:battles<=free?1:1+Math.ceil((battles-free)/5),purchases,cost:purchases*25};}
  function combinations(population, slots) {
    if (population < slots) return 0;
    let count = 1;
    for (let i = 1; i <= slots; i++) count = count * (population - i + 1) / i;
    return count;
  }
                                                                       
  function appearanceCounts(population, acceptable) {
    const slots = Math.min(4, population);
    const total = combinations(population, slots);
    return { hits: total - combinations(population - acceptable, slots), total };
  }
  function appearanceProbability(population, acceptable) {
    if (population <= 0 || acceptable <= 0) return 0;
    const { hits, total } = appearanceCounts(population, acceptable);
    return hits / total;
  }
  const DEFAULT_CONFIDENCE = 0.8;
  const DEFAULT_REDRAWS = 5;
  const MAX_REDRAWS = 15;
                                                                 
  const BATTLE_GEM_GOAL_RANKS = [200, 500, 1000];
  const GOAL_PRESETS = [1, ...Array.from({length:10}, (_, i) => (i+1)*10), ...BATTLE_GEM_GOAL_RANKS];
  function guidance(value, goalValue=1, redraws=DEFAULT_REDRAWS, confidence=DEFAULT_CONFIDENCE) {
    const current=normalize(value), goal=normalize(goalValue);
    const displays = Math.max(0, Math.min(MAX_REDRAWS, Math.trunc(Number(redraws) || 0))) + 1;
    const steps=new Uint16Array(current+1);
    const continuation = new Float64Array(current + 1);
    continuation.fill(1);
    const boundaries = new Uint16Array(current + 1);
    const findProbability = (population, count) => {
      const perDisplay = appearanceProbability(population, count);
      return displays === 1 ? perDisplay : -Math.expm1(displays * Math.log1p(-perDisplay));
    };
    for (let r = goal + 1; r <= current; r++) {
      const target = limit(r);
      steps[r] = 1 + steps[target];
      const scores = [];
      let boundary = target;
      while (boundary < r && steps[boundary] === steps[target]) scores.push(continuation[boundary++]);
      boundaries[r] = boundary - 1;
      scores.sort((a, b) => b - a);
                                                                                        
      continuation[r] = scores.reduce((best, score, index) =>
        Math.max(best, Math.min(score, findProbability(r - target, index + 1))), 0);
    }
    const battles=steps[current], rows=[];
    const routeProbability = Math.min(confidence, continuation[current]);
    let rank=current;
    for(let remaining=battles;remaining>0;remaining--){
      const target = limit(rank), population = rank - target, boundary = boundaries[rank];
      const candidates = [];
      for (let next = target; next <= boundary; next++) {
        if (continuation[next] < routeProbability) continue;
        candidates.push(next);
        if (findProbability(population, candidates.length) >= routeProbability) break;
      }
      const compromise = candidates.at(-1);
      rows.push({ current:rank, target, compromise, boundary, candidates,
        probability:findProbability(population, candidates.length) });
      rank = compromise;
    }
    return {current,goal,battles,rows,routeProbability,meetsDisplayTarget:continuation[current]>=confidence};
  }
  function mount(doc){
    const input=doc.getElementById('pvp-rank'),slider=doc.getElementById('pvp-slider'),target=doc.getElementById('pvp-target'),undoButton=doc.getElementById('pvp-undo'),redoButton=doc.getElementById('pvp-redo');if(!input||!slider)return;
    const bestInput=doc.getElementById('pvp-best'),modeInput=doc.getElementById('pvp-mode'),route=doc.getElementById('pvp-route');
    let saved={}; try{saved=JSON.parse((globalThis.TRICKCAL_STORAGE_FACADE?.localStorage||localStorage).getItem('trickcal_tool_pvp_v1')||'{}')||{};}catch{}
    let current=normalize(saved.current??input.value),bestValue=saved.bestValue===undefined?'':String(saved.bestValue);
    const goalInput=doc.getElementById('pvp-goal'), displaysInput=doc.getElementById('pvp-displays');
    const savedGoal = Number(saved.goal) === 3000 ? 1 : normalize(saved.goal ?? 1);
    const goalOptions = new Set([...GOAL_PRESETS, savedGoal]);
    for (const rank of [...goalOptions].sort((a, b) => a - b)) {
      const option = doc.createElement('option');
      option.value = String(rank);
      option.textContent = `${rank.toLocaleString('ja-JP')}位`;
      goalInput.append(option);
    }
    goalInput.value = String(savedGoal);
    const savedRedraws = Number(saved.redraws);
    displaysInput.value = String(Number.isInteger(savedRedraws) && savedRedraws >= 1 && savedRedraws <= MAX_REDRAWS
      ? savedRedraws : DEFAULT_REDRAWS);
    const inlineDisplays = ['pvp-compact-displays', 'pvp-desktop-displays'].map(id => doc.getElementById(id));
    for (const select of inlineDisplays) {
      select.replaceChildren(...Array.from(displaysInput.options, option => option.cloneNode(true)));
    }
    if(bestInput)bestInput.value=bestValue;
    function persist(){try{(globalThis.TRICKCAL_STORAGE_FACADE?.localStorage||localStorage).setItem('trickcal_tool_pvp_v1',JSON.stringify({current,bestValue,goal:normalize(goalInput.value),redraws:Number(displaysInput.value)}));}catch{}}const undo=[],redo=[];
    const snapshot=()=>({current,bestValue});
    function render(value,normalizeInput){const result=calculate(value),best=bestValue===''?result.current:Math.min(result.current,normalize(bestValue));if(normalizeInput)input.value=String(result.current);slider.value=String(result.current);target.textContent=result.target.toLocaleString('ja-JP')+'位';target.setAttribute('aria-label',result.target+'位へ進む');target.disabled=result.current===result.target;doc.getElementById('pvp-eliph').textContent=String(reward(result.current,result.target,best));undoButton.disabled=!undo.length;redoButton.disabled=!redo.length;
      const guide=guidance(result.current,goalInput.value,Number(displaysInput.value));
      doc.getElementById('pvp-minimum').textContent=`目標${guide.goal.toLocaleString('ja-JP')}位まで最短${guide.battles}戦`;
      function rankMarkup(rank){
        return `${rank.toLocaleString('ja-JP')}位<small class="pvp-gain">＋<img src="../img/エリーフ.webp" alt="エリーフ">${reward(result.current,rank,best)}</small>`;
      }
      const first=guide.rows[0];
      target.innerHTML=rankMarkup(result.target);
      function candidateLabel(row) {
        const ranges = [];
        for (const candidate of row.candidates) {
          const last = ranges.at(-1);
          if (last && last[1] + 1 === candidate) last[1] = candidate;
          else ranges.push([candidate, candidate]);
        }
        const format = rank => rank.toLocaleString('ja-JP');
        if (ranges.length === 1 && ranges[0][0] === row.target) return `〜${format(row.compromise)}位`;
        return ranges.map(([start, end]) => start === end ? `${format(start)}位` : `${format(start)}〜${format(end)}位`).join('、');
      }
      doc.getElementById('pvp-compromise').textContent=first?candidateLabel(first):'到達済み';
      doc.getElementById('pvp-boundary').innerHTML=first?rankMarkup(first.boundary):'到達済み';
      const formatProbability = value => `${(value * 100).toLocaleString('ja-JP',{maximumFractionDigits:2})}%`;
      const budget = `初回＋引き直し${displaysInput.value}回以内`;
      doc.getElementById('pvp-probability').textContent=first?`${budget}で約${formatProbability(first.probability)}`:'到達済み';
      const displayWarning = doc.getElementById('pvp-display-warning');
      displayWarning.hidden = !first;
      displayWarning.textContent = !first ? '' : guide.meetsDisplayTarget
        ? 'おすすめを選び続けると、各戦で80%以上'
        : `おすすめを選び続けると、各戦で約${formatProbability(guide.routeProbability)}以上`;
      const compactProbability = doc.getElementById('pvp-compact-probability');
      compactProbability.hidden = !first;
      for (const select of inlineDisplays) {
        select.value = displaysInput.value;
        select.hidden = !first;
      }
      doc.getElementById('pvp-compact-probability-text').textContent = first
        ? `各戦・引き直し${displaysInput.value}回以内：約${formatProbability(guide.routeProbability)}以上` : '';
      const guideRoute=doc.getElementById('pvp-guide-route');guideRoute.replaceChildren();
      guide.rows.forEach((row,i)=>{
        const tr=doc.createElement('tr');const count=doc.createElement('td');count.textContent=String(i+1);tr.append(count);
        for(const key of ['target','compromise','boundary']){
          const td=doc.createElement('td'),button=doc.createElement('button');button.type='button';button.dataset.rank=String(row[key]);
          button.textContent = key === 'compromise' ? candidateLabel(row) : row[key].toLocaleString('ja-JP');
          if (key === 'compromise') button.setAttribute('aria-label', `${button.textContent}、${row.compromise}位を選択`);
          td.append(button);tr.append(td);
        }
        guideRoute.append(tr);
      });
      if(!route)return;
      const resultPlan=plan(result.current,{mode:modeInput.value,bestRank:best}),timing=schedule(resultPlan.battles,doc.getElementById('pvp-free').value);
      doc.getElementById('pvp-route-summary').textContent=`獲得 ${resultPlan.total.toLocaleString('ja-JP')} エリーフ · ${resultPlan.battles}戦 · 無料で${timing.days}日`;
      doc.getElementById('pvp-one-day-result').hidden=!doc.getElementById('pvp-one-day').checked;
      doc.getElementById('pvp-one-day-result').textContent=`補充 ${timing.purchases}回 · 消費 ${timing.cost} · 差引 ${resultPlan.total-timing.cost} エリーフ（5戦／25）`;
      route.replaceChildren();
      for(const [i,row] of resultPlan.rows.entries()){
        const tr=doc.createElement('tr'),count=doc.createElement('td'),rank=doc.createElement('td'),gain=doc.createElement('td'),sum=doc.createElement('td'),button=doc.createElement('button');
        count.textContent=String(i+1);button.type='button';button.textContent=row.target.toLocaleString('ja-JP')+'位';button.dataset.rank=String(row.target);button.setAttribute('aria-label',row.target+'位から再計算');rank.append(button);gain.textContent='+'+row.eliph;sum.textContent=String(row.total);tr.append(count,rank,gain,sum);route.append(tr);
      }
      doc.getElementById('pvp-route-empty').hidden=!!resultPlan.rows.length;
    }
    function commit(value,nextBest=bestValue){const next=normalize(value);if(next!==current||nextBest!==bestValue){undo.push(snapshot());if(undo.length>100)undo.shift();redo.length=0;current=next;bestValue=nextBest;}if(bestInput)bestInput.value=bestValue;persist();render(current,true);}
    function advance(value){const next=normalize(value);commit(next,bestValue===''?'':String(Math.min(normalize(bestValue),next)));}
    input.addEventListener('input',()=>{if(input.value!==''&&Number.isFinite(input.valueAsNumber))render(input.value,false);});input.addEventListener('change',()=>commit(input.value||current));
    slider.addEventListener('input',()=>render(slider.value,true));slider.addEventListener('change',()=>commit(slider.value));
    target.addEventListener('click',()=>advance(calculate(input.value||current).target));
    function restore(entry){current=entry.current;bestValue=entry.bestValue;if(bestInput)bestInput.value=bestValue;persist();render(current,true);}
    undoButton.addEventListener('click',()=>{if(!undo.length)return;redo.push(snapshot());restore(undo.pop());});
    redoButton.addEventListener('click',()=>{if(!redo.length)return;undo.push(snapshot());restore(redo.pop());});
    if(route){route.addEventListener('click',e=>{const button=e.target.closest('button[data-rank]');if(button){advance(button.dataset.rank);(route.querySelector('button')||modeInput).focus({preventScroll:true});}});bestInput.addEventListener('change',()=>commit(current,bestInput.value===''?'':String(normalize(bestInput.value))));for(const id of ['pvp-mode','pvp-free','pvp-one-day'])doc.getElementById(id).addEventListener('change',()=>{if(id==='pvp-free'){const free=doc.getElementById(id);free.value=String(Math.max(0,Math.min(5,Math.floor(Number(free.value)||0))));}render(input.value||current,true);});}
    for (const button of doc.querySelectorAll('[data-adjust="rank"]')) {
      const delta = Number(button.dataset.delta);
      let pointerId = null, timer, repeated = false;
      function repeat() {
        repeated = true;
        const previous = normalize(input.value || current);
        const next = normalize(previous + delta);
        if (next === previous) return;
        render(next, true);
        timer = setTimeout(repeat, 100);
      }
      button.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary || pointerId !== null) return;
        pointerId = event.pointerId;
        repeated = false;
        button.setPointerCapture(pointerId);
        timer = setTimeout(repeat, 350);
      });
      button.addEventListener('contextmenu', event => event.preventDefault());
      function finish(event) {
        if (event.pointerId !== pointerId) return;
        pointerId = null;
        clearTimeout(timer);
        if (repeated) commit(input.value || current);
      }
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, finish);
      }
      button.addEventListener('click', event => {
        if (repeated && event.detail > 0) return;
        commit(normalize(Number(input.value || current) + delta));
      });
    }
    goalInput.addEventListener('change',()=>{goalInput.value=String(normalize(goalInput.value));persist();render(current,true);});
    displaysInput.addEventListener('change',()=>{persist();render(current,true);});
    for (const select of inlineDisplays) {
      select.addEventListener('change', () => {
        displaysInput.value = select.value;
        persist();
        render(current, true);
      });
    }
    doc.getElementById('pvp-guide-route').addEventListener('click',e=>{const button=e.target.closest('button[data-rank]');if(button)advance(button.dataset.rank);});
    const bar = doc.getElementById('pvp-site-topbar'), toggle = doc.getElementById('pvp-nav-toggle');
    toggle.addEventListener('click', () => {
      for (const menu of bar.querySelectorAll('details[open]')) menu.open = false;
      bar.hidden = !bar.hidden;
      doc.body.classList.toggle('pvp-nav-collapsed', bar.hidden);
      toggle.setAttribute('aria-expanded', String(!bar.hidden));
      const label = bar.hidden ? '上部ナビを表示' : '上部ナビを閉じる';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    });
    render(current,true);
  }
  return {normalize,calculate,plan,schedule,appearanceProbability,guidance,mount};
});
