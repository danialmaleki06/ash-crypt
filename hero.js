// Restored whole-character sprite frames; simulation time owns every transition.
(function(root){
 'use strict';const H=root.HERO={},D=root.HERO_DATA,angles=Object.keys(D.directions).map(Number);
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),TAU=Math.PI*2;
 H.direction=rad=>{let best=angles[0],distance=Infinity;for(const angle of angles){const d=Math.abs(Math.atan2(Math.sin(rad-angle*Math.PI/180),Math.cos(rad-angle*Math.PI/180)));if(d<distance){distance=d;best=angle;}}return best;};
 const last=(s,kind,limit)=>{for(let i=s.events.length-1;i>=0;i--){const e=s.events[i];if(e.k===kind&&s.t-e.t>=-1e-8&&s.t-e.t<limit)return e;}return null;};
 function frameAt(clip,time){const cfg=D.timings[clip];let frame=0;for(let i=0;i<cfg.times.length;i++)if(time+1e-9>=cfg.times[i])frame=i;return frame;}
 const castClock=(age,windup)=>age<windup?age*.18/windup:.18+age-windup;
 H.pose=s=>{
  const p=s.p,t=s.t,a=p.action,speed=Math.hypot(p.vx,p.vy);let clip='attack',time=0,view=H.direction(p.facing),state='idle',frame=0;
  if(p.hp<=0||p.state==='dead')return{clip,frame,view,state:'dead',time:0};
  if(p.state==='guardBreak')return{clip:'parry',frame:4,view,state:'guardBreak',time:0};
  if(a?.kind==='roll'){clip='roll';time=Math.max(0,t-a.started);view=H.direction(a.aim);state='roll';}
  else if(a?.kind==='attack'){clip='attack';time=Math.max(0,t-a.started);view=H.direction(a.aim);state='attack';}
  else if(a?.kind==='critical'){const c=SIM.CONFIG.abilities[1],age=Math.max(0,t-a.started);clip='attack';time=age<c.windup?age*.14/c.windup:age<c.windup+c.active?.14+(age-c.windup)*.08/c.active:.22+(age-c.windup-c.active)*.22/c.recovery;view=H.direction(a.aim);state='critical';}
  else if(a?.kind==='cast'){clip='cast';time=castClock(Math.max(0,t-a.started),SIM.CONFIG.abilities[a.ability].windup);view=H.direction(a.aim);state='cast';}
  else if(p.state==='block'){
   const hit=last(s,'parry',.24);time=Math.max(0,t-p.stateStart);if(hit)time=Math.max(time,.095+t-hit.t);
   frame=Math.min(3,frameAt('parry',time));return{clip:'parry',frame,view,state:t<p.parryUntil?'parry':'block',time};
  }else if(speed>5){clip='run';time=((p.travel??Math.max(0,p.stateT)*speed)/SIM.CONFIG.speed)%D.timings.run.duration;view=H.direction(Math.atan2(p.vy,p.vx));state='run';}
  else{
   const lowered=last(s,'guardLower',.16),cast=last(s,'cast',.32);
   if(lowered)return{clip:'parry',frame:t-lowered.t<.09?4:5,view:H.direction(lowered.angle),state:'lower',time:t-lowered.t};
   if(cast){clip='cast';time=.18+t-cast.t;view=H.direction(cast.angle);state='castRecover';}
  }
  return{clip,frame:frameAt(clip,time),view,state,time};
 };
 H.castPoint=(p,aim=p.facing)=>{const pt=D.directions[H.direction(aim)].castOrigin;return[Math.round(p.x)-D.anchor[0]+pt[0],Math.round(p.y)-D.anchor[1]+pt[1]];};
 H.shieldPoint=(p,aim=p.facing)=>{const pt=D.directions[H.direction(aim)].shieldContact;return[Math.round(p.x)-D.anchor[0]+pt[0],Math.round(p.y)-D.anchor[1]+pt[1]];};
 H.projectileOffset=sh=>{if(sh.owner!=='player'||sh.type!=='frost'||!Number.isFinite(sh.aim))return[0,0];const pt=D.directions[H.direction(sh.aim)].castOrigin;return[pt[0]-D.anchor[0]-Math.cos(sh.aim)*32,pt[1]-D.anchor[1]-Math.sin(sh.aim)*32];};
 H.load=()=>Promise.all(Object.values(D.directions).flatMap(d=>[G.load(d.texture,d.url,{nearest:true}),G.load(d.mask,d.maskUrl,{nearest:true})]));
 H.init=()=>{H.program=G.program('knightSprite',`uniform sampler2D u_tex,u_mask;uniform vec4 u_rect;uniform vec2 u_size;uniform float u_cloth,u_hurt,u_dead,u_fire;uniform vec4 u_lights[6];
 vec2 at(vec2 uv){return mix(u_rect.xy,u_rect.zw,uv);}
 void main(){vec2 uv=v_uv;float q=clamp((uv.y-.20)/.65,0.,1.);
  for(int i=0;i<3;i++){float weight=texture(u_mask,at(clamp(uv,0.,1.))).r;float phase=u_t*2.61799-q*4.+v_uv.x*1.2;
   vec2 delta=vec2(sin(phase)*1.25+.35*sin(phase*1.5),.15*sin(phase+.5))*weight*q*q*u_cloth;uv=v_uv-delta/u_size;}
  if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.){o=vec4(0.);return;}vec4 c=texture(u_tex,at(uv));vec3 base=c.rgb/max(c.a,.001);
  float lum=dot(base,vec3(.299,.587,.114));base=mix(vec3(lum),base,1.10);base=clamp((base-.18)*1.20+.18,0.,1.)*1.10;vec3 rgb=base*c.a;
  for(int i=0;i<6;i++){vec2 d=(floor(v_px/2.)*2.-u_lights[i].xy)/vec2(1.,.72);float a=pow(max(0.,1.-length(d)/u_lights[i].z),2.)*u_lights[i].w;rgb+=c.rgb*vec3(1.35,.58,.12)*a;}
  rgb+=base*c.a*vec3(1.5,.43,.045)*u_fire;rgb=mix(rgb,vec3(dot(rgb,vec3(.299,.587,.114)))*.6,u_dead);rgb=mix(rgb,c.a*vec3(.65,.17,.12),u_hurt*.45);o=vec4(rgb,c.a)*(1.-u_dead*.25);}`);};
 const oldInit=H.init;H.init=()=>{oldInit();H.shadowProgram=G.program('knightShadow',`uniform sampler2D u_tex;uniform vec4 u_rect;uniform vec2 u_texel;uniform float u_alpha;
 void main(){float a=0.;for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)a+=texture(u_tex,mix(u_rect.xy,u_rect.zw,clamp(v_uv+vec2(float(i),float(j))*u_texel*.8,0.,1.))).a; a=a/9.*u_alpha;o=vec4(vec3(.010,.016,.023)*a,a);}`);};
 H.drawShadow=s=>{
  const p=s.p,pose=H.pose(s),d=D.directions[pose.view],f=d.clips[pose.clip][pose.frame];let dx=.35,dy=.22,total=1;
  const lamps=[...LEVEL.torches];if(s.boss.attack==='breath'&&s.boss.state==='active')lamps.push({x:s.boss.x,y:s.boss.y,power:1.8});
  for(const l of lamps){const vx=p.x-l.x,vy=p.y-l.y,dist=Math.hypot(vx,vy),w=l.power*140000/(dist*dist+140000);dx+=vx/Math.max(1,dist)*w;dy+=vy/Math.max(1,dist)*w*.65;total+=w;}
  dx=dx/total*.48;dy=dy/total*.48;const [cw,ch]=D.cell,[ax,ay]=D.anchor;
  G.draw(H.shadowProgram,{u_tex:G.tex(d.texture),u_rect:f.rect,u_texel:[1/cw,1/ch],u_alpha:.30},[cw,0,0,-ch*dx,ch*(.12-dy),0,p.x-ax+ay*dx,p.y+ay*(dy-.12),1]);
  LIB.shadow(p.x,p.y+1,15,4,.40);
  for(const [x,y,r]of f.contacts||[]){const weight=Math.max(.12,1-Math.abs(y-ay)/15);LIB.shadow(Math.round(p.x)-ax+x,Math.round(p.y)-ay+y+1,r,2.2,.64*weight);}
 };
 H.draw=(s,lights)=>{
  const pose=H.pose(s),d=D.directions[pose.view],f=d.clips[pose.clip][pose.frame],p=s.p;
  const b=s.boss,fire=b.hp>0&&b.attack==='breath'&&b.state==='active'&&SIM.inBreath(s,p);
  G.draw(H.program,{u_tex:G.tex(d.texture),u_mask:G.tex(d.mask),u_rect:f.rect,u_size:D.cell,u_t:s.t,u_cloth:s.qaHeroNoCloth||p.hp<=0?0:1,u_hurt:p.hurtUntil>s.t?1:0,u_dead:p.hp<=0?1:0,u_fire:fire?.6:0,u_lights:lights.u_lights},G.xf(Math.round(p.x)-D.anchor[0],Math.round(p.y)-D.anchor[1],...D.cell));
  H.last={...pose,x:p.x,y:p.y};return pose;
 };
})(typeof window!=='undefined'?window:globalThis);
