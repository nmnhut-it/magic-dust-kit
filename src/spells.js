// Bảng thần chú của học sinh nằm ở src/my-spells.js và được trộn vào cuối file này.
import { MY_SPELLS, MY_FINGERS, MY_FX } from './my-spells.js?v=4';

const TAU=Math.PI*2,R=Math.random;
function sph(rad){const t=R()*TAU,p=Math.acos(2*R()-1);return[rad*Math.sin(p)*Math.cos(t),rad*Math.sin(p)*Math.sin(t),rad*Math.cos(p)];}

// Each generator receives (index, particleCount, stamp) and calls
// stamp(i, x, y, z, r, g, b, size) to place one particle's target state.

function genNeutral(i,n,st){if(i<n*.05){const[x,y,z]=sph(14+R()*20);st(i,x,y,z,.05,.09,.14,.35);}else st(i,0,0,0,0,0,0,0);}

// Fireball and Lightning are rendered by dedicated real effect libraries
// instead of this shared point-cloud system (see main.js: `three-particle-fire`
// for the flame, the vendored official three.js `LightningStrike` geometry for
// the bolt) — actual shader-driven fire and a real fractal voltaic arc, not a
// hand-shaped particle cluster. Their generator here is a no-op so the shared
// Points system stays invisible for these two spells.
function genNone(i,n,st){st(i,0,0,0,0,0,0,0);}

function genFrost(i,n,st){
  const f=i/n,spike=i%16,a=spike*(TAU/16),r=2+f*45,jitter=(R()-.5)*2,cold=f<.1?3:.8;
  st(i,r*Math.cos(a)+jitter,r*Math.sin(a)*.3+jitter*.5,(R()-.5)*r*.2,.3*cold,.7*cold,1.0*cold,cold>1.5?2.5:.9);
}

function genShield(i,n,st){
  const f=i/n;
  if(f<.12){const a=R()*TAU,r=26+(R()-.5)*1.5;st(i,r*Math.cos(a),r*Math.sin(a),(R()-.5)*.8,.15,.6,1.1,2.8);}
  else if(f<.24){const a=R()*TAU,r=16+(R()-.5);st(i,r*Math.cos(a),r*Math.sin(a),(R()-.5)*.5,.1,.4,.9,1.2);}
  else{const[x,y,z]=sph(35+R()*80);st(i,x,y,z,.05,.2,.4,.5);}
}

function genPortal(i,n,st){
  const f=i/n;
  if(f<.5){const[x,y,z]=sph(20+R()*4);st(i,x,y,z,.5,.1,.9,2.5);}
  else st(i,(R()-.5)*110,(R()-.5)*110,(R()-.5)*110,.4,.05,.7,.7);
}

function genHeal(i,n,st){
  const f=i/n,[x,y,z]=sph(7+f*55),d=Math.sqrt(x*x+y*y+z*z),b=d<18?2.8:.7;
  st(i,x+(R()-.5)*4,y+(R()-.5)*4,z+(R()-.5)*4,.1*b,1.2*b,.5*b,b>1?2.5:.85);
}

export const ENERGY={neutral:0,fireball:70,frost:65,lightning:80,shield:60,portal:90,heal:55};

const BASE_SPELLS={
  neutral:  {n:'ARCANE ENERGY DORMANT', color:'#78b2a5', bloom:1.0, fn:genNeutral},
  fireball: {n:'Fireball',              color:'#d69a20', bloom:2.8, fn:genNone, sprite:'flame'},
  frost:    {n:'Frost Spike',           color:'#78b2a5', bloom:2.6, fn:genFrost},
  lightning:{n:'Chain Lightning',       color:'#78b2a5', bloom:3.2, fn:genNone, sprite:'bolt'},
  shield:   {n:'Arcane Shield',         color:'#78b2a5', bloom:2.2, fn:genShield},
  portal:   {n:'Portal',                color:'#9b3845', bloom:3.6, fn:genPortal},
  heal:     {n:'Healing Aura',          color:'#78b2a5', bloom:2.4, fn:genHeal},
};

// Live gesture input: hold up N fingers to charge the matching spell.
const BASE_FINGERS={1:'fireball',2:'lightning'};

// ── chỗ thần chú của bạn nhập bọn với thần chú có sẵn ─────────────────────────
// Thêm vào my-spells.js là tự động có mặt ở đây, không phải sửa file này.
export const SPELLS={...BASE_SPELLS,...MY_SPELLS};
export const FINGER_TO_SPELL={...BASE_FINGERS,...MY_FINGERS};
for(const key of Object.keys(MY_SPELLS))if(!(key in ENERGY))ENERGY[key]=60;
export const MY_FX_CLIPS=Object.fromEntries(Object.entries(MY_FX).map(([k,v])=>[k,v.file]));

// Spells that play a full-frame video plate rather than a particle cast. The
// router treats these as one group (they don't stop each other's overlay the
// way a particle cast does), so the list lives here once instead of being
// re-typed at every branch in main.js.
export const OVERLAY_SPELLS=['koto','dragon','rose','phoenix','butterfly','sakura','smoke','rain','flower','magic',...Object.keys(MY_FX)];

// Plates that belong IN FRONT of the caster rather than behind them. Petals,
// blossom and dust are near-camera weather: they should drift between the
// viewer and the person. A creature or an atmosphere (stag, phoenix, smoke,
// rain) belongs behind, where the segmentation mask puts the caster on top.
// Anything listed here gets .front (z 5) instead of the default z 3.
export const FRONT_SPELLS=['sakura','flower','dust'];

// Number-key side channel for every spoken spell. Speech recognition needs a
// mic, a quiet room and a cooperative browser; a demo in a noisy classroom
// needs none of that, so each spell also has a digit that fires the exact same
// routine. 1 and 2 stay reserved for the finger-count override (see
// CLAUDE.md's testing section) and 3 keeps the 'rain' binding it already had.
// The digits ran out at 'magic', so the two newest plates take the letters of
// their own name ('d'/'r') — same side channel, same routine.
const BASE_KEYS={
  '3':'rain', '4':'koto', '5':'phoenix', '6':'butterfly',
  '7':'sakura', '8':'smoke', '9':'flower', '0':'magic',
  'd':'dragon', 'r':'rose',
};
export const SPELL_KEYS={...BASE_KEYS,
  ...Object.fromEntries(Object.entries(MY_FX).filter(([,v])=>v.hotkey).map(([k,v])=>[v.hotkey,k]))};

// Order here also defines the on-screen gesture-guide list order.
export const GUIDE=[
  {key:'fireball', name:'Fireball',  label:'Index + “Fireball”',desc:'Point one index finger, then say “fireball”'},
  {key:'lightning', name:'Lightning', label:'Index + “Lightning”',desc:'Point one index finger, then say “lightning”'},
  {key:'summon', name:'Summon',    label:'Index + “Summon”',desc:'Summon continuous dust and draw a glowing ribbon with the fingertip'},
  {key:'stop', name:'Stop',      label:'Say “Stop”',desc:'Stop continuous dust and clear the current atmosphere'},
  {key:'rain', name:'Rain',      hotkey:'3', label:'Index + “Rain”',desc:'Summon a cinematic storm plate across the camera'},
  {key:'blur', name:'Blur',      label:'Index + “Blur”',desc:'Point one index finger, then say “blur”'},
  {key:'flip', name:'Flip',      label:'Index + “Flip”',desc:'Point one index finger, then say “flip” to mirror the camera'},
  {key:'flower', name:'Flower',    hotkey:'9', label:'Index + “Flower”',desc:'Loop a full-frame atmosphere of floating pink flower petals'},
  {key:'magic', name:'Glyphs',     hotkey:'0', label:'Index + “Magic”',desc:'Loop a separate atmosphere of luminous magical symbols'},
  {key:'koto', name:'Stag',      hotkey:'4', label:'Index + “Koto”',desc:'Summon the glowing spirit stag video spell'},
  {key:'dragon', name:'Dragon',    hotkey:'D', label:'Index + “Dragon”',desc:'Call a spirit dragon that bursts out of a glowing summoning circle'},
  {key:'rose', name:'Rose',      hotkey:'R', label:'Index + “Rose”',desc:'Bloom a luminous spirit rose in a drift of glowing motes'},
  {key:'phoenix', name:'Phoenix',   hotkey:'5', label:'Index + “Phoenix”',desc:'Summon a spirit phoenix that spreads its wings in a burst of embers'},
  {key:'butterfly', name:'Butterfly', hotkey:'6', label:'Index + “Butterfly”',desc:'Release a drifting swarm of glowing crystal butterflies'},
  {key:'sakura', name:'Sakura',    hotkey:'7', label:'Index + “Sakura”',desc:'Scatter a warm swirl of glowing cherry-blossom petals'},
  {key:'smoke', name:'Smoke',     hotkey:'8', label:'Index + “Smoke”',desc:'Fill the stage with a looping blue smoke overlay'},
  {key:'photo', name:'Photo',     label:'Heart Hands',desc:'Make a heart and hold to take a magic photo'},
  {key:'lighting', name:'Lumos/Nox',  label:'Index + “Lumos / Nox”',desc:'Point one index finger; Lumos brightens and Nox darkens'},
  // Thần chú và hiệu ứng bạn thêm ở my-spells.js tự hiện xuống cuối bảng này,
  // kèm đúng số ngón tay hoặc phím bạn đã gán — không phải khai báo lần nữa.
  ...Object.entries(MY_SPELLS).map(([key,spell])=>({key,name:spell.n,
    hotkey:Object.entries(MY_FINGERS).find(([,v])=>v===key)?.[0],
    label:`Giơ ${Object.entries(MY_FINGERS).find(([,v])=>v===key)?.[0]||'?'} ngón tay`,
    desc:'Thần chú bạn tự viết trong src/my-spells.js'})),
  ...Object.entries(MY_FX).map(([key,fx])=>({key,name:fx.n,hotkey:fx.hotkey,
    label:fx.hotkey?`Bấm phím ${fx.hotkey.toUpperCase()}`:'',
    desc:'Hiệu ứng video bạn tự bỏ vào assets/my-fx/'})),
];

export const ROT={
  neutral:{y:.004,x:.001,z:0}, fireball:{y:0,x:0,z:-.11}, frost:{y:.025,x:.01,z:.015},
  lightning:{y:0,x:0,z:-.11}, shield:{y:.006,x:.002,z:0}, portal:{y:.06,x:.01,z:.22}, heal:{y:.065,x:.022,z:.03},
};
