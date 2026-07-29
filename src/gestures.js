// Thumb, index, middle, ring, pinky tip landmark indices (MediaPipe Hands topology).
export const FINGERTIPS=[4,8,12,16,20];

// Hand size: wrist(0) to mid-MCP(9) — normalizes finger metrics and doubles as
// a rough proxy for how close the hand is to the camera.
export function handSize(lm){return Math.hypot(lm[0].x-lm[9].x,lm[0].y-lm[9].y)||.001;}

// Finger extension: PIP vs TIP, normalized by hand size.
// In image coords Y increases downward, so an extended finger has tip above pip.
function ext(lm,pip,tip){const h=handSize(lm),dy=(lm[pip].y-lm[tip].y)/h;return Math.max(0,Math.min(1,dy*4.5));}

const EXT_THRESHOLD=0.55,THUMB_EXT_RATIO=1.12;

// Counts how many of index/middle/ring/pinky are clearly extended. Thumb is
// excluded here on purpose — its extension needs a different axis, and keeping
// it out means the 1-finger / 2-finger spell gestures aren't disturbed by a
// stray thumb. (Thumb is handled separately for the open-palm summon below.)
export function countExtendedFingers(lm){
  const idx=ext(lm,6,8)>EXT_THRESHOLD,mid=ext(lm,10,12)>EXT_THRESHOLD,rng=ext(lm,14,16)>EXT_THRESHOLD,pnk=ext(lm,18,20)>EXT_THRESHOLD;
  return[idx,mid,rng,pnk].filter(Boolean).length;
}

// Thumb abducts sideways rather than curling along a finger axis, so measure it
// across the palm: compare how far the tip(4) sits from the far side of the palm
// (pinky MCP, 17) versus its own MCP(2). Splayed out → tip is farther than its
// base; folded across the palm → the tip pulls in closer. Orientation-free.
function thumbExtended(lm){
  const px=lm[17].x,py=lm[17].y;
  const dTip=Math.hypot(lm[4].x-px,lm[4].y-py),dMcp=Math.hypot(lm[2].x-px,lm[2].y-py);
  return dTip>dMcp*THUMB_EXT_RATIO;
}

export function fingerStates(lm){
  return{
    thumb:thumbExtended(lm),
    index:ext(lm,6,8)>EXT_THRESHOLD,
    middle:ext(lm,10,12)>EXT_THRESHOLD,
    ring:ext(lm,14,16)>EXT_THRESHOLD,
    pinky:ext(lm,18,20)>EXT_THRESHOLD,
  };
}

const matches=(state,open)=>Object.entries(state).every(([finger,value])=>value===open.includes(finger));

export function classifySpellGesture(lm){
  const state=fingerStates(lm);
  if(matches(state,['thumb','index']))return'fireball';
  if(matches(state,['index','pinky']))return'lightning';
  return null;
}

export function isIndexWand(lm){
  const state=fingerStates(lm);
  return matches(state,['index']);
}

// Open palm = all four fingers extended AND the thumb splayed → the "true 5"
// summon gesture, kept distinct from the thumb-excluded spell count above.
// PINCH: thumb tip against index tip. Measured as a distance between two
// landmarks rather than a curl estimate, which is why it survives a classroom
// webcam when finger-count reads wobble. Normalised by handSize so it does not
// become easier the closer a learner leans in.
//
// A pinched hand reads as zero or one extended finger, so any classifier that
// also counts fingers MUST check this first or the two signs fight.
export const PINCH_RATIO=.42;
export function isPinch(lm){
  if(!lm||lm.length<21)return false;
  return Math.hypot(lm[4].x-lm[8].x,lm[4].y-lm[8].y)<handSize(lm)*PINCH_RATIO;
}

export function isOpenPalm(lm){return countExtendedFingers(lm)===4&&thumbExtended(lm);}

export function isHorizontalOpenPalm(lm){
  const wrist=lm[0];
  const extended=[[6,8],[10,12],[14,16],[18,20]].every(([pip,tip])=>{
    const pipDistance=Math.hypot(lm[pip].x-wrist.x,lm[pip].y-wrist.y);
    const tipDistance=Math.hypot(lm[tip].x-wrist.x,lm[tip].y-wrist.y);
    return tipDistance>pipDistance*1.12;
  });
  if(!extended||!thumbExtended(lm))return false;
  const dx=lm[9].x-lm[0].x;
  const dy=lm[9].y-lm[0].y;
  return Math.abs(dx)>Math.abs(dy)*1.15;
}

export function heartGestureMetrics(hands=[]){
  let best={active:false,score:Infinity};
  for(let i=0;i<hands.length;i++)for(let j=i+1;j<hands.length;j++){
    const a=hands[i],b=hands[j],scale=(handSize(a)+handSize(b))*.5;
    const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)/scale;
    const indexDistance=distance(a[8],b[8]),thumbDistance=distance(a[4],b[4]);
    const indexMidY=(a[8].y+b[8].y)*.5,thumbMidY=(a[4].y+b[4].y)*.5;
    const candidate={
      active:indexDistance<.42&&thumbDistance<.48&&indexMidY<thumbMidY,
      indexDistance,thumbDistance,pair:[i,j],score:indexDistance+thumbDistance,
    };
    if(candidate.active&&candidate.score<best.score)best=candidate;
  }
  return best;
}

export function classifyStudioGesture(hands=[]){
  if(heartGestureMetrics(hands).active)return'photo';
  if(hands.some(isHorizontalOpenPalm))return'lotus';
  const hand=hands[0];
  if(!hand||isOpenPalm(hand))return null;
  const state=fingerStates(hand);
  if(matches(state,[]))return'blur';
  if(matches(state,['index','ring','pinky']))return'rain';
  return null;
}

// holdMs may be a NUMBER (every gesture waits the same) or a MAP of kind -> ms
// with an optional `default`. The map exists because a heavy spell should be
// visibly slower to bring up than a cheap one - the wait is the weight - and
// that only works if one gate can hold several durations at once.
export class StableGestureTrigger{
  constructor({holdMs=700,releaseMs=220}={}){
    this.holdMs=holdMs;this.releaseMs=releaseMs;
    this.candidate=null;this.since=0;this.latched=null;this.neutralSince=0;
  }
  holdFor(kind){
    if(typeof this.holdMs==='number')return this.holdMs;
    return this.holdMs?.[kind]??this.holdMs?.default??700;
  }
  sample(kind,now=performance.now()){
    if(!kind){
      this.candidate=null;this.since=0;
      if(!this.neutralSince)this.neutralSince=now;
      if(now-this.neutralSince>=this.releaseMs)this.latched=null;
      return null;
    }
    this.neutralSince=0;
    if(this.latched)return null;
    if(kind!==this.candidate){this.candidate=kind;this.since=now;return null;}
    if(now-this.since<this.holdFor(kind))return null;
    this.latched=kind;
    return kind;
  }
  progress(now=performance.now()){
    return{kind:this.candidate,value:this.candidate?Math.min(1,(now-this.since)/this.holdFor(this.candidate)):0,latched:this.latched};
  }
}
