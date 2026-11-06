// Deterministic arena combat. Presentation is handled separately by scene/hero.
(function (root) {
  'use strict';
  const DT = 1 / 120;
  const VIEW = { W: 1672, H: 941 };
  const TAU = Math.PI * 2;
  const CONFIG = {
    speed: 230, acceleration: 2400, deceleration: 3200, radius: 20,
    hp: 150, mana: 100, manaRegen: 5, stamina: 100, staminaRegen: 22, staminaDelay: .8,
    attack: { windup: .14, active: .08, recovery: .22, range: 150, arc: 110 * Math.PI / 180, damage: 18 },
    roll: { cost: 25, duration: .56, distance: 190, cooldown: .65, evadeStart: .08, evadeEnd: .30 },
    block: { arc: 130 * Math.PI / 180, move: .35, reduction: .9, elementalReduction: .65, breakDuration: 1, parryWindow: .16, rearm: .5 },
    abilities: [
      { id: 'frost', cost: 18, cooldown: 2.5, windup: .18 },
      { id: 'critical', cost: 25, cooldown: 5, windup: .26, active: .10, recovery: .30, damage: 72, range: 190, arc: 125*Math.PI/180 },
      { id: 'ward', cost: 30, cooldown: 12, windup: .08 }
    ]
  };
  const BOSS_ATTACKS = {
    claw: { windup: .85, active: .16, recovery: .9, damage: 32, guardCost: 22, range: 245, arc: 110 * Math.PI / 180 },
    slam: { windup: 1.55, active: .28, recovery: 1.10, damage: 45, radius: 330 },
    breath: { windup: 1.10, active: 2.20, recovery: 1.0, damage: 6, tick: .25, range: 520, arc: .54, turnRate: .38 },
    bolt: { windup: 1.05, lockBefore: .30, active: .12, recovery: .85, damage: 30, guardCost: 24, speed: 460, range: 1100, radius: 15 }
  };
  const FLOOR_Y=.62;
  const FALLBACK_LEVEL = {
    walkPolygon: [[240,420],[760,240],[1410,350],[1550,650],[1080,835],[390,850],[95,655]],
    blockers: [], playerSpawn: [730,720], targetSpawn: [835,532]
  };
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const hypot = Math.hypot;
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const near = (a, b) => Math.abs(a - b) < 1e-8;
  const point = p => Array.isArray(p) ? p : [p.x,p.y];
  function levelData() {
    if (root.LEVEL) return root.LEVEL;
    if (typeof require === 'function') { try { return require('./level.js'); } catch (_) { /* source-only unit tests */ } }
    return FALLBACK_LEVEL;
  }
  function inPolygon(x, y, polygon) {
    let inside = false;
    for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const [xi,yi]=point(polygon[i]),[xj,yj]=point(polygon[j]);
      if (((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  }
  function isWalkable(S, x, y, r = CONFIG.radius, ignoreBoss = false) {
    const L = S.level || levelData();
    const poly = L.walkPolygon || FALLBACK_LEVEL.walkPolygon;
    for (let i=0;i<8;i++) {
      const a=i*TAU/8;
      if (!inPolygon(x+Math.cos(a)*r,y+Math.sin(a)*r,poly)) return false;
    }
    for (const o of L.blockers || []) {
      const rx=(o.rx ?? o.r ?? 30)+r,ry=(o.ry ?? o.r ?? 30)+r;
      if (((x-o.x)/rx)**2+((y-o.y)/ry)**2 < 1) return false;
    }
    const b=S.boss;
    if (!ignoreBoss && b && b.hp>0 && b.solid!==false && bossHeight(S)<130 && hypot(x-b.x,y-b.y)<r+b.r) return false;
    return true;
  }
  function moveWithCollision(S, actor, dx, dy, ignoreBoss=false) {
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));
    let blockedX=false,blockedY=false;
    for (let i=0;i<n;i++) {
      if (isWalkable(S,actor.x+dx/n,actor.y,actor.r,ignoreBoss)) actor.x+=dx/n; else blockedX=true;
      if (isWalkable(S,actor.x,actor.y+dy/n,actor.r,ignoreBoss)) actor.y+=dy/n; else blockedY=true;
    }
    return {blockedX,blockedY};
  }
  function emit(S,k,x,y,extra={}) {
    S.events.push({k,t:S.t,x,y,...extra});
    if (S.events.length>128) S.events.splice(0,S.events.length-128);
  }
  function create(options={}) {
    const level=options.level || levelData();
    const ps=point(level.playerSpawn || [730,720]),bs=point(level.targetSpawn || [835,532]);
    const events=[];
    return {
      t:0,steps:0,wt0:0,level,events,ev:events,shots:[],hazards:[],outcome:null,nextId:1,
      p:{x:ps[0],y:ps[1],vx:0,vy:0,r:20,facing:-Math.PI/2,hp:150,maxHp:150,mana:100,maxMana:100,stamina:100,maxStamina:100,
        state:'idle',stateT:0,stateStart:0,action:null,travel:0,ward:0,wardUntil:0,cooldowns:[0,0,0],rollReadyAt:0,parryUntil:-1,
        lastParryArmAt:-10,guardBreakUntil:0,hurtUntil:0,lastStaminaUseAt:-10,lastDryAt:-10,blockHeld:false,hitHistory:{},bufferRollUntil:-1,bufferSkill:null},
      boss:{x:bs[0],y:bs[1],r:80,hp:1800,maxHp:1800,facing:Math.PI/2,state:'idle',stateT:0,stateStart:0,
        attack:null,attackId:0,attackIndex:0,aim:Math.PI/2,hit:false,spawned:false,breathTick:-1,breathFacing:null,boltFacing:null,boltTarget:null,staggerUntil:0,chilledUntil:0,nextAttackAt:1.4,
        enabled:options.enemyEnabled!==false,solid:options.bossSolid!==false},
      stats:{dealt:0,taken:0,evades:0,blocks:0,parries:0,rolls:0,casts:[0,0,0]}
    };
  }
  const spawn = (worldT=0) => Object.assign(create(),{wt0:worldT});
  function reset(S, worldT=0) { return Object.assign(S,spawn(worldT)); }
  function setState(p,state,t) {
    if (p.state!==state) {p.state=state;p.stateStart=t;p.stateT=0;}
  }
  function inEvadeWindow(S) {
    const a=S.p.action;
    if (!a || a.kind!=='roll') return false;
    const t=S.t-a.started;
    return t+1e-9>=CONFIG.roll.evadeStart && t<CONFIG.roll.evadeEnd-1e-9;
  }
  function death(S) {
    const p=S.p;
    if (p.state==='dead') return;
    p.hp=0;p.vx=0;p.vy=0;p.action=null;p.ward=0;setState(p,'dead',S.t);S.outcome='defeat';
    S.boss.attack=null;S.boss.state='idle';S.boss.stateStart=S.t;S.boss.stateT=0;S.shots=S.shots.filter(x=>x.owner!=='boss');S.hazards=[];
    emit(S,'death',p.x,p.y);
  }
  function damageBoss(S, amount, extra={}) {
    const b=S.boss;
    if (b.hp<=0 || S.outcome==='defeat' || !bossVulnerable(S)) return 0;
    const applied=Math.min(b.hp,Math.max(0,amount));
    b.hp-=applied;S.stats.dealt+=applied;
    emit(S,'targetHit',b.x,b.y,{amount:applied,...extra});
    if (b.hp<=0) {
      b.state='dead';b.stateStart=S.t;b.stateT=0;b.attack=null;S.outcome='victory';
      S.shots=S.shots.filter(x=>x.owner!=='boss');S.hazards=S.hazards.filter(x=>x.owner!=='boss');
      emit(S,'targetDown',b.x,b.y);
    }
    return applied;
  }
  function applyHit(S, hit) {
    const p=S.p;
    if (p.hp<=0 || S.outcome==='victory') return {kind:'ignored',damage:0};
    if (hit.id!==undefined && p.hitHistory[hit.id]!==undefined) return {kind:'duplicate',damage:0};
    if (hit.id!==undefined) p.hitHistory[hit.id]=S.t;
    const x=hit.sourceX ?? hit.x ?? S.boss.x,y=hit.sourceY ?? hit.y ?? S.boss.y;
    if (hit.evadable!==false && inEvadeWindow(S)) {
      S.stats.evades++;emit(S,'evade',p.x,p.y,{attackId:hit.id});return {kind:'evade',damage:0};
    }
    let damage=Math.max(0,hit.damage || 0),kind='hurt';
    const sourceAngle=Math.atan2(y-p.y,x-p.x);
    const front=Math.abs(angleDelta(sourceAngle,p.facing))<=CONFIG.block.arc/2+1e-9;
    if (p.state==='block' && hit.blockable!==false && front) {
      if (S.t < p.parryUntil && hit.parryable!==false) {
        const cost=(hit.guardCost ?? 20)*.25;
        if (p.stamina>=cost) {
          p.stamina-=cost;p.lastStaminaUseAt=S.t;S.stats.parries++;
          S.boss.staggerUntil=Math.max(S.boss.staggerUntil,S.t+.42);
          emit(S,'parry',p.x,p.y,{angle:p.facing,attackId:hit.id});
          return {kind:'parry',damage:0,reflect:!!hit.projectile};
        }
      }
      const cost=hit.guardCost ?? 20;
      if (p.stamina>=cost) {
        p.stamina-=cost;p.lastStaminaUseAt=S.t;S.stats.blocks++;kind='block';
        damage*=1-(hit.type==='elemental'?CONFIG.block.elementalReduction:CONFIG.block.reduction);
        emit(S,'block',p.x,p.y,{angle:p.facing,attackId:hit.id});
      } else {
        p.stamina=0;p.lastStaminaUseAt=S.t;p.guardBreakUntil=S.t+CONFIG.block.breakDuration;p.action=null;
        setState(p,'guardBreak',S.t);kind='guardBreak';emit(S,'guardBreak',p.x,p.y);
      }
    }
    if (p.ward>0 && S.t<p.wardUntil) {
      const absorbed=Math.min(p.ward,damage);p.ward-=absorbed;damage-=absorbed;
      if (absorbed>0) emit(S,'wardHit',p.x,p.y,{amount:absorbed});
    }
    const applied=Math.min(p.hp,damage);p.hp=Math.max(0,p.hp-damage);S.stats.taken+=applied;
    if (applied>0) {p.hurtUntil=S.t+.18;emit(S,'hurt',p.x,p.y,{amount:applied});}
    if (p.hp<=0) death(S);
    return {kind,damage:applied};
  }
  const abilityCooldown=(S,index)=>Math.max(0,S.p.cooldowns[index]-S.t);
  const canPrimary=S=>S.p.hp>0 && S.t>=S.p.guardBreakUntil && !S.p.action && S.p.state!=='block';
  function dry(S, reason) {
    if (S.t-S.p.lastDryAt>.45) {emit(S,reason,S.p.x,S.p.y);S.p.lastDryAt=S.t;}
  }
  function canCancel(action,t) {
    if (!action) return true;
    if (action.kind==='roll') return false;
    const age=t-action.started;
    // A released spell already owns its cost and effect; defensive recovery
    // cancellation therefore cannot duplicate or refund it.
    const cfg=action.kind==='critical'?CONFIG.abilities[1]:CONFIG.attack;
    return action.kind==='cast' || age<cfg.windup || age>=cfg.windup+cfg.active;
  }
  function startRoll(S, inp) {
    const p=S.p,c=CONFIG.roll;
    if (S.t+1e-9<p.rollReadyAt || p.stamina<c.cost || !canCancel(p.action,S.t)) return false;
    let dx=clamp(Number(inp.moveX)||0,-1,1),dy=clamp(Number(inp.moveY)||0,-1,1),len=hypot(dx,dy);
    if (len<.01) {dx=Math.cos(p.facing);dy=Math.sin(p.facing);len=1;}
    p.stamina-=c.cost;p.lastStaminaUseAt=S.t;p.rollReadyAt=S.t+c.cooldown;
    p.action={kind:'roll',started:S.t,elapsed:0,duration:c.duration,dx:dx/len,dy:dy/len,aim:Math.atan2(dy,dx)};
    p.parryUntil=-1;setState(p,'roll',S.t);S.stats.rolls++;emit(S,'roll',p.x,p.y,{angle:p.action.aim});
    return true;
  }
  function startCast(S,index) {
    const p=S.p,c=CONFIG.abilities[index];
    if (!c || p.action || p.state==='block') return false;
    if (abilityCooldown(S,index)>1e-9) {dry(S,'cooldown');return false;}
    if (p.mana+1e-9<c.cost) {dry(S,'noMana');return false;}
    const kind=index===1?'critical':'cast';
    p.action={kind,ability:index,id:S.nextId++,started:S.t,elapsed:0,duration:index===1?c.windup+c.active+c.recovery:c.windup+.12,aim:p.facing,committed:false};
    setState(p,kind,S.t);emit(S,index===1?'criticalWindup':'castStart',p.x,p.y,{ability:index,angle:p.facing});return true;
  }
  function hand(S) {return {x:S.p.x+Math.cos(S.p.facing)*32,y:S.p.y+Math.sin(S.p.facing)*32};}
  function commitCast(S,a) {
    const p=S.p,c=CONFIG.abilities[a.ability];
    if (p.mana+1e-9<c.cost) {dry(S,'noMana');p.action=null;return;}
    p.mana=Math.max(0,p.mana-c.cost);p.cooldowns[a.ability]=S.t+c.cooldown;a.committed=true;S.stats.casts[a.ability]++;
    const origin=hand(S),dx=Math.cos(a.aim),dy=Math.sin(a.aim),id=S.nextId++;
    if (a.ability===0) {
      S.shots.push({id,owner:'player',type:'frost',aim:a.aim,x:origin.x,y:origin.y,vx:dx*720,vy:dy*720,r:10,ttl:1.3,damage:28,age:0});
    } else if (a.ability===1) {
      emit(S,'criticalSwing',p.x,p.y,{angle:a.aim,attackId:a.id});
      const b=S.boss,da=Math.atan2(b.y-p.y,b.x-p.x);
      if(b.hp>0&&hypot(b.x-p.x,b.y-p.y)<=c.range+b.r&&Math.abs(angleDelta(da,a.aim))<=c.arc/2&&clearMeleeLine(S,p,b)){
        const applied=damageBoss(S,c.damage,{type:'critical',attackId:a.id});
        if(applied>0)emit(S,'criticalHit',b.x,b.y,{angle:a.aim,amount:applied,heroX:p.x,heroY:p.y,attackId:a.id});
      }
    } else {p.ward=60;p.wardUntil=S.t+4;}
    emit(S,'cast',origin.x,origin.y,{ability:a.ability,angle:a.aim});
  }
  function segmentDistance(x,y,ax,ay,bx,by) {
    const dx=bx-ax,dy=by-ay,d=dx*dx+dy*dy;
    const t=d?clamp(((x-ax)*dx+(y-ay)*dy)/d,0,1):0;
    return hypot(x-(ax+dx*t),y-(ay+dy*t));
  }
  function clearMeleeLine(S,p,b){
    const dx=b.x-p.x,dy=b.y-p.y,d=hypot(dx,dy),reach=Math.max(0,d-b.r);
    for(let q=8;q<reach;q+=8)if(!isWalkable(S,p.x+dx*q/d,p.y+dy*q/d,2,true))return false;
    return true;
  }
  function processAction(S) {
    const p=S.p,a=p.action;
    if (!a) return;
    a.elapsed=S.t-a.started;
    if (a.kind==='attack') {
      if (a.elapsed+1e-9>=CONFIG.attack.windup && a.elapsed<CONFIG.attack.windup+CONFIG.attack.active && !a.hit) {
        const b=S.boss,da=Math.atan2(b.y-p.y,b.x-p.x);
        if (b.hp>0 && hypot(b.x-p.x,b.y-p.y)<=CONFIG.attack.range+b.r && Math.abs(angleDelta(da,a.aim))<=CONFIG.attack.arc/2 && clearMeleeLine(S,p,b)) {
          a.hit=true;const applied=damageBoss(S,CONFIG.attack.damage,{type:'melee',attackId:a.id});
          if(applied>0){p.mana=Math.min(p.maxMana,p.mana+4);emit(S,'meleeHit',b.x,b.y,{angle:a.aim,attackId:a.id});}
        }
      }
    } else if ((a.kind==='cast'||a.kind==='critical') && !a.committed && a.elapsed+1e-9>=CONFIG.abilities[a.ability].windup) commitCast(S,a);
    if (p.action===a && a.elapsed+1e-9>=a.duration) {p.action=null;setState(p,'idle',S.t);}
  }
  function updatePlayer(S,inp) {
    const p=S.p;
    if (p.hp<=0) {death(S);return;}
    if (p.wardUntil<=S.t) p.ward=0;
    if (Number.isFinite(inp.mx) && Number.isFinite(inp.my) && hypot(inp.mx-p.x,inp.my-p.y)>.01 && p.action?.kind!=='roll') {
      const locked=(p.action?.kind==='attack'||p.action?.kind==='critical') && S.t-p.action.started>=(p.action.kind==='critical'?CONFIG.abilities[1].windup:CONFIG.attack.windup);
      if (!locked) p.facing=Math.atan2(inp.my-p.y,inp.mx-p.x);
    }
    if (p.action && S.t-p.action.started+1e-9>=p.action.duration) {
      if (p.action.kind==='roll') p.vx=p.vy=0;
      p.action=null;setState(p,'idle',S.t);
    }
    if (inp.roll) p.bufferRollUntil=S.t+.12;
    if (inp.skill>=1 && inp.skill<=3) p.bufferSkill={index:inp.skill-1,until:S.t+.12};
    if (S.t<p.guardBreakUntil) {
      p.action=null;setState(p,'guardBreak',S.t);p.vx=0;p.vy=0;p.blockHeld=!!inp.block;return;
    }
    if (p.state==='guardBreak') setState(p,'idle',S.t);
    if (p.bufferRollUntil>=S.t && startRoll(S,inp)) p.bufferRollUntil=-1;
    const wantsBlock=!!inp.block && p.action?.kind!=='roll';
    if (wantsBlock && canCancel(p.action,S.t)) {
      p.action=null;
      if (p.state!=='block') {
        setState(p,'block',S.t);
        if (S.t-p.lastParryArmAt>=CONFIG.block.rearm) {p.parryUntil=S.t+CONFIG.block.parryWindow;p.lastParryArmAt=S.t;}
        else p.parryUntil=-1;
      }
    } else if (p.state==='block' && !wantsBlock) {emit(S,'guardLower',p.x,p.y,{angle:p.facing});p.parryUntil=-1;setState(p,'idle',S.t);}
    p.blockHeld=!!inp.block;
    if (!p.action && p.state!=='block' && p.bufferSkill && p.bufferSkill.until>=S.t) {
      const request=p.bufferSkill;p.bufferSkill=null;startCast(S,request.index);
    }
    if (p.bufferSkill && p.bufferSkill.until<S.t) p.bufferSkill=null;
    if (!p.action && p.state!=='block' && inp.attack) {
      const c=CONFIG.attack;p.action={kind:'attack',id:S.nextId++,started:S.t,elapsed:0,duration:c.windup+c.active+c.recovery,aim:p.facing,hit:false};
      setState(p,'attack',S.t);emit(S,'swing',p.x,p.y,{angle:p.facing,attackId:p.action.id});
    }
    if (p.action && ((['cast','critical'].includes(p.action.kind) && !p.action.committed) || (p.action.kind==='attack' && S.t-p.action.started<CONFIG.attack.windup))) p.action.aim=p.facing;
    let dx=clamp(Number(inp.moveX)||0,-1,1),dy=clamp(Number(inp.moveY)||0,-1,1),len=hypot(dx,dy);
    if (len>1) {dx/=len;dy/=len;}
    if (p.action?.kind==='roll') {
      const portion=clamp((p.action.duration-(S.t-p.action.started))/DT,0,1);
      p.vx=p.action.dx*CONFIG.roll.distance/CONFIG.roll.duration*portion;p.vy=p.action.dy*CONFIG.roll.distance/CONFIG.roll.duration*portion;
    } else {
      const mul=p.state==='block' ? CONFIG.block.move : p.action?.kind==='critical'?0:(p.action?.kind==='attack' ? .45 : (p.action?.kind==='cast' ? .55 : 1));
      const tx=dx*CONFIG.speed*mul,ty=dy*CONFIG.speed*mul,dvx=tx-p.vx,dvy=ty-p.vy,dl=hypot(dvx,dvy);
      const max=(len>0?CONFIG.acceleration:CONFIG.deceleration)*DT,k=dl>max?max/dl:1;
      p.vx+=dvx*k;p.vy+=dvy*k;
      if (!p.action && p.state!=='block') setState(p,len>0?'move':'idle',S.t);
    }
    const oldX=p.x,oldY=p.y,blocked=moveWithCollision(S,p,p.vx*DT,p.vy*DT);
    p.travel=(p.travel||0)+hypot(p.x-oldX,p.y-oldY);
    if (blocked.blockedX) p.vx=0;if (blocked.blockedY) p.vy=0;
    processAction(S);
    p.mana=Math.min(p.maxMana,p.mana+CONFIG.manaRegen*DT);
    if (p.action?.kind!=='roll' && p.state!=='block' && S.t-p.lastStaminaUseAt>=CONFIG.staminaDelay) p.stamina=Math.min(p.maxStamina,p.stamina+CONFIG.staminaRegen*DT);
    p.stateT=S.t-p.stateStart;
  }
  const floorDistance=(dx,dy)=>hypot(dx,dy/FLOOR_Y);
  const floorAim=(dx,dy)=>Math.atan2(dy/FLOOR_Y,dx);
  function inSlam(b,p,r=BOSS_ATTACKS.slam.radius){return ((p.x-b.x)/(r+p.r))**2+((p.y-b.y)/(r*FLOOR_Y+p.r))**2<=1;}
  function inBossCone(b,p,range,arc){
    const dx=p.x-b.x,dy=p.y-b.y,d=floorDistance(dx,dy);
    return d<=range+p.r&&Math.abs(angleDelta(floorAim(dx,dy),b.aim))<=arc/2+Math.asin(Math.min(1,p.r/Math.max(p.r,d)));
  }
  function breathPose(S){
    let data=root.DRAGON_DATA;
    if(!data&&typeof require==='function')data=require('./dragon-data.js');
    const bolt=S.boss.attack==='bolt',locked=bolt?S.boss.boltFacing:S.boss.breathFacing;
    const facing=Number.isFinite(locked)?locked:S.boss.facing;
    const screen=Math.atan2(Math.sin(facing)*FLOOR_Y,Math.cos(facing));
    let view=0,dist=9;for(const key of Object.keys(data.directions)){const d=Math.abs(angleDelta(screen,Number(key)*Math.PI/180));if(d<dist){dist=d;view=Number(key);}}
    let frame=Math.min(5,Math.floor(((S.t/.9)%1+1)%1*6));
    if(bolt){const b=S.boss;frame=b.state==='telegraph'?(b.stateT<.30?0:b.stateT<.65?1:2):b.state==='active'?2:Math.min(5,3+Math.floor(b.stateT/.24));}
    if(Number.isFinite(S.qaDragonFrame))frame=S.qaDragonFrame;
    return{view,frame,data,mouth:data.directions[view].clips.breath[frame].muzzle};
  }
  function breathGeometry(S){
    const b=S.boss,pose=breathPose(S),d=pose.data,k=d.scale;
    // Floor hazards belong to the dragon's world anchor, not an animated
    // screen-space mouth plus an assumed skull height. Keep both anchors:
    // the floor mark stays under the body; the visible jet leaves the mouth.
    const origin={x:b.x,y:b.y};
    const muzzle=[b.x+(pose.mouth[0]-d.anchor[0])*k,b.y+(pose.mouth[1]-d.anchor[1])*k-bossHeight(S)*.8],range=BOSS_ATTACKS.breath.range;
    const point=q=>[origin.x+Math.cos(b.aim)*range*q+(muzzle[0]-origin.x)*(1-q),origin.y+Math.sin(b.aim)*range*FLOOR_Y*q+(muzzle[1]-origin.y)*(1-q)**4];
    return{origin,muzzle,range,aim:b.aim,arc:BOSS_ATTACKS.breath.arc,view:pose.view,frame:pose.frame,point,end:point(1)};
  }
  function inBreath(S,p=S.p){const g=breathGeometry(S);return inBossCone({...g.origin,aim:g.aim},p,g.range,g.arc);}
  function boltGeometry(S){
    const g=breathGeometry(S),b=S.boss,target=b.boltTarget||S.p;
    const aim=floorAim(target.x-g.origin.x,target.y-g.origin.y);let range=BOSS_ATTACKS.bolt.range;
    for(let d=8;d<range;d+=8)if(!isWalkable(S,g.origin.x+Math.cos(aim)*d,g.origin.y+Math.sin(aim)*d*FLOOR_Y,2,true)){range=Math.max(8,d-8);break;}
    return{...g,aim,range,end:[g.origin.x+Math.cos(aim)*range,g.origin.y+Math.sin(aim)*range*FLOOR_Y]};
  }
  const projectileDrop=shot=>shot.dropDistance>0?clamp((shot.travelled||0)/shot.dropDistance,0,1):1;
  function projectileHeight(shot){
    if(shot.visual!=='obsidian')return 0;
    const q=projectileDrop(shot);
    return 44+((shot.launchHeight??44)-44)*(1-q)**2;
  }
  function projectilePoint(shot){return[shot.x+(shot.visual==='obsidian'?(shot.launchOffsetX||0)*(1-projectileDrop(shot)):0),shot.y-projectileHeight(shot)];}
  function releaseBolt(S){
    const b=S.boss,c=BOSS_ATTACKS.bolt,g=boltGeometry(S),target=b.boltTarget||S.p,d=floorDistance(target.x-g.origin.x,target.y-g.origin.y);
    // Give the head's forward screen offset time to join the floor lane;
    // a close target must not pull the shard backwards through the jaw.
    const cx=Math.cos(g.aim),headAdvance=Math.max(0,(g.muzzle[0]-g.origin.x)*Math.sign(cx))/Math.max(.2,Math.abs(cx));
    const shot={id:S.nextId++,owner:'boss',type:'ashBolt',visual:'obsidian',x:g.origin.x,y:g.origin.y,vx:Math.cos(g.aim)*c.speed,vy:Math.sin(g.aim)*c.speed*FLOOR_Y,r:c.radius,ttl:c.range/c.speed,age:0,damage:c.damage,guardCost:c.guardCost,
      launchHeight:g.origin.y-g.muzzle[1],launchOffsetX:g.muzzle[0]-g.origin.x,dropDistance:Math.max(60,Math.min(260,d*.65),headAdvance+12),travelled:0,aim:g.aim};
    S.shots.push(shot);emit(S,'boltRelease',shot.x,shot.y,{muzzle:g.muzzle,angle:g.aim,attackId:b.attackId,shotId:shot.id});
  }
  function bossHeight(S){
    const b=S.boss,age=Math.max(0,b.stateT||0);if(b.hp<=0)return 0;
    if(b.attack==='slam'){
      const c=BOSS_ATTACKS.slam;
      if(b.state==='telegraph'){const q=clamp(age/c.windup,0,1);return 52+138*q*q*(3-2*q);}
      if(b.state==='active'){const q=clamp(age/c.active,0,1);return 190*(1-q*q);}
      if(b.state==='recover'){const q=clamp(age/c.recovery,0,1);return 52*q*q*(3-2*q);}
    }
    return 52+4*Math.sin(S.t*TAU/.9);
  }
  const bossVulnerable=S=>S.boss.hp>0&&bossHeight(S)<120;
  function bossState(S,state) {S.boss.state=state;S.boss.stateStart=S.t;S.boss.stateT=0;if(S.boss.attack==='breath'){if(state==='telegraph')S.boss.breathFacing=null;if(state==='active')S.boss.breathFacing=S.boss.facing;}}
  function updateBoss(S) {
    const b=S.boss,p=S.p;
    if (b.hp<=0) {b.state='dead';return;}
    if (!b.enabled || p.hp<=0) return;
    if (S.t<b.staggerUntil) {if (b.state!=='stagger') bossState(S,'stagger');b.stateT=S.t-b.stateStart;return;}
    if (b.state==='stagger') {bossState(S,'recover');b.nextAttackAt=S.t+.5;b.attack=null;}
    // Frost affects the target's action clock, not merely its tint. Projectile
    // speeds remain their own property once released.
    if (S.t<b.chilledUntil) {b.stateStart+=DT*.12;b.nextAttackAt+=DT*.12;}
    b.stateT=S.t-b.stateStart;
    if (b.state==='idle') {
      b.facing=floorAim(p.x-b.x,p.y-b.y);
      if (S.t>=b.nextAttackAt && hypot(p.x-b.x,p.y-b.y)<700) {
        let name=['slam','bolt','claw','breath'][b.attackIndex++%4];
        if (name==='claw' && floorDistance(p.x-b.x,p.y-b.y)>BOSS_ATTACKS.claw.range+p.r) name='bolt';
        b.attack=name;b.attackId=S.nextId++;b.aim=b.facing;b.hit=false;b.spawned=false;b.breathTick=-1;b.boltFacing=null;b.boltTarget=null;bossState(S,'telegraph');
        emit(S,'telegraph',b.x,b.y,{type:name,angle:b.aim,attackId:b.attackId});
      }
      return;
    }
    if (b.state==='recover' && !b.attack) {if (S.t>=b.nextAttackAt) bossState(S,'idle');return;}
    const cfg=BOSS_ATTACKS[b.attack];if (!cfg) return;
    if (b.state==='telegraph') {
      if (b.attack!=='slam'&&b.stateT<cfg.windup-(cfg.lockBefore??.24)) {
        const desired=floorAim(p.x-b.x,p.y-b.y),delta=angleDelta(desired,b.aim),cap=(b.attack==='breath'?.70:2.0)*DT;
        b.aim+=clamp(delta,-cap,cap);
      }
      b.facing=b.aim;
      if(b.attack==='bolt'&&b.stateT+1e-9>=cfg.windup-cfg.lockBefore){
        if(!b.boltTarget){b.boltFacing=b.facing;b.boltTarget={x:p.x,y:p.y};}
        b.facing=b.boltFacing;b.aim=boltGeometry(S).aim;
      }
      if (b.stateT+1e-9>=cfg.windup) bossState(S,'active');
    }
    if (b.state==='active') {
      if(b.attack==='claw'&&!b.spawned){b.spawned=true;emit(S,'clawSwing',b.x,b.y,{angle:b.aim,attackId:b.attackId,range:cfg.range,arc:cfg.arc});}
      if (b.attack==='claw' && !b.hit) {
        if (inBossCone(b,p,cfg.range,cfg.arc)) {
          b.hit=true;applyHit(S,{id:'claw-'+b.attackId,damage:cfg.damage,sourceX:b.x,sourceY:b.y,guardCost:cfg.guardCost,blockable:true,evadable:true});
          emit(S,'targetSwing',b.x,b.y,{angle:b.aim});
        }
      } else if(b.attack==='bolt'&&!b.spawned){
        if(!b.boltTarget){b.boltFacing=b.facing;b.boltTarget={x:p.x,y:p.y};}
        b.spawned=true;releaseBolt(S);
      } else if (b.attack==='breath') {
        if(!Number.isFinite(b.breathFacing))b.breathFacing=b.facing;
        const g=breathGeometry(S),desired=floorAim(p.x-g.origin.x,p.y-g.origin.y),cap=cfg.turnRate*DT*(S.t<b.chilledUntil?.88:1);
        b.aim+=clamp(angleDelta(desired,b.aim),-cap,cap);b.facing=b.aim;
        const tick=Math.floor((b.stateT+1e-8)/cfg.tick);
        if(tick>b.breathTick){b.breathTick=tick;if(inBreath(S,p))applyHit(S,{id:'breath-'+b.attackId+'-'+tick,damage:cfg.damage,type:'elemental',sourceX:g.origin.x,sourceY:g.origin.y,blockable:false,parryable:false,evadable:true});}
      } else if (b.attack==='slam'&&!b.hit&&b.stateT+1e-9>=cfg.active){
        b.hit=true;if(inSlam(b,p,cfg.radius))applyHit(S,{id:'slam-'+b.attackId,damage:cfg.damage,sourceX:b.x,sourceY:b.y,blockable:false,parryable:false,evadable:true});
        emit(S,'dragonSlam',b.x,b.y,{radius:cfg.radius,attackId:b.attackId});
        // Landing cannot trap a player who rolled under the airborne body.
        const dx=p.x-b.x,dy=p.y-b.y,d=hypot(dx,dy),reach=b.r+p.r+2;
        if(p.hp>0&&d<reach){const an=d>.01?Math.atan2(dy,dx):p.facing,nx=b.x+Math.cos(an)*reach,ny=b.y+Math.sin(an)*reach;if(isWalkable(S,nx,ny,p.r,true)){p.x=nx;p.y=ny;}}
      }
      if (b.stateT+1e-9>=cfg.active) bossState(S,'recover');
    } else if (b.state==='recover' && b.stateT+1e-9>=cfg.recovery) {b.nextAttackAt=S.t+.65;b.attack=null;bossState(S,'idle');}
  }
  function updateShots(S) {
    for (const shot of S.shots) {
      if (shot.dead) continue;
      const oldX=shot.x,oldY=shot.y;shot.x+=shot.vx*DT;shot.y+=shot.vy*DT;shot.age+=DT;shot.ttl-=DT;
      if(shot.visual==='obsidian')shot.travelled=(shot.travelled||0)+floorDistance(shot.x-oldX,shot.y-oldY);
      if (shot.owner==='player') {
        const b=S.boss;
        if (b.hp>0 && bossVulnerable(S) && segmentDistance(b.x,b.y,oldX,oldY,shot.x,shot.y)<=b.r+shot.r) {
          const applied=damageBoss(S,shot.damage,{type:shot.type});
          if (shot.type==='frost'&&applied>0) {b.chilledUntil=S.t+1.4;emit(S,'frost',b.x,b.y);}
          if(shot.visual==='obsidian')emit(S,'obsidianImpact',shot.x,shot.y,{height:projectileHeight(shot),point:projectilePoint(shot),kind:'return'});
          shot.dead=true;
        }
      } else {
        const p=S.p;
        if (p.hp>0 && projectileHeight(shot)<=100 && (shot.visual!=='obsidian'||projectileDrop(shot)>=1) && segmentDistance(p.x,p.y,oldX,oldY,shot.x,shot.y)<=p.r+shot.r) {
          const result=applyHit(S,{id:'shot-'+shot.id,damage:shot.damage,sourceX:oldX,sourceY:oldY,guardCost:shot.guardCost,blockable:true,evadable:true,projectile:true});
          if (result.reflect) {
            shot.owner='player';shot.type='reflected';shot.vx*=-1;shot.vy*=-1;shot.damage=34;shot.x=p.x+Math.cos(p.facing)*42;shot.y=p.y+Math.sin(p.facing)*42;shot.ttl=3;
            if(shot.visual==='obsidian'){const a=floorAim(S.boss.x-p.x,S.boss.y-p.y),v=BOSS_ATTACKS.bolt.speed*1.25;shot.vx=Math.cos(a)*v;shot.vy=Math.sin(a)*v*FLOOR_Y;shot.x=p.x+Math.cos(a)*42;shot.y=p.y+Math.sin(a)*42*FLOOR_Y;shot.launchHeight=44;shot.launchOffsetX=0;shot.dropDistance=0;shot.travelled=0;}
          } else {shot.dead=true;if(shot.visual==='obsidian')emit(S,'obsidianImpact',shot.x,shot.y,{height:projectileHeight(shot),point:projectilePoint(shot),kind:result.kind});}
        }
      }
      if (!shot.dead && !isWalkable(S,shot.x,shot.y,shot.r,true)){shot.dead=true;if(shot.visual==='obsidian')emit(S,'obsidianImpact',oldX,oldY,{height:projectileHeight(shot),point:projectilePoint({...shot,x:oldX,y:oldY}),kind:'stone'});}
      if (shot.ttl<=0) shot.dead=true;
    }
    S.shots=S.shots.filter(x=>!x.dead);
  }
  function updateHazards(S) {
    for (const h of S.hazards) {
      h.age+=DT;
      if (h.type==='shockwave') {
        h.radius=h.startRadius+(h.endRadius-h.startRadius)*clamp(h.age/h.duration,0,1);
        if (!h.hit && Math.abs(hypot(S.p.x-h.x,S.p.y-h.y)-h.radius)<h.width/2+S.p.r) {
          h.hit=true;applyHit(S,{id:'wave-'+h.id,damage:h.damage,sourceX:h.x,sourceY:h.y,blockable:false,evadable:true});
        }
      } else if (h.type==='fireLine' && h.owner==='player') {
        if (h.age+1e-9>=h.nextTick) {
          h.nextTick+=.25;
          if (S.boss.hp>0 && segmentDistance(S.boss.x,S.boss.y,h.x,h.y,h.x2,h.y2)<=h.width/2+S.boss.r) damageBoss(S,2,{type:'fireTick'});
        }
      }
    }
    S.hazards=S.hazards.filter(h=>h.age<h.duration);
  }
  function step(S,inp={}) {
    if (S.paused) return S;
    S.t+=DT;S.steps++;
    updatePlayer(S,inp);updateBoss(S);updateShots(S);updateHazards(S);
    while (S.events.length && S.t-S.events[0].t>6) S.events.shift();
    S.ev=S.events;
    for (const id of Object.keys(S.p.hitHistory)) if (S.t-S.p.hitHistory[id]>6) delete S.p.hitHistory[id];
    return S;
  }
  function scriptInput() {return {};}
  let cache=null;
  function at(t) {
    const loop=Math.floor(Math.max(0,t)/30),q=Math.max(0,t)-loop*30,n=Math.round(q/DT);
    if (!cache || cache.loop!==loop || cache.S.steps>n) cache={loop,S:create({enemyEnabled:false})};
    while(cache.S.steps<n) step(cache.S,{});
    return Object.assign({},cache.S,{loop,q});
  }
  function selfCheck() {
    const S=create(),errors=[];
    if (!isWalkable(S,S.p.x,S.p.y,S.p.r)) errors.push('Player spawn collides with the arena');
    if (!isWalkable(S,S.boss.x,S.boss.y,S.boss.r,true)) errors.push('Target spawn collides with the arena');
    return errors;
  }
  root.SIM={DT,L:30,VIEW,CONFIG,BOSS_ATTACKS,FLOOR_Y,bossHeight,bossVulnerable,inSlam,inBossCone,breathPose,breathGeometry,inBreath,boltGeometry,projectileHeight,projectilePoint,floorDistance,floorAim,get LEVEL(){return levelData();},
    HINT:'WASD — движение · ЛКМ — удар · ПКМ — щит / парирование · Space — перекат · Q / E / R — способности',
    create,spawn,reset,step,at,scriptInput,selfCheck,applyHit,damageBoss,inEvadeWindow,abilityCooldown,canPrimary,
    isWalkable,inPolygon,moveWithCollision,segmentDistance,hand,angleDelta};
  if (typeof module!=='undefined' && module.exports) module.exports=root.SIM;
})(typeof window!=='undefined'?window:globalThis);
