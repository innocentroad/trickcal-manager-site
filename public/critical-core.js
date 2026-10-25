(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TRICKCAL_CRITICAL=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const KEYS=['crit','critDmg','critRes','critDmgRes'];
  const LABELS={crit:'会心',critDmg:'会心ダメージ',critRes:'会心抵抗',critDmgRes:'会心ダメージ抵抗'};
  const EFFECT_KEYS=new Set(['critP','critDmgP','critResP','critDmgResP','critRateP','critDmgAddP','critResAddP','critDmgResAddP','enemyCritResDownP','enemyCritDmgResDownP']);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
  function defaults(){return {inputModel:4,inputMode:'manual',composition:null,formation:null,side:'self',modes:{self:'direct',enemy:'direct'},ally:{crit:'60000',critDmg:'60000',critRes:'40000',critDmgRes:''},buffs:Object.fromEntries(KEYS.map(k=>[k,'0'])),direct:{self:{rate:'0',damage:'0'},enemy:{rate:'0',damage:'0'}},extra:{self:{rate:'0',damage:'0'},enemy:{rate:'0',damage:'0'}},cards:{card:[],formation:[]},cardDefault:'auto',enemy:{key:'',phase:0,overrides:{}},source:null,formationId:'',memberId:'',statMode:'current',grade:'saved',growth:{enabled:false,fields:Object.fromEntries(KEYS.map(k=>[k,{current:'',next:''}]))}};}
  function numeric(value,{blank=true,min=-1e6,max=1e12}={}){
    if(value===''&&blank)return '';
    if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<min||Number(value)>max)throw Error('入力の数値が不正です。');
    return String(value);
  }
  function str(v,max=200){if(typeof v!=='string'||v.length>max)throw Error('入力の形式が不正です。');return v;}
  function normalize(value){
    if(!object(value))throw Error('入力データを確認できません。');
    const s=defaults();
    if(value.inputModel!=null&&![1,2,3,4].includes(value.inputModel))throw Error('入力形式のバージョンが不正です。');
    const legacy=value.inputModel!==2&&value.inputModel!==3&&value.inputModel!==4,modern=value.inputModel===3,latest=value.inputModel===4;
    if(modern&&!['manual','formation'].includes(value.inputMode))throw Error('入力方法の指定が不正です。');
    if(latest&&!['manual','calculated'].includes(value.inputMode))throw Error('入力方法の指定が不正です。');
    s.inputModel=latest?4:modern?3:2;s.inputMode=latest||modern?value.inputMode:'manual';
    if(!['self','enemy'].includes(value.side))throw Error('攻守の指定が不正です。');s.side=value.side;
    for(const side of ['self','enemy']){
      if(!['direct','card','formation'].includes(value.modes?.[side]))throw Error('強化方法が不正です。');s.modes[side]=value.modes[side];
      for(const k of ['rate','damage']){s.direct[side][k]=numeric(value.direct?.[side]?.[k]);s.extra[side][k]=numeric(value.extra?.[side]?.[k]);}
      if(legacy&&s.modes[side]!=='direct'){s.direct[side]={...s.extra[side]};s.extra[side]={rate:'0',damage:'0'};}
    }
    for(const k of KEYS){
      s.ally[k]=numeric(value.ally?.[k],{min:0});s.buffs[k]=numeric(value.buffs?.[k],{min:-100});
      s.growth.fields[k]={current:numeric(value.growth?.fields?.[k]?.current,{min:0}),next:numeric(value.growth?.fields?.[k]?.next,{min:0})};
    }
    if(typeof value.growth?.enabled!=='boolean')throw Error('比較条件が不正です。');s.growth.enabled=value.growth.enabled;
    if(!['auto','manager','max'].includes(value.cardDefault))throw Error('カードの初期値指定が不正です。');s.cardDefault=value.cardDefault;
    for(const mode of ['card','formation']){
      const rows=value.cards?.[mode];if(!Array.isArray(rows)||rows.length>128)throw Error('カード数が不正です。');
      s.cards[mode]=rows.map(row=>{
        if(!object(row)||![1,2,3,4,5].includes(row.star)||![0,1,2].includes(row.solder)||!Number.isInteger(row.qty)||row.qty<1||row.qty>99||!object(row.conditions)||Object.keys(row.conditions).length>30)throw Error('カードの強化値が不正です。');
        const conditions={};for(const [key,v]of Object.entries(row.conditions)){str(key);if(typeof v!=='boolean'||['__proto__','constructor','prototype'].includes(key))throw Error('カード条件が不正です。');conditions[key]=v;}
        if(row.slot!=null&&![0,1,2].includes(row.slot))throw Error('遺物スロットの指定が不正です。');
        return {id:str(row.id),qty:row.qty,star:row.star,solder:row.star===5?row.solder:0,conditions,...(row.slot==null?{}:{slot:row.slot})};
      });
      const slotIds=new Set(),byId=new Map();for(const row of s.cards[mode]){if(row.slot!=null){if(slotIds.has(row.slot))throw Error('遺物スロットが重複しています。');slotIds.add(row.slot);}const group=byId.get(row.id)||[];group.push(row);byId.set(row.id,group);}
      for(const group of byId.values())if(group.length>1&&(group.some(row=>row.slot==null||row.qty!==1)||new Set(group.map(row=>row.slot)).size!==group.length))throw Error('同じカードの枚数はまとめてください。');
    }
    if(!object(value.enemy)||!Number.isInteger(value.enemy.phase)||value.enemy.phase<0||value.enemy.phase>100||!object(value.enemy.overrides))throw Error('敵の指定が不正です。');
    s.enemy={key:str(value.enemy.key),phase:value.enemy.phase,overrides:{}};
    for(const k of KEYS)if(own(value.enemy.overrides,k))s.enemy.overrides[k]=numeric(value.enemy.overrides[k],{min:0});
    if(value.source!=null){
      const source=value.source;if(!object(source)||!Number.isInteger(source.grade)||source.grade<1||source.grade>6||!object(source.bases))throw Error('読込元の値が不正です。');
      s.source={id:str(source.id),name:str(source.name),grade:source.grade,bases:{},bakedRates:{}};
      for(const k of KEYS)if(own(source.bases,k)){
        const b=source.bases[k];if(!object(b))throw Error('全体強化の内訳が不正です。');
        s.source.bases[k]={base:Number(numeric(b.base,{blank:false,min:0})),rate:Number(numeric(b.rate,{blank:false,min:0})),follow:Number(numeric(b.follow,{blank:false,min:0,max:1}))};
      }
      for(const k of KEYS)if(own(source.bakedRates,k))s.source.bakedRates[k]=Number(numeric(source.bakedRates[k],{blank:false,min:-100,max:1000}));
    }
    if((modern||latest)&&value.formation!=null){
      const formation=value.formation;
      if(!object(formation)||!Number.isInteger(formation.grade)||formation.grade<1||formation.grade>6
        ||!['current','planned'].includes(formation.statMode)||!Array.isArray(formation.effects)||formation.effects.length>200
        ||!object(formation.skillLevels)||!Number.isInteger(formation.asideRank)||formation.asideRank<0||formation.asideRank>3)throw Error('編成読込の詳細が不正です。');
      const skillLevels={};for(const key of ['low','high'])skillLevels[key]=Number(numeric(formation.skillLevels[key]??1,{blank:false,min:1,max:15}));
      skillLevels.passive=Number(numeric(formation.skillLevels.passive??0,{blank:false,min:0,max:15}));
      s.formation={id:str(formation.id),name:str(formation.name),grade:formation.grade,statMode:formation.statMode,
        requestedStatMode:['current','planned'].includes(formation.requestedStatMode)?formation.requestedStatMode:formation.statMode,
        dataVersion:str(formation.dataVersion||''),asideRank:formation.asideRank,
        asideLevel:Number(numeric(formation.asideLevel??0,{blank:false,min:0,max:50})),skillLevels,
        effects:formation.effects.map(row=>{
          if(!object(row)||!EFFECT_KEYS.has(row.bonusKey)||!['self','enemy'].includes(row.target)
            ||typeof row.enabled!=='boolean'||typeof row.defaultEnabled!=='boolean'
            ||!['resolved','needs-level','unresolved'].includes(row.status))throw Error('本人効果の保存値が不正です。');
          return {id:str(row.id),label:str(row.label),sourceLabel:str(row.sourceLabel),target:row.target,bonusKey:row.bonusKey,
            value:row.status==='resolved'?Number(numeric(row.value,{blank:false,min:-1e6,max:1e6})):null,
            enabled:row.enabled,defaultEnabled:row.defaultEnabled,status:row.status,condition:str(row.condition||'')};
        }),warnings:Array.isArray(formation.warnings)?formation.warnings.slice(0,20).map(v=>str(v,300)):[]};
    }
    if(modern&&s.inputMode==='formation'&&!s.formation)throw Error('編成読込の保存値がありません。');
    if(latest&&value.composition!=null){
      const c=value.composition;if(!object(c)||!['manual','formation'].includes(c.kind)||!Number.isInteger(c.grade)||c.grade<1||c.grade>6
        ||!object(c.baseBeforeGrade)||!object(c.ownAdditions)||!object(c.globalAdditions)||!object(c.globalRates)||!object(c.follow)
        ||!object(c.gradeRates)||!object(c.exactTotals))throw Error('育成ステータスの内訳が不正です。');
      const readVector=(input,{required=true,min=-1e9,max=1e12}={})=>Object.fromEntries(KEYS.flatMap(key=>{
        if(!own(input,key)){if(required)throw Error('育成ステータスの内訳が不足しています。');return [];}
        const value=numeric(input[key],{blank:true,min,max});return [[key,value===''?'':Number(value)]];
      }));
      const gradeRates={},exactTotals={};
      for(const key of KEYS){if(!object(c.gradeRates[key]))throw Error('学年補正率が不足しています。');gradeRates[key]={};for(let grade=1;grade<=6;grade++)gradeRates[key][grade]=Number(numeric(c.gradeRates[key][grade],{blank:false,min:-1,max:10}));}
      for(const grade of Object.keys(c.exactTotals)){if(!/^[1-6]$/.test(grade)||!object(c.exactTotals[grade]))throw Error('学年別ステータスが不正です。');exactTotals[grade]=readVector(c.exactTotals[grade]);}
      if(Object.keys(exactTotals).length!==0&&Object.keys(exactTotals).length!==6)throw Error('学年別ステータスが不足しています。');
      if(!object(c.baseBeforeGrade)||!object(c.ownAdditions)||!object(c.globalAdditions)||!object(c.globalRates)||!object(c.follow)||typeof c.followAllowed!=='boolean')throw Error('育成ステータスの内訳が不足しています。');
      s.composition={kind:c.kind,grade:c.grade,dataVersion:str(c.dataVersion||''),baseBeforeGrade:readVector(c.baseBeforeGrade,{min:0}),ownAdditions:readVector(c.ownAdditions),globalAdditions:readVector(c.globalAdditions),globalRates:readVector(c.globalRates,{min:0,max:1e6}),follow:Object.fromEntries(KEYS.map(key=>[key,Number(numeric(c.follow[key],{blank:false,min:0,max:1}))])),followAllowed:c.followAllowed,gradeRates,exactTotals};
    }
    if(latest&&s.inputMode==='calculated'&&!s.composition)throw Error('計算用の育成内訳がありません。編成から再読込するか、戦闘時の値を入力してください。');
    s.formationId=str(value.formationId);s.memberId=str(value.memberId);
    if(!['current','planned'].includes(value.statMode)||!['saved','1','2','3','4','5','6'].includes(value.grade))throw Error('育成条件が不正です。');
    s.statMode=value.statMode;s.grade=value.grade;return s;
  }
  function decode(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>65536)throw Error('入力ファイルが大きすぎます。');let v;try{v=JSON.parse(raw);}catch{throw Error('入力ファイルを読み取れませんでした。');}if(!object(v)||v.format!=='trickcal-critical-input'||v.version!==1)throw Error('この入力ファイルの形式には対応していません。');return normalize(v.settings);}
  function encode(s){const raw=JSON.stringify({format:'trickcal-critical-input',version:1,settings:normalize(s)});if(new TextEncoder().encode(raw).length>65536)throw Error('入力の保存容量を超えました。');return raw;}
  function initialCardState(cards={},preference='auto'){
    const managed=Object.values(cards).some(c=>Number(c?.star)>1||Number(c?.solder)>0);
    const manager=preference==='manager'||preference==='auto'&&managed;
    return {manager,label:manager?'管理の値':'★5／はんだ0',get(id){const c=cards[id]||{};const star=manager?Math.max(1,Math.min(5,Number(c.star)||1)):5;return {star,solder:manager&&star===5?Math.max(0,Math.min(2,Number(c.solder)||0)):0};}};
  }
  function sumMap(a,b,mult=1){for(const k of ['critP','critDmgP','critResP','critDmgResP','critRateP','critDmgAddP','critResAddP','critDmgResAddP'])a[k]=(a[k]||0)+(Number(b?.[k])||0)*mult;return a;}
  function baseBonuses(card,row){const a={};for(const b of [card?.bonusesByStar?.[row.star-1],row.star===5?card?.solderBonuses?.[row.solder]:null]){
    sumMap(a,{critP:b?.critP,critRateP:b?.critRateP,critDmgAddP:(Number(b?.critDmgP)||0)+(Number(b?.critDmgAddP)||0),critResAddP:(Number(b?.critResP)||0)+(Number(b?.critResAddP)||0),critDmgResAddP:(Number(b?.critDmgResP)||0)+(Number(b?.critDmgResAddP)||0)},row.qty);
  }return a;}
  function conditionalBonus(effect,row){const b={...(effect.bonusesByStar?.[row.star-1]||effect.bonuses||{})};const label=effect.shortLabel||effect.label||'';
    if(b.critRateP!=null&&/会心(?!率|DMG|ダメージ|抵抗)/.test(label)){b.critP=(Number(b.critP)||0)+Number(b.critRateP);delete b.critRateP;}
    if(b.critDmgP!=null&&/会心(?:ダメージ量|DMG量)/.test(label)){b.critDmgAddP=(Number(b.critDmgAddP)||0)+Number(b.critDmgP);delete b.critDmgP;}
    return b;
  }
  function cardBonuses(card,row){const a=baseBonuses(card,row);for(const e of card?.conditionalEffects||[])if(row.conditions[e.id])sumMap(a,conditionalBonus(e,row),row.qty);return a;}
  function relevant(card,side){const rows=[...(card.bonusesByStar||[]),...Object.values(card.solderBonuses||{}),...(card.conditionalEffects||[]).flatMap(e=>e.bonusesByStar||[e.bonuses||{}])];
    return rows.some(b=>Object.keys(b||{}).some(k=>side==='self'?['critP','critRateP','critDmgP','critDmgAddP'].includes(k):['critResP','critDmgResP','critResAddP','critDmgResAddP'].includes(k)));}
  function enemyStats(preset,index){const out={};for(const k of KEYS)out[k]=preset?.[k];const phase=preset?.phases?.[index];
    if(phase?.stats){for(const k of KEYS)if(typeof phase.stats[k]==='number'&&Number.isFinite(phase.stats[k])&&phase.stats[k]>=0)out[k]=phase.stats[k];}
    else if(phase)for(const k of KEYS)if(phase.scaleStats?.includes(k))out[k]=Math.round(Number(out[k])*(Number(phase.mult)||1));return out;}
  function enabledPersonalEffects(s){return (s.formation?.effects||[]).filter(row=>row.status==='resolved'&&row.enabled&&Number.isFinite(Number(row.value)));}
  function sumPersonal(s,bonusKey,target){return enabledPersonalEffects(s).reduce((sum,row)=>sum+(row.bonusKey===bonusKey&&(!target||row.target===target)?Number(row.value):0),0);}
  function calculatedStatValue(s,key,changed){
    const c=s.composition,grade=String(c.grade),fields=s.growth.fields[key],currentRate=Number(c.globalRates[key]);
    if(changed&&s.growth.enabled&&(fields.current===''||fields.next===''))throw Error(`${LABELS[key]}の全体強化値を入力してください。`);
    const rate=changed&&s.growth.enabled?Number(fields.next):currentRate;
    const exact=c.exactTotals?.[grade]?.[key];
    if(Number.isFinite(exact)&&Number.isFinite(rate)&&rate===currentRate)return exact;
    const gradeRate=Number(c.gradeRates[key]?.[grade]);
    if(c.baseBeforeGrade[key]===''||c.ownAdditions[key]===''||c.globalAdditions[key]===''||c.globalRates[key]===''||!Number.isFinite(gradeRate)||!Number.isFinite(rate))return null;
    const preGlobal=Number(c.baseBeforeGrade[key])*(1+gradeRate)+Number(c.ownAdditions[key])+Number(c.globalAdditions[key]);
    return preGlobal*((1+rate/100)+Number(c.follow[key]));
  }
  function cardStatPercent(s,index,key){
    const mode=s.modes[s.side];if(mode==='direct')return 0;
    return (s.cards[mode]||[]).reduce((sum,row)=>{const card=index?.[row.id];if(!card)return sum;return sum+(Number(cardBonuses(card,row)[`${key}P`])||0);},0);
  }
  function resolveAllyStats(s,math,{changed=false,index={}}={}){
    const out={},side=s.side,changedKeys=new Set(side==='self'?KEYS.slice(0,2):KEYS.slice(2));
    for(const k of KEYS){const calculated=s.inputModel===4&&s.inputMode==='calculated',changesThisStat=changed&&changedKeys.has(k);let value=calculated?calculatedStatValue(s,k,changesThisStat):Number(s.ally[k]);if(!calculated&&(s.ally[k]===''||!Number.isFinite(value))||calculated&&!Number.isFinite(value)){out[k]=null;continue;}
      if(!calculated&&changed&&s.growth.enabled&&changedKeys.has(k)){const fields=s.growth.fields[k],current=Number(fields.current),next=Number(fields.next),base=s.source?.bases?.[k];
        if(fields.current===''||fields.next===''||!Number.isFinite(current)||!Number.isFinite(next))throw Error(`${LABELS[k]}の全体強化値を入力してください。`);
        if(current!==next){
          if(s.inputModel<4&&base&&current===base.rate){
            value=base.base*(1+next/100+base.follow);
            if(s.inputModel===3&&s.inputMode==='manual')value=math.resolveCombatStat(value,Number(s.source?.bakedRates?.[k])||0,side==='enemy'?1:0);
          }else{value=value/(1+current/100)*(1+next/100);out.approximate=true;}
        }
      }
      const manualBattleValue=s.inputModel===4&&s.inputMode==='manual';
      const selfRate=calculated?sumPersonal(s,`${k}P`,'self')+cardStatPercent(s,index,k):s.inputModel===3&&s.inputMode==='formation'?sumPersonal(s,`${k}P`,'self'):0;
      if(calculated){
        const c=s.composition,exact=c.exactTotals?.[String(c.grade)]?.[k],rate=Number(c.globalRates[k]);
        if(c.kind==='formation'&&!Number.isFinite(exact))out.approximate=true;
        if(changesThisStat&&s.growth.enabled){const next=Number(s.growth.fields[k].next);if(Number.isFinite(rate)&&Number.isFinite(next)&&rate!==next)out.approximate=true;}
      }
      out[k]=math.resolveCombatStat(value,(manualBattleValue?0:Number(s.buffs[k])||0)+selfRate,side==='enemy'?1:0);
    }
    return out;
  }
  function personalDirect(s,side){
    return side==='self'
      ? {rate:sumPersonal(s,'critRateP','self'),damage:sumPersonal(s,'critDmgAddP','self')}
      : {rate:sumPersonal(s,'critResAddP','self'),damage:sumPersonal(s,'critDmgResAddP','self')};
  }
  function enemyStatReductions(s){return {critRes:sumPersonal(s,'enemyCritResDownP','enemy'),critDmgRes:sumPersonal(s,'enemyCritDmgResDownP','enemy')};}
  function calculate(s,preset,index,math,{spellsDisabled=false,changed=false}={}){
    const side=s.side,keys=side==='self'?KEYS.slice(0,2):KEYS.slice(2),opposite=side==='self'?KEYS.slice(2):KEYS.slice(0,2);
    if(!preset)return {error:'敵を選択してください。'};
    const read=(value,label)=>{if(value===''||value==null||!Number.isFinite(Number(value)))throw Error(`${label}を入力してください。`);return Number(value);};
    try{
      const enemy=enemyStats(preset,s.enemy.phase),ally=resolveAllyStats(s,math,{changed,index}),reductions=enemyStatReductions(s);let approximate=!!ally.approximate;delete ally.approximate;
      for(const k of keys)if(ally[k]==null)read(ally[k],LABELS[k]);
      for(const k of opposite){let value=read(own(s.enemy.overrides,k)?s.enemy.overrides[k]:enemy[k],`敵の${LABELS[k]}`);const reduction=side==='self'?(k==='critRes'?reductions.critRes:k==='critDmgRes'?reductions.critDmgRes:0):0;enemy[k]=math.resolveCombatStat(value,-reduction,side==='self'?1:0);}
      const extra=personalDirect(s,side);let rate=(Number(s.direct[side].rate)||0)+extra.rate,damage=(Number(s.direct[side].damage)||0)+extra.damage;const mode=s.modes[side],missing=[];
      if(mode!=='direct')for(const row of s.cards[mode]){const card=own(index,row.id)?index[row.id]:null;if(!card){missing.push(row.id);continue;}if(spellsDisabled&&card.kind==='spell')continue;const b=cardBonuses(card,row);rate+=side==='self'?b.critRateP||0:b.critResAddP||0;damage+=side==='self'?b.critDmgAddP||0:b.critDmgResAddP||0;}
      if(missing.length)return {error:'見つからないカードがあります。選び直してください。'};
      const chance=side==='self'?math.calcRuntimeCritRate(ally.crit,enemy.critRes):math.calcRuntimeCritRate(enemy.crit,ally.critRes);
      const multiplier=side==='self'?math.calcRuntimeCritMultiplier(ally.critDmg,enemy.critDmgRes):math.calcRuntimeCritMultiplier(enemy.critDmg,ally.critDmgRes);
      const rateDelta=side==='self'?rate:-rate;
                                                                                
      const resolvedRate=math.clampCombatCritRate(chance+rateDelta*0.01);
      return {rate:resolvedRate,multiplier:math.clampCombatCritMultiplier(multiplier+(side==='self'?damage:-damage)/100),rateBonus:rate,damageBonus:damage,approximate,ally,enemy};
    }catch(e){return {error:e.message};}
  }
  return {KEYS,LABELS,defaults,normalize,encode,decode,initialCardState,baseBonuses,conditionalBonus,cardBonuses,relevant,enemyStats,resolveAllyStats,personalDirect,calculate};
});
