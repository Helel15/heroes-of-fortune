import { useState, useEffect, useRef, useCallback } from "react";

/* ════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
════════════════════════════════════════════════════════════════ */
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
const SUIT_COLOR = s => (s==='♥'||s==='♦') ? '#e05555' : '#6aabff';
const rng = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function createDeck(){return shuffle(SUITS.flatMap(s=>RANKS.map(r=>({suit:s,rank:r,id:`${r}${s}${Math.random()}`}))));}

const HAND_DATA = {
  'Royal Flush':    {chips:100,mult:8,  color:'#FFD700',emoji:'👑'},
  'Straight Flush': {chips:80, mult:6,  color:'#FF6B35',emoji:'🌊'},
  'Five of a Kind': {chips:90, mult:7,  color:'#FF00FF',emoji:'⭐'},
  'Four of a Kind': {chips:70, mult:5,  color:'#9B59B6',emoji:'🐉'},
  'Full House':     {chips:50, mult:4,  color:'#E74C3C',emoji:'🏰'},
  'Flush':          {chips:40, mult:3.5,color:'#3498DB',emoji:'✨'},
  'Straight':       {chips:35, mult:3,  color:'#2ECC71',emoji:'⚡'},
  'Three of a Kind':{chips:25, mult:2.5,color:'#1ABC9C',emoji:'⚔️'},
  'Two Pair':       {chips:15, mult:2,  color:'#F39C12',emoji:'🛡️'},
  'Pair':           {chips:10, mult:1.5,color:'#E67E22',emoji:'🏹'},
  'High Card':      {chips:5,  mult:1.2,color:'#95A5A6',emoji:'🗡️'},
};

function evaluateHand(cards){
  if(!cards.length) return {name:'None',chips:0,mult:1};
  const ranks=cards.map(c=>RANK_VALUES[c.rank]).sort((a,b)=>b-a);
  const suits=cards.map(c=>c.suit);
  const rc={};ranks.forEach(r=>rc[r]=(rc[r]||0)+1);
  const counts=Object.values(rc).sort((a,b)=>b-a);
  const isFlush=cards.length>=5&&suits.every(s=>s===suits[0]);
  const uRanks=[...new Set(ranks)].sort((a,b)=>a-b);
  const isStraight=cards.length>=5&&uRanks.length===5&&(uRanks[4]-uRanks[0]===4||(uRanks.includes(2)&&uRanks.includes(14)&&uRanks.includes(3)&&uRanks.includes(4)&&uRanks.includes(5)));
  const isRoyal=isFlush&&[14,13,12,11,10].every(r=>ranks.includes(r));
  const chipBase=ranks.reduce((s,r)=>s+Math.min(r,10),0);
  if(counts[0]===5)                return {name:'Five of a Kind', chips:chipBase+HAND_DATA['Five of a Kind'].chips, mult:HAND_DATA['Five of a Kind'].mult};
  if(isRoyal)                      return {name:'Royal Flush',    chips:chipBase+HAND_DATA['Royal Flush'].chips,    mult:HAND_DATA['Royal Flush'].mult};
  if(isStraight&&isFlush)          return {name:'Straight Flush', chips:chipBase+HAND_DATA['Straight Flush'].chips, mult:HAND_DATA['Straight Flush'].mult};
  if(counts[0]===4)                return {name:'Four of a Kind', chips:chipBase+HAND_DATA['Four of a Kind'].chips, mult:HAND_DATA['Four of a Kind'].mult};
  if(counts[0]===3&&counts[1]===2) return {name:'Full House',     chips:chipBase+HAND_DATA['Full House'].chips,     mult:HAND_DATA['Full House'].mult};
  if(isFlush)                      return {name:'Flush',          chips:chipBase+HAND_DATA['Flush'].chips,          mult:HAND_DATA['Flush'].mult};
  if(isStraight)                   return {name:'Straight',       chips:chipBase+HAND_DATA['Straight'].chips,       mult:HAND_DATA['Straight'].mult};
  if(counts[0]===3)                return {name:'Three of a Kind',chips:chipBase+HAND_DATA['Three of a Kind'].chips,mult:HAND_DATA['Three of a Kind'].mult};
  if(counts[0]===2&&counts[1]===2) return {name:'Two Pair',       chips:chipBase+HAND_DATA['Two Pair'].chips,       mult:HAND_DATA['Two Pair'].mult};
  if(counts[0]===2)                return {name:'Pair',           chips:chipBase+HAND_DATA['Pair'].chips,           mult:HAND_DATA['Pair'].mult};
  return                                  {name:'High Card',      chips:chipBase+HAND_DATA['High Card'].chips,      mult:HAND_DATA['High Card'].mult};
}

/* ════════════════════════════════════════════════════════════════
   GAME MODES
════════════════════════════════════════════════════════════════ */
const GAME_MODES = [
  {id:'classic',   name:'Classic Quest',    emoji:'⚔️', color:'#e74c3c',
   desc:'5 waves of escalating enemies. The Lich King awaits.',
   waves:5, startGold:80, handCount:4, discardCount:3, timerEnabled:false, wildcards:false},
  {id:'survival',  name:'Endless Survival', emoji:'♾️', color:'#9b59b6',
   desc:'Waves never stop. Enemies scale forever. Chase the high score.',
   waves:999, startGold:100, handCount:4, discardCount:3, timerEnabled:false, wildcards:true, endless:true},
  {id:'speedblitz',name:'Speed Blitz',      emoji:'⚡', color:'#f39c12',
   desc:'10 seconds per hand. Fast plays earn bonus gold. Hesitate and lose gold.',
   waves:5, startGold:80, handCount:5, discardCount:2, timerEnabled:true, timerSecs:10, wildcards:false},
  {id:'chaos',     name:'Chaos Realm',      emoji:'🌀', color:'#1abc9c',
   desc:'Every wave brings a random wildcard event. Boon or curse — fate decides.',
   waves:5, startGold:80, handCount:4, discardCount:3, timerEnabled:false, wildcards:true},
  {id:'draft',     name:'Card Draft',       emoji:'🃏', color:'#3498db',
   desc:'Choose 8 cards from a draft pool each wave instead of random draw.',
   waves:5, startGold:60, handCount:3, discardCount:4, timerEnabled:false, wildcards:false, draftMode:true},
  {id:'hardcore',  name:'Hardcore',         emoji:'💀', color:'#2c3e50',
   desc:'One life. No shop healing. Enemy ATK +40%. Only the worthy survive.',
   waves:5, startGold:120, handCount:4, discardCount:3, timerEnabled:false, wildcards:true, noHeal:true, enemyAtkMult:1.4},
];

/* ════════════════════════════════════════════════════════════════
   HERO CLASSES
════════════════════════════════════════════════════════════════ */
const HERO_CLASSES = [
  {id:'knight',      name:'Knight',      emoji:'⚔️', color:'#e74c3c', hp:140, startCreature:null,
   desc:'Pairs & Full Houses ×1.5 mult. Ability: Iron Will — block next enemy attack.',
   bonus:(h,d)=>(['Pair','Two Pair','Full House'].some(n=>h.name.includes(n)))?{...d,mult:d.mult*1.5}:d,
   ability:{name:'Iron Will',emoji:'🛡️',desc:'Block next attack.',cd:3,effect:'block'}},
  {id:'wizard',      name:'Wizard',      emoji:'🔮', color:'#9b59b6', hp:90, startCreature:null,
   desc:'Straights & Flushes ×2 mult. Ability: Arcane Surge — double next hand mult.',
   bonus:(h,d)=>(h.name.includes('Straight')||h.name.includes('Flush'))?{...d,mult:d.mult*2}:d,
   ability:{name:'Arcane Surge',emoji:'⚡',desc:'×2 mult this hand.',cd:3,effect:'multburst'}},
  {id:'ranger',      name:'Ranger',      emoji:'🏹', color:'#27ae60', hp:110, startCreature:'archer',
   desc:'Starts with Archer. +1 hand & discard. Ability: Eagle Eye — free discard.',
   bonus:(h,d)=>d,
   ability:{name:'Eagle Eye',emoji:'🦅',desc:'Next discard is free.',cd:2,effect:'freediscard'}},
  {id:'necromancer', name:'Necromancer', emoji:'💀', color:'#2c3e50', hp:80, startCreature:null,
   desc:'Three/Four of a Kind ×2.5 mult. Ability: Soul Drain — steal 15% enemy HP.',
   bonus:(h,d)=>(['Three of a Kind','Four of a Kind'].includes(h.name))?{...d,mult:d.mult*2.5}:d,
   ability:{name:'Soul Drain',emoji:'🩸',desc:'Drain 15% enemy max HP.',cd:4,effect:'drain'}},
  {id:'paladin',     name:'Paladin',     emoji:'✝️', color:'#f1c40f', hp:120, startCreature:null,
   desc:'All hands heal 5 HP. Full House/Royal Flush heal 25 HP. Ability: +50 HP.',
   bonus:(h,d)=>({...d,heal:(d.heal||0)+(['Full House','Royal Flush'].includes(h.name)?25:5)}),
   ability:{name:'Divine Shield',emoji:'💛',desc:'Restore 50 HP instantly.',cd:4,effect:'bigHeal'}},
  {id:'berserker',   name:'Berserker',   emoji:'🪓', color:'#e67e22', hp:100, startCreature:null,
   desc:'Gains +0.3 mult each time damaged (stacks). Ability: Rage — ×3 mult, take 20 dmg.',
   bonus:(h,d)=>d,
   ability:{name:'Rage',emoji:'🔥',desc:'×3 mult, take 20 dmg.',cd:3,effect:'rage'}},
];

/* ════════════════════════════════════════════════════════════════
   CREATURES
════════════════════════════════════════════════════════════════ */
const CREATURES = [
  {id:'pikeman', name:'Pikeman',    emoji:'⚔️', rarity:'common',   color:'#7f8c8d',cost:50, desc:'+20 chips always',             apply:(d,h)=>({...d,chips:d.chips+20})},
  {id:'archer',  name:'Archer',    emoji:'🏹', rarity:'common',   color:'#7f8c8d',cost:60, desc:'Pairs → ×2 mult',              apply:(d,h)=>h.name.includes('Pair')?{...d,mult:d.mult*2}:d},
  {id:'griffin', name:'Griffin',   emoji:'🦅', rarity:'rare',     color:'#3498db',cost:110,desc:'Flush family → ×2.5 mult',     apply:(d,h)=>h.name.includes('Flush')?{...d,mult:d.mult*2.5}:d},
  {id:'knight2', name:'Knight',    emoji:'🛡️', rarity:'uncommon', color:'#2ecc71',cost:90, desc:'Full House +100 chips',         apply:(d,h)=>h.name==='Full House'?{...d,chips:d.chips+100}:d},
  {id:'dragon',  name:'Dragon',    emoji:'🐉', rarity:'legendary',color:'#e74c3c',cost:160,desc:'Royal/Straight Flush ×2 mult',  apply:(d,h)=>['Royal Flush','Straight Flush','Five of a Kind'].includes(h.name)?{...d,mult:d.mult*2}:d},
  {id:'mage',    name:'TowerMage', emoji:'🧙', rarity:'uncommon', color:'#2ecc71',cost:80, desc:'Three of a Kind +80 chips',     apply:(d,h)=>h.name==='Three of a Kind'?{...d,chips:d.chips+80}:d},
  {id:'cyclops', name:'Cyclops',   emoji:'👁️', rarity:'common',   color:'#7f8c8d',cost:70, desc:'High Card → ×4 mult',           apply:(d,h)=>h.name==='High Card'?{...d,mult:d.mult*4}:d},
  {id:'phoenix', name:'Phoenix',   emoji:'🔥', rarity:'rare',     color:'#3498db',cost:100,desc:'Straights +60 chips',           apply:(d,h)=>h.name.includes('Straight')?{...d,chips:d.chips+60}:d},
  {id:'vampire', name:'Vampire',   emoji:'🧛', rarity:'rare',     color:'#3498db',cost:95, desc:'Every hand heals 8 HP',         apply:(d,h)=>({...d,heal:(d.heal||0)+8})},
  {id:'angel',   name:'Angel',     emoji:'👼', rarity:'uncommon', color:'#2ecc71',cost:85, desc:'+1 hand each battle',           apply:(d,h)=>d},
  {id:'lich2',   name:'Lich',      emoji:'💀', rarity:'common',   color:'#7f8c8d',cost:75, desc:'Two Pair → ×3 mult',            apply:(d,h)=>h.name==='Two Pair'?{...d,mult:d.mult*3}:d},
  {id:'titan',   name:'Titan',     emoji:'⛰️', rarity:'rare',     color:'#3498db',cost:130,desc:'All hands +40 chips',           apply:(d,h)=>({...d,chips:d.chips+40})},
  {id:'hydra',   name:'Hydra',     emoji:'🐍', rarity:'rare',     color:'#3498db',cost:120,desc:'Four of a Kind +150 chips',     apply:(d,h)=>h.name==='Four of a Kind'?{...d,chips:d.chips+150}:d},
  {id:'golem',   name:'Golem',     emoji:'🗿', rarity:'uncommon', color:'#2ecc71',cost:85, desc:'+15 chips per card played',     apply:(d,h)=>({...d,chips:d.chips+15*(h.cardCount||1)})},
  {id:'fairy',   name:'Fairy',     emoji:'🧚', rarity:'common',   color:'#7f8c8d',cost:55, desc:'♠ cards worth +5 chips each',  apply:(d,h)=>({...d,chips:d.chips+(h.spadeCount||0)*5})},
  {id:'wyvern',  name:'Wyvern',    emoji:'🦎', rarity:'legendary',color:'#e74c3c',cost:170,desc:'All mult ×1.5 always',          apply:(d,h)=>({...d,mult:d.mult*1.5})},
  {id:'dwarf',   name:'DwarfSmith',emoji:'🔨', rarity:'uncommon', color:'#2ecc71',cost:80, desc:'Low cards (2-9) +8 chips each', apply:(d,h)=>({...d,chips:d.chips+(h.lowCount||0)*8})},
  {id:'siren',   name:'Siren',     emoji:'🧜', rarity:'rare',     color:'#3498db',cost:110,desc:'♥ cards → +0.3 mult each',     apply:(d,h)=>({...d,mult:d.mult+(h.heartCount||0)*0.3})},
];

/* ════════════════════════════════════════════════════════════════
   ARTIFACTS
════════════════════════════════════════════════════════════════ */
const ARTIFACTS = [
  {id:'blazesword', name:'Blazing Sword',   emoji:'🗡️',cost:80, desc:'+35 global chips',          effect:{chips:35}},
  {id:'holycrown',  name:'Holy Crown',      emoji:'👑',cost:100,desc:'+0.5 global mult',           effect:{mult:0.5}},
  {id:'spellbook',  name:'Spell Tome',      emoji:'📖',cost:90, desc:'+2 hands per battle',        effect:{hands:2}},
  {id:'boots',      name:'Speed Boots',     emoji:'👢',cost:70, desc:'+1 discard per battle',      effect:{discards:1}},
  {id:'shield',     name:'Dragon Shield',   emoji:'🛡️',cost:85, desc:'-30% enemy ATK',            effect:{shieldPct:0.3}},
  {id:'potion',     name:'Mega Potion',     emoji:'🧪',cost:60, desc:'Restore 40 HP',              effect:{heal:40}},
  {id:'ring',       name:'Ring of Greed',   emoji:'💍',cost:95, desc:'+20 gold after each battle', effect:{goldPerWave:20}},
  {id:'compass',    name:'Fortune Compass', emoji:'🧭',cost:75, desc:'Chest rewards ×2',           effect:{chestMult:2}},
  {id:'lantern',    name:'Soul Lantern',    emoji:'🏮',cost:110,desc:'High Card mult ×3',          effect:{highCardMult:3}},
  {id:'hourglass',  name:'Hourglass',       emoji:'⏳',cost:80, desc:'+10s Speed Blitz timer',     effect:{timer:10}},
  {id:'phylactery', name:'Phylactery',      emoji:'💎',cost:200,desc:'Survive lethal damage once', effect:{revive:true}},
  {id:'mirror',     name:'Magic Mirror',    emoji:'🪞',cost:130,desc:'Copies best creature bonus', effect:{mirror:true}},
];

/* ════════════════════════════════════════════════════════════════
   WILDCARDS
════════════════════════════════════════════════════════════════ */
const WILDCARDS = [
  {id:'blessing', name:'Ancient Blessing',  emoji:'✨',type:'good',    desc:'+60% mult this entire battle',   effect:{battleMultMod:0.6}},
  {id:'horseshoe',name:'Lucky Horseshoe',   emoji:'🧲',type:'good',    desc:'+2 hands this battle',           effect:{battleHandMod:2}},
  {id:'hoard',    name:"Dragon's Hoard",    emoji:'💰',type:'good',    desc:'Gain 80 gold immediately',       effect:{goldBonus:80}},
  {id:'wardrums', name:'War Drums',         emoji:'🥁',type:'good',    desc:'All chip values doubled this battle', effect:{battleChipDouble:true}},
  {id:'elvenspd', name:'Elven Speed',       emoji:'🌿',type:'good',    desc:'+3 discards this battle',        effect:{battleDiscardMod:3}},
  {id:'moonwell', name:'Moonwell',          emoji:'🌙',type:'good',    desc:'Restore 50 HP',                  effect:{healBonus:50}},
  {id:'goldcards',name:'Golden Cards',      emoji:'🃏',type:'good',    desc:'Face cards deal +20 extra chips', effect:{faceCardChips:20}},
  {id:'curse',    name:'Cursed Dice',       emoji:'🎲',type:'bad',     desc:'Lose 1 hand this battle',        effect:{battleHandMod:-1}},
  {id:'enemyrage',name:'Enemy Rage',        emoji:'😡',type:'bad',     desc:'Enemy ATK +60% this battle',     effect:{battleEnemyAtkMod:0.6}},
  {id:'corrupt',  name:'Dark Corruption',   emoji:'🖤',type:'bad',     desc:'Lose 30 max HP permanently',     effect:{maxHpLoss:30}},
  {id:'fumble',   name:'Fumble Curse',      emoji:'🤦',type:'bad',     desc:'Mult halved this battle',        effect:{battleMultPenalty:0.5}},
  {id:'sapped',   name:'Sapped',            emoji:'😴',type:'bad',     desc:'-1 hand and -1 discard',         effect:{battleHandMod:-1,battleDiscardMod:-1}},
  {id:'bloodpact',name:'Blood Pact',        emoji:'🩸',type:'neutral', desc:'+100% mult but lose 15 HP per hand played', effect:{battleMultMod:1.0,hpPerHand:-15}},
  {id:'gambler',  name:"Gambler's Curse",   emoji:'🎰',type:'neutral', desc:'Face cards ×3, number cards ÷2', effect:{faceMult:3,numberDiv:2}},
  {id:'dblnoth',  name:'Double or Nothing', emoji:'🎯',type:'neutral', desc:'1st hand = 0 dmg. 2nd hand = ×4 dmg.', effect:{doubleOrNothing:true}},
  {id:'demontrade',name:'Demon Trade',      emoji:'😈',type:'neutral', desc:'Lose 50 gold → Wyvern joins army', effect:{demonTrade:true}},
];

/* ════════════════════════════════════════════════════════════════
   CHESTS
════════════════════════════════════════════════════════════════ */
const CHEST_TYPES = [
  {id:'wooden',emoji:'📦',name:'Wooden Chest', color:'#8B6914',weight:50,gold:[20,50], artifactChance:0,   creatureChance:0},
  {id:'iron',  emoji:'🗃️',name:'Iron Chest',   color:'#7f8c8d',weight:30,gold:[50,100],artifactChance:0.15,creatureChance:0},
  {id:'golden',emoji:'🏆',name:'Golden Chest', color:'#f1c40f',weight:15,gold:[100,200],artifactChance:0.25,creatureChance:0.25},
  {id:'dragon',emoji:'🐲',name:'Dragon Chest', color:'#e74c3c',weight:5, gold:[200,400],artifactChance:0.5, creatureChance:0.4},
];

function rollChest(mult=1){
  const total=CHEST_TYPES.reduce((s,c)=>s+c.weight,0);
  let r=Math.random()*total,chest=CHEST_TYPES[0];
  for(const c of CHEST_TYPES){r-=c.weight;if(r<=0){chest=c;break;}}
  const gold=Math.floor(rng(chest.gold[0],chest.gold[1])*mult);
  let bonus=null;
  if(Math.random()<chest.artifactChance){bonus={type:'artifact',item:shuffle(ARTIFACTS)[0]};}
  else if(Math.random()<chest.creatureChance){bonus={type:'creature',item:shuffle(CREATURES.filter(c=>c.rarity!=='legendary'))[0]};}
  return {chest,gold,bonus};
}

/* ════════════════════════════════════════════════════════════════
   ENEMIES
════════════════════════════════════════════════════════════════ */
const ENEMY_POOL = [
  {id:'goblin',   name:'Goblin Horde',   emoji:'👺',maxHp:220, atk:18,reward:65, tier:1},
  {id:'orc',      name:'Orc Warriors',   emoji:'👹',maxHp:380, atk:28,reward:85, tier:2},
  {id:'troll',    name:'Cave Troll',     emoji:'🧌',maxHp:450, atk:35,reward:95, tier:2,special:'shield',specialVal:50},
  {id:'vamp2',    name:'Vampire Lord',   emoji:'🧛',maxHp:520, atk:38,reward:115,tier:3,special:'heal',  specialVal:25},
  {id:'wolf',     name:'Werewolf Pack',  emoji:'🐺',maxHp:600, atk:45,reward:125,tier:3,special:'howl'},
  {id:'dragon2',  name:'Emerald Dragon', emoji:'🐲',maxHp:720, atk:55,reward:155,tier:4,special:'burn',  specialVal:10},
  {id:'golem2',   name:'Iron Golem',     emoji:'🗿',maxHp:900, atk:60,reward:170,tier:4,special:'armor', specialVal:20},
  {id:'demon',    name:'Demon King',     emoji:'👿',maxHp:1000,atk:70,reward:200,tier:4,special:'curse'},
  {id:'lich',     name:'The Lich King',  emoji:'☠️',maxHp:1100,atk:75,reward:999,tier:5,special:'curse',isBoss:true},
  {id:'hydrae',   name:'Chaos Hydra',    emoji:'🐍',maxHp:1300,atk:65,reward:999,tier:5,special:'multi',isBoss:true},
];

const CLASSIC_WAVES=[0,1,3,5,8];
function getEnemy(waveIdx,gm){
  if(gm.endless){
    const tier=Math.min(5,Math.ceil((waveIdx+1)/2));
    const pool=ENEMY_POOL.filter(e=>e.tier<=tier&&!e.isBoss);
    const e=shuffle(pool)[0]||ENEMY_POOL[0];
    const sc=1+waveIdx*0.15;
    return {...e,maxHp:Math.floor(e.maxHp*sc),atk:Math.floor(e.atk*sc),reward:Math.floor(e.reward*(1+waveIdx*0.1))};
  }
  return ENEMY_POOL[CLASSIC_WAVES[Math.min(waveIdx,4)]]||ENEMY_POOL[0];
}

function generateShop(ownedC=[],ownedA=[]){
  return{
    creatures:shuffle(CREATURES.filter(c=>!ownedC.includes(c.id))).slice(0,3),
    artifacts:shuffle(ARTIFACTS.filter(a=>!ownedA.includes(a.id))).slice(0,2),
  };
}

function calcFull(handResult,cards,creatures,artifacts,heroClass,bMods={}){
  const spadeCount=cards.filter(c=>c.suit==='♠').length;
  const heartCount=cards.filter(c=>c.suit==='♥').length;
  const lowCount=cards.filter(c=>RANK_VALUES[c.rank]<=9).length;
  const faceCount=cards.filter(c=>['J','Q','K','A'].includes(c.rank)).length;
  const ext={...handResult,cardCount:cards.length,spadeCount,heartCount,lowCount,faceCount};
  let d={chips:handResult.chips,mult:handResult.mult,heal:0};
  d=heroClass.bonus(ext,d);
  for(const c of creatures)d=c.apply(d,ext);
  for(const a of artifacts){
    if(a.effect.chips)d.chips+=a.effect.chips;
    if(a.effect.mult)d.mult+=a.effect.mult;
    if(a.effect.highCardMult&&handResult.name==='High Card')d.mult*=a.effect.highCardMult;
  }
  if(bMods.multMod)d.mult*=(1+bMods.multMod);
  if(bMods.chipDouble)d.chips*=2;
  if(bMods.multPenalty)d.mult*=bMods.multPenalty;
  if(bMods.faceCardChips)d.chips+=faceCount*(bMods.faceCardChips||0);
  if(bMods.faceMult&&bMods.numberDiv){
    if(faceCount>0)d.chips=Math.floor(d.chips*bMods.faceMult);
    if(lowCount>0)d.chips=Math.floor(d.chips/bMods.numberDiv);
  }
  return{dmg:Math.floor(d.chips*d.mult),heal:d.heal,chips:d.chips,mult:d.mult};
}

const BASE_FONT="'Cinzel','Palatino Linotype',Georgia,serif";
const GLOBAL_CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&display=swap');
  @keyframes glow{0%,100%{text-shadow:0 0 20px #ffd700,0 0 40px #ff8c00}50%{text-shadow:0 0 40px #ffd700,0 0 80px #ff8c00}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes chestPop{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
  @keyframes timerBlink{0%,100%{color:#e74c3c}50%{color:#ff0000}}
  .glow{animation:glow 3s ease-in-out infinite}
  .float{animation:float 4s ease-in-out infinite}
  .shake{animation:shake 0.5s ease}
  .fadeUp{animation:fadeUp 0.5s ease}
  .chestPop{animation:chestPop 0.6s cubic-bezier(.17,.67,.3,1.3)}
  .timerBlink{animation:timerBlink 0.5s ease-in-out infinite}
  .card{transition:transform 0.15s ease,box-shadow 0.15s ease}
  .card:hover{transform:translateY(-10px)!important}
  .btn{transition:all 0.15s ease}
  .btn:hover:not(:disabled){filter:brightness(1.15);transform:translateY(-1px)}
  .modecard:hover{transform:translateY(-5px)!important;transition:all 0.2s}
  .herocard:hover{transform:translateY(-5px) scale(1.02)!important;transition:all 0.2s}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#3a2a10;border-radius:2px}
`;
const ROOT={minHeight:'100vh',background:'#080c14',backgroundImage:'radial-gradient(ellipse at 50% 0%,#1a0a2e 0%,#080c14 70%)',
  fontFamily:BASE_FONT,color:'#d4af7a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'8px',overflow:'hidden'};

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function HeroesOfFortune(){
  const [phase,setPhase]             = useState('title');
  const [gameMode,setGameMode]       = useState(null);
  const [heroClass,setHeroClass]     = useState(null);
  const [hero,setHero]               = useState(null);
  const [waveIdx,setWaveIdx]         = useState(0);
  const [enemy,setEnemy]             = useState(null);
  const [deck,setDeck]               = useState([]);
  const [hand,setHand]               = useState([]);
  const [selected,setSelected]       = useState([]);
  const [handsLeft,setHandsLeft]     = useState(4);
  const [discards,setDiscards]       = useState(3);
  const [creatures,setCreatures]     = useState([]);
  const [artifacts,setArtifacts]     = useState([]);
  const [shop,setShop]               = useState(null);
  const [log,setLog]                 = useState([]);
  const [lastHand,setLastHand]       = useState(null);
  const [lastDmg,setLastDmg]         = useState(null);
  const [animating,setAnimating]     = useState(false);
  const [eShake,setEShake]           = useState(false);
  const [hShake,setHShake]           = useState(false);
  const [burnStacks,setBurnStacks]   = useState(0);
  const [score,setScore]             = useState(0);
  const [chest,setChest]             = useState(null);
  const [wildcard,setWildcard]       = useState(null);
  const [abilityReady,setAbilityReady] = useState(true);
  const [abilityCd,setAbilityCd]     = useState(0);
  const [abilityFx,setAbilityFx]     = useState({});
  const [berserkerMult,setBerserkerMult] = useState(0);
  const [blockActive,setBlockActive] = useState(false);
  const [handCount,setHandCount]     = useState(0);
  const [reviveUsed,setReviveUsed]   = useState(false);
  const [bMods,setBMods]             = useState({});
  const [timerSec,setTimerSec]       = useState(null);
  const [draftPool,setDraftPool]     = useState([]);
  const [draftPicked,setDraftPicked] = useState([]);
  const timerRef                     = useRef(null);
  const pendingWc                    = useRef(null);

  const addLog=(msg,type='normal')=>setLog(l=>[{msg,type,id:Date.now()+Math.random()},...l].slice(0,9));

  /* ── TIMER ── */
  useEffect(()=>{
    if(phase!=='battle'||!gameMode?.timerEnabled||animating||handsLeft===0)return;
    const max=(gameMode.timerSecs||10)+(artifacts.some(a=>a.effect.timer)?10:0);
    setTimerSec(max);
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{
      setTimerSec(t=>{
        if(t<=1){clearInterval(timerRef.current);addLog('⏰ Time\'s up! -20 gold!','bad');setHero(h=>({...h,gold:Math.max(0,h.gold-20)}));return max;}
        return t-1;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[phase,animating,handsLeft,gameMode,artifacts]);

  /* ── START BATTLE ── */
  const startBattle=useCallback((hc,crts,arts,heroData,wi,gm,wc=null)=>{
    const e=getEnemy(wi,gm);
    const nd=createDeck();
    let bH=gm.handCount||4,bD=gm.discardCount||3;
    if(hc.id==='ranger'){bH++;bD++;}
    arts.forEach(a=>{if(a.effect.hands)bH+=a.effect.hands;if(a.effect.discards)bD+=a.effect.discards;});
    if(crts.some(c=>c.id==='angel'))bH++;

    const mods={};
    if(wc){
      if(wc.effect.battleMultMod)  mods.multMod=wc.effect.battleMultMod;
      if(wc.effect.battleChipDouble) mods.chipDouble=true;
      if(wc.effect.battleMultPenalty) mods.multPenalty=wc.effect.battleMultPenalty;
      if(wc.effect.battleHandMod)  bH=Math.max(1,bH+wc.effect.battleHandMod);
      if(wc.effect.battleDiscardMod) bD=Math.max(0,bD+wc.effect.battleDiscardMod);
      if(wc.effect.faceCardChips)  mods.faceCardChips=wc.effect.faceCardChips;
      if(wc.effect.faceMult)       {mods.faceMult=wc.effect.faceMult;mods.numberDiv=wc.effect.numberDiv;}
      if(wc.effect.doubleOrNothing) mods.doubleOrNothing=true;
      if(wc.effect.hpPerHand)      mods.hpPerHand=wc.effect.hpPerHand;
    }
    const atkScale=(gm.enemyAtkMult||1)*(wc?.effect.battleEnemyAtkMod?1+wc.effect.battleEnemyAtkMod:1);
    const shieldArt=arts.find(a=>a.effect.shieldPct);
    const finalAtk=Math.floor(e.atk*atkScale*(1-(shieldArt?.effect.shieldPct||0)));

    setEnemy({...e,hp:e.maxHp,finalAtk});
    setDeck(nd.slice(8));setHand(nd.slice(0,8));setSelected([]);
    setHandsLeft(bH);setDiscards(bD);
    setLastHand(null);setLastDmg(null);setAnimating(false);
    setBurnStacks(0);setHandCount(0);setBlockActive(false);setAbilityFx({});setAbilityCd(0);setAbilityReady(true);
    setBMods(mods);setWildcard(wc);
    setLog([{msg:`⚔️ Wave ${wi+1}: ${e.name} appears!`,type:'system',id:Date.now()}]);
    setPhase('battle');
  },[]);

  /* ── PLAY HAND ── */
  const playHand=()=>{
    if(!selected.length||!handsLeft||animating)return;
    clearInterval(timerRef.current);
    const playedCards=selected.map(i=>hand[i]);
    const hr=evaluateHand(playedCards);
    let {dmg,heal,chips,mult}=calcFull(hr,playedCards,creatures,artifacts,heroClass,bMods);
    if(heroClass.id==='berserker'&&berserkerMult>0)dmg=Math.floor(dmg*(1+berserkerMult));
    if(abilityFx.multburst){dmg*=2;addLog('⚡ Arcane Surge: damage doubled!','ability');}
    if(abilityFx.rage)dmg*=3;
    let finalDmg=dmg;
    if(bMods.doubleOrNothing){
      if(handCount===0){finalDmg=0;addLog('🎯 Double or Nothing: ZERO! Next hand is ×4!','wildcard');}
      else if(handCount===1){finalDmg=dmg*4;addLog('🎯 Double or Nothing: ×4 MEGA DAMAGE!','wildcard');}
    }
    if(bMods.hpPerHand&&!gameMode?.noHeal){
      setHero(h=>({...h,hp:Math.max(1,h.hp+bMods.hpPerHand)}));
      addLog(`🩸 Blood Pact: ${bMods.hpPerHand} HP`,'bad');
    }
    setLastHand(hr);setLastDmg(finalDmg);setAnimating(true);setEShake(true);
    setTimeout(()=>setEShake(false),600);
    const hd=HAND_DATA[hr.name]||{emoji:'🃏'};
    addLog(`${hd.emoji} ${hr.name}! ${chips|0}×${mult.toFixed(1)}=${finalDmg} dmg`,'attack');
    setScore(s=>s+finalDmg);
    if(heal>0&&!gameMode?.noHeal){setHero(h=>({...h,hp:Math.min(h.maxHp,h.hp+heal)}));addLog(`💚 Healed ${heal} HP!`,'heal');}
    setEnemy(prev=>{
      if(!prev)return prev;
      let nhp=Math.max(0,prev.hp-finalDmg);
      if(prev.special==='heal'&&nhp>0){const ha=prev.specialVal||25;nhp=Math.min(prev.maxHp,nhp+ha);setTimeout(()=>addLog(`🧛 ${prev.name} regens ${ha} HP!`,'enemy'),400);}
      return{...prev,hp:nhp};
    });
    const rem=hand.filter((_,i)=>!selected.includes(i));
    const need=8-rem.length;
    let nd=deck.length<need?createDeck():[...deck];
    setHand([...rem,...nd.slice(0,need)]);setDeck(nd.slice(need));
    setSelected([]);setHandsLeft(p=>p-1);setHandCount(p=>p+1);setAbilityFx({});
    if(abilityCd>0)setAbilityCd(p=>p-1); else setAbilityReady(true);
    setTimeout(()=>{
      setAnimating(false);
      setEnemy(cur=>{
        if(cur&&cur.hp<=0){
          const ringBonus=artifacts.some(a=>a.effect.goldPerWave)?20:0;
          const totalGold=cur.reward+ringBonus;
          addLog(`💀 ${cur.name} defeated! +${totalGold} gold!`,'victory');
          setHero(h=>({...h,gold:h.gold+totalGold}));
          setTimeout(()=>{
            if(Math.random()<0.5){
              const cm=artifacts.some(a=>a.effect.chestMult)?2:1;
              setChest(rollChest(cm));setPhase('chest');
            } else if(waveIdx>=gameMode.waves-1&&!gameMode.endless){setPhase('victory');}
            else{openNext(false);}
          },900);
        }
        return cur;
      });
    },700);
  };

  const openNext=(fromChest=false)=>{
    if(gameMode?.wildcards&&Math.random()<0.65){
      const wc=shuffle(WILDCARDS)[0];
      pendingWc.current=wc;
      setPhase('wildcard');
    } else {
      setShop(generateShop(creatures.map(c=>c.id),artifacts.map(a=>a.id)));
      setPhase('shop');
    }
  };

  /* ── ENEMY COUNTER-ATTACK ── */
  useEffect(()=>{
    if(!animating||!enemy||enemy.hp<=0)return;
    const t=setTimeout(()=>{
      if(blockActive){addLog('🛡️ Iron Will blocks the attack!','ability');setBlockActive(false);return;}
      const atkDmg=enemy.finalAtk||enemy.atk;
      if(enemy.special==='burn')setBurnStacks(b=>b+2);
      setHShake(true);setTimeout(()=>setHShake(false),500);
      setHero(prev=>{
        let nhp=Math.max(0,prev.hp-atkDmg);
        addLog(`👿 ${enemy.name} strikes for ${atkDmg}!`,'enemy');
        if(heroClass?.id==='berserker')setBerserkerMult(b=>+(b+0.3).toFixed(1));
        if(nhp<=0){
          const hasRevive=artifacts.some(a=>a.effect.revive)&&!reviveUsed;
          if(hasRevive){nhp=Math.floor(prev.maxHp*0.3);setReviveUsed(true);addLog('💎 Phylactery! Revived!','ability');}
          else setTimeout(()=>setPhase('defeat'),800);
        }
        return{...prev,hp:nhp};
      });
    },460);
    return()=>clearTimeout(t);
  },[animating]);

  /* ── BURN ── */
  useEffect(()=>{
    if(burnStacks<=0||!enemy||enemy.hp<=0)return;
    const t=setTimeout(()=>{
      const bd=burnStacks*5;
      setEnemy(e=>e?{...e,hp:Math.max(0,e.hp-bd)}:e);
      addLog(`🔥 Burn: ${bd} dmg!`,'burn');
      setBurnStacks(b=>Math.max(0,b-1));
    },800);
    return()=>clearTimeout(t);
  },[burnStacks]);

  /* ── OUT OF HANDS ── */
  useEffect(()=>{
    if(phase!=='battle'||handsLeft>0||!enemy||enemy.hp<=0)return;
    addLog('😤 No hands left! Retreating...','system');
    setHero(prev=>{const nhp=Math.max(0,prev.hp-Math.floor((enemy.finalAtk||enemy.atk)*3));if(nhp<=0)setTimeout(()=>setPhase('defeat'),800);return{...prev,hp:nhp};});
    setTimeout(()=>{
      if(waveIdx>=gameMode.waves-1&&!gameMode.endless)setPhase('victory');
      else openNext(false);
    },1400);
  },[handsLeft,enemy,phase]);

  /* ── DISCARD ── */
  const discardCards=()=>{
    if(!selected.length||(!discards&&!abilityFx.freediscard)||animating)return;
    if(!abilityFx.freediscard)setDiscards(p=>p-1);
    const rem=hand.filter((_,i)=>!selected.includes(i));
    const need=8-rem.length;
    let nd=deck.length<need?createDeck():[...deck];
    setHand([...rem,...nd.slice(0,need)]);setDeck(nd.slice(need));setSelected([]);setAbilityFx({});
    addLog(`🔄 Discarded ${selected.length} card(s)`,'normal');
  };

  /* ── ABILITY ── */
  const useAbility=()=>{
    if(!abilityReady||!heroClass)return;
    const ab=heroClass.ability;
    setAbilityReady(false);setAbilityCd(ab.cd);
    if(ab.effect==='block')     {setBlockActive(true);addLog('🛡️ Iron Will: next attack blocked!','ability');}
    if(ab.effect==='multburst') {setAbilityFx(p=>({...p,multburst:true}));addLog('⚡ Arcane Surge: ×2 mult ready!','ability');}
    if(ab.effect==='freediscard'){setAbilityFx(p=>({...p,freediscard:true}));addLog('🦅 Eagle Eye: free discard ready!','ability');}
    if(ab.effect==='drain')     {setEnemy(e=>{if(!e)return e;const d=Math.floor(e.maxHp*0.15);addLog(`🩸 Soul Drain: ${d} dmg!`,'ability');return{...e,hp:Math.max(0,e.hp-d)};});}
    if(ab.effect==='bigHeal')   {setHero(h=>({...h,hp:Math.min(h.maxHp,h.hp+50)}));addLog('💛 Divine Shield: +50 HP!','ability');}
    if(ab.effect==='rage')      {setAbilityFx(p=>({...p,rage:true}));setHero(h=>({...h,hp:Math.max(1,h.hp-20)}));addLog('🪓 RAGE activated! ×3 mult, -20 HP!','ability');}
  };

  /* ── WILDCARD RESOLVE ── */
  const resolveWildcard=(wc,accept)=>{
    const shops=()=>{setShop(generateShop(creatures.map(c=>c.id),artifacts.map(a=>a.id)));setPhase('shop');};
    if(!accept){addLog('❌ Wildcard skipped','system');shops();return;}
    addLog(`🌀 ${wc.name} activated!`,'wildcard');
    if(wc.effect.goldBonus)setHero(h=>({...h,gold:h.gold+wc.effect.goldBonus}));
    if(wc.effect.healBonus&&!gameMode?.noHeal)setHero(h=>({...h,hp:Math.min(h.maxHp,h.hp+wc.effect.healBonus)}));
    if(wc.effect.maxHpLoss)setHero(h=>({...h,maxHp:Math.max(10,h.maxHp-wc.effect.maxHpLoss),hp:Math.max(1,h.hp-wc.effect.maxHpLoss)}));
    if(wc.effect.demonTrade&&hero.gold>=50){setHero(h=>({...h,gold:h.gold-50}));setCreatures(c=>[...c,CREATURES.find(x=>x.id==='wyvern')]);addLog('😈 Wyvern joins!','wildcard');}
    shops();
  };

  /* ── SHOP BUY ── */
  const buyItem=(item,type)=>{
    if(hero.gold<item.cost)return;
    setHero(h=>{let hp=h.hp;if(type==='artifact'&&item.effect.heal)hp=Math.min(h.maxHp,h.hp+item.effect.heal);return{...h,gold:h.gold-item.cost,hp};});
    if(type==='creature')setCreatures(p=>[...p,item]);
    else{setArtifacts(p=>[...p,item]);if(item.effect.revive)setReviveUsed(false);}
    setShop(p=>({creatures:type==='creature'?p.creatures.filter(c=>c.id!==item.id):p.creatures,artifacts:type==='artifact'?p.artifacts.filter(a=>a.id!==item.id):p.artifacts}));
    addLog(`🛒 Bought ${item.name}!`,'shop');
  };

  /* ── OPEN CHEST ── */
  const openChest=(res)=>{
    setHero(h=>({...h,gold:h.gold+res.gold}));
    addLog(`${res.chest.emoji} ${res.chest.name}: +${res.gold} gold!`,'victory');
    if(res.bonus?.type==='artifact'){setArtifacts(p=>[...p,res.bonus.item]);addLog(`✨ Bonus: ${res.bonus.item.name}!`,'victory');}
    if(res.bonus?.type==='creature'){setCreatures(p=>[...p,res.bonus.item]);addLog(`✨ ${res.bonus.item.name} joins!`,'victory');}
    setChest(null);
    if(waveIdx>=gameMode.waves-1&&!gameMode.endless)setPhase('victory');
    else openNext(true);
  };

  /* ── CONTINUE ── */
  const continueAfterShop=()=>{
    const next=waveIdx+1;
    setWaveIdx(next);
    startBattle(heroClass,creatures,artifacts,hero,next,gameMode,null);
  };

  /* ── START GAME ── */
  const selectHero=(hc)=>{
    const sc=hc.startCreature?[CREATURES.find(c=>c.id===hc.startCreature)].filter(Boolean):[];
    const newHero={hp:hc.hp,maxHp:hc.hp,gold:gameMode.startGold};
    setHeroClass(hc);setHero(newHero);setCreatures(sc);setArtifacts([]);
    setWaveIdx(0);setBerserkerMult(0);setReviveUsed(false);setScore(0);setWildcard(null);
    startBattle(hc,sc,[],newHero,0,gameMode,null);
  };

  const selectCard=(idx)=>{if(animating)return;setSelected(p=>p.includes(idx)?p.filter(i=>i!==idx):p.length>=5?p:[...p,idx]);};

  /* ── PREVIEW ── */
  const previewHR=selected.length>0?evaluateHand(selected.map(i=>hand[i])):null;
  let previewDmg=0;
  if(previewHR){
    let r=calcFull(previewHR,selected.map(i=>hand[i]),creatures,artifacts,heroClass,bMods);
    previewDmg=r.dmg;
    if(heroClass?.id==='berserker'&&berserkerMult>0)previewDmg=Math.floor(previewDmg*(1+berserkerMult));
    if(abilityFx.multburst)previewDmg*=2;
    if(abilityFx.rage)previewDmg*=3;
    if(bMods.doubleOrNothing&&handCount===0)previewDmg=0;
    if(bMods.doubleOrNothing&&handCount===1)previewDmg=r.dmg*4;
  }

  /* ════════════════════════════════════════════════════════════════
     TITLE
  ════════════════════════════════════════════════════════════════ */
  if(phase==='title') return(
    <div style={ROOT}><style>{GLOBAL_CSS}</style>
      <div style={{textAlign:'center',maxWidth:'700px',width:'100%'}} className="fadeUp">
        <div style={{fontSize:'56px',marginBottom:'8px'}} className="float">⚔️🃏🐉</div>
        <h1 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'clamp(22px,5vw,42px)',color:'#ffd700',letterSpacing:'4px',margin:'0 0 4px'}} className="glow">Heroes of Fortune</h1>
        <p style={{letterSpacing:'6px',color:'#9b7a3a',fontSize:'10px',marginBottom:'24px'}}>MIGHT · CARDS · MAGIC · v2.0</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'20px'}}>
          {GAME_MODES.map(gm=>(
            <div key={gm.id} className="modecard" onClick={()=>{setGameMode(gm);setPhase('heroSelect');}}
              style={{background:`linear-gradient(135deg,rgba(0,0,0,0.7),${gm.color}22)`,border:`2px solid ${gm.color}55`,
                borderRadius:'8px',padding:'14px 10px',cursor:'pointer',boxShadow:`0 4px 16px ${gm.color}22`,textAlign:'left',transition:'transform 0.2s'}}>
              <div style={{fontSize:'22px',marginBottom:'6px'}}>{gm.emoji}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:'11px',color:gm.color,fontWeight:'700',marginBottom:'4px'}}>{gm.name}</div>
              <div style={{fontSize:'9px',color:'#7a6040',lineHeight:'1.5'}}>{gm.desc}</div>
              <div style={{marginTop:'8px',display:'flex',gap:'4px',flexWrap:'wrap'}}>
                {gm.wildcards&&<span style={{fontSize:'8px',color:'#1abc9c',border:'1px solid #1abc9c44',padding:'1px 5px',borderRadius:'10px'}}>🌀wildcards</span>}
                {gm.endless&&<span style={{fontSize:'8px',color:'#9b59b6',border:'1px solid #9b59b644',padding:'1px 5px',borderRadius:'10px'}}>♾️endless</span>}
                {gm.timerEnabled&&<span style={{fontSize:'8px',color:'#f39c12',border:'1px solid #f39c1244',padding:'1px 5px',borderRadius:'10px'}}>⚡timer</span>}
                {gm.noHeal&&<span style={{fontSize:'8px',color:'#e74c3c',border:'1px solid #e74c3c44',padding:'1px 5px',borderRadius:'10px'}}>💀no heal</span>}
              </div>
            </div>
          ))}
        </div>
        <p style={{fontSize:'10px',color:'#444'}}>Select up to 5 cards · Play poker hands · Slay monsters · Collect loot · Find chests</p>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     HERO SELECT
  ════════════════════════════════════════════════════════════════ */
  if(phase==='heroSelect') return(
    <div style={{...ROOT,justifyContent:'flex-start',paddingTop:'20px'}}><style>{GLOBAL_CSS}</style>
      <div style={{width:'100%',maxWidth:'740px'}} className="fadeUp">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
          <div>
            <h2 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'18px',color:'#ffd700',margin:'0 0 3px',letterSpacing:'3px'}}>Choose Your Hero</h2>
            <p style={{color:'#555',fontSize:'10px',margin:0}}>{gameMode?.emoji} {gameMode?.name}</p>
          </div>
          <button className="btn" onClick={()=>setPhase('title')} style={{padding:'6px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid #333',color:'#777',borderRadius:'4px',cursor:'pointer',fontFamily:BASE_FONT,fontSize:'11px'}}>← Back</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
          {HERO_CLASSES.map(hc=>(
            <div key={hc.id} className="herocard" onClick={()=>selectHero(hc)}
              style={{background:`linear-gradient(135deg,rgba(0,0,0,0.65),${hc.color}1a)`,border:`2px solid ${hc.color}55`,borderRadius:'8px',padding:'14px',cursor:'pointer',transition:'transform 0.2s',boxShadow:`0 4px 14px ${hc.color}22`}}>
              <div style={{fontSize:'28px',marginBottom:'6px'}}>{hc.emoji}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:'13px',color:hc.color,fontWeight:'700',marginBottom:'4px'}}>{hc.name}</div>
              <div style={{fontSize:'9px',color:'#8a7050',lineHeight:'1.5',marginBottom:'8px'}}>{hc.desc}</div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <span style={{fontSize:'10px',color:'#e74c3c'}}>❤️ {hc.hp}</span>
                <span style={{fontSize:'10px',color:'#9b59b6'}}>{hc.ability.emoji} {hc.ability.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     WILDCARD SCREEN
  ════════════════════════════════════════════════════════════════ */
  if(phase==='wildcard'){
    const wc=pendingWc.current;
    if(!wc)return null;
    const tcol={good:'#2ecc71',bad:'#e74c3c',neutral:'#f39c12'};
    const tlbl={good:'✨ BOON',bad:'💀 CURSE',neutral:'🎲 GAMBLE'};
    return(
      <div style={ROOT}><style>{GLOBAL_CSS}</style>
        <div style={{textAlign:'center',maxWidth:'420px'}} className="fadeUp">
          <div style={{fontSize:'60px',marginBottom:'12px'}}>{wc.emoji}</div>
          <div style={{fontSize:'10px',letterSpacing:'4px',color:tcol[wc.type],marginBottom:'6px'}}>{tlbl[wc.type]}</div>
          <h2 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'20px',color:'#ffd700',marginBottom:'8px'}}>{wc.name}</h2>
          <p style={{color:'#b09070',fontSize:'13px',lineHeight:'1.7',marginBottom:'24px',padding:'0 16px'}}>{wc.desc}</p>
          <div style={{display:'flex',gap:'12px',justifyContent:'center'}}>
            <button className="btn" onClick={()=>resolveWildcard(wc,true)}
              style={{padding:'12px 24px',fontFamily:BASE_FONT,background:`linear-gradient(135deg,${tcol[wc.type]}22,${tcol[wc.type]}44)`,border:`2px solid ${tcol[wc.type]}`,color:tcol[wc.type],borderRadius:'4px',cursor:'pointer',fontSize:'13px',letterSpacing:'1px'}}>
              {wc.type==='bad'?'Accept Curse':wc.type==='neutral'?'Take the Gamble':'Accept Blessing'} ✓
            </button>
            <button className="btn" onClick={()=>resolveWildcard(wc,false)}
              style={{padding:'12px 24px',fontFamily:BASE_FONT,background:'rgba(30,30,30,0.6)',border:'1px solid #444',color:'#666',borderRadius:'4px',cursor:'pointer',fontSize:'13px'}}>
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     CHEST SCREEN
  ════════════════════════════════════════════════════════════════ */
  if(phase==='chest'&&chest) return(
    <div style={ROOT}><style>{GLOBAL_CSS}</style>
      <div style={{textAlign:'center'}} className="fadeUp">
        <div style={{fontSize:'72px',marginBottom:'12px'}} className="chestPop">{chest.chest.emoji}</div>
        <h2 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'22px',color:chest.chest.color,marginBottom:'4px'}}>{chest.chest.name}</h2>
        <p style={{color:'#ffd700',fontSize:'22px',fontWeight:'bold',marginBottom:'4px'}}>+{chest.gold} Gold!</p>
        {chest.bonus&&<p style={{color:'#2ecc71',fontSize:'14px',marginBottom:'4px'}}>🎁 Bonus item: {chest.bonus.item.name}!</p>}
        <p style={{color:'#555',fontSize:'11px',marginBottom:'24px'}}>A treasure awaits the bold adventurer...</p>
        <button className="btn" onClick={()=>openChest(chest)}
          style={{padding:'13px 40px',fontFamily:BASE_FONT,background:'linear-gradient(135deg,#3a2a00,#7a6000)',border:'2px solid #ffd700',color:'#ffd700',borderRadius:'4px',cursor:'pointer',fontSize:'15px',letterSpacing:'2px'}}>
          🏆 Claim Treasure!
        </button>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     SHOP
  ════════════════════════════════════════════════════════════════ */
  if(phase==='shop') return(
    <div style={{...ROOT,justifyContent:'flex-start',paddingTop:'10px'}}><style>{GLOBAL_CSS}</style>
      <div style={{width:'100%',maxWidth:'700px'}} className="fadeUp">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
          <div>
            <h2 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'16px',color:'#ffd700',margin:'0 0 2px',letterSpacing:'3px'}}>🏪 Tavern & Market</h2>
            <p style={{color:'#555',fontSize:'9px',margin:0,letterSpacing:'2px'}}>WAVE {waveIdx+2} OF {gameMode?.endless?'∞':gameMode?.waves} APPROACHES</p>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'16px',color:'#ffd700',fontWeight:'bold'}}>💰 {hero?.gold}</div>
            {gameMode?.endless&&<div style={{fontSize:'10px',color:'#9b59b6'}}>★ {score.toLocaleString()}</div>}
            {heroClass?.id==='berserker'&&berserkerMult>0&&<div style={{fontSize:'10px',color:'#e67e22'}}>🪓 +{berserkerMult.toFixed(1)} rage</div>}
          </div>
        </div>
        {/* Hero bar */}
        <div style={{background:'rgba(212,175,122,0.06)',border:'1px solid rgba(212,175,122,0.12)',borderRadius:'6px',padding:'8px 10px',marginBottom:'10px',display:'flex',gap:'8px',alignItems:'center'}}>
          <span style={{fontSize:'22px'}}>{heroClass?.emoji}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:'11px',color:'#ffd700',marginBottom:'3px'}}>{heroClass?.name}</div>
            <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
              <div style={{flex:1,height:'7px',background:'#1a0a0a',borderRadius:'4px',overflow:'hidden'}}>
                <div style={{width:`${(hero?.hp/hero?.maxHp)*100}%`,height:'100%',background:'linear-gradient(90deg,#8b0000,#e74c3c)',transition:'width 0.4s'}}/>
              </div>
              <span style={{fontSize:'10px',color:'#e74c3c',minWidth:'55px'}}>❤️ {hero?.hp}/{hero?.maxHp}</span>
            </div>
          </div>
          <div style={{display:'flex',gap:'3px',flexWrap:'wrap',maxWidth:'90px'}}>
            {creatures.slice(0,6).map((c,i)=><span key={i} title={c.name} style={{fontSize:'14px'}}>{c.emoji}</span>)}
          </div>
        </div>
        {/* Next enemy preview */}
        {waveIdx<(gameMode?.waves||5)-1&&(()=>{const ne=getEnemy(waveIdx+1,gameMode||{});return(
          <div style={{background:'rgba(192,57,43,0.08)',border:'1px solid rgba(192,57,43,0.25)',borderRadius:'6px',padding:'7px 10px',marginBottom:'10px',display:'flex',gap:'8px',alignItems:'center'}}>
            <span style={{fontSize:'22px'}}>{ne.emoji}</span>
            <div>
              <div style={{color:'#e74c3c',fontFamily:"'Cinzel',serif",fontSize:'11px'}}>{ne.name}{ne.isBoss&&<span style={{color:'#ffd700',marginLeft:'6px',fontSize:'9px'}}>⚠️BOSS</span>}</div>
              <div style={{color:'#555',fontSize:'9px'}}>❤️ {ne.maxHp} · ⚔️ {ne.atk} ATK{ne.special?' · '+ne.special:''}</div>
            </div>
          </div>
        );})()}
        {/* Creatures */}
        <div style={{fontFamily:"'Cinzel',serif",fontSize:'10px',letterSpacing:'3px',color:'#9b7a3a',marginBottom:'7px',textTransform:'uppercase'}}>⚔️ Recruit Creatures</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'12px'}}>
          {shop?.creatures.map(c=>{
            const can=hero?.gold>=c.cost;
            const rc={common:'#7f8c8d',uncommon:'#2ecc71',rare:'#3498db',legendary:'#ffd700'};
            return(
              <div key={c.id} style={{background:'rgba(0,0,0,0.4)',border:`1px solid ${rc[c.rarity]}33`,borderRadius:'6px',padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:'22px',marginBottom:'4px'}}>{c.emoji}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:'10px',color:'#d4af7a',marginBottom:'2px'}}>{c.name}</div>
                <div style={{fontSize:'8px',color:'#555',marginBottom:'4px',lineHeight:'1.4'}}>{c.desc}</div>
                <div style={{fontSize:'7px',color:rc[c.rarity],textTransform:'uppercase',letterSpacing:'1px',marginBottom:'5px'}}>{c.rarity}</div>
                <button className="btn" onClick={()=>buyItem(c,'creature')} disabled={!can}
                  style={{width:'100%',padding:'4px',fontFamily:BASE_FONT,fontSize:'9px',background:can?'rgba(30,80,30,0.7)':'rgba(40,40,40,0.5)',border:`1px solid ${can?'#27ae60':'#2a2a2a'}`,color:can?'#7dff7d':'#333',borderRadius:'3px',cursor:can?'pointer':'default'}}>
                  💰 {c.cost}
                </button>
              </div>
            );
          })}
        </div>
        {/* Artifacts */}
        <div style={{fontFamily:"'Cinzel',serif",fontSize:'10px',letterSpacing:'3px',color:'#9b7a3a',marginBottom:'7px',textTransform:'uppercase'}}>🏺 Artifacts</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px',marginBottom:'14px'}}>
          {shop?.artifacts.map(a=>{
            const can=hero?.gold>=a.cost,owned=artifacts.some(x=>x.id===a.id);
            return(
              <div key={a.id} style={{background:'rgba(0,0,0,0.4)',border:'1px solid rgba(255,215,0,0.15)',borderRadius:'6px',padding:'8px',display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'20px'}}>{a.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:'10px',color:'#ffd700',marginBottom:'2px'}}>{a.name}</div>
                  <div style={{fontSize:'8px',color:'#555',marginBottom:'5px'}}>{a.desc}</div>
                  <button className="btn" onClick={()=>buyItem(a,'artifact')} disabled={!can||owned}
                    style={{padding:'3px 10px',fontFamily:BASE_FONT,fontSize:'9px',background:can&&!owned?'rgba(60,50,0,0.7)':'rgba(40,40,40,0.5)',border:`1px solid ${can&&!owned?'#ffd700':'#222'}`,color:can&&!owned?'#ffd700':'#333',borderRadius:'3px',cursor:can&&!owned?'pointer':'default'}}>
                    {owned?'✓ Owned':`💰 ${a.cost}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn" onClick={continueAfterShop}
          style={{width:'100%',padding:'12px',fontFamily:BASE_FONT,fontSize:'14px',letterSpacing:'3px',background:'linear-gradient(135deg,#8b1a1a,#c0392b)',border:'2px solid #ffd700',color:'#ffd700',borderRadius:'4px',cursor:'pointer',textTransform:'uppercase'}}>
          ⚔️ March Forward — Wave {waveIdx+2}
        </button>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     VICTORY / DEFEAT
  ════════════════════════════════════════════════════════════════ */
  if(phase==='victory') return(
    <div style={ROOT}><style>{GLOBAL_CSS}</style>
      <div style={{textAlign:'center'}} className="fadeUp">
        <div style={{fontSize:'72px',marginBottom:'12px'}} className="float">🏆</div>
        <h1 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'30px',color:'#ffd700',textShadow:'0 0 40px #ffd700',letterSpacing:'4px',marginBottom:'8px'}} className="glow">VICTORY!</h1>
        <p style={{color:'#d4af7a',fontSize:'14px',marginBottom:'4px'}}>The realm is saved, {heroClass?.name}!</p>
        {gameMode?.endless&&<p style={{color:'#9b59b6',fontSize:'18px',marginBottom:'4px'}}>🌀 Final Score: {score.toLocaleString()}</p>}
        <p style={{color:'#666',fontSize:'11px',marginBottom:'26px'}}>Wave {waveIdx+1} · ❤️ {hero?.hp}/{hero?.maxHp} HP</p>
        <button className="btn" onClick={()=>{setPhase('title');setHero(null);setHeroClass(null);setWaveIdx(0);setScore(0);}}
          style={{padding:'12px 36px',fontFamily:BASE_FONT,fontSize:'14px',background:'linear-gradient(135deg,#1a4a1a,#27ae60)',border:'2px solid #ffd700',color:'#ffd700',borderRadius:'4px',cursor:'pointer',letterSpacing:'2px'}}>
          🏰 New Quest
        </button>
      </div>
    </div>
  );

  if(phase==='defeat') return(
    <div style={ROOT}><style>{GLOBAL_CSS}</style>
      <div style={{textAlign:'center'}} className="fadeUp">
        <div style={{fontSize:'72px',marginBottom:'12px'}}>💀</div>
        <h1 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:'30px',color:'#c0392b',textShadow:'0 0 30px #c0392b',letterSpacing:'4px',marginBottom:'8px'}}>FALLEN</h1>
        <p style={{color:'#8a7050',marginBottom:'4px',fontSize:'13px'}}>Your {heroClass?.name} has been vanquished.</p>
        {gameMode?.endless&&<p style={{color:'#9b59b6',fontSize:'16px',marginBottom:'4px'}}>🌀 Score: {score.toLocaleString()}</p>}
        <p style={{color:'#444',fontSize:'11px',marginBottom:'26px'}}>Wave {waveIdx+1} — {enemy?.name}</p>
        <button className="btn" onClick={()=>{setPhase('title');setHero(null);setHeroClass(null);setWaveIdx(0);setScore(0);}}
          style={{padding:'12px 36px',fontFamily:BASE_FONT,fontSize:'14px',background:'linear-gradient(135deg,#2c0a0a,#8b1a1a)',border:'2px solid #c0392b',color:'#e8a0a0',borderRadius:'4px',cursor:'pointer',letterSpacing:'2px'}}>
          ⚔️ Try Again
        </button>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════
     BATTLE SCREEN
  ════════════════════════════════════════════════════════════════ */
  if(phase==='battle'){
    const hd=HAND_DATA[previewHR?.name]||{};
    const timerMax=(gameMode?.timerSecs||10)+(artifacts.some(a=>a.effect.timer)?10:0);
    const timerPct=timerSec?timerSec/timerMax:1;
    const timerCol=timerPct>0.5?'#2ecc71':timerPct>0.25?'#f39c12':'#e74c3c';
    const wcColors={good:'#2ecc71',bad:'#e74c3c',neutral:'#f39c12'};

    return(
      <div style={{...ROOT,justifyContent:'flex-start',padding:'5px',gap:'0'}}><style>{GLOBAL_CSS}</style>

        {/* ── TOP HUD ── */}
        <div style={{width:'100%',maxWidth:'790px',display:'flex',gap:'5px',marginBottom:'5px',alignItems:'stretch'}}>
          {/* Hero */}
          <div className={hShake?'shake':''} style={{flex:1,background:'rgba(0,0,0,0.5)',border:'1px solid rgba(212,175,122,0.18)',borderRadius:'6px',padding:'7px 9px',display:'flex',gap:'7px',alignItems:'center'}}>
            <span style={{fontSize:'22px'}}>{heroClass?.emoji}</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:'9px',color:'#9b7a3a',letterSpacing:'2px',marginBottom:'2px'}}>{heroClass?.name?.toUpperCase()}</div>
              <div style={{display:'flex',gap:'5px',alignItems:'center'}}>
                <div style={{flex:1,height:'8px',background:'#1a0a0a',borderRadius:'4px',overflow:'hidden'}}>
                  <div style={{width:`${(hero?.hp/hero?.maxHp)*100}%`,height:'100%',background:'linear-gradient(90deg,#8b0000,#e74c3c)',transition:'width 0.4s',boxShadow:'0 0 5px #e74c3c'}}/>
                </div>
                <span style={{fontSize:'10px',color:'#e74c3c',minWidth:'48px'}}>❤️{hero?.hp}/{hero?.maxHp}</span>
              </div>
            </div>
            {heroClass?.id==='berserker'&&berserkerMult>0&&<span style={{fontSize:'10px',color:'#e67e22'}}>🔥+{berserkerMult.toFixed(1)}</span>}
          </div>
          {/* Enemy */}
          <div className={eShake?'shake':''} style={{flex:1.5,background:'rgba(139,0,0,0.1)',border:`2px solid ${enemy?.isBoss?'#ffd700':'rgba(192,57,43,0.3)'}`,borderRadius:'6px',padding:'7px 9px'}}>
            <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'3px'}}>
              <span style={{fontSize:'24px'}}>{enemy?.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:'11px',color:'#d4af7a'}}>{enemy?.name}{enemy?.isBoss&&<span style={{color:'#ffd700',marginLeft:'5px',fontSize:'9px'}}>⚠️BOSS</span>}</div>
                <div style={{fontSize:'9px',color:'#555'}}>⚔️{enemy?.finalAtk||enemy?.atk}{burnStacks>0&&<span style={{color:'#ff6b35'}}> 🔥×{burnStacks}</span>}</div>
              </div>
              <div style={{fontSize:'10px',color:'#e74c3c'}}>{enemy?.hp}<span style={{color:'#333',fontSize:'8px'}}>/{enemy?.maxHp}</span></div>
            </div>
            <div style={{height:'7px',background:'#1a0a0a',borderRadius:'4px',overflow:'hidden'}}>
              <div style={{width:`${Math.max(0,(enemy?.hp/enemy?.maxHp)*100)}%`,height:'100%',background:'linear-gradient(90deg,#4a0000,#e74c3c,#ff6b6b)',transition:'width 0.4s',boxShadow:'0 0 6px #e74c3c'}}/>
            </div>
          </div>
          {/* Stats */}
          <div style={{background:'rgba(0,0,0,0.45)',border:'1px solid rgba(212,175,122,0.12)',borderRadius:'6px',padding:'7px 9px',display:'flex',flexDirection:'column',justifyContent:'center',gap:'2px',minWidth:'72px'}}>
            <div style={{color:'#7dff7d',fontSize:'11px'}}>🃏 {handsLeft}</div>
            <div style={{color:'#ffd07d',fontSize:'11px'}}>🔄 {discards}</div>
            <div style={{color:'#ffd700',fontSize:'11px'}}>💰 {hero?.gold}</div>
            {gameMode?.endless&&<div style={{color:'#9b59b6',fontSize:'9px'}}>★{(score/1000).toFixed(1)}k</div>}
          </div>
          {/* Wave dots */}
          <div style={{background:'rgba(0,0,0,0.35)',border:'1px solid rgba(212,175,122,0.08)',borderRadius:'6px',padding:'7px',display:'flex',flexDirection:'column',justifyContent:'center',gap:'3px',minWidth:'24px',alignItems:'center'}}>
            {Array.from({length:Math.min(gameMode?.endless?8:gameMode?.waves||5,8)},(_,i)=>(
              <div key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:i<waveIdx?'#ffd700':i===waveIdx?'#e74c3c':'#1a1a1a',boxShadow:i===waveIdx?'0 0 5px #e74c3c':'none',transition:'all 0.3s'}}/>
            ))}
          </div>
        </div>

        {/* ── TIMER ── */}
        {gameMode?.timerEnabled&&timerSec!==null&&(
          <div style={{width:'100%',maxWidth:'790px',marginBottom:'4px',display:'flex',gap:'7px',alignItems:'center'}}>
            <div style={{flex:1,height:'5px',background:'#111',borderRadius:'3px',overflow:'hidden'}}>
              <div style={{width:`${timerPct*100}%`,height:'100%',background:timerCol,transition:'width 1s linear',boxShadow:`0 0 5px ${timerCol}`}}/>
            </div>
            <span className={timerSec<=3?'timerBlink':''} style={{fontSize:'12px',color:timerCol,minWidth:'26px',fontWeight:'bold'}}>⏱{timerSec}</span>
          </div>
        )}

        {/* ── WILDCARD BANNER ── */}
        {wildcard&&(
          <div style={{width:'100%',maxWidth:'790px',marginBottom:'4px',background:'rgba(0,0,0,0.45)',border:`1px solid ${wcColors[wildcard.type]||'#555'}44`,borderRadius:'5px',padding:'4px 9px',display:'flex',gap:'7px',alignItems:'center'}}>
            <span style={{fontSize:'14px'}}>{wildcard.emoji}</span>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:'9px',color:wcColors[wildcard.type]}}>{wildcard.name}:</span>
            <span style={{fontSize:'9px',color:'#777'}}>{wildcard.desc}</span>
          </div>
        )}

        {/* ── PREVIEW + ABILITY + LOG ── */}
        <div style={{width:'100%',maxWidth:'790px',display:'flex',gap:'5px',marginBottom:'5px',minHeight:'60px'}}>
          {/* Preview */}
          <div style={{flex:1,background:'rgba(0,0,0,0.4)',border:`1px solid ${previewHR?hd.color+'55':'rgba(212,175,122,0.08)'}`,borderRadius:'6px',padding:'7px 10px',display:'flex',alignItems:'center',gap:'8px',transition:'border-color 0.3s'}}>
            {previewHR?(
              <>
                <span style={{fontSize:'22px'}}>{hd.emoji}</span>
                <div><div style={{fontFamily:"'Cinzel',serif",fontSize:'12px',color:hd.color,fontWeight:'600'}}>{previewHR.name}</div><div style={{fontSize:'9px',color:'#555'}}>{previewHR.chips|0} chips</div></div>
                <div style={{marginLeft:'auto',fontSize:'17px',fontWeight:'bold',color:'#ff6b35'}}>⚔️{previewDmg}</div>
              </>
            ):lastHand?(
              <>
                <span style={{fontSize:'18px'}}>{HAND_DATA[lastHand.name]?.emoji}</span>
                <div style={{fontSize:'11px',color:HAND_DATA[lastHand.name]?.color}}>{lastHand.name}</div>
                <div style={{marginLeft:'auto',fontSize:'13px',color:'#ff6b35'}}>⚔️{lastDmg}</div>
              </>
            ):<div style={{color:'#2a2a2a',fontSize:'10px',letterSpacing:'2px',fontFamily:"'Cinzel',serif"}}>SELECT CARDS TO PREVIEW</div>}
          </div>
          {/* Ability */}
          <div onClick={abilityReady?useAbility:undefined}
            style={{minWidth:'90px',background:'rgba(0,0,0,0.4)',border:`1px solid ${abilityReady?heroClass?.color+'66':'#222'}`,borderRadius:'6px',padding:'7px',textAlign:'center',cursor:abilityReady?'pointer':'default',transition:'all 0.2s',opacity:abilityReady?1:0.5}}>
            <div style={{fontSize:'18px',filter:abilityReady?'none':'grayscale(1)'}}>{heroClass?.ability.emoji}</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:'8px',color:abilityReady?heroClass?.color:'#333',marginTop:'2px',letterSpacing:'1px'}}>{heroClass?.ability.name}</div>
            <div style={{fontSize:'8px',color:'#555'}}>{abilityReady?'READY':`CD:${abilityCd}`}</div>
            {blockActive&&<div style={{fontSize:'7px',color:'#27ae60'}}>BLOCKING</div>}
          </div>
          {/* Log */}
          <div style={{width:'175px',background:'rgba(0,0,0,0.45)',border:'1px solid rgba(212,175,122,0.06)',borderRadius:'6px',padding:'5px',overflowY:'auto'}}>
            {log.slice(0,6).map((e,i)=>(
              <div key={e.id} style={{fontSize:'8.5px',marginBottom:'2px',lineHeight:'1.35',color:e.type==='attack'?'#ff8c00':e.type==='enemy'?'#e74c3c':e.type==='victory'?'#ffd700':e.type==='heal'?'#2ecc71':e.type==='ability'?'#9b59b6':e.type==='wildcard'?'#1abc9c':e.type==='burn'?'#ff6b35':e.type==='bad'?'#e74c3c':e.type==='shop'?'#f39c12':'#555',opacity:1-i*0.16}}>
                {e.msg}
              </div>
            ))}
          </div>
        </div>

        {/* ── ARMY PILLS ── */}
        {(creatures.length>0||artifacts.length>0)&&(
          <div style={{width:'100%',maxWidth:'790px',marginBottom:'4px',display:'flex',gap:'4px',flexWrap:'wrap'}}>
            {creatures.map((c,i)=>(
              <div key={i} title={`${c.name}: ${c.desc}`} style={{padding:'2px 7px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(212,175,122,0.12)',borderRadius:'20px',fontSize:'9px',color:'#9b7a3a',display:'flex',gap:'3px',alignItems:'center',cursor:'help'}}>
                {c.emoji}<span style={{fontFamily:"'Cinzel',serif"}}>{c.name}</span>
              </div>
            ))}
            {artifacts.map((a,i)=>(
              <div key={i} title={`${a.name}: ${a.desc}`} style={{padding:'2px 7px',background:'rgba(255,215,0,0.04)',border:'1px solid rgba(255,215,0,0.18)',borderRadius:'20px',fontSize:'9px',color:'#ffd700',display:'flex',gap:'3px',alignItems:'center',cursor:'help'}}>
                {a.emoji}<span style={{fontFamily:"'Cinzel',serif"}}>{a.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── CARDS ── */}
        <div style={{width:'100%',maxWidth:'790px',display:'flex',justifyContent:'center',gap:'4px',flexWrap:'wrap',marginBottom:'7px',minHeight:'100px',alignItems:'flex-end'}}>
          {hand.map((card,idx)=>{
            const isSel=selected.includes(idx);
            const sc=SUIT_COLOR(card.suit);
            return(
              <div key={card.id} className="card" onClick={()=>selectCard(idx)}
                style={{width:'54px',height:'84px',borderRadius:'6px',cursor:'pointer',position:'relative',
                  background:isSel?'linear-gradient(135deg,#1a1a3e,#2a2a5e)':'linear-gradient(135deg,#1e1a14,#2a2416)',
                  border:`2px solid ${isSel?'#ffd700':'rgba(212,175,122,0.22)'}`,
                  boxShadow:isSel?'0 0 12px rgba(255,215,0,0.45),0 4px 10px rgba(0,0,0,0.8)':'0 3px 8px rgba(0,0,0,0.6)',
                  transform:isSel?'translateY(-14px)':'translateY(0)',transition:'all 0.15s ease',userSelect:'none',flexShrink:0}}>
                <div style={{position:'absolute',top:'4px',left:'5px',fontSize:'11px',fontWeight:'bold',color:sc,fontFamily:"'Cinzel',serif"}}>{card.rank}</div>
                <div style={{position:'absolute',top:'17px',left:'5px',fontSize:'10px',color:sc}}>{card.suit}</div>
                <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontSize:'18px',color:sc}}>{card.suit}</div>
                <div style={{position:'absolute',bottom:'4px',right:'5px',fontSize:'11px',fontWeight:'bold',color:sc,transform:'rotate(180deg)',fontFamily:"'Cinzel',serif"}}>{card.rank}</div>
                {isSel&&<div style={{position:'absolute',inset:0,borderRadius:'4px',background:'rgba(255,215,0,0.07)',pointerEvents:'none'}}/>}
              </div>
            );
          })}
        </div>

        {/* ── ACTIONS ── */}
        <div style={{width:'100%',maxWidth:'790px',display:'flex',gap:'7px'}}>
          <button className="btn" onClick={playHand} disabled={!selected.length||!handsLeft||animating}
            style={{flex:2,padding:'10px',fontFamily:BASE_FONT,fontSize:'13px',letterSpacing:'2px',textTransform:'uppercase',
              background:selected.length&&handsLeft&&!animating?'linear-gradient(135deg,#8b1a1a,#c0392b)':'rgba(50,30,30,0.5)',
              border:`2px solid ${selected.length&&handsLeft&&!animating?'#ffd700':'#2a2a2a'}`,
              color:selected.length&&handsLeft&&!animating?'#ffd700':'#444',
              borderRadius:'5px',cursor:selected.length&&handsLeft&&!animating?'pointer':'default',
              boxShadow:selected.length&&handsLeft&&!animating?'0 4px 14px rgba(192,57,43,0.3)':'none'}}>
            ⚔️ Play ({handsLeft})
          </button>
          <button className="btn" onClick={discardCards} disabled={!selected.length||(!discards&&!abilityFx.freediscard)||animating}
            style={{flex:1,padding:'10px',fontFamily:BASE_FONT,fontSize:'12px',letterSpacing:'1px',textTransform:'uppercase',
              background:selected.length&&(discards||abilityFx.freediscard)&&!animating?'linear-gradient(135deg,#1a3a5a,#1a5a8a)':'rgba(30,40,50,0.5)',
              border:`2px solid ${selected.length&&(discards||abilityFx.freediscard)&&!animating?'#4a90d9':'#2a2a2a'}`,
              color:selected.length&&(discards||abilityFx.freediscard)&&!animating?'#7dc8ff':'#333',
              borderRadius:'5px',cursor:selected.length&&(discards||abilityFx.freediscard)&&!animating?'pointer':'default'}}>
            🔄 {abilityFx.freediscard?'FREE':discards}
          </button>
          <button className="btn" onClick={()=>setSelected([])}
            style={{padding:'10px 12px',fontFamily:BASE_FONT,fontSize:'11px',background:'rgba(18,18,18,0.6)',border:'1px solid #1a1a1a',color:'#444',borderRadius:'5px',cursor:'pointer'}}>✕</button>
        </div>

        {/* ── HAND REF ── */}
        <div style={{width:'100%',maxWidth:'790px',marginTop:'5px',display:'flex',gap:'2px',flexWrap:'wrap',justifyContent:'center'}}>
          {Object.entries(HAND_DATA).reverse().map(([name,data])=>(
            <span key={name} style={{fontSize:'7.5px',padding:'2px 4px',borderRadius:'3px',background:'rgba(0,0,0,0.4)',border:`1px solid ${data.color}1a`,color:data.color,opacity:previewHR?.name===name?1:0.35,transform:previewHR?.name===name?'scale(1.12)':'scale(1)',transition:'all 0.2s',fontFamily:"'Cinzel',serif"}}>
              {data.emoji} {name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
