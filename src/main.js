import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Pass }           from 'three/addons/postprocessing/Pass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader }     from 'three/addons/shaders/CopyShader.js';
import { SPELLS, ROT, ENERGY, GUIDE, FINGER_TO_SPELL, OVERLAY_SPELLS, SPELL_KEYS, FRONT_SPELLS } from './spells.js';
import { FINGERTIPS, handSize, countExtendedFingers, heartGestureMetrics, isIndexWand, StableGestureTrigger } from './gestures.js';
import { AudioManager } from './audio.js';
import { Efk } from './effekseer.js';
import { StudioEffects } from './studio-effects.js';
import { Segmentation } from './segmentation.js';
import { mountPixelStage } from './pixel-stage.js';
import { Lotus3DEngine } from '../lessons/weather-lab/lotus-3d.js';

const $=id=>document.getElementById(id);
// Saga theme bridge: the teaching platform's picker (localStorage 'magicdust.theme', see lessons/theme.js) recolors the ambient dust + neutral HUD here too; BLOOM also renders motes as hard pixel squares.
const THEME=localStorage.getItem('magicdust.theme')==='bloom'?{amb:[1,.6,.84],c:'#f4c85a',pixel:true}:{amb:[.5,.72,1],c:'#78b2a5',pixel:false};
const AMB_R=THEME.amb[0],AMB_G=THEME.amb[1],AMB_B=THEME.amb[2];
SPELLS.neutral.color=THEME.c; // neutral/idle tint follows the theme; per-spell colors stay their own
const snEl=$('sname'),efEl=$('efill');
const flashEl=$('flash'),topbarEl=$('topbar'),pdotEl=$('pdot'),ptxtEl=$('ptxt');
const glowEl=$('screenglow'),dotEl=$('dot'),muteEl=$('mute'),guideEl=$('guide');
const camdarkEl=$('camdark'),vigEl=$('vig');
const testCastBtn=$('testcastbtn'),voiceStatEl=$('voicestat');

document.addEventListener('mousemove',e=>{dotEl.style.left=e.clientX+'px';dotEl.style.top=e.clientY+'px';});

// ── Gesture guide panel ────────────────────────────────────────────────────────
// Sixteen spells at one card each ran the full height of the screen and buried
// the camera. Each row is now a single compact line — hotkey badge + short
// name, two per row — and only the ACTIVE spell expands to explain itself.
// 'g' collapses the whole panel for a clean stage.
const guideItems={};
for(const g of GUIDE){
  const el=document.createElement('div');
  el.className='gi';
  if(g.hotkey){const k=document.createElement('b');k.className='gk';k.textContent=g.hotkey;el.appendChild(k);}
  const name=document.createElement('span');name.className='gn';name.textContent=g.name||g.label;
  const desc=document.createElement('span');desc.className='gd';desc.textContent=g.desc;
  el.append(name,desc);
  el.title=`${g.label} — ${g.desc}`;
  guideEl.appendChild(el);
  guideItems[g.key]=el;
}
function setActiveGuide(key){
  for(const[k,el]of Object.entries(guideItems))el.classList.toggle('active',k===key);
}

// ── Perf tier ─────────────────────────────────────────────────────────────────
const mob=(/Mobi|Android|iPhone|iPad/i).test(navigator.userAgent);
const cores=navigator.hardwareConcurrency||2;
const tier=mob?0:cores<=2?0:cores<=4?1:2;
const COUNT=[4500,11000,19000][tier];
const PR=[1,1.2,Math.min(devicePixelRatio,2)][tier];
const LERP=[.11,.085,.068][tier];
const MCX=[0,1,1][tier];
const CAM_W=[320,480,640][tier];
const CAM_H=[240,360,480][tier];
$('perf').textContent=['LOW','MID','HIGH'][tier];

// ── Loading bar ───────────────────────────────────────────────────────────────
let ldv=0;const ldEl=$('ldf'),ldT=setInterval(()=>{ldv=Math.min(ldv+Math.random()*13,90);ldEl.style.width=ldv+'%';},150);
setTimeout(()=>{clearInterval(ldT);ldEl.style.width='100%';setTimeout(()=>{const l=$('loading');l.style.opacity='0';setTimeout(()=>l.remove(),1100);},350);},1600);

// ── Audio ─────────────────────────────────────────────────────────────────────
const audio=new AudioManager();
muteEl.addEventListener('click',()=>{const on=audio.toggleMute();muteEl.textContent='SOUND: '+(on?'ON':'OFF');});
document.body.addEventListener('pointerdown',()=>audio.unlock(),{once:true});

// ── Three.js ──────────────────────────────────────────────────────────────────
const scene=new THREE.Scene();
const cam3=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,1000);
cam3.position.z=55;
const renderer=new THREE.WebGLRenderer({antialias:tier>=2,alpha:true,preserveDrawingBuffer:true,powerPreference:tier===0?'low-power':'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(PR);renderer.domElement.id='cv';
document.body.appendChild(renderer.domElement);
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,cam3));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.4,.4,.85);
composer.addPass(bloom);

// Effekseer draws AFTER bloom: its effects already self-glow, so bloom-ing them
// too blows them out to full-screen white. It composites in place into the
// post-bloom buffer (needsSwap=false); a final CopyShader pass blits to screen.
const efk=new Efk();let efkReady=false;
efk.init(renderer.getContext(),'./src/vendor/effekseer/effekseer.wasm',()=>{efkReady=true;});
class EffekseerPass extends Pass{
  constructor(){super();this.needsSwap=false;}
  render(renderer,writeBuffer,readBuffer){efk.drawPass(renderer,this.renderToScreen?null:readBuffer,cam3);}
}
composer.addPass(new EffekseerPass());
composer.addPass(new ShaderPass(CopyShader));

// ── Effekseer is currently DORMANT: both charge and cast are carried by the dust
// field, so nothing is played here (the sample effects looked like flat vector
// shapes). The runtime/pass stay wired up above and window.magicDust.playEfk still
// works, so a good flame .efk dropped in assets/efk/ (see its README) can be
// re-attached to the cast if desired.

// A soft radial-gradient sprite so particles render as glowing orbs instead of
// flat squares — this is what makes additive particle VFX read as "magical".
function makeGlowSprite(){
  const s=64,c=document.createElement('canvas');c.width=c.height=s;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'#fffdf5');
  g.addColorStop(.35,'rgba(255,253,245,.75)');
  g.addColorStop(1,'rgba(255,253,245,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}
const glowSprite=makeGlowSprite();

// ── Particle buffers ──────────────────────────────────────────────────────────
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(COUNT*3),col=new Float32Array(COUNT*3),sz=new Float32Array(COUNT);
const tPos=new Float32Array(COUNT*3),tCol=new Float32Array(COUNT*3),tSz=new Float32Array(COUNT);
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
geo.setAttribute('color',new THREE.BufferAttribute(col,3));
geo.setAttribute('size',new THREE.BufferAttribute(sz,1));
const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:.5,map:glowSprite,vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,sizeAttenuation:true}));
scene.add(pts);
let fingerWorld=null; // hand "attract" point in world units at z=0 (index tip, or
                      // midpoint between index+middle for 2 fingers), null if no hand

function hexToRgb01(hex){
  const n=parseInt(hex.slice(1),16);
  return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}

// ── Magic dust ("motes") ────────────────────────────────────────────────────────
// A pooled glowing-dust field. Motes are DEAD by default (screen empty); they are
// summoned, live, then die — never auto-respawn. Four behaviours, blended by state:
//  • SUMMON — while an open palm (true 5-finger gesture) is shown, motes are
//             conjured from the palm and drift outward; the cloud grows while held
//             (up to the mote budget) and follows the hand.
//  • FLOAT  — live motes drift, glow, twinkle and fade out at their lifespan, then
//             go dead (invisible). Stop summoning → the cloud thins and empties.
//  • CHARGE — switch to 1/2 fingers and the vortex grabs the live cloud in place and
//             whirlpools it into the core, tightening/brightening with charge.
//  • BURST  — on cast the live dust is flung outward, coasts, fades and dies; the
//             screen empties, so you must re-summon.
// A tiny additive point ShaderMaterial gives each mote its own random size (plain
// PointsMaterial can't); brightness carries the glow/fade, size grows on charge/burst.
const TAU=Math.PI*2,MOTES=[1600,2800,4200][tier]; // pool budget per perf tier — caps how dense the summoned cloud can get
const mGeo=new THREE.BufferGeometry();
const mPos=new Float32Array(MOTES*3),mCol=new Float32Array(MOTES*3),mSize=new Float32Array(MOTES);
const mVel=new Float32Array(MOTES*2),mDir=new Float32Array(MOTES),mRad=new Float32Array(MOTES),mPhase=new Float32Array(MOTES),mBri=new Float32Array(MOTES),mLife=new Float32Array(MOTES),mMax=new Float32Array(MOTES),mSpin=new Float32Array(MOTES),mBase=new Float32Array(MOTES);
for(let i=0;i<MOTES;i++){
  mPhase[i]=Math.random()*TAU;mBri[i]=.7+Math.random()*.6;mBase[i]=mSize[i]=0.55+Math.random()*1.55;
  mMax[i]=1;mLife[i]=1; // start DEAD (life≥max) — the screen is empty until the open-palm gesture summons dust
}
mGeo.setAttribute('position',new THREE.BufferAttribute(mPos,3));
mGeo.setAttribute('color',new THREE.BufferAttribute(mCol,3));
mGeo.setAttribute('size',new THREE.BufferAttribute(mSize,1));
const MOTE_PX=165*PR;
const motesMat=new THREE.ShaderMaterial({
  uniforms:{uScale:{value:MOTE_PX}},
  vertexShader:`attribute float size;attribute vec3 color;varying vec3 vC;uniform float uScale;
    void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*uScale/(-mv.z);gl_Position=projectionMatrix*mv;}`,
  // Procedural round glow dot (no texture): soft quadratic falloff to a feathered
  // edge, so motes read as soft circles, not squares/discs. BLOOM's fx-pixel
  // theme swaps in a hard-edged square (bright core, dimmer rim) instead.
  fragmentShader:THEME.pixel
    ?`varying vec3 vC;
    void main(){vec2 p=abs(gl_PointCoord-vec2(0.5));if(max(p.x,p.y)>0.5)discard;float a=max(p.x,p.y)<0.27?0.95:0.5;gl_FragColor=vec4(vC,1.0)*a;}`
    :`varying vec3 vC;
    void main(){float d=length(gl_PointCoord-vec2(0.5));if(d>0.5)discard;float a=1.0-2.0*d;a*=a;gl_FragColor=vec4(vC,1.0)*a;}`,
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
});
const motes=new THREE.Points(mGeo,motesMat);
scene.add(motes);
const TRAIL_MAX=360;
const trailPositions=new Float32Array(TRAIL_MAX*2*3),trailColors=new Float32Array(TRAIL_MAX*2*3);
const trailAlpha=new Float32Array(TRAIL_MAX*2),trailSide=new Float32Array(TRAIL_MAX*2);
const trailIndices=new Uint16Array((TRAIL_MAX-1)*6);
for(let i=0;i<TRAIL_MAX-1;i++){
  const v=i*2,o=i*6;
  trailIndices[o]=v;trailIndices[o+1]=v+1;trailIndices[o+2]=v+2;
  trailIndices[o+3]=v+1;trailIndices[o+4]=v+3;trailIndices[o+5]=v+2;
}
const trailGeo=new THREE.BufferGeometry();
trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));
trailGeo.setAttribute('color',new THREE.BufferAttribute(trailColors,3));
trailGeo.setAttribute('trailAlpha',new THREE.BufferAttribute(trailAlpha,1));
trailGeo.setAttribute('trailSide',new THREE.BufferAttribute(trailSide,1));
trailGeo.setIndex(new THREE.BufferAttribute(trailIndices,1));trailGeo.setDrawRange(0,0);
const trailMat=new THREE.ShaderMaterial({
  uniforms:{uOpacity:{value:.9}},
  vertexShader:`attribute vec3 color;attribute float trailAlpha;attribute float trailSide;
    varying vec3 vColor;varying float vAlpha;varying float vSide;
    void main(){vColor=color;vAlpha=trailAlpha;vSide=trailSide;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec3 vColor;varying float vAlpha;varying float vSide;uniform float uOpacity;
    void main(){float edge=1.0-smoothstep(.2,1.0,abs(vSide));float core=1.0-smoothstep(0.0,.34,abs(vSide));
    float alpha=(edge*.42+core*.58)*vAlpha*uOpacity;if(alpha<.01)discard;gl_FragColor=vec4(vColor*(1.0+core*.55),alpha);}`,
  transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
});
const magicRibbon=new THREE.Mesh(trailGeo,trailMat);scene.add(magicRibbon);
const TRAIL_LIFE=5200,trailPoints=[];let trailLastAt=0,trailFading=false;
function fadeMagicRibbon(){trailFading=true;}
function updateMagicRibbon(dt,now,tip,summoning,collapse=0){
  if(summoning&&tip){
    trailFading=false;trailMat.uniforms.uOpacity.value=Math.min(.94,trailMat.uniforms.uOpacity.value+dt*2.4);
    const last=trailPoints[trailPoints.length-1];
    if(!last||Math.hypot(tip.x-last.x,tip.y-last.y)>.7||now-trailLastAt>55){
      trailPoints.push({x:tip.x,y:tip.y,z:(Math.random()-.5)*.45,born:now});
      if(trailPoints.length>TRAIL_MAX)trailPoints.shift();
      trailLastAt=now;
    }
  }else if(trailFading){
    trailMat.uniforms.uOpacity.value=Math.max(0,trailMat.uniforms.uOpacity.value-dt*.72);
    if(trailMat.uniforms.uOpacity.value<=.01){trailPoints.length=0;trailFading=false;}
  }
  while(trailPoints.length&&now-trailPoints[0].born>TRAIL_LIFE)trailPoints.shift();
  const count=trailPoints.length;
  for(let i=0;i<count;i++){
    const point=trailPoints[i],prev=trailPoints[Math.max(0,i-1)],next=trailPoints[Math.min(count-1,i+1)];
    const dx=next.x-prev.x,dy=next.y-prev.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
    const t=count<=1?1:i/(count-1),pull=collapse*collapse*(3-2*collapse);
    const smoothX=i===count-1?point.x:(prev.x+point.x*2+next.x)*.25;
    const smoothY=i===count-1?point.y:(prev.y+point.y*2+next.y)*.25;
    const x=smoothX+(tip?smoothX*-1+tip.x:0)*pull,y=smoothY+(tip?smoothY*-1+tip.y:0)*pull,width=(.16+.58*t)*(1-pull*.72);
    for(let side=0;side<2;side++){
      const sign=side?1:-1,vertex=i*2+side,o=vertex*3,edge=side?.88:1;
      trailPositions[o]=x+nx*width*sign;trailPositions[o+1]=y+ny*width*sign;trailPositions[o+2]=point.z*(1-pull);
      const wave=.5+.5*Math.sin(t*Math.PI*2+now*.0025);
      trailColors[o]=(.16+.68*wave+.28*t)*edge;
      trailColors[o+1]=(.58+.64*t)*edge;
      trailColors[o+2]=(1.15+.52*t+.22*wave)*edge;
      const life=Math.max(0,1-(now-point.born)/TRAIL_LIFE);
      trailAlpha[vertex]=Math.min(1,t*4)*Math.min(1,life*3.2);
      trailSide[vertex]=sign;
    }
  }
  trailGeo.setDrawRange(0,Math.max(0,count-1)*6);
  trailGeo.attributes.position.needsUpdate=true;trailGeo.attributes.color.needsUpdate=true;
  trailGeo.attributes.trailAlpha.needsUpdate=true;trailGeo.attributes.trailSide.needsUpdate=true;
}
let motesFocus=0,motesBurst=0,chargeCaptured=false;
let emitAccum=0,emitPtr=0,summonRamp=0; // open-palm summon emitter: fractional-mote accumulator + round-robin pointer; summonRamp 0→1 powers up birth size/speed the longer the palm is held
const GRAV=7;
const EMIT_RATE=3400,PALM_JIT=5.5,MOTE_LIFE=3.2,MOTE_LIFE_SPAN=3.8,MIN_BURST=620; // dense continuous fingertip summon; long life lets drawn dust linger until the next spell consumes it
const EMIT_SPEED_MIN=44,EMIT_SPEED_MAX=108,BIRTH_SIZE_MIN=1.8,BIRTH_SIZE_MAX=3.6,SUMMON_RAMP_SEC=2.2; // hold-to-power-up: as summonRamp climbs 0→1 over SUMMON_RAMP_SEC, conjured motes' outward birth speed grows toward MAX (travel further) and their birth-size flash toward MAX
const BIRTH_SEC=.4,BIRTH_GLOW=.9,DEATH_FRAC=.3; // conjure flash: a freshly summoned mote bursts out big (birth-size, now ramped) and bright (×1+BIRTH_GLOW), settling to normal over BIRTH_SEC; DEATH_FRAC = tail fraction of life spent fading out
// Whirlpool params. VORTEX_AT splits charge into GATHER (below) and VORTEX
// (above). Radius collapse is deterministic (guarantees arrival at the core by
// full charge); the SPIN is integrated with a 1+SWIRL_K/r differential so inner
// motes whip round far faster than outer ones — that shear is what makes a
// vortex read as a funnel instead of a rigid, concentric rotating spiral.
const VORTEX_AT=.4,OMEGA=6.2,SWIRL_K=150,RMIN=5.5; // vortex split, base spin, 1/r shear strength, core-radius clamp. The field that spins up IS the dust already on screen (seeded from its live positions), so the differential shear alone winds it into spiral arms — no injected ring.
const SPIN_JIT=.5,SPIN_FLOOR=.12; // SPIN_JIT: ±25% per-mote angular-speed spread → breaks concentric rings into a churning vortex. SPIN_FLOOR: overall spin starts near-still and accelerates (c²) so gather is a slow drift, not a buzzing jitter
const BACK=1.3,GATHER_SWELL=2,CORE_TIGHTEN=.6; // BACK: vortex collapse eases with anticipation (breathe out → snap into core). GATHER_SWELL: motes swell *smoothly* from baseline to ~3× (1+2) across the gather via smoothstep — no instant pop; CORE_TIGHTEN cinches them back as they cram the core

// Conjure a mote at the palm, drifting outward with a full lifetime ahead — the
// source of summoned dust. Reuses a dead pool slot (see the emitter in updateMotes).
function emitMote(i,cx,cy){
  const a=Math.random()*TAU,rr=Math.random()*PALM_JIT,spBase=EMIT_SPEED_MIN+(EMIT_SPEED_MAX-EMIT_SPEED_MIN)*summonRamp,sp=spBase*(.75+.25*Math.random()); // faster (travels further) the longer the palm has been held
  mPos[i*3]=cx+Math.cos(a)*rr;mPos[i*3+1]=cy+Math.sin(a)*rr;mPos[i*3+2]=(Math.random()-.5)*14;
  mVel[i*2]=Math.cos(a)*sp+(Math.random()-.5)*6;mVel[i*2+1]=Math.sin(a)*sp+(Math.random()-.5)*6;
  mLife[i]=0;mMax[i]=MOTE_LIFE+Math.random()*MOTE_LIFE_SPAN;mBri[i]=.7+Math.random()*.6;mBase[i]=mSize[i]=0.55+Math.random()*1.55;mPhase[i]=Math.random()*TAU;
}

// Fling the LIVE summoned dust radially outward from the cast point (dead motes
// stay out), then top up to MIN_BURST fresh embers at the point so a cast always
// reads as a burst even if little/no dust was summoned (e.g. test forceCast).
function burstMotes(cx,cy){
  motesBurst=1;let alive=0;
  for(let i=0;i<MOTES;i++){
    if(mLife[i]>=mMax[i])continue;                    // dead → not part of the scatter
    alive++;
    const dx=mPos[i*3]-cx,dy=mPos[i*3+1]-cy,d=Math.hypot(dx,dy);
    const a=(d<1?Math.random()*TAU:Math.atan2(dy,dx))+(Math.random()-.5)*1.4,sp=25+Math.random()*100;
    mVel[i*2]=Math.cos(a)*sp;mVel[i*2+1]=Math.sin(a)*sp;
    mBase[i]=mSize[i]=0.55+Math.random()*1.55;mMax[i]=1.1+Math.random()*2.1;mLife[i]=Math.random()*mMax[i]; // short life → embers die after the cast
  }
  for(let i=0;i<MOTES&&alive<MIN_BURST;i++){
    if(mLife[i]<mMax[i])continue;alive++;             // revive a dead slot at the cast point
    const a=Math.random()*TAU,sp=25+Math.random()*100;
    mPos[i*3]=cx+(Math.random()-.5)*8;mPos[i*3+1]=cy+(Math.random()-.5)*8;mPos[i*3+2]=(Math.random()-.5)*14;
    mVel[i*2]=Math.cos(a)*sp;mVel[i*2+1]=Math.sin(a)*sp;
    mBri[i]=.7+Math.random()*.6;mBase[i]=mSize[i]=0.55+Math.random()*1.55;mMax[i]=1.1+Math.random()*2.1;mLife[i]=Math.random()*mMax[i];mPhase[i]=Math.random()*TAU;
  }
}

// attract:{x,y}|null · focus:0..1 hand presence · charging:bool · intensity:0..1 · summoning:bool (open palm)
function updateMotes(dt,time,attract,focus,charging,intensity,summoning){
  const cx=attract?attract.x:0,cy=attract?attract.y:0,[ir,ig,ib]=hexToRgb01(gColor);
  const doCharge=charging&&!!attract;if(!doCharge)chargeCaptured=false; // re-snapshot the spiral next time charging begins
  const emitting=summoning&&!!attract&&!doCharge&&motesBurst<=0; // SUMMON active this frame?
  summonRamp=Math.max(0,Math.min(1,summonRamp+(emitting?1:-1.4)*dt/SUMMON_RAMP_SEC)); // hold-to-power-up while summoning; decays a bit faster when you stop
  if(emitting){                                          // conjure dust from the palm (never mid-charge/burst)
    emitAccum+=EMIT_RATE*dt;
    while(emitAccum>=1){emitAccum--;
      let tries=0;while(mLife[emitPtr]<mMax[emitPtr]&&tries<MOTES){emitPtr=(emitPtr+1)%MOTES;tries++;}
      if(tries>=MOTES){emitAccum=0;break;}             // pool full → the cloud grows only up to the mote budget
      emitMote(emitPtr,cx,cy);emitPtr=(emitPtr+1)%MOTES;
    }
  }
  const birthSize=BIRTH_SIZE_MIN+(BIRTH_SIZE_MAX-BIRTH_SIZE_MIN)*summonRamp; // birth-size flash amplitude, grown by the summon hold
  const c=intensity,gather=Math.min(1,c/VORTEX_AT),tt=Math.max(0,(c-VORTEX_AT)/(1-VORTEX_AT)),coll=tt*tt*((BACK+1)*tt-BACK),spinEnv=SPIN_FLOOR+(1-SPIN_FLOOR)*c*c; // gather ramp + back-eased collapse + c²-accelerating spin (slow drift at first, whips up into the vortex)
  const gS=gather*gather*(3-2*gather); // smoothstep(gather): soft start so the size swell eases in rather than snapping
  motesMat.uniforms.uScale.value=MOTE_PX*(1+(doCharge?GATHER_SWELL*gS-CORE_TIGHTEN*Math.max(0,coll):0)+(motesBurst>0?.7*motesBurst:0)); // motes swell smoothly from baseline (no added size at charge onset) up to ~3× across the gather, then cinch into the core
  for(let i=0;i<MOTES;i++){
    let x=mPos[i*3],y=mPos[i*3+1],r,g,b;
    if(mLife[i]>=mMax[i]){mCol[i*3]=mCol[i*3+1]=mCol[i*3+2]=0;continue;} // DEAD → invisible (pooled slot, awaiting a summon)
    if(motesBurst>0){                                   // BURST: dying-flame embers — fly out, fall, cool, fade
      mVel[i*2+1]-=GRAV*1.6*dt;                          // embers arc and drop
      x+=mVel[i*2]*dt;y+=mVel[i*2+1]*dt;mVel[i*2]*=.94;mVel[i*2+1]*=.94;
      const f=motesBurst,hot=f*f*.8;                    // white-hot at birth → cools to spell colour → dies
      r=Math.min(2,(ir*(.5+1.3*f)+hot)*mBri[i]);g=Math.min(2,(ig*(.5+1.3*f)+hot)*mBri[i]);b=Math.min(2,(ib*(.5+1.3*f)+hot)*mBri[i]);
    }else if(doCharge){                                 // CHARGE: the vortex GRABS the dust already drifting on screen (from wherever each mote is) → gathers → whirlpools into the core → boom on full charge
      if(!chargeCaptured){const dx0=mPos[i*3]-cx,dy0=mPos[i*3+1]-cy;mDir[i]=Math.atan2(dy0,dx0);mRad[i]=Math.max(RMIN,Math.hypot(dx0,dy0));mSpin[i]=1+(Math.random()-.5)*SPIN_JIT;} // snapshot each mote where it ALREADY is → no teleport/ring-injection; the live field is what spins up, and its own spread seeds the arms
      const rt=mRad[i]*(1-coll);                          // back-eased radius envelope (hoisted coll) → anticipation breath then guaranteed snap to the core by full charge
      mDir[i]+=OMEGA*mSpin[i]*spinEnv*(1+SWIRL_K/Math.max(rt,RMIN))*dt; // differential spin × per-mote jitter × charge-ramped envelope: slow drift while gathering, whips up as it funnels — same-radius motes desync into a true swirl, not rigid spokes
      x=cx+Math.cos(mDir[i])*rt;y=cy+Math.sin(mDir[i])*rt;mPos[i*3+2]*=.93; // funnel toward the z≈0 plane
      const mix=Math.min(1,c/.4),tw=.8+.2*Math.sin(time*5+mPhase[i]*7),br=(.5+.7*c)*mBri[i]*tw; // starts at ~ambient brightness (no flare) and eases up as it charges; never fades in from black
      r=(AMB_R+(ir-AMB_R)*mix)*br;g=(AMB_G+(ig-AMB_G)*mix)*br;b=(AMB_B+(ib-AMB_B)*mix)*br; // themed ambient → spell colour as the charge builds
    }else{                                              // FLOAT: summoned dust bursts from the palm (birth flash), drifts, glows, and dies at its lifespan — no respawn
      mLife[i]+=dt;
      const ax=Math.sin(y*.05+time*.4+mPhase[i])*6,ay=Math.cos(x*.05+time*.3+mPhase[i])*6-GRAV*.4; // gentle turbulence + slight buoyant gravity
      mVel[i*2]+=ax*dt;mVel[i*2+1]+=ay*dt;mVel[i*2]*=.972;mVel[i*2+1]*=.972;x+=mVel[i*2]*dt;y+=mVel[i*2+1]*dt; // low drag → birth burst coasts far before settling
      const lf=mLife[i]/mMax[i],fresh=Math.max(0,1-mLife[i]/BIRTH_SEC),flash=fresh*fresh; // conjure flash: 1 at birth → 0 after BIRTH_SEC (squared for a punchy settle)
      const rise=Math.min(1,mLife[i]/.05),fade=Math.min(1,(1-lf)/DEATH_FRAC); // 3-frame soft-on so it doesn't hard-pop; fade out over the last DEATH_FRAC of life
      const tw=.65+.35*Math.sin(time*3.5+mPhase[i]*5),br=(.5+.4*focus)*(1+BIRTH_GLOW*flash)*rise*fade*tw*mBri[i]; // extra glow at conjure, settling to normal
      mSize[i]=mBase[i]*(1+birthSize*flash);            // swell big on conjure (bigger the longer you've held) → settle to base size
      r=AMB_R*br;g=AMB_G*br;b=AMB_B*br;                 // themed ambient (cyan-white / bloom pink)
    }
    mPos[i*3]=x;mPos[i*3+1]=y;
    mCol[i*3]=Math.min(2,r);mCol[i*3+1]=Math.min(2,g);mCol[i*3+2]=Math.min(2,b);
  }
  if(doCharge)chargeCaptured=true; // every mote has now snapshotted its spiral start
  if(motesBurst>0)motesBurst=Math.max(0,motesBurst-dt/1.1); // embers die slowly
  mGeo.attributes.position.needsUpdate=true;mGeo.attributes.color.needsUpdate=true;mGeo.attributes.size.needsUpdate=true;
}

// Maps a normalized (0..1) landmark position to world units on the z=0 plane
// visible to cam3, mirrored to match the CSS-mirrored camera display.
function landmarkToWorld(lm){
  const vh=2*Math.tan(THREE.MathUtils.degToRad(cam3.fov/2))*cam3.position.z;
  const vw=vh*cam3.aspect;
  return{x:(studio.flip?lm.x-0.5:0.5-lm.x)*vw,y:(0.5-lm.y)*vh};
}

// ── State ─────────────────────────────────────────────────────────────────────
let curSpell='neutral',shakeAmt=0,gColor='#78b2a5';
function setCol(c){document.documentElement.style.setProperty('--c',c);document.documentElement.style.setProperty('--g',c+'44');}

const baseTPos=new Float32Array(COUNT*3),baseTCol=new Float32Array(COUNT*3),baseTSz=new Float32Array(COUNT);
function stampBase(i,x,y,z,r,g,b,s){baseTPos[i*3]=x;baseTPos[i*3+1]=y;baseTPos[i*3+2]=z;baseTCol[i*3]=r;baseTCol[i*3+1]=g;baseTCol[i*3+2]=b;baseTSz[i]=s;}

let shapeKey=null;
function setSpellShape(key){
  for(let i=0;i<COUNT;i++)SPELLS[key].fn(i,COUNT,stampBase);
  shapeKey=key;
  pts.rotation.set(0,0,0);
}

// Renders a spell at a given charge intensity (0..1): 0 is invisible, 1 is a
// fully-cast spell. Regenerates the underlying particle shape only when the
// spell key changes, then fades color/size/bloom/UI toward that shape.
function applyCharge(key,intensity){
  if(key!==shapeKey)setSpellShape(key);
  const s=SPELLS[key];
  gColor=s.color;setCol(s.color);curSpell=key;
  bloom.strength=SPELLS.neutral.bloom+(s.bloom-SPELLS.neutral.bloom)*intensity;
  snEl.style.color=s.color;snEl.style.textShadow=`0 0 18px ${s.color}88,0 0 44px ${s.color}44`;
  snEl.style.opacity=key==='neutral'?'1':String(0.35+0.65*intensity);
  snEl.textContent=s.n;
  const pct=(ENERGY[key]||0)*intensity;
  efEl.style.width=pct+'%';efEl.style.background=s.color;efEl.style.boxShadow=`0 0 10px ${s.color}88`;
  topbarEl.style.background=s.color;topbarEl.style.boxShadow=`0 0 ${6+8*intensity}px ${s.color}`;
  const glowA=Math.round((key==='neutral'?0.33:0.15+0.7*intensity)*255).toString(16).padStart(2,'0');
  glowEl.style.boxShadow=`inset 0 0 140px ${s.color}${glowA}`;
  dotEl.style.background=s.color;dotEl.style.boxShadow=`0 0 12px 5px ${s.color}66`;
  for(let i=0;i<COUNT*3;i++){tPos[i]=baseTPos[i];tCol[i]=baseTCol[i]*intensity;}
  for(let i=0;i<COUNT;i++)tSz[i]=baseTSz[i]*intensity;
  // The shape cloud only renders the (test-only) frost/shield/portal/heal spells;
  // for live fireball/lightning (and neutral) the dust field carries the visual.
  pts.visible=!(key==='neutral'||key==='fireball'||key==='lightning');
}

// ── Charge / cast state machine ────────────────────────────────────────────────
// Holding up 1 or 2 fingers starts charging once that pose has been held for
// STILL_SEC — a fresh pose shows a faint "steadying" hint but doesn't ramp
// yet. This gate is purely about how long the *pose* has been held, not
// whether the hand is spatially still: moving your hand around the frame
// while keeping the same finger count doesn't reset anything, so the VFX
// (anchored to your fingertip) keeps tracking your hand the whole time.
// Once past the gate, the spell fades in and gathers dust from off-screen
// over CHARGE_SEC. If confidence reaches 1 it casts; if the pose breaks
// first, it fades back out instead.
const STILL_SEC=0.22,CHARGE_SEC=1.0,DECAY_SEC=0.5,CAST_DURATION_MS=2400,STILL_I=.14; // snappier: steadying + full charge ~1.2s total (was 0.35+1.6). STILL_I: dust intensity reached during the steadying window — motes spawn + glow (barely spinning) before the vortex, then this value carries into confidence so there's no pop
let heldKey=null,confidence=0,casting=false,castTimer=null;
let lastFingerCount=0,wandActive=false,manualFingerOverride=null,handOpenPalm=false,manualSummon=false;
let voiceCharge=null;
let holdTimer=0;
let motesCharging=false,chargeI=0; // drives the dust swirl-in during charge

function triggerCast(key){
  if(key==='lightning'){
    voiceCharge=null;manualSummon=false;fadeMagicRibbon();
    studio.clear();studio.playOverlay('lightning');setActiveGuide('lightning');
    return;
  }
  voiceCharge=null;
  casting=true;confidence=0;motesCharging=false; // stop charging so the burst embers scatter+die instead of being re-vortexed during the cast
  const s=SPELLS[key];
  applyCharge(key,1);
  const p=fingerWorld||{x:0,y:0};
  burstMotes(p.x,p.y); // dying-flame ember burst from the dust itself
  fadeMagicRibbon();
  flashEl.style.background='#fffdf5';flashEl.style.opacity='.85';setTimeout(()=>flashEl.style.opacity='0',110);
  shakeAmt=s.bloom*.11;
  audio.play(key);
  setActiveGuide(key);
  clearTimeout(castTimer);
  castTimer=setTimeout(()=>{
    casting=false;heldKey=null;confidence=0;
    setActiveGuide(null);
    applyCharge('neutral',1);
  },CAST_DURATION_MS);
}

function startVoiceCast(key){
  if(key!=='fireball'){triggerCast(key);return;}
  if(voiceCharge||casting)return;
  manualSummon=false;
  voiceCharge={key,startedAt:performance.now(),duration:1150};
  heldKey=key;confidence=0;
  setActiveGuide(key);
}

function updateVoiceCharge(now){
  if(!voiceCharge)return 0;
  const progress=Math.min(1,(now-voiceCharge.startedAt)/voiceCharge.duration);
  confidence=progress;motesCharging=true;chargeI=progress;
  applyCharge(voiceCharge.key,progress);
  ptxtEl.textContent=`FIREBALL · HÚT BỤI ${Math.round(progress*100)}%`;
  if(progress>=1)triggerCast(voiceCharge.key);
  return progress;
}

function updateCasting(dt){
  if(casting)return;
  const fingerCount=manualFingerOverride!=null?manualFingerOverride:lastFingerCount;
  const target=manualFingerOverride!=null?FINGER_TO_SPELL[fingerCount]:null;
  // Simulated finger input has no real hand landmark to anchor VFX to — pin a
  // fixed on-screen point so keyboard/API-driven testing shows the effect
  // without a camera. Pinned unconditionally (not just when fingerWorld is
  // null) so a stray real-hand detection can't drag the vortex centre around
  // mid-charge and reset the spiral snapshot.
  if(manualFingerOverride!=null)fingerWorld={x:0,y:0};
  motesCharging=false;
  if(target){
    if(target!==heldKey){heldKey=target;confidence=0;holdTimer=0;}
    holdTimer+=dt;
    if(holdTimer>=STILL_SEC){
      if(confidence<STILL_I)confidence=STILL_I;         // carry the steadying pre-charge in so mote intensity stays continuous (no pop) as the vortex begins
      confidence=Math.min(1,confidence+dt/CHARGE_SEC);
      applyCharge(heldKey,confidence);
      motesCharging=true;chargeI=confidence; // dust swirls into the fingertip
      ptxtEl.textContent=`CHARGING · ${Math.round(confidence*100)}%`;
      if(confidence>=1){triggerCast(heldKey);return;}
    }else{
      const steady=STILL_I*(holdTimer/STILL_SEC);       // hand shows some tendency → dust spawns + glows in place (near-zero spin) before the vortex spins up
      applyCharge(heldKey,steady);
      motesCharging=true;chargeI=steady;
      ptxtEl.textContent='GATHERING…';
    }
  }else if(heldKey){
    confidence=Math.max(0,confidence-dt/DECAY_SEC);
    holdTimer=0;
    applyCharge(heldKey,confidence);
    if(confidence>0.02){motesCharging=true;chargeI=confidence;} // keep swirling as it decays
    if(confidence<=0)heldKey=null;
  }else{
    holdTimer=0;
    applyCharge('neutral',1);
  }
}

// ── Proximity dimming ──────────────────────────────────────────────────────────
// Hand size in landmark units is a rough proxy for camera distance: bigger
// hand → closer to the camera → brighter scene. Falls back toward darkness
// when the hand moves away or leaves the frame. Charging further darkens the
// scene, building anticipation until the spell fires.
const PROX_NEAR=0.42,PROX_FAR=0.12;
let handProxTarget=0,presence=0;
function updatePresence(){
  presence+=(handProxTarget-presence)*(handProxTarget>presence?0.08:0.035);
  const chargeDark=0.22*(heldKey?confidence:0);
  const dark=Math.min(0.85,0.5-0.32*presence+chargeDark);
  camdarkEl.style.background=`rgba(0,0,0,${dark.toFixed(3)})`;
  const vigDark=Math.min(0.85,0.55-0.2*presence+chargeDark);
  vigEl.style.background=`radial-gradient(ellipse at 50% 38%,transparent ${(68-18*presence-14*(heldKey?confidence:0)).toFixed(1)}%,rgba(0,0,0,${vigDark.toFixed(3)}) 100%)`;
}

// ── Gesture detection ─────────────────────────────────────────────────────────
const videoEl=document.querySelector('.input_video'),ocv=$('ocv'),ctx2d=ocv.getContext('2d');
mountPixelStage(videoEl);   // BÀI TẬP 3: F lật · B mờ · N chồng lớp · X tắt · T tự chấm
const studio=new StudioEffects({THREE,scene,camera:cam3,renderer,video:videoEl,handCanvas:ocv,statusEl:ptxtEl});
const lotus3d=new Lotus3DEngine(document.body);
const studioGestureTrigger=new StableGestureTrigger({holdMs:700,releaseMs:220});
let pendingStudioSpell=null,lotusClearTimer=null;

function armLotus(){
  pendingStudioSpell='lotus';
  setActiveGuide('lotus');
  ptxtEl.textContent='THANH LIÊN ĐÃ KHÓA · SAY “LOTUS”';
}

function summonLotus(){
  if(pendingStudioSpell!=='lotus'&&!wandActive)return false;
  pendingStudioSpell=null;
  studio.clear();
  lotus3d.cast('lotus');
  ptxtEl.textContent='THANH LIÊN · SUMMONED';
  setActiveGuide('lotus');
  clearTimeout(lotusClearTimer);
  lotusClearTimer=setTimeout(()=>{
    lotus3d.release();
    lotusClearTimer=setTimeout(()=>{lotus3d.clear();setActiveGuide(null);},1700);
  },14000);
  return true;
}
let smoothed=null;
const ALPHA=0.40;
function lerp3(a,b,t){return a.map((p,i)=>({x:p.x+(b[i].x-p.x)*t,y:p.y+(b[i].y-p.y)*t,z:p.z+(b[i].z-p.z)*t}));}

function drawFingertips(lm){
  for(const idx of FINGERTIPS){
    const p=lm[idx],x=p.x*ocv.width,y=p.y*ocv.height;
    ctx2d.beginPath();ctx2d.arc(x,y,7,0,Math.PI*2);
    ctx2d.fillStyle=gColor+'33';ctx2d.fill();
    ctx2d.beginPath();ctx2d.arc(x,y,3,0,Math.PI*2);
    ctx2d.fillStyle=gColor;ctx2d.fill();
  }
}

const hands=new Hands({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`});
hands.setOptions({maxNumHands:4,modelComplexity:MCX,minDetectionConfidence:0.72,minTrackingConfidence:0.62,selfieMode:false});

// MediaPipe's legacy solutions share ONE global emscripten `Module`. Building
// SelfieSegmentation while Hands is still fetching its wasm makes the selfie
// glue resolve through Hands' locateFile — it asks for
// hands@…/selfie_segmentation_solution_simd_wasm_bin.wasm (404) and aborts BOTH
// graphs. The page then looks perfectly fine and never sees a hand (measured:
// dead on 6 of 6 loads). Hands must be up and delivering frames before the mask
// is allowed to load.
let handsFirstFrame=null;const handsUp=new Promise(r=>{handsFirstFrame=r;});

hands.onResults(res=>{
  if(handsFirstFrame){handsFirstFrame();handsFirstFrame=null;}
  ocv.width=videoEl.videoWidth||CAM_W;ocv.height=videoEl.videoHeight||CAM_H;
  ctx2d.clearRect(0,0,ocv.width,ocv.height);
  const rawHands=res.multiHandLandmarks||[];
  const studioKind=heartGestureMetrics(rawHands).active?'photo':null;
  const studioAction=studioGestureTrigger.sample(studioKind,performance.now());
  if(studioAction){
    setActiveGuide(studioAction);
    if(studioAction==='photo')studio.capture();
    else studio.activate(studioAction);
  }
  if(rawHands.length>0){
    const raw=rawHands.find(isIndexWand)||rawHands[0];
    try{
      for(const visibleHand of rawHands){
        drawConnectors(ctx2d,visibleHand,HAND_CONNECTIONS,{color:gColor+'cc',lineWidth:3.5});
        drawLandmarks(ctx2d,visibleHand,{color:'#fffdf5',lineWidth:1,radius:2.5});
        drawFingertips(visibleHand);
      }
    }catch{ /* overlay drawing is cosmetic only — never let it block finger counting below */ }
    if(!smoothed)smoothed=raw.map(p=>({...p}));else smoothed=lerp3(smoothed,raw,ALPHA);
    const studioOwnsHands=Boolean(studioKind);
    lastFingerCount=studioOwnsHands?0:countExtendedFingers(smoothed);
    wandActive=!studioOwnsHands&&isIndexWand(smoothed);
    handOpenPalm=false;
    // Anchor point: palm centre while summoning (dust emanates from the hand);
    // otherwise the index fingertip, or the index+middle midpoint for 2 fingers.
    const tip=smoothed[8];
    fingerWorld=landmarkToWorld(tip);
    if(wandActive)lotus3d.setTracking({anchor:{x:tip.x,y:tip.y}});
    handProxTarget=Math.max(0,Math.min(1,(handSize(smoothed)-PROX_FAR)/(PROX_NEAR-PROX_FAR)));
    pdotEl.style.background=gColor;pdotEl.style.boxShadow=`0 0 6px 2px ${gColor}88`;
    ptxtEl.style.color=gColor+'ee';
    const studioProgress=studioGestureTrigger.progress(performance.now());
    if(studioKind&&!studioAction)ptxtEl.textContent=`${studioKind.toUpperCase()} · HOLD ${Math.round(studioProgress.value*100)}%`;
    else if(wandActive)ptxtEl.textContent='WAND READY · SAY A SPELL';
    else ptxtEl.textContent='SHOW ONE INDEX FINGER';
  } else {
    studioGestureTrigger.sample(null,performance.now());
    smoothed=null;fingerWorld=null;handProxTarget=0;lastFingerCount=0;wandActive=false;handOpenPalm=false;
    pdotEl.style.background='rgba(255,253,245,.18)';pdotEl.style.boxShadow='none';
    ptxtEl.style.color='rgba(255,253,245,.18)';ptxtEl.textContent='NO HAND DETECTED';
  }
});

// ── Person segmentation ───────────────────────────────────────────────────────
// MediaPipe Hands gives 21 landmarks and no silhouette, so without a mask the
// dust and the video plates can only ever draw ACROSS the caster's face.
// SelfieSegmentation buys the three things this stage actually needed: the room
// dimmed, the caster bright and readable, and the FX behind them.
const segmentation=new Segmentation(videoEl);
// Deliberately serialised behind hands — see handsUp above. Without a camera
// Hands never reports, and a mask with no video is useless anyway, so leaving
// this pending forever is the correct behaviour rather than a missing fallback.
handsUp.then(()=>segmentation.init()).catch(e=>console.warn('segmentation off:',e));
const showSeg=()=>{ptxtEl.textContent=`DEPTH: ${segmentation.mode.toUpperCase()}`;};
window.segmentation=segmentation;   // console hook: inspect/drive the mask layer
studio.segmentation=segmentation;   // so capture() composites the same layers the screen shows
const camUtil=new Camera(videoEl,{onFrame:async()=>{await hands.send({image:videoEl});},width:CAM_W,height:CAM_H});
camUtil.start();

// ── Render loop ───────────────────────────────────────────────────────────────
const FPS=tier===0?30:60,FMS=1000/FPS;
let lastTs=0,time=0;
const R=Math.random;
function animate(ts){
  requestAnimationFrame(animate);if(ts-lastTs<FMS*.85)return;lastTs=ts;time+=.016;
  updateCasting(.016);
  const ribbonCollapse=updateVoiceCharge(ts);
  if(shakeAmt>.005){const s=shakeAmt*18;renderer.domElement.style.transform=`translate(${(R()-.5)*s}px,${(R()-.5)*s}px)`;shakeAmt*=.93;}
  else{renderer.domElement.style.transform='';shakeAmt=0;}
  for(let i=0;i<COUNT*3;i++){pos[i]+=(tPos[i]-pos[i])*LERP;col[i]+=(tCol[i]-col[i])*LERP;}
  for(let i=0;i<COUNT;i++)sz[i]+=(tSz[i]-sz[i])*LERP;
  geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.attributes.size.needsUpdate=true;
  const rs=ROT[curSpell]||ROT.neutral;pts.rotation.x+=rs.x;pts.rotation.y+=rs.y;pts.rotation.z+=rs.z;
  if(fingerWorld){
    pts.position.x+=(fingerWorld.x-pts.position.x)*.25;
    pts.position.y+=(fingerWorld.y-pts.position.y)*.25;
  }
  if(manualSummon&&!fingerWorld)fingerWorld={x:0,y:0}; // headless test summon (no camera) → pin the palm to centre
  motesFocus+=((fingerWorld?1:0)-motesFocus)*.06; // ease dust cluster→hand / spread when gone
  updateMagicRibbon(.016,ts,fingerWorld,manualSummon,ribbonCollapse);
  updateMotes(.016,time,fingerWorld,motesFocus,motesCharging,chargeI,handOpenPalm||manualSummon);
  studio.update(.016,ts);
  segmentation.send();                          // fire-and-forget; the mask graph runs off the render loop
  segmentation.draw(gColor,casting?1:chargeI);  // rim light tracks charge and peaks on the cast
  updatePresence();
  efk.update(.016);        // advance Effekseer sim; the EffekseerPass draws it inside composer.render()
  composer.render();
}

applyCharge('neutral',1);animate(0);
window.addEventListener('resize',()=>{
  cam3.aspect=innerWidth/innerHeight;cam3.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);
});

// fromKey: a number-key press is its own deliberate act, so it skips the
// "show one index finger" gate that stops stray speech from firing spells.
function runVoiceSpell(spell,fromKey=false){
  if(spell==='stop'){
    manualSummon=false;
    voiceCharge=null;
    fadeMagicRibbon();
    pendingStudioSpell=null;
    studio.clear();
    lotus3d.clear();
    setActiveGuide(null);
    ptxtEl.textContent='STOP · SPELL CLEARED';
    return true;
  }
  if(!wandActive&&!fromKey){
    voiceStatEl.textContent=`voice: heard “${spell}” · show one index finger`;
    return false;
  }
  if(spell!=='dust'){
    manualSummon=false;
    if(spell!=='fireball')fadeMagicRibbon();
  }
  if(!OVERLAY_SPELLS.includes(spell))studio.stopOverlay();
  lotus3d.clear();
  if(spell==='lumos'||spell==='nox'){studio.setLighting(spell);setActiveGuide('lighting');}
  else if(spell==='fireball'||spell==='lightning')startVoiceCast(spell);
  else if(spell==='blur')studio.activate(spell);
  else if(spell==='flip'){studio.toggleFlip();lotus3d.mirrorInput=!studio.flip;}
  else if(OVERLAY_SPELLS.includes(spell)){studio.clear();studio.playOverlay(spell,FRONT_SPELLS.includes(spell));}
  else if(spell==='dust'){manualSummon=true;ptxtEl.textContent='MAGIC DUST · CONTINUOUS';}
  setActiveGuide(spell==='dust'?'summon':spell);
  return true;
}

// ── Manual test triggers: keyboard, button, voice, and a scriptable API ───────
// These let the spell system be exercised without a webcam/hand in frame.
window.addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.key==='1')manualFingerOverride=1;
  else if(e.key==='2')manualFingerOverride=2;
  // Number keys are the no-mic path to the spoken spells: same routine voice
  // runs, minus the one-index-finger gate. Lets the whole set be demoed in a
  // noisy room, or on a browser with no SpeechRecognition at all.
  else if(SPELL_KEYS[e.key.toLowerCase()])runVoiceSpell(SPELL_KEYS[e.key.toLowerCase()],true);
  else if(e.key.toLowerCase()==='g')guideEl.classList.toggle('hidden');
  else if(e.key.toLowerCase()==='m'){segmentation.cycleMode();showSeg();}
  else if(e.key.toLowerCase()==='k'){segmentation.useScene=!segmentation.useScene;ptxtEl.textContent=segmentation.useScene?'BACKDROP: ENCHANTED FOREST':'BACKDROP: BLURRED ROOM';}
  else if(e.key.toLowerCase()==='b')studio.activate('blur');
  else if(e.key.toLowerCase()==='l')armLotus();
  else if(e.key.toLowerCase()==='p')studio.capture();
  else if(e.key.toLowerCase()==='u')studio.setLighting('lumos');
  else if(e.key.toLowerCase()==='n')studio.setLighting('nox');
  else if(e.key.toLowerCase()==='f'){studio.toggleFlip();lotus3d.mirrorInput=!studio.flip;}
  else if(e.key==='Escape'){studio.clear();studio.setLighting('normal');}
  else if(e.code==='Space'){
    e.preventDefault();
    if(!summonLotus())triggerCast(heldKey||FINGER_TO_SPELL[manualFingerOverride]||'fireball');
  }
});
window.addEventListener('keyup',e=>{
  if((e.key==='1'&&manualFingerOverride===1)||(e.key==='2'&&manualFingerOverride===2))manualFingerOverride=null;
});

testCastBtn.addEventListener('click',()=>{
  if(!summonLotus())triggerCast(heldKey||'fireball');
});

const SpeechRecognitionImpl=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognitionImpl){
  const rec=new SpeechRecognitionImpl();
  let voiceWanted=false,voiceRunning=false,restartTimer=null,lastVoiceActionAt=-Infinity;
  const normalizeVoice=text=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
  const voiceSpell=text=>{
    const heard=normalizeVoice(text);
    if(['lumos','lumous','luminous','lumas'].some(word=>heard.includes(word)))return'lumos';
    if(['nox','knox','knocks','nocks'].some(word=>heard.includes(word)))return'nox';
    if(['flower','flowers','flour'].some(word=>heard.includes(word)))return'flower';
    if(heard==='magic'||heard==='magik')return'magic';
    if(['fireball','firebol','firebal'].some(word=>heard.includes(word)))return'fireball';
    if(['lightning','lightening','lighting'].some(word=>heard.includes(word)))return'lightning';
    if(['rain','reign','rane'].some(word=>heard.includes(word)))return'rain';
    if(['blur','blurr','bler'].some(word=>heard.includes(word)))return'blur';
    if(['flip','flipped','fliping'].some(word=>heard.includes(word)))return'flip';
    if(['koto','kodo','coto','photo'].some(word=>heard===word||heard.startsWith(word)))return'koto';
    if(['dragon','draggon','dragen','drag on'].some(word=>heard.includes(word)))return'dragon';
    if(['rose','rosa','roze','rows'].some(word=>heard===word||heard.startsWith(word)))return'rose';
    if(['phoenix','phenix','feenix','fenix'].some(word=>heard.includes(word)))return'phoenix';
    if(['butterfly','butterflies','butter fly'].some(word=>heard.includes(word)))return'butterfly';
    if(['sakura','sacura','sakawa','blossom'].some(word=>heard.includes(word)))return'sakura';
    if(['smoke','smok','smoked'].some(word=>heard.includes(word)))return'smoke';
    if(['summon','summons','someone'].some(word=>heard.includes(word)))return'dust';
    if(['stop','stopp','stap','top'].some(word=>heard===word||heard.startsWith(word)))return'stop';
    return null;
  };
  const startVoice=()=>{
    if(!voiceWanted||voiceRunning)return;
    try{rec.start();}catch{/* the browser may still be closing the previous session */}
  };
  rec.continuous=true;rec.interimResults=true;rec.lang='en-US';rec.maxAlternatives=5;
  rec.onstart=()=>{
    voiceRunning=true;
    voiceStatEl.textContent='voice: listening · show index finger + say spell';
    voiceStatEl.classList.add('listening');
  };
  rec.onresult=e=>{
    const result=e.results[e.results.length-1];
    const alternatives=Array.from(result,entry=>entry.transcript);
    voiceStatEl.textContent=`voice: heard “${alternatives[0].trim()}”`;
    const now=performance.now();
    if(now-lastVoiceActionAt<1200)return;
    const spokenSpell=alternatives.map(voiceSpell).find(Boolean);
    if(spokenSpell){
      lastVoiceActionAt=now;
      runVoiceSpell(spokenSpell);
    }
  };
  rec.onerror=event=>{
    voiceRunning=false;
    voiceStatEl.textContent=event.error==='not-allowed'?'voice: microphone permission blocked':`voice: ${event.error} · tap once to retry`;
    voiceStatEl.classList.remove('listening');
    if(event.error==='not-allowed'||event.error==='service-not-allowed')voiceWanted=false;
  };
  rec.onend=()=>{
    voiceRunning=false;
    clearTimeout(restartTimer);
    if(voiceWanted)restartTimer=setTimeout(startVoice,180);
  };
  document.body.addEventListener('pointerdown',()=>{
    voiceWanted=true;
    startVoice();
  });
  voiceStatEl.addEventListener('click',()=>{
    voiceWanted=true;
    voiceStatEl.textContent='voice: starting microphone…';
    startVoice();
  });
}else{
  voiceStatEl.textContent='voice: not supported in this browser';
}

// Scriptable test API — e.g. from a browser console or an automated test:
//   magicDust.simulateFingers(1); magicDust.getState(); magicDust.release();
//   magicDust.forceCast('lightning');
window.magicDust={
  simulateFingers(n){manualFingerOverride=n;},
  simulateWand(on=true){wandActive=!!on;if(on&&!fingerWorld)fingerWorld={x:0,y:0};},
  moveWand(x,y){wandActive=true;fingerWorld={x,y};},
  release(){manualFingerOverride=null;},
  summon(on=true){manualSummon=!!on;},                 // test hook: emit dust from the pinned centre without a camera
  forceCast(key){
    if(key==='flower'||key==='magic'){lotus3d.clear();studio.clear();return studio.playOverlay(key);}
    if(key==='lotus'){armLotus();return summonLotus();}
    triggerCast(key||heldKey||'fireball');return true;
  },
  armLotus,
  summonLotus,
  activateEffect(kind){studio.activate(kind);},
  playOverlay(kind){lotus3d.clear();studio.clear();return studio.playOverlay(kind);},
  clearEffect(){studio.clear();},
  setLighting(kind){studio.setLighting(kind);},
  flip(){const value=studio.toggleFlip();lotus3d.mirrorInput=!value;return value;},
  snapshot(){return studio.capture();},
  getState(){return{heldKey,confidence,casting,lastFingerCount,wandActive,manualFingerOverride,summoning:manualSummon,trailPoints:trailPoints.length,voiceCharge:voiceCharge?.key||null,pendingStudioSpell,lotus3d:{visible:lotus3d.visible,mode:lotus3d.mode},studio:studio.getState(),efkReady};},
  // Play an Effekseer effect key (charge/fireball/lightning/ring — see EFFECTS
  // in effekseer.js) at world coords/scale, for eyeballing VFX in isolation.
  playEfk(key,x=0,y=0,z=0,scale=3,speed=1,rx=0){const h=efk.play(key,x,y,z);if(h){h.setScale(scale,scale,scale);if(rx)h.setRotation(rx,0,0);if(speed!==1)h.setSpeed(speed);}return!!h;},
};
