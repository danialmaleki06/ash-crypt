// Selected runic pixel HUD. Art is neutral; every value, glow and cooldown is live.
(function(root){
 'use strict';const H=root.RUNE_HUD={},D=root.RUNE_HUD_DATA||(typeof require==='function'?require('./rune-hud-data.js'):null);
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),cache={};H.data=D;H.pointer=null;
 const inside=(x,y,r)=>x>=r[0]&&y>=r[1]&&x<r[0]+r[2]&&y<r[1]+r[3];
 const atMask=(x,y,r,rows)=>inside(x,y,r)&&rows[Math.floor((y-r[1])/2)]?.[Math.floor((x-r[0])/2)]==='1';
 const through=(x,y)=>H.clip?.strength>.55&&y>=D.bottom.rect[1]&&Math.hypot((x-H.clip.box[0])/H.clip.box[2],(y-H.clip.box[1])/H.clip.box[3])<1.08;
 H.slotAt=(x,y)=>through(x,y)?-1:D.slots.findIndex(s=>atMask(x,y,s.hitRect,s.hitRows));
 H.hitUI=(x,y)=>{if(through(x,y))return false;const i=H.slotAt(x,y);if(i>=0)return{skill:i+1};return inside(x,y,D.boss.rect)||atMask(x,y,D.bottom.rect,D.panelHitRows);};
 const program=(name,code)=>G.program(name,'uniform vec4 u_clip;uniform float u_clipStrength;'+code.replace('void main()','void hudMain()')+`
  void main(){hudMain();if(v_px.y>=${D.bottom.rect[1]}.0){vec2 p=(floor(v_px/2.)*2.-u_clip.xy)/u_clip.zw;float visibility=mix(.14,1.,smoothstep(.95,1.25,length(p)));o*=1.-u_clipStrength*(1.-visibility);}}`);
 const draw=(p,u,xf)=>G.draw(p,{...u,u_clip:H.clip?.box||[0,0,64,94],u_clipStrength:H.clip?.strength||0},xf);
 H.setPointer=(x,y)=>{H.pointer=Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null;};
 H.textWidth=(text,scale=2)=>([...String(text)].length*D.font.advance+2)*scale;
 const color=c=>Array.isArray(c)?c:[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255];
 H.load=()=>Promise.all([
  ...['bottom','boss','fills','slots','boss_mask','icons'].map(n=>G.load('ui_rune_'+n,'assets/ui_rune_'+n+'.png',{nearest:true})),
  new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{H.fontImage=im;resolve();};im.onerror=()=>reject(new Error('Не загружен пиксельный шрифт'));im.src='assets/ui_rune_font.png';})
 ]);
 H.init=()=>{
  H.frame=program('runeFrame',`uniform sampler2D u_tex;void main(){o=texture(u_tex,v_uv);}`);
  H.solid=program('runeBadge',`uniform vec3 u_col;uniform float u_alpha;void main(){o=vec4(u_col*u_alpha,u_alpha);}`);
  H.fill=program('runeResources',`uniform sampler2D u_mask;uniform vec2 u_size;uniform vec4 u_hpBox,u_mpBox,u_staBox;uniform vec3 u_values;uniform float u_wave,u_hurt;
   vec3 vessel(vec2 p,float fill,vec3 col,float phase){float wave=(sin(p.x*8.+u_t*2.+phase)+sin(p.x*13.-u_t*1.2))*.012*u_wave;
    float full=step(1.-fill+wave,p.y)*step(.0001,fill);if(fill>.999)full=1.;float facet=p.x<.30?1.05:p.x>.74?.53:.79;float surface=step(abs(p.y-(1.-fill+wave)),.025)*full;
    vec3 c=mix(vec3(.025,.028,.038),col*facet,full);c+=col*(surface*.38+step(.05,p.x)*step(p.x,.12)*full*.16);return c;}
   void main(){vec2 uv=(floor(v_uv*u_size)+.5)/u_size;vec3 m=texture(u_mask,uv).rgb;float a=max(m.r,max(m.g,m.b));if(a<.1){o=vec4(0.);return;}
    vec2 px=uv*u_size,hp=(px-u_hpBox.xy)/u_hpBox.zw,mp=(px-u_mpBox.xy)/u_mpBox.zw;float sx=(px.x-u_staBox.x)/u_staBox.z;
    vec3 c=vessel(hp,u_values.x,vec3(.74,.055,.10)+u_hurt*vec3(.22,.08,.04),.0)*m.r;
    c+=vessel(mp,u_values.y,vec3(.035,.35,.76),2.)*m.g;
    c+=mix(vec3(.045,.052,.039),vec3(.51,.61,.25),step(sx,u_values.z))*m.b;o=vec4(c*a,a);}`);
  H.ability=program('runeAbility',`uniform sampler2D u_icons,u_mask;uniform vec4 u_iconRect,u_maskRect;uniform vec2 u_size;uniform vec3 u_channel,u_col;uniform float u_cool,u_dry,u_hover,u_flash,u_dead;
   void main(){float mask=dot(texture(u_mask,mix(u_maskRect.xy,u_maskRect.zw,v_uv)).rgb,u_channel);if(mask<.5){o=vec4(0.);return;}
    vec2 p=(v_uv-.5)*u_size/min(u_size.x,u_size.y)+.5;vec4 icon=texture(u_icons,mix(u_iconRect.xy,u_iconRect.zw,clamp(p,0.,1.)));
    float n=hash(floor(v_px/4.));vec3 rgb=mix(vec3(.028,.033,.044)+n*.012,icon.rgb/max(.001,icon.a),icon.a);
    float an=fract(atan(v_uv.y-.5,v_uv.x-.5)/6.283185+.25+1.);float shade=u_cool>0.?.26+.28*step(u_cool,an):1.;rgb*=shade*(1.-u_dry*.58)*(1.-u_dead*.55);
    vec2 delta=1./u_size;float nearMask=min(min(dot(texture(u_mask,mix(u_maskRect.xy,u_maskRect.zw,v_uv+vec2(delta.x,0.))).rgb,u_channel),dot(texture(u_mask,mix(u_maskRect.xy,u_maskRect.zw,v_uv-vec2(delta.x,0.))).rgb,u_channel)),min(dot(texture(u_mask,mix(u_maskRect.xy,u_maskRect.zw,v_uv+vec2(0.,delta.y))).rgb,u_channel),dot(texture(u_mask,mix(u_maskRect.xy,u_maskRect.zw,v_uv-vec2(0.,delta.y))).rgb,u_channel)));
    float edge=1.-nearMask;rgb+=u_col*edge*(.12+u_hover*.5+u_flash*.85)*(1.-u_dead);o=vec4(rgb*mask,mask);}`);
  H.meter=program('runeBossHealth',`uniform sampler2D u_mask;uniform vec4 u_box;uniform vec2 u_size;uniform float u_fill,u_air,u_hit;
   void main(){float a=texture(u_mask,v_uv).r;if(a<.1){o=vec4(0.);return;}vec2 p=(v_uv*u_size-u_box.xy)/u_box.zw;float full=step(p.x,u_fill);float bevel=p.y<.25?1.15:p.y>.75?.50:.82;
    vec3 red=mix(vec3(.64,.035,.055),vec3(.35,.40,.43),u_air)*bevel;red+=u_hit*vec3(.24,.13,.08);vec3 c=mix(vec3(.075,.025,.032),red,full);o=vec4(c*a,a);}`);
  H.rune=program('runeEngraving',`uniform vec3 u_col;uniform float u_power,u_kind;uniform vec2 u_grid;
   void main(){vec2 p=(floor(v_uv*u_grid)+.5)/u_grid;float stem=step(abs(p.x-.5),.056)*step(.25,p.y)*step(p.y,.90);float arms=step(abs(abs(p.x-.5)-(.4-p.y)*.85),.065)*step(.12,p.y)*step(p.y,.40);
    float diamond=1.-smoothstep(.035,.10,abs(abs(p.x-.5)+abs(p.y-.5)-.29));float ink=mix(max(stem,arms),diamond,u_kind);
    float a=ink*u_power*(.84+.16*sin(u_t*2.1));o=vec4(u_col*a,0.);}`);
  H.font=program('runeBitmapText',`uniform sampler2D u_tex;uniform vec3 u_col;uniform float u_alpha;void main(){vec4 p=texture(u_tex,v_uv);vec3 c=mix(vec3(.025,.020,.025),u_col,step(.5,p.r));o=vec4(c*p.a*u_alpha,p.a*u_alpha);}`);
 };
 H.label=(id,text,x,y,opt={})=>{
  text=String(text);const scale=Math.max(1,Math.round((opt.size||16)/8)),[cw,ch]=D.font.cell;let r=cache[id];
  if(!r||r.text!==text){
   const cv=document.createElement('canvas');cv.width=Math.max(4,[...text].length*D.font.advance+4);cv.height=ch;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
   let dx=0;for(const char of text){const a=D.font.glyphs[char]||D.font.glyphs['?'];g.drawImage(H.fontImage,Math.round(a[0]*D.font.size[0]),Math.round(a[1]*D.font.size[1]),cw,ch,dx,0,cw,ch);dx+=D.font.advance;}
   const name='rune_text_'+id;if(!r){r={tex:G.canvasTex(name,cv)};cache[id]=r;}else{G.gl.bindTexture(G.gl.TEXTURE_2D,r.tex.t);G.gl.pixelStorei(G.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);G.gl.texImage2D(G.gl.TEXTURE_2D,0,G.gl.RGBA,G.gl.RGBA,G.gl.UNSIGNED_BYTE,cv);r.tex.w=cv.width;r.tex.h=cv.height;}
   G.gl.bindTexture(G.gl.TEXTURE_2D,r.tex.t);G.gl.texParameteri(G.gl.TEXTURE_2D,G.gl.TEXTURE_MIN_FILTER,G.gl.NEAREST);G.gl.texParameteri(G.gl.TEXTURE_2D,G.gl.TEXTURE_MAG_FILTER,G.gl.NEAREST);r.text=text;
  }
  const width=[...text].length*D.font.advance*scale,left=Math.round((x-width*(opt.al||0))/scale)*scale,top=Math.round((y-ch*scale/2)/scale)*scale,alpha=opt.a??1;
  draw(H.font,{u_tex:r.tex,u_col:color(opt.col||'#e6d5b5'),u_alpha:alpha},G.xf(left-scale*2,top,r.tex.w*scale,ch*scale));
  if(alpha>.05)LIB.uiText(id,text,left-scale,Math.round(y-5*scale),width+2*scale,10*scale);return width;
 };
 const solid=(x,y,w,h,col,a=1)=>draw(H.solid,{u_col:col,u_alpha:a},G.xf(x,y,w,h));
 const badge=(x,y,w,h)=>{solid(x-w/2-2,y-h/2-2,w+4,h+4,[.36,.28,.17]);solid(x-w/2,y-h/2,w,h,[.045,.044,.047]);};
 H.render=s=>{
  const p=s.p,b=s.boss,t=s.t,low=p.hp/p.maxHp<.25,dead=p.hp<=0||b.hp<=0,hit=s.events.slice().reverse().find(e=>e.k==='targetHit'&&t-e.t<.13),hurt=s.events.slice().reverse().find(e=>e.k==='hurt'&&t-e.t<.25);
  H.clip={box:[p.x,p.y-56,64,94],strength:clamp((p.y-720)/70)};
  const bottom=D.bottom.rect,top=D.boss.rect,values=[clamp(p.hp/p.maxHp),clamp(p.mana/p.maxMana),clamp(p.stamina/p.maxStamina)];
  draw(H.fill,{u_mask:G.tex('ui_rune_fills'),u_size:D.bottom.size,u_hpBox:D.fills[0],u_mpBox:D.fills[1],u_staBox:D.fills[2],u_values:values,u_t:t,u_wave:s.qaNoUIWave?0:1,u_hurt:hurt?1-(t-hurt.t)/.25:0},G.xf(...bottom));
  const hover=Number.isFinite(s.qaHudHover)?s.qaHudHover:H.pointer?H.slotAt(...H.pointer):-1;
  if(H.pointer&&typeof document!=='undefined'){const canvas=document.getElementById('c'),cursor=hover>=0?'pointer':'default';if(canvas&&canvas.style.cursor!==cursor)canvas.style.cursor=cursor;}
  D.slots.forEach((slot,i)=>{const a=SIM.CONFIG.abilities[i],cd=SIM.abilityCooldown(s,i),dry=p.mana<a.cost,cast=s.events.slice().reverse().find(e=>e.k==='cast'&&e.ability===i&&t-e.t<.35),flash=cast?1-(t-cast.t)/.35:0,col=i===0?[.32,.68,.86]:i===1?[.86,.50,.21]:[.87,.67,.30];
   draw(H.ability,{u_icons:G.tex('ui_rune_icons'),u_mask:G.tex('ui_rune_slots'),u_iconRect:slot.iconRect,u_maskRect:slot.maskRect,u_size:slot.rect.slice(2),u_channel:[i===0?1:0,i===1?1:0,i===2?1:0],u_col:col,u_cool:clamp(cd/a.cooldown),u_dry:dry?1:0,u_hover:hover===i?1:0,u_flash:flash,u_dead:dead?1:0},G.xf(...slot.rect));
  });
  draw(H.frame,{u_tex:G.tex('ui_rune_bottom')},G.xf(...bottom));
  const runePos=[[456,836],[602,834],[1072,834],[1216,834]],runeCol=[[.65,.11,.13],[.30,.63,.81],[.78,.57,.25],[.10,.40,.78]];
  const ready=i=>!dead&&SIM.abilityCooldown(s,i)<=0&&p.mana>=SIM.CONFIG.abilities[i].cost;
  const flash=i=>{const e=s.events.slice().reverse().find(e=>e.k==='cast'&&e.ability===i&&t-e.t<.35);return e?1-(t-e.t)/.35:0;};
  runePos.forEach(([x,y],i)=>{const power=s.qaNoRuneGlow?0:dead?.06:i===0?.25+(low?.25:0)+(hurt?.35:0):i===3?.12+values[1]*.20:(ready(i===1?0:2)?.50:.06)+flash(i===1?0:2)*.65;
   draw(H.rune,{u_t:t,u_col:runeCol[i],u_power:power,u_kind:0,u_grid:[9,13]},G.xf(x-9,y-13,18,26));});
  for(const x of[768,906])draw(H.rune,{u_t:t,u_col:[.85,.49,.22],u_power:s.qaNoRuneGlow?0:(ready(1)?.40:.05)+flash(1)*.9,u_kind:1,u_grid:[8,8]},G.xf(x-8,800,16,16));
  D.slots.forEach((slot,i)=>{const a=SIM.CONFIG.abilities[i],cd=SIM.abilityCooldown(s,i),dry=p.mana<a.cost;
   badge(...slot.key,26,22);badge(...slot.cost,36,20);
   LIB.uiBox('ability-'+i,slot.hitRect[0],slot.hitRect[1],slot.hitRect[2],slot.hitRect[3],2);
   H.label('ability-key-'+i,['Q','E','R'][i],slot.key[0],slot.key[1],{size:16,al:.5,col:'#e7d1a6'});
   H.label('ability-cost-'+i,String(a.cost),slot.cost[0],slot.cost[1],{size:16,al:.5,col:dry?'#bd6b62':'#a9bdd0'});
   if(cd>0)H.label('cooldown-'+i,Math.max(.1,Math.ceil((cd-1e-9)*10)/10).toFixed(1),slot.cooldown[0],slot.cooldown[1],{size:16,al:.5,col:'#f4dfbc'});
  });
  D.plates.forEach((rect,i)=>{const [x,y,w,h]=rect;LIB.uiBox(['health','mana','stamina'][i],x,y,w,h,2);const text=i===0?`${Math.ceil(p.hp)}/${p.maxHp}`:i===1?`${Math.floor(p.mana)}/${p.maxMana}`:Math.floor(values[2]*100)+'%';
   H.label(['hp','mana','stamina-value'][i],text,x+w/2,y+h/2,{size:16,al:.5,col:i===0&&low?'#e49789':'#e4d3b3'});});
  draw(H.meter,{u_mask:G.tex('ui_rune_boss_mask'),u_box:D.boss.fill,u_size:D.boss.size,u_fill:clamp(b.hp/b.maxHp),u_air:b.hp>0&&!SIM.bossVulnerable(s)?1:0,u_hit:hit?1-(t-hit.t)/.13:0},G.xf(...top));
  draw(H.frame,{u_tex:G.tex('ui_rune_boss')},G.xf(...top));
  const title=D.boss.title;LIB.uiBox('target-name',...title,3);H.label('target-name','ПЕПЕЛЬНЫЙ ВЕНЕЦ',title[0]+title[2]/2,title[1]+title[3]/2,{size:16,al:.5});
  if(b.hp>0&&['telegraph','active'].includes(b.state)){
   const text=b.attack==='slam'?(b.state==='telegraph'?'ВЫЙДИ ИЗ ПОЛЯ':'ОБРУШЕНИЕ'):b.attack==='breath'?'ОГНЕННОЕ ДЫХАНИЕ':b.attack==='bolt'?'ОБСИДИАНОВЫЙ ВЫСТРЕЛ':b.attack==='claw'?'ОДИНОЧНЫЙ УДАР ЛАПОЙ':null;
   if(text){LIB.uiBox('boss-action',560,106,552,34,3);H.label('boss-action',text,836,122,{size:16,al:.5,col:b.attack==='bolt'?'#a8c4ce':b.attack==='claw'?'#ddc08d':'#d6a184'});}
  }
  const recent=s.events.slice().reverse().find(e=>['parry','guardBreak','noMana','noStamina','cooldown','evade'].includes(e.k)&&t-e.t<.9);
  if(recent){const words={parry:'ПАРИРОВАНИЕ',guardBreak:'ЗАЩИТА ПРОБИТА',noMana:'НЕДОСТАТОЧНО МАНЫ',noStamina:'НЕТ ВЫНОСЛИВОСТИ',cooldown:'ПЕРЕЗАРЯДКА',evade:'УКЛОНЕНИЕ'};
   LIB.uiBox('feedback',480,147,712,38,3);H.label('feedback',words[recent.k],836,165,{size:16,al:.5,col:recent.k==='parry'?'#accbd4':'#c7ab87'});}
  H.last={values,hover,clip:H.clip,slots:D.slots.map((slot,i)=>({rect:slot.rect,cd:SIM.abilityCooldown(s,i),dry:p.mana<SIM.CONFIG.abilities[i].cost})),airborne:b.hp>0&&!SIM.bossVulnerable(s)};
 };
 if(typeof module!=='undefined')module.exports=H;
})(typeof window!=='undefined'?window:globalThis);
