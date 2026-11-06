// Procedural combat marks, flame, shock, particles and camera impulse.
(function(){
 'use strict';const F=window.BATTLE_FX={},TAU=Math.PI*2,L=LIB;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const h=(n)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
 F.init=()=>{
  F.mark=G.program('runeTelegraph',`uniform vec4 u_shape,u_col;uniform vec2 u_size;
   void main(){vec2 p=(floor(v_uv*u_size/2.)*2./u_size-.5)*2.;float d=length(p),an=atan(p.y,p.x),da=abs(atan(sin(an-u_shape.x),cos(an-u_shape.x))),q=u_shape.z;
    float mask=(1.-smoothstep(.993,1.,d));if(u_shape.w>.5)mask*=1.-smoothstep(u_shape.y*.5-.006,u_shape.y*.5+.007,da);
    if(d>.999||mask<.001){o=vec4(0.);return;}float rim=1.-smoothstep(.005,.015,abs(d-.974));float inner=1.-smoothstep(.004,.011,abs(d-.886));
    float ticks=step(.79,d)*step(d,.87)*step(.79,fract(an*32./6.28318));
    float a0=fract(an/6.28318+1.25);float countdown=step(a0,q)*(1.-smoothstep(.009,.017,abs(d-.930)));
    float gx=fract(an/6.28318*12.+.5)-.5,gy=(d-.72)*6.;float glyph=1.-smoothstep(.032,.063,abs(abs(gx)*1.45+abs(gy)*.32-.24));glyph*=step(.64,d)*step(d,.80);
    float stem=(1.-smoothstep(.022,.043,abs(gx)))*step(.65,d)*step(d,.77);glyph=max(glyph,stem);
    float chevron=(1.-smoothstep(.025,.055,abs(abs(gx)*.85-(d-.56)*2.)))*step(.56,d)*step(d,.65);
    float side=u_shape.w>.5?(1.-smoothstep(.004,.016,abs(da-u_shape.y*.5)))*step(.13,d):0.;float pulse=.86+.14*sin(u_t*(5.+q*6.));
    float fill=(.10+.16*q)*smoothstep(.08,.25,d);float ink=clamp((rim+inner*.54+ticks*.78+countdown*.90+glyph*.88+chevron*.30+side)*pulse+fill,0.,.96)*mask*u_col.a;
    vec3 hot=mix(u_col.rgb,vec3(1.,.72,.36),.35);vec3 rgb=mix(u_col.rgb*.50,hot,clamp(rim+countdown+side+glyph+ticks,0.,1.));o=vec4(rgb*ink,ink);}`);
  F.slash=G.program('criticalSlash',`uniform float u_age,u_aim;void main(){vec2 p=floor(v_uv*vec2(250.))/vec2(250.)*2.-1.;float d=length(p),an=atan(p.y,p.x);
   float head=u_aim+1.14*clamp(u_age/.13,0.,1.),da=atan(sin(an-head),cos(an-head));float trail=step(da,.04)*smoothstep(-1.10,-.12,da);
   float edge=1.-smoothstep(.011,.034,abs(d-.84)),body=1.-smoothstep(.03,.11,abs(d-.79));float a=trail*(edge+body*.52)*(1.-smoothstep(.14,.27,u_age));
   vec3 col=mix(vec3(.82,.16,.08),vec3(1.,.69,.20),edge);col=mix(col,vec3(1.,.94,.73),edge*trail);o=vec4(col*a,a);}`);
  F.flame=G.program('dragonBreath',`uniform vec4 u_col;uniform float u_power;uniform vec2 u_span;void main(){vec2 p=floor(vec2(mix(u_span.x,u_span.y,v_uv.x),v_uv.y)*vec2(270.,90.))/vec2(270.,90.);
   float flow=p.x*11.-u_t*5.,n=fbm(vec2(flow,p.y*7.+u_t*.7));float width=(.075+p.x*.39)*( .83+.30*n );float wave=.035*sin(p.x*25.-u_t*13.)*p.x;
   float d=abs(p.y-.5-wave);float plume=1.-smoothstep(width*.62,width,d);plume*=smoothstep(0.,.035,p.x)*(1.-smoothstep(.86,1.,p.x));
   float tongues=smoothstep(.18,.65,n+ .22*sin(p.x*42.-u_t*21.));float core=(1.-smoothstep(width*.10,width*.55,d))*(.54+.46*smoothstep(.30,.72,n));
   vec3 col=mix(vec3(.48,.065,.012),vec3(1.,.28,.025),tongues);col=mix(col,vec3(1.,.76,.22),core);col=mix(col,vec3(1.,.94,.64),core*step(.72,n));float a=plume*(.82+.18*tongues)*u_power*u_col.a;o=vec4(col*u_col.rgb*a,a);}`);
  F.dust=G.program('impactDust',`uniform vec4 u_col;void main(){vec2 p=v_uv*2.-1.;float n=fbm(p*3.+vec2(u_t*.3,0.));float a=(1.-smoothstep(.30,.95,length(p)+n*.25))*u_col.a;o=vec4(u_col.rgb*a,a);}`);
  F.claw=G.program('dragonClawSlash',`uniform float u_age,u_aim;void main(){vec2 p=floor(v_uv*vec2(245.,150.))/vec2(245.,150.)*2.-1.;float d=length(p),an=atan(p.y,p.x),head=u_aim+.95*clamp(u_age/.12,0.,1.);
   float da=atan(sin(an-head),cos(an-head)),trail=step(da,.04)*smoothstep(-1.42,-.08,da),cuts=0.;for(int i=0;i<3;i++){float r=.54+float(i)*.18;cuts=max(cuts,1.-smoothstep(.012,.032,abs(d-r)));}
   float a=cuts*trail*(1.-smoothstep(.10,.29,u_age));vec3 c=mix(vec3(.53,.36,.18),vec3(1.,.91,.70),cuts);o=vec4(c*a,a);}`);
  F.lane=G.program('obsidianWarning',`uniform float u_progress,u_locked;uniform vec2 u_size;void main(){vec2 p=floor(v_uv*u_size/2.)*2./u_size;float y=abs(p.y-.5),edge=1.-smoothstep(.025,.060,abs(y-.37));
   float phase=fract(p.x*u_size.x/70.-u_t*.6),chev=1.-smoothstep(.04,.10,abs(phase-.5-y*.60));float fill=.10+.12*u_progress,ink=(fill+edge*.70+chev*.45)*smoothstep(0.,.025,p.x)*(1.-smoothstep(.97,1.,p.x));
   vec3 c=mix(vec3(.38,.56,.63),vec3(.85,.95,1.),u_locked*.65+edge*.25);o=vec4(c*ink,ink);}`);
  F.shard=G.program('obsidianShard',`uniform float u_returned;void main(){vec2 p=floor(v_uv*vec2(32.,18.))/vec2(32.,18.)*2.-1.;float w=max(0.,.49*(1.-abs((p.x+.12)/1.03))),a=1.-smoothstep(w-.035,w,abs(p.y));a*=step(-.95,p.x)*step(p.x,.91);
   float facet=step(p.y,-.03+p.x*.11),vein=1.-smoothstep(.012,.05,abs(p.y-p.x*.065));vec3 c=mix(vec3(.055,.075,.10),vec3(.35,.46,.50),facet);c+=vein*mix(vec3(.90,.73,.40),vec3(.42,.84,1.),u_returned);o=vec4(c*a,a);}`);
  F.wave=G.program('earthFracture',`uniform float u_age;void main(){vec2 p=floor(v_uv*vec2(250.,150.))/vec2(250.,150.)*2.-1.;float d=length(p),an=atan(p.y,p.x),q=clamp(u_age/.60,0.,1.);
   float r=.10+q*.85,edge=1.-smoothstep(.008,.027,abs(d-r-.008*sin(an*31.)));float spokes=1.-smoothstep(.014,.034,abs(sin(an*13.+sin(d*19.)*.34)));
   float crack=spokes*step(.13,d)*step(d,min(.86,r))*(.72+.28*step(.25,fract(d*11.+an)));float a=(edge*.62+crack*.82)*(1.-smoothstep(.65,1.4,u_age));
   vec3 col=mix(vec3(.035,.029,.024),vec3(.74,.50,.27),edge);o=vec4(col*a,a);}`);
  F.icon=G.program('criticalIcon',`void main(){vec2 p=v_uv*2.-1.;vec2 q=mat2(.707,-.707,.707,.707)*p;float blade=step(abs(q.x),.085)*step(-.72,q.y)*step(q.y,.26);float tip=step(abs(q.x)*2.,q.y+.86)*step(q.y,-.67);
   float guard=step(abs(q.y-.29),.055)*step(abs(q.x),.36),grip=step(abs(q.x),.07)*step(.32,q.y)*step(q.y,.70);float ray=(1.-smoothstep(.015,.04,abs(abs(p.x)-abs(p.y))))*smoothstep(.30,.52,length(p))*(1.-smoothstep(.7,.96,length(p)));
   vec3 bg=mix(vec3(.07,.035,.045),vec3(.20,.065,.045),max(0.,1.-length(p)));vec3 col=mix(bg,vec3(.84,.85,.78),clamp(blade+tip,0.,1.));col=mix(col,vec3(.69,.44,.19),clamp(guard+grip,0.,1.));col+=ray*vec3(.65,.18,.07);o=vec4(col,1.);}`);
 };
 F.telegraph=(s)=>{
  const b=s.boss,c=SIM.BOSS_ATTACKS[b.attack];if(!c||b.hp<=0||s.p.hp<=0)return;
  if(b.attack==='bolt'){
   if(b.state==='telegraph'){const g=SIM.boltGeometry(s),dx=g.end[0]-g.origin.x,dy=g.end[1]-g.origin.y,w=c.radius*2+16,wx=-Math.sin(g.aim)*w,wy=Math.cos(g.aim)*w*SIM.FLOOR_Y;
    G.draw(F.lane,{u_t:s.t,u_progress:clamp(b.stateT/c.windup),u_locked:b.boltTarget?1:0,u_size:[Math.max(8,g.range),w]},[dx,dy,0,wx,wy,0,g.origin.x-wx/2,g.origin.y-wy/2,1]);}
   return;
  }
  if(b.state==='telegraph'||(b.attack==='slam'&&b.state==='active')){
   const circle=b.attack==='slam',r=circle?c.radius:c.range,progress=b.state==='active'?1:clamp(b.stateT/c.windup),col=circle?[.96,.25,.12,.84]:b.attack==='breath'?[1.,.39,.10,.80]:[.91,.67,.27,.83];
   const origin=b.attack==='breath'?SIM.breathGeometry(s).origin:b;
   G.draw(F.mark,{u_t:s.t,u_shape:[b.aim,c.arc||TAU,progress,circle?0:1],u_col:col,u_size:[r*2,r*2*SIM.FLOOR_Y]},G.xf(origin.x-r,origin.y-r*SIM.FLOOR_Y,r*2,r*2*SIM.FLOOR_Y));
  }
  if(b.attack==='breath'&&b.state==='active'){
   const r=c.range,origin=SIM.breathGeometry(s).origin;G.draw(F.mark,{u_t:s.t,u_shape:[b.aim,c.arc,1,1],u_col:[.93,.25,.055,.44],u_size:[r*2,r*2*SIM.FLOOR_Y]},G.xf(origin.x-r,origin.y-r*SIM.FLOOR_Y,r*2,r*2*SIM.FLOOR_Y));
  }
 };
 F.ground=s=>{
  HERO.drawShadow(s);DRAGON.drawShadow(s);F.telegraph(s);
  for(const shot of s.shots)if(shot.visual==='obsidian')L.shadow(shot.x,shot.y,18,7,clamp(.38-SIM.projectileHeight(shot)*.0008,.12,.38));
  for(const e of s.events){const age=s.t-e.t;if(e.k==='dragonSlam'&&age>=0&&age<1.4){const r=e.radius*1.14;G.draw(F.wave,{u_t:s.t,u_age:age},G.xf(e.x-r,e.y-r*SIM.FLOOR_Y,r*2,r*2*SIM.FLOOR_Y));}}
 };
 F.load=()=>G.load('critical_icon','assets/critical_icon.png',{nearest:true});
 F.boltCharge=s=>{
  const b=s.boss;if(s.qaNoBoltCharge||b.attack!=='bolt'||b.state!=='telegraph'||b.hp<=0||s.p.hp<=0)return;
  const g=SIM.boltGeometry(s),[x,y]=g.muzzle,q=clamp(b.stateT/SIM.BOSS_ATTACKS.bolt.windup);
  L.glow(x,y,28+q*30,[.38,.66,.82],.12+q*.24,4);L.star(x,y,5+q*13,[.84,.91,1.],.45+q*.45);
  for(let i=0;i<7;i++){const a=i*TAU/7+s.t*2,r=(1-q)*40+10;L.solid(Math.round((x+Math.cos(a)*r)/2)*2,Math.round((y+Math.sin(a)*r*.6)/2)*2,3,4,[.66,.74,.78],0,0,0,.45+q*.4);}
  L.anchor('dragon-bolt-charge',g.muzzle,DRAGON.muzzle(s),1);
 };
 F.projectile=(shot,t)=>{
  const [x,y]=SIM.projectilePoint(shot),a=Math.atan2(shot.vy,shot.vx),returned=shot.owner==='player';
  L.glow(x,y,35,returned?[.30,.65,.92]:[.63,.72,.79],.18,4);
  for(let i=1;i<=5;i++){const px=x-Math.cos(a)*i*11,py=y-Math.sin(a)*i*11;L.solid(Math.round(px/2)*2,Math.round(py/2)*2,6-i*.6,4-i*.3,returned?[.32,.68,.91]:[.41,.47,.50],0,0,0,(6-i)*.085);}
  G.draw(F.shard,{u_t:t,u_returned:returned?1:0},G.xf(x-29,y-16,58,32,a,29,16));
 };
 F.breath=(s,segment=0)=>{
  const b=s.boss;if(s.qaNoBreath||b.hp<=0||s.p.hp<=0||b.attack!=='breath'||!['telegraph','active'].includes(b.state))return;
  const geom=SIM.breathGeometry(s),[mx,my]=geom.muzzle,cfg=SIM.BOSS_ATTACKS.breath;
  if(b.state==='telegraph'){const a=clamp(b.stateT/cfg.windup);L.glow(mx,my,20+a*18,[1,.32,.06],a*.25,4);return;}
  const width=2*cfg.range*Math.tan(cfg.arc/2)+40,count=16;
  const fade=Math.min(1,b.stateT/.12,(cfg.active-b.stateT)/.18);
  const lo=segment/count,hi=(segment+1)/count,from=geom.point(lo),to=geom.point(hi),dx=to[0]-from[0],dy=to[1]-from[1];
  const wx=-Math.sin(b.aim)*width,wy=Math.cos(b.aim)*width*SIM.FLOOR_Y;
  G.draw(F.flame,{u_t:s.t,u_col:[1,1,1,.96],u_power:fade,u_span:[lo,hi]},[dx,dy,0,wx,wy,0,from[0]-wx/2,from[1]-wy/2,1]);
  if(segment===0)L.glow(mx,my,45,[1,.42,.08],.30*fade,4);
  for(let i=0;i<22;i++){const q=(s.t*.7+i/22)%1;if(q<lo||q>=hi)continue;const p=geom.point(q),spread=(h(i+33)-.5)*q*100,x=p[0]-Math.sin(b.aim)*spread,y=p[1]+Math.cos(b.aim)*spread*SIM.FLOOR_Y;L.solid(Math.round(x/2)*2,Math.round(y/2)*2,2+q*3,2+q*3,[1,.47+.25*h(i),.12],0,0,0,(1-q)*.60*fade);}
  if(segment===0)L.anchor('dragon-breath-muzzle',[mx,my],DRAGON.muzzle(s),1);
 };
 F.events=(e,s)=>{
  const age=s.t-e.t;if(age<0)return;
  if(e.k==='clawSwing'&&age<.30){const r=e.range;G.draw(F.claw,{u_t:s.t,u_age:age,u_aim:e.angle},G.xf(e.x-r,e.y-r*SIM.FLOOR_Y-32,r*2,r*2*SIM.FLOOR_Y));}
  if(e.k==='boltRelease'&&age<.18){L.glow(e.muzzle[0],e.muzzle[1],50,[.56,.74,.88],.28*(1-age/.18),4);}
  if(e.k==='obsidianImpact'&&age<.5){const x=e.x,y=e.y-(e.height||44),fade=1-age/.5;
   if(age<.11)L.star(x,y,27*(1-age/.12),[.86,.91,.96],.85);
   for(let i=0;i<14;i++){const a=i*TAU/14,d=8+Math.sqrt(age)*85;L.solid(Math.round((x+Math.cos(a)*d)/2)*2,Math.round((y+Math.sin(a)*d*.65+age*age*100)/2)*2,3+h(i)*4,3+h(i+7)*3,i%3?[.39,.45,.48]:[.80,.84,.85],0,0,0,fade);}
  }
  if(e.k==='criticalSwing'&&age<.28){const r=250;G.draw(F.slash,{u_t:s.t,u_age:age,u_aim:e.angle},G.xf(e.x-r,e.y-45-r,r*2,r*2));}
  if(e.k==='criticalHit'&&age<.75){
   const x=e.x,y=e.y-SIM.bossHeight(s)*.8-16,a=1-age/.75;
   if(age<.15){L.star(x,y,42*(1-age/.19),[1,.88,.61],.95);L.glow(x,y,95,[1,.48,.12],.48*(1-age/.15),4);}
   for(let i=0;i<24;i++){const an=i*TAU/24+h(i+e.t)*.3,dist=18+Math.sqrt(age)*105;L.solid(Math.round((x+Math.cos(an)*dist)/2)*2,Math.round((y+Math.sin(an)*dist*.65-age*30)/2)*2,2+3*h(i),2+2*h(i+8),i%3?[1,.65,.19]:[.78,.15,.07],0,0,0,a*.9);}
   L.uiBox('critical-damage',x-90,y-75-age*35,180,35,1);L.label('critical-damage','КРИТ '+Math.round(e.amount),x,y-58-age*35,{size:22,col:'#ffe0a1',out:'#411808',al:.5,font:'Georgia',a});
  }
  if(e.k==='dragonSlam'&&age<1.35){
   const fade=1-age/1.35;
   for(let i=0;i<22;i++){const an=i*TAU/22,dist=58+age*(180+h(i)*220),x=e.x+Math.cos(an)*dist,y=e.y+Math.sin(an)*dist*SIM.FLOOR_Y-age*(95+h(i+7)*90)+age*age*170;
    const size=4+h(i+2)*8;L.solid(Math.round(x/2)*2,Math.round(y/2)*2,size,size,[.44,.37,.29],0,0,0,fade);}
   for(let i=0;i<12;i++){const an=i*TAU/12,r=75+age*260,x=e.x+Math.cos(an)*r,y=e.y+Math.sin(an)*r*SIM.FLOOR_Y-age*22,w=65+age*140;G.draw(F.dust,{u_t:s.t,u_col:[.32,.285,.25,.42*fade]},G.xf(x-w/2,y-w*.22,w,w*.44));}
  }
 };
 F.camera=s=>{if(L.NOFX)return[0,0];let amp=0,phase=0;for(const e of s.events){const age=s.t-e.t,life=e.k==='dragonSlam'?.50:e.k==='criticalHit'?.20:e.k==='criticalSwing'?.12:0;if(age>=0&&age<life){const a=(e.k==='dragonSlam'?10:e.k==='criticalHit'?5:1.5)*(1-age/life)**2;if(a>amp){amp=a;phase=age;}}}return[Math.round(Math.sin(phase*111)*amp),Math.round(Math.cos(phase*137)*amp*.65)];};
})();
