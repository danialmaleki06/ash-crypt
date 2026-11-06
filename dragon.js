// Whole-frame pixel-art dragon; flight height, muzzle and shadow share one pose.
(function(root){
 'use strict';const R=root.DRAGON={},D=root.DRAGON_DATA;
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 R.direction=rad=>{let a=Object.keys(D.directions).map(Number),best=a[0],dist=9;for(const v of a){const q=Math.abs(Math.atan2(Math.sin(rad-v*Math.PI/180),Math.cos(rad-v*Math.PI/180)));if(q<dist){dist=q;best=v;}}return best;};
 R.pose=s=>{
  const b=s.boss,breathing=['breath','bolt'].includes(b.attack)&&['telegraph','active','recover'].includes(b.state),view=breathing?SIM.breathPose(s).view:R.direction(Math.atan2(Math.sin(b.facing)*SIM.FLOOR_Y,Math.cos(b.facing))),age=Math.max(0,b.stateT),phase=((s.t/.90)%1+1)%1;
  let clip='hover',frame=Math.min(5,Math.floor(phase*6));
  if(b.hp<=0){clip='slam';frame=4;}
  else if(b.attack==='breath'&&['telegraph','active'].includes(b.state)){clip='breath';}
  else if(b.attack==='bolt'&&['telegraph','active','recover'].includes(b.state)){clip='breath';frame=SIM.breathPose(s).frame;}
  else if(b.attack==='slam'){
   if(b.state==='telegraph')frame=Math.floor((s.t/.55)%1*6);
   if(b.state==='active'){clip='slam';frame=age<SIM.BOSS_ATTACKS.slam.active*.4?1:2;}
   if(b.state==='recover'){clip='slam';frame=age<.17?3:age<.48?4:5;}
  }else if(b.attack==='claw'){
   if(b.state==='telegraph'&&age>.34){clip='slam';frame=age<.65?0:1;}
   if(b.state==='active'){clip='slam';frame=age<.055?2:3;}
   if(b.state==='recover'){clip='slam';frame=age<.18?3:age<.52?4:5;}
  }
  if(Number.isFinite(s.qaDragonFrame))frame=s.qaDragonFrame;
  return{view,clip,frame,height:SIM.bossHeight(s)*.8,dead:b.hp<=0};
 };
 R.muzzle=s=>{const pose=R.pose(s),p=D.directions[pose.view].clips[pose.clip][pose.frame].muzzle;return[s.boss.x+(p[0]-D.anchor[0])*D.scale,s.boss.y-pose.height+(p[1]-D.anchor[1])*D.scale];};
 R.load=()=>Promise.all(Object.values(D.directions).map(d=>G.load(d.texture,d.url,{nearest:true})));
 R.init=()=>{
  R.body=G.program('dragonBody',`uniform sampler2D u_tex;uniform vec4 u_rect;uniform float u_chill,u_hit,u_dead;uniform vec4 u_lights[6];
   void main(){vec4 c=texture(u_tex,mix(u_rect.xy,u_rect.zw,v_uv));vec3 rgb=c.rgb*.95;
    for(int i=0;i<6;i++){float r=length((v_px-u_lights[i].xy)/vec2(1.,.72));float a=pow(max(0.,1.-r/u_lights[i].z),2.)*u_lights[i].w;rgb+=c.rgb*vec3(1.3,.55,.12)*a;}
    float frost=step(.53,hash(floor(v_px/3.)))*u_chill;rgb=mix(rgb,c.a*vec3(.43,.67,.74),frost*.48);rgb=mix(rgb,c.a*vec3(1.,.83,.49),u_hit*.44);
    rgb=mix(rgb,vec3(dot(rgb,vec3(.299,.587,.114)))*.45,u_dead);o=vec4(rgb,c.a);}`);
  R.shadow=G.program('dragonShadow',`uniform sampler2D u_tex;uniform vec4 u_rect;uniform vec2 u_texel;uniform float u_soft,u_alpha;
   void main(){float a=0.;for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){vec2 uv=clamp(v_uv+vec2(float(i),float(j))*u_texel*u_soft,0.,1.);a+=texture(u_tex,mix(u_rect.xy,u_rect.zw,uv)).a;}a=a/9.*u_alpha;o=vec4(vec3(.012,.017,.023)*a,a);}`);
 };
 R.drawShadow=s=>{const pose=R.pose(s),d=D.directions[pose.view],f=d.clips[pose.clip][pose.frame],h=SIM.bossHeight(s),k=D.scale,grow=1+h*.0009,ww=D.cell[0]*k*grow,hh=D.cell[1]*k*.29*grow;
  G.draw(R.shadow,{u_tex:G.tex(d.texture),u_rect:f.rect,u_texel:[1/D.cell[0],1/D.cell[1]],u_soft:1+h*.017,u_alpha:pose.dead?.30:clamp(.46-h*.00155,.12,.46)},G.xf(s.boss.x-D.anchor[0]*k*grow,s.boss.y-D.anchor[1]*k*.29*grow,ww,hh));
  LIB.shadow(s.boss.x,s.boss.y+4,72+h*.10,24+h*.035,pose.dead?.3:Math.max(.08,.35-h*.0012));
 };
 R.draw=(s,lights)=>{const pose=R.pose(s),d=D.directions[pose.view],f=d.clips[pose.clip][pose.frame],k=D.scale,t=s.t,hit=(s.events||[]).slice().reverse().find(e=>e.k==='targetHit'&&t-e.t<.11);
  G.draw(R.body,{u_tex:G.tex(d.texture),u_rect:f.rect,u_t:t,u_lights:lights.u_lights,u_chill:s.boss.chilledUntil>t?1:0,u_hit:hit?1-(t-hit.t)/.11:0,u_dead:pose.dead?1:0},G.xf(Math.round(s.boss.x-D.anchor[0]*k),Math.round(s.boss.y-pose.height-D.anchor[1]*k),D.cell[0]*k,D.cell[1]*k));R.last={...pose,muzzle:R.muzzle(s)};return R.last;
 };
})(typeof window!=='undefined'?window:globalThis);
