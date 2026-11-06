// Reference-aligned room, restored whole-sprite knight and procedural light/VFX.
(function(){
  'use strict';
  const S=window.SCENE={},L=LIB,W=1672,H=941;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const TAU=Math.PI*2;
  const extra={
    roomLight:`uniform sampler2D u_src; uniform vec4 u_lights[6]; uniform vec4 u_flash;uniform vec3 u_flashCol;uniform vec4 u_fire,u_fireShape;
      void main(){ vec4 c=texture(u_src,v_uv); vec3 rgb=c.rgb;
        for(int i=0;i<6;i++){vec2 d=(floor(v_px/2.)*2.-u_lights[i].xy)/vec2(1.,.72);
          float a=pow(max(0.,1.-length(d)/u_lights[i].z),2.)*u_lights[i].w;
          rgb+=c.rgb*vec3(1.35,.58,.12)*a;}
        float a=pow(max(0.,1.-length(v_px-u_flash.xy)/max(1.,u_flash.z)),2.)*u_flash.w;
        rgb+=c.rgb*u_flashCol*a;
        vec2 fp=(v_px-u_fire.xy)/vec2(1.,u_fireShape.y);float fd=length(fp),fa=abs(atan(sin(atan(fp.y,fp.x)-u_fire.z),cos(atan(fp.y,fp.x)-u_fire.z)));
        float beam=(1.-smoothstep(u_fireShape.z*.5,u_fireShape.z*.5+.16,fa))*(1.-smoothstep(u_fireShape.x*.5,u_fireShape.x,fd))*u_fire.w;
        rgb+=c.rgb*vec3(2.5,.85,.10)*beam;o=vec4(rgb,c.a);}`,
    flame:`uniform float u_seed; uniform float u_a;
      void main(){vec2 p=floor(v_uv*vec2(24.,36.))/vec2(24.,36.);
        float y=1.-p.y;float n=vnoise(vec2(p.x*8.+u_seed,p.y*5.-u_t*4.));
        float wave=.11*sin(y*11.-u_t*6.+u_seed)+.09*(n-.5);
        float width=.30*pow(max(0.,1.-y),.6);
        float flame=1.-smoothstep(width-.07,width+.035,abs(p.x-.5-wave));
        flame*=smoothstep(0.,.09,y)*(1.-smoothstep(.76+.18*n,1.,y));
        float core=1.-smoothstep(.02,.19,abs(p.x-.5-wave)+y*.17);
        vec3 col=mix(vec3(.85,.17,.025),vec3(1.,.56,.10),step(.48,flame));
        col=mix(col,vec3(1.,.88,.43),step(.55,core));float a=flame*u_a;
        o=vec4(col*a,a);}`,
    zone:`uniform vec4 u_shape; uniform vec4 u_col; uniform float u_mode;
      void main(){vec2 p=(v_uv-.5)*2.;float d=length(p);float angle=atan(p.y,p.x);
        float da=abs(atan(sin(angle-u_shape.x),cos(angle-u_shape.x)));
        float wob=.012*sin(angle*19.+u_t*2.)+.006*sin(angle*37.-u_t*3.);
        float edge=1.-smoothstep(.014,.032,abs(d-u_shape.y-wob));
        float body=(1.-smoothstep(u_shape.y-.02,u_shape.y+.01,d))*.18;
        float arc=1.-smoothstep(u_shape.z-.012,u_shape.z+.012,da);
        float a=(edge+body)*arc;
        if(u_mode>.5){float stripes=step(.64,fract((p.x*cos(u_shape.x)+p.y*sin(u_shape.x))*12.-u_t));a*=.6+.4*stripes;}
        a=clamp(a*u_col.a,0.,1.);o=vec4(u_col.rgb*a,a);}`,
    token:`uniform vec4 u_color;uniform float u_kind;uniform float u_state;
      void main(){vec2 p=floor(v_uv*vec2(38.,50.))/vec2(38.,50.);
        vec2 q=p-.5;float head=length((p-vec2(.5,.25))/vec2(.18,.15));
        float body=max(abs(q.x)-(.24-.12*(p.y-.4)),abs(p.y-.60)-.23);
        float inside=min(head-1.,body*5.);float a=1.-step(0.,inside);
        if(u_kind>.5){float outer=abs(q.x)*.82+abs(q.y)*.65; a=1.-step(.41,outer);
          float edge=step(.34,outer);float carving=step(.042,abs(q.x))*.6;
          vec3 c=u_color.rgb*(.58+.22*step(0.,q.x)+.2*carving)+edge*vec3(.18,.13,.08);
          float mark=(1.-step(.028,abs(q.x)))*step(.18,p.y)*step(p.y,.78);
          c+=mark*vec3(.55,.22,.08);o=vec4(c*a,a);return;}
        float rim=step(-.12,inside);float side=step(.48,p.x);vec3 c=u_color.rgb*(.65+.28*side);
        c=mix(c,vec3(.055,.065,.08),rim);float line=(1.-step(.025,abs(q.x)))*step(.47,p.y)*step(p.y,.77);
        c+=line*vec3(.32,.23,.12);o=vec4(c*a,a);}`,
    meter:`uniform float u_fill,u_airborne;
      void main(){float full=step(v_uv.x,u_fill);float n=hash(floor(v_px/2.));
        float bevel=.73+.23*sin(v_uv.y*3.14159)+.05*n;
        vec3 red=vec3(.63,.047,.043)*bevel;
        red+=vec3(.17,.055,.04)*(step(.18,v_uv.y)-step(.28,v_uv.y));
        red=mix(red,vec3(.30,.34,.36)*bevel,u_airborne);
        o=vec4(mix(vec3(.11,.032,.036),red,full),1.);}`,
    orb:`uniform float u_fill;uniform vec3 u_color;
      void main(){vec2 p=(v_uv-.5)*2.;float d=length(p);float a=1.-smoothstep(.97,1.,d);
        float wave=.022*sin(p.x*8.+u_t*1.7)+.012*sin(p.x*13.-u_t*2.2);
        float full=step(1.-2.*u_fill+wave,p.y);
        vec3 empty=vec3(.025,.032,.045);float shade=.24+.70*sqrt(max(0.,1.-d*d));
        vec3 col=mix(empty,u_color*shade,full);float shine=exp(-length(p-vec2(-.29,-.45))*17.);
        col+=shine*.5;col+=full*.05*sin(p.y*10.+u_t*1.5)*u_color;o=vec4(col*a,a);}`,
    ribbon:`uniform vec4 u_col;uniform float u_age;uniform float u_kind;
      void main(){vec2 p=v_uv;float n=vnoise(vec2(p.x*15.,p.y*5.-u_t*3.));
        float width=(.22+.13*n)*sin(3.14159*p.x);
        float a=1.-smoothstep(width,width+.08,abs(p.y-.5));
        a*=smoothstep(0.,.06,p.x)*(1.-smoothstep(.84,1.,p.x))*u_col.a;
        vec3 col=mix(u_col.rgb*.45,u_col.rgb,step(.43,n));
        col=mix(col,vec3(1.,.82,.36),step(.80,n)*u_kind);o=vec4(col*a,a);}`
  };
  function quad(program,x,y,w,h,uniforms={},rot=0,px=0,py=0){G.draw(L.P[program],uniforms,G.xf(x,y,w,h,rot,px,py));}
  // LIB takes RGB and opacity separately; keep scene colors in one RGBA tuple.
  function solid(x,y,w,h,c){L.solid(x,y,w,h,c.slice(0,3),0,0,0,c[3]??1);}
  function lightUniforms(t,ST){
    const vals=[];
    for(const f of LEVEL.torches) vals.push(f.x,f.y,f.r,(ST.qaNoTorch||L.NOFX)?0:f.power*(.94+.045*Math.sin(t*5.3+f.seed)+.025*Math.sin(t*11.1+f.seed*3)));
    const last=(ST.events||[]).slice().reverse().find(e=>['parry','cast','wardHit','criticalHit','dragonSlam'].includes(e.k)&&t-e.t<.22),b=ST.boss,fire=b.attack==='breath'&&b.state==='active'&&b.hp>0&&ST.p.hp>0;
    const heavy=last&&['criticalHit','dragonSlam'].includes(last.k);
    const nozzle=fire?SIM.breathGeometry(ST).origin:b;
    return {u_lights:vals,u_flash:last?[last.x,last.y,heavy?260:160,(1-(t-last.t)/.22)*(heavy?.65:.28)]:[0,0,1,0],u_flashCol:heavy?[1.5,.88,.36]:[.6,.85,1.1],u_fire:[nozzle.x,nozzle.y,b.aim,fire?.70:0],u_fireShape:[SIM.BOSS_ATTACKS.breath.range,SIM.FLOOR_Y,SIM.BOSS_ATTACKS.breath.arc,0]};
  }
  function texture(name,x,y,w,h,t,lights){
    quad('roomLight',x,y,w,h,{u_src:G.tex(name),u_t:t,...lights});
  }
  function zone(x,y,r,angle,arc,col,fill=1,mode=0,t=0){
    quad('zone',x-r,y-r,r*2,r*2,{u_t:t,u_shape:[angle,fill,arc,0],u_col:col,u_mode:mode});
  }
  function flame(f,t){
    const k=f.scale||1;
    L.glow(f.x,f.y-13*k,66*k,[1,.37,.06],.12,3.2);
    quad('flame',f.x-25*k,f.y-47*k,50*k,64*k,{u_t:t,u_seed:f.seed,u_a:.93});
    for(let i=0;i<3;i++){
      const life=(t*.52+f.seed*.17+i*.34)%1;
      const x=f.x+Math.sin(i*7+f.seed+life*5)*17*life*k,y=f.y-(35+life*73)*k;
      solid(Math.round(x/2)*2,Math.round(y/2)*2,2,2,[1,.56,.15,(1-life)*.6]);
    }
  }
  function target(ST){
    DRAGON.draw(ST,lightUniforms(ST.t,ST));if(ST.boss.state==='telegraph'){BATTLE_FX.breath(ST);BATTLE_FX.boltCharge(ST);}
  }
  function player(ST,lights){
    const p=ST.p,t=ST.t,evade=SIM.inEvadeWindow(ST);
    if(evade)L.ring(p.x,p.y,24,9,[.42,.67,.80],.34,.06);
    HERO.draw(ST,lights);
    if(p.action?.kind==='cast'){
      const origin={x:p.x+Math.cos(p.action.aim)*32,y:p.y+Math.sin(p.action.aim)*32},off=HERO.projectileOffset({owner:'player',type:'frost',aim:p.action.aim});
      L.anchor('player-cast-origin',HERO.castPoint(p,p.action.aim),[origin.x+off[0],origin.y+off[1]],1);
    }
    if(p.state==='block'){
      const col=t<p.parryUntil?[.53,.82,.93,.98]:[.75,.57,.27,.80];
      zone(p.x,p.y,53,p.facing,SIM.CONFIG.block.arc/2,col,.96,0,t);
    }
    if(p.ward>0){L.ring(p.x,p.y-40,43,62,[.38,.61,.84],.5,.025);L.glow(p.x,p.y-48,60,[.15,.35,.6],.08,4);}
    if(p.action?.kind==='attack'){
      const a=p.action,age=t-a.started;
      if(age>=.10&&age<.28)zone(p.x,p.y,SIM.CONFIG.attack.range,a.aim,SIM.CONFIG.attack.arc/2,[.90,.79,.55,(1-(age-.1)/.18)*.8],.98,0,t);
    }
  }
  function groundFX(ST){
    const b=ST.boss,t=ST.t;BATTLE_FX.ground(ST);
    for(const h of ST.hazards){
      if(h.type==='shockwave'){
        const a=1-clamp(h.age/h.duration);
        zone(h.x,h.y,h.radius+16,0,Math.PI,[.92,.67,.38,.8*a+.12],h.radius/(h.radius+16),0,t);
        L.ring(h.x,h.y,h.radius,h.radius,[.55,.31,.16],a*.17,.08);
      }
      if(h.type==='fireLine'){
        const len=Math.hypot(h.x2-h.x,h.y2-h.y),a=Math.min(1,(h.duration-h.age)*3);
        quad('ribbon',h.x,h.y-h.width*.5,len,h.width,{u_t:t,u_col:[1,.40,.075,.75*a],u_age:h.age,u_kind:1},h.angle,0,h.width*.5);
        for(let i=0;i<5;i++){
          const q=(i+.35)/5,fx=h.x+(h.x2-h.x)*q,fy=h.y+(h.y2-h.y)*q;
          quad('flame',fx-15,fy-34,30,42,{u_t:t,u_seed:i+30,u_a:.65*a});
        }
      }
    }
  }
  function shot(sh,t){
    if(sh.visual==='obsidian'){BATTLE_FX.projectile(sh,t);return;}
    const offset=HERO.projectileOffset(sh);sh={...sh,x:sh.x+offset[0],y:sh.y+offset[1]};
    const frost=sh.type==='frost',reflected=sh.type==='reflected',col=frost?[.4,.75,.96]:reflected?[.88,.83,.61]:[1,.35,.07];
    L.glow(sh.x,sh.y,30,col,.28,3.8);L.star(sh.x,sh.y,sh.r*1.25,col,.96);
    const a=Math.atan2(sh.vy,sh.vx),len=32;
    quad('ribbon',sh.x-Math.cos(a)*len,sh.y-Math.sin(a)*len-6,len,12,{u_t:t,u_col:[...col,.65],u_age:sh.age,u_kind:frost?0:1},a,0,6);
  }
  function event(e,ST){
    const age=ST.t-e.t;if(age<0||age>1.4)return;BATTLE_FX.events(e,ST);if(age>.65)return;
    const parry=e.k==='parry',guard=e.k==='block',hurt=e.k==='hurt';
    if(parry||guard){const pt=HERO.shieldPoint(e,e.angle);e={...e,x:pt[0],y:pt[1]+25};}
    if(['parry','block','meleeHit','targetHit','wardHit','guardBreak','hurt','frost'].includes(e.k)){
      const col=parry?[.62,.88,1]:guard?[.9,.70,.38]:hurt?[.70,.15,.08]:e.k==='frost'?[.40,.74,.94]:[1,.68,.26];
      const n=parry?12:7,a=1-age/.65;
      for(let i=0;i<n;i++){
        const an=i*TAU/n+e.t*.37,d=12+Math.sqrt(age)*65;
        const x=e.x+Math.cos(an)*d,y=e.y-25+Math.sin(an)*d*.65-age*33;
        solid(Math.round(x/2)*2,Math.round(y/2)*2,parry?4:3,parry?4:3,[...col,a*.85]);
      }
      if(parry)L.ring(e.x,e.y-23,30+age*90,25+age*60,col,a*.7,.045);
    }
  }
  function hud(ST){RUNE_HUD.render(ST);}
  S.NEAREST=true;
  S.programs=()=>L.init(W,H,extra,{pixel:1});
  S.hitUI=(x,y)=>RUNE_HUD.hitUI(x,y);
  S.render=(t)=>{
    const ST=S.state||SIM.at(t),GT=ST.t,lights=lightUniforms(GT,ST);
    L.beginBG([.035,.04,.05,1]);texture('arena',0,0,W,H,GT,lights);L.beginComp();
    groundFX(ST);
    const sorted=[{y:ST.p.y,draw:()=>player(ST,lights)},{y:ST.boss.y,draw:()=>target(ST)}];
    LEVEL.occluders.forEach(o=>sorted.push({y:o.baseY,draw:()=>texture(o.name,o.x,o.y,ASSETS[o.name].w,ASSETS[o.name].h,GT,lights)}));
    if(!ST.qaNoTorch&&!L.NOFX)LEVEL.torches.forEach(f=>sorted.push({y:f.y+46,draw:()=>flame(f,GT)}));
    ST.shots.forEach(sh=>sorted.push({y:sh.y,draw:()=>shot(sh,GT)}));
    if(ST.boss.attack==='breath'&&ST.boss.state==='active'){const g=SIM.breathGeometry(ST);for(let i=0;i<16;i++)sorted.push({y:g.origin.y+Math.sin(g.aim)*g.range*SIM.FLOOR_Y*(i+.5)/16,draw:()=>BATTLE_FX.breath(ST,i)});}
    ST.events.forEach(e=>{if(GT-e.t<(e.k==='dragonSlam'?1.4:.75))sorted.push({y:e.y+1,draw:()=>event(e,ST)});});
    sorted.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    // Exact-color, zero-bloom copy; avoids unused full-resolution blur passes.
    G.bind(null,[.035,.04,.05,1]);G.blend('none');const [sx,sy]=BATTLE_FX.camera(ST);
    if(sx||sy){const k=1.035;G.draw(L.P.copy,{u_src:L.T.comp},G.xf(-W*(k-1)/2+sx,-H*(k-1)/2+sy,W*k,H*k));}else G.full(L.P.copy,{u_src:L.T.comp});G.blend();
    hud(ST);
  };
  S.QA=()=>{
    const make=(edit)=>{const s=SIM.create({enemyEnabled:false});if(edit)edit(s);return s;};
    const match=make(),low=make(s=>{s.p.hp=1;s.p.mana=0;s.p.stamina=0;});
    const ward=make(s=>{s.p.ward=60;s.p.wardUntil=4;});
    const block=make(s=>{s.p.state='block';s.p.parryUntil=.16;});
    const dead=make(s=>{s.p.hp=0;s.p.state='dead';s.outcome='defeat';});
    const flameOn=Array.from({length:8},(_,i)=>make(s=>{s.t=i/60;}));
    const flameOff=flameOn.map(s=>({...s,qaNoTorch:true}));
    const heroState=(angle,clip,age)=>make(s=>{
      const rad=angle*Math.PI/180,p=s.p;s.t=age;p.facing=rad;s.qaHeroNoCloth=true;
      if(clip==='run'){p.state='move';p.vx=Math.cos(rad)*SIM.CONFIG.speed;p.vy=Math.sin(rad)*SIM.CONFIG.speed;p.travel=age*SIM.CONFIG.speed;}
      else if(clip==='parry'||clip==='block'){p.state='block';p.parryUntil=clip==='parry'?.16:-1;}
      else p.action={kind:clip,started:0,aim:rad,ability:0,duration:clip==='roll'?.56:clip==='attack'?.44:.3};
    });
    const heroStates=[];for(const angle of [0,45,90,125,180,225,270,305])for(const clip of ['run','attack','roll','block','cast'])heroStates.push(['hero-'+clip+'-'+angle,heroState(angle,clip,clip==='roll'?.23:clip==='block'?.6:.18)]);
    const runOn=Array.from({length:6},(_,i)=>heroState(305,'run',i*.12+.01));
    const runOff=runOn.map(s=>({...s,p:{...s.p,travel:0}}));
    const dragonState=(attack,state,age,view=125)=>make(s=>{s.t=4;s.boss.attack=attack;s.boss.state=state;s.boss.stateT=age;s.boss.stateStart=s.t-age;
      const a=view*Math.PI/180;s.boss.aim=s.boss.facing=Math.atan2(Math.sin(a)/SIM.FLOOR_Y,Math.cos(a));
      if(attack==='bolt'&&(state!=='telegraph'||age>=SIM.BOSS_ATTACKS.bolt.windup-SIM.BOSS_ATTACKS.bolt.lockBefore)){s.boss.boltFacing=s.boss.facing;s.boss.boltTarget={x:s.p.x,y:s.p.y};s.boss.aim=SIM.boltGeometry(s).aim;}});
    const clawState=(state,age,view=125)=>{const s=dragonState('claw',state,age,view),b=s.boss;s.p.x=b.x+Math.cos(b.aim)*190;s.p.y=b.y+Math.sin(b.aim)*190*SIM.FLOOR_Y;s.p.facing=Math.atan2(b.y-s.p.y,b.x-s.p.x);
      if(state==='active')s.events.push({k:'clawSwing',x:b.x,y:b.y,t:s.t-age,angle:b.aim,range:SIM.BOSS_ATTACKS.claw.range,arc:SIM.BOSS_ATTACKS.claw.arc});return s;};
    const boltShot=(age,view=125)=>{const s=dragonState('bolt','active',0,view),b=s.boss;b.boltFacing=b.facing;const g=SIM.boltGeometry(s),cfg=SIM.BOSS_ATTACKS.bolt;b.boltTarget={x:g.origin.x+Math.cos(b.aim)*400,y:g.origin.y+Math.sin(b.aim)*400*SIM.FLOOR_Y};
      s.shots.push({id:99,owner:'boss',type:'ashBolt',visual:'obsidian',x:g.origin.x+Math.cos(b.aim)*cfg.speed*age,y:g.origin.y+Math.sin(b.aim)*cfg.speed*age*SIM.FLOOR_Y,vx:Math.cos(b.aim)*cfg.speed,vy:Math.sin(b.aim)*cfg.speed*SIM.FLOOR_Y,r:cfg.radius,ttl:2,age,launchHeight:g.origin.y-g.muzzle[1],dropDistance:250,travelled:cfg.speed*age});b.state='recover';b.stateT=Math.min(.8,age);return s;};
    const criticalState=age=>make(s=>{s.t=4;const p=s.p,b=s.boss;p.x=b.x-180;p.y=b.y+110;p.facing=Math.atan2(b.y-p.y,b.x-p.x);
      p.action={kind:'critical',ability:1,aim:p.facing,started:s.t-age,duration:.66,committed:age>=.26};
      if(age>=.26)s.events.push({k:'criticalSwing',x:p.x,y:p.y,angle:p.facing,t:s.t-(age-.26)},{k:'criticalHit',x:b.x,y:b.y,amount:72,t:s.t-(age-.26)});});
    const slamImpact=age=>{const s=dragonState('slam','recover',age);s.events.push({k:'dragonSlam',x:s.boss.x,y:s.boss.y,t:s.t-age,radius:SIM.BOSS_ATTACKS.slam.radius});return s;};
    const bossStates=[['critical-windup',criticalState(.17)],['critical-impact',criticalState(.30)],['critical-recovery',criticalState(.52)],
      ['slam-start',dragonState('slam','telegraph',.12)],['slam-ascent',dragonState('slam','telegraph',1.10)],['slam-peak',dragonState('slam','telegraph',1.54)],
      ['slam-dive',dragonState('slam','active',.19)],['slam-impact',slamImpact(.06)],['slam-wave',slamImpact(.30)],['slam-recovery',slamImpact(.65)],
      ['breath-warning',dragonState('breath','telegraph',.8)],['breath-start',dragonState('breath','active',.07)],['breath-end',dragonState('breath','active',2.13)],
      ['claw-warning',clawState('telegraph',.7)],['claw-impact',clawState('active',.04)],['claw-recovery',clawState('recover',.35)],
      ['bolt-warning',dragonState('bolt','telegraph',.5)],['bolt-locked',dragonState('bolt','telegraph',.9)],['bolt-launch',boltShot(.01)],['bolt-flight',boltShot(.38)],
      ['bolt-shatter',make(s=>{s.t=4;s.events.push({k:'obsidianImpact',x:730,y:720,height:44,t:3.92});})],
      ['boss-defeated',make(s=>{s.boss.hp=0;s.boss.state='dead';s.outcome='victory';})]];
    for(const view of [0,45,90,125,180,225,270,305]){
      bossStates.push(['dragon-hover-'+view,dragonState(null,'idle',0,view)],['dragon-breath-'+view,dragonState('breath','active',.75,view)]);
      bossStates.push(['dragon-claw-'+view,clawState('active',.07,view)],['dragon-bolt-'+view,dragonState('bolt','telegraph',.85,view)]);
    }
    const wingOn=Array.from({length:12},(_,i)=>{const s=dragonState(null,'idle',0);s.t=4+i*.075;return s;});
    const flameCycle=Array.from({length:10},(_,i)=>{const s=dragonState('breath','active',.8+i/60);s.t=4+i/60;s.qaDragonFrame=2;return s;});
    const warningCycle=Array.from({length:8},(_,i)=>{const s=dragonState('slam','telegraph',.45+i*.08);s.t=4+i*.08;s.qaDragonFrame=0;return s;});
    const impactCycle=Array.from({length:10},(_,i)=>{const s=slamImpact(.07+i/60);s.t=4+i/60;s.events[0].t=s.t-(.07+i/60);s.qaDragonFrame=3;return s;});
    const criticalCycle=Array.from({length:8},(_,i)=>criticalState(.27+i/60));
    const clawCycle=Array.from({length:10},(_,i)=>clawState('active',.01+i/60));
    const boltCycle=Array.from({length:10},(_,i)=>boltShot(.30+i/60));
    const chargeCycle=Array.from({length:10},(_,i)=>{const s=dragonState('bolt','telegraph',.80+i/60);s.t=4+i/60;return s;});
    const uiStates=[['ui-reference',make(s=>{s.p.hp=120;s.p.mana=65;s.p.stamina=70;s.p.cooldowns[1]=2.4;s.boss.hp=1350;})],
      ['ui-hero-bottom',make(s=>{s.p.x=835;s.p.y=840;})],['ui-hero-lower-left',make(s=>{s.p.x=650;s.p.y=810;})],
      ['ui-hero-bottom-roll',make(s=>{s.t=.20;s.p.x=835;s.p.y=840;s.p.action={kind:'roll',started:0,duration:.56,aim:0,dx:1,dy:0};s.p.state='roll';})],
      ['ui-empty',make(s=>{s.p.hp=0;s.p.mana=0;s.p.stamina=0;s.p.state='dead';})],
      ['ui-cooldowns',make(s=>{s.p.cooldowns=[2.5,5,12];})],['ui-last-cooldown',make(s=>{s.p.cooldowns=[.01,.01,.01];})],
      ...[0,1,2].map(i=>['ui-hover-'+i,make(s=>{s.qaHudHover=i;})]),
      ...['noMana','noStamina','cooldown','parry','guardBreak','evade'].map(k=>['ui-feedback-'+k,make(s=>{s.p.mana=5;s.events.push({k,t:s.t,x:s.p.x,y:s.p.y});})])];
    const runeCycle=Array.from({length:12},(_,i)=>make(s=>{s.t=i/60;}));
    const liquidCycle=Array.from({length:20},(_,i)=>make(s=>{s.t=i/60;s.p.hp=120;s.p.mana=65;}));
    const cooldownCycle=Array.from({length:20},(_,i)=>make(s=>{s.t=i/60;s.p.cooldowns[1]=2.0;}));
    const uiCastCycle=Array.from({length:12},(_,i)=>make(s=>{s.t=i/60;s.p.cooldowns[1]=5;s.events.push({k:'cast',ability:1,t:0,x:s.p.x,y:s.p.y});}));
    return {states:[['match',match],['low-resources',low],['ward',ward],['block',block],['defeat',dead],...heroStates,...bossStates,...uiStates],
      cycles:{},sprites:{},box:()=>[0,0,W,H],
      anim:{torch:{on:flameOn,off:flameOff,box:[275,270,60,90],min:.02},knightRun:{on:runOn,off:runOff,box:[650,585,160,155],min:.005},
        dragonWings:{on:wingOn,off:wingOn.map(s=>({...s,qaDragonFrame:0})),box:[565,150,550,400],min:.03},
        dragonFlame:{on:flameCycle,off:flameCycle.map(s=>({...s,qaNoBreath:true})),box:[620,350,230,440],min:.02},
        slamCountdown:{on:warningCycle,off:warningCycle.map(s=>({...s,boss:{...s.boss,stateT:.45}})),box:[490,540,690,210],min:.01},
        groundImpact:{on:impactCycle,off:impactCycle.map(s=>({...s,events:[]})),box:[495,500,690,260],min:.02},
        criticalStrike:{on:criticalCycle,off:criticalCycle.map(s=>({...s,events:[]})),box:[400,365,650,380],min:.02},
        singleClaw:{on:clawCycle,off:clawCycle.map(s=>({...s,events:[]})),box:[575,385,520,315],min:.02},
        rangedShot:{on:boltCycle,off:boltCycle.map(s=>({...s,shots:[]})),box:[400,350,650,440],min:.02},
        rangedCharge:{on:chargeCycle,off:chargeCycle.map(s=>({...s,qaNoBoltCharge:true})),box:[600,230,360,260],min:.02},
        runeGlow:{on:runeCycle,off:runeCycle.map(s=>({...s,qaNoRuneGlow:true})),box:[593,821,18,26],min:.02},
        resourceSurface:{on:liquidCycle,off:liquidCycle.map(s=>({...s,qaNoUIWave:true})),box:[502,755,44,112],min:.02},
        cooldownClock:{on:cooldownCycle,off:cooldownCycle.map(s=>({...s,p:{...s.p,cooldowns:[0,s.t+2,0]}})),box:[792,757,90,108],min:.02},
        abilityRuneFeedback:{on:uiCastCycle,off:uiCastCycle.map(s=>({...s,events:[]})),box:[760,800,16,16],min:.02}},
      scope:'Whole-frame knight and dragon; critical, dive/quake, tracking flame, single claw, reflectable obsidian bolt, distinct telegraphs and shadows.'};
  };
})();
