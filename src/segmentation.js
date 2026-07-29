// Person segmentation layer for the dust FX.
//
// MediaPipe Hands only gives 21 landmarks — no silhouette — so the dust can
// only ever draw OVER the caster. SelfieSegmentation adds a person/background
// mask, which buys two things the FX can't fake:
//   OCCLUDE — re-draw the cut-out person ON TOP of the particle canvas AND the
//             video FX plates, so a stag or a vortex passes BEHIND the body
//             instead of across the caster's face.
//   BACKDROP— a BLURRED, slightly darkened copy of the frame laid over the raw
//             camera, so the room falls out of focus and the caster reads
//             clearly against the FX. Portrait mode, essentially. It covers the
//             whole frame; the sharp cut-out person on top is what brings the
//             caster back into focus, so no mask punch-out is needed here.
//             The blur is done at HALF resolution and upscaled — cheap, and the
//             upscale adds softness for free.
//   RIM     — blur(mask) minus mask = a silhouette edge band; tint it with the
//             spell colour and screen-blend it, so the caster is lit by their
//             own spell. This is the cheap effect that sells the composite.
//
// The model is 256px and temporally noisy, so the mask is EMA-smoothed across
// frames (#accum) — without it the edge crawls badly. Inference runs at half
// rate; the mask changes far slower than landmarks do.
//
// in : video element + per-frame (spellColor, intensity 0..1)
// out: two fixed canvases over #cv — occlusion (normal) and rim (screen blend)
// Modes cycle with the M key: off → occlude → rim → both → mask debug.

const SEG_CDN='https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation';
const EMA=.45;              // mask smoothing per inference frame
const EVERY=3;              // run inference on 1 of N render frames (~20/s at 60fps)
const COVER=1.02;           // matches #camlayer video's scale(1.02)
const RIM_PX=14, RIM_GAIN=.85, RIM_FLOOR=.28;
const BLUR_PX=9;                  // at half-res, so ~18px at full frame
const BACKDROP_TINT='rgba(9,22,28,.34)';   // gentle push-back behind the blur
// A generated scene to stand in for the room entirely. Blurring a real office
// still leaves an office; replacing it puts the caster somewhere worth being.
// The plate is dark and open in the centre by design, so a lit person reads
// against it. null = keep the blurred camera.
const SCENE_CLIP='./lessons/assets/camera-effects/overlays/bg-enchanted-forest.mp4';
export const MODES=['off','occlude','rim','both','mask'];

const mkCanvas=(z,blend)=>{const c=document.createElement('canvas');
  c.style.cssText=`position:fixed;inset:0;width:100%;height:100%;z-index:${z};pointer-events:none`;
  if(blend)c.style.mixBlendMode=blend;document.body.appendChild(c);return c;};
const off=()=>document.createElement('canvas');

export class Segmentation{
  #video;#seg=null;#frame=0;#have=false;#busy=false;
  #accum=off();#person=off();#rim=off();#bg=off();#solid=off();  // all in video pixel space
  #scene=null;              // <video> of the generated backdrop, lazily created
  useScene=true;            // false = fall back to the blurred real room
  #occCv;#rimCv;#dimCv;#occ;#rimx;#dim;
  mode='both';masks=0;sends=0;         // counters: `magicDust.segmentation` in the console
  get ready(){return this.#have;}
  constructor(video){this.#video=video;
    // Stack: 0 camera · 1 backdrop dim · 2 dust (#cv) · 3 video FX plates ·
    // 4 cut-out person + rim · 5 vignette. The person sits ABOVE the plates
    // (z 3) so the stag passes behind the caster; the dim sits below the dust
    // so only the room darkens.
    this.#dimCv=mkCanvas(1);
    this.#occCv=mkCanvas(4);this.#rimCv=mkCanvas(4,'screen');
    this.#dim=this.#dimCv.getContext('2d');
    this.#occ=this.#occCv.getContext('2d');this.#rimx=this.#rimCv.getContext('2d');
    addEventListener('resize',()=>this.#size());this.#size();}

  #size(){const d=devicePixelRatio||1,w=innerWidth*d|0,h=innerHeight*d|0;
    for(const c of [this.#occCv,this.#rimCv,this.#dimCv]){c.width=w;c.height=h;}}

  // The photo path needs the SAME layers in the SAME order the screen shows,
  // otherwise a capture silently reproduces the pre-segmentation stacking.
  // These expose the already-composited, viewport-sized canvases so
  // studio-effects.capture() can blit them straight in.
  get layers(){return this.mode==='off'||!this.#have
    ? null
    : {backdrop:this.#dimCv,person:this.#occCv,rim:this.#rimCv};}

  cycleMode(){this.mode=MODES[(MODES.indexOf(this.mode)+1)%MODES.length];return this.mode;}

  async init(){
    if(!self.SelfieSegmentation)await new Promise((ok,no)=>{const s=document.createElement('script');
      s.src=`${SEG_CDN}/selfie_segmentation.js`;s.crossOrigin='anonymous';s.onload=ok;s.onerror=no;document.head.appendChild(s);});
    const seg=new self.SelfieSegmentation({locateFile:f=>`${SEG_CDN}/${f}`});
    seg.setOptions({modelSelection:1});     // 144x256 general model: steadier edges than 0
    seg.onResults(r=>this.#onMask(r));this.#seg=seg;
  }

  // Called from the camera onFrame, alongside hands.send().
  // Fire-and-forget from the render loop. #busy keeps one inference in flight —
  // overlapping send() calls into the same graph error out.
  async send(){if(!this.#seg||this.#busy||this.mode==='off')return;
    // The render loop starts before the camera has negotiated a size, and
    // handing a 0x0 video to the graph makes it throw
    // "createImageBitmap: The image source's width is 0" from inside its own
    // onResults — an unhandled rejection the caller can't see. Wait for real
    // dimensions and decoded data before feeding it.
    const v=this.#video;
    if(!v||!v.videoWidth||!v.videoHeight||v.readyState<2)return;
    if(this.#frame++%EVERY)return;
    this.sends++;this.#busy=true;
    // Never let a bad frame reject into the void; one dropped inference is
    // fine, a dead promise chain is not.
    try{await this.#seg.send({image:v});}
    catch(err){this.errors=(this.errors||0)+1;this.lastError=String(err);}
    finally{this.#busy=false;}}

  #onMask(r){const m=r&&r.segmentationMask;this.masks++;if(!m||!m.width||!m.height)return;
    const a=this.#accum;if(a.width!==m.width){a.width=m.width;a.height=m.height;
      for(const c of [this.#person,this.#rim,this.#solid]){c.width=m.width;c.height=m.height;}}
    const x=a.getContext('2d');
    // EMA on the mask's alpha: fade the old one down BY EMA, then add EMA*new,
    // so a steady mask converges to fully opaque: A = (1-E)A + E.
    // This used to erase at globalAlpha=1, which is not a fade but a wipe — the
    // accumulator was rebuilt from scratch each time and so could never exceed
    // EMA (0.45). A 45%-opaque cut-out let the stag show straight through the
    // caster's face, which read as "the FX is not going behind me".
    x.globalCompositeOperation='destination-out';x.globalAlpha=EMA;
    x.fillStyle='#000';x.fillRect(0,0,a.width,a.height);
    x.globalCompositeOperation='lighter';x.globalAlpha=EMA;x.drawImage(m,0,0);
    x.globalAlpha=1;x.globalCompositeOperation='source-over';this.#have=true;
  }

  // spellColor: css color of the active spell · intensity: charge 0..1
  draw(spellColor,intensity){
    const oc=this.#occ,rc=this.#rimx,dm=this.#dim,W=this.#occCv.width,H=this.#occCv.height;
    oc.clearRect(0,0,W,H);rc.clearRect(0,0,W,H);dm.clearRect(0,0,W,H);
    if(!this.#have||this.mode==='off')return;
    if(this.mode==='mask'){this.#blit(oc,this.#accum,1);return;}
    if(this.mode==='occlude'||this.mode==='both'){
      // the room is replaced (or merely blurred), then the sharp caster returns
      const scene=this.useScene?this.#sceneFrame():null;
      if(scene){
        // cover-fit the plate; no mirror, it is not a camera image
        const sc=Math.max(W/scene.videoWidth,H/scene.videoHeight);
        const dw=scene.videoWidth*sc,dh=scene.videoHeight*sc;
        dm.drawImage(scene,(W-dw)/2,(H-dh)/2,dw,dh);
      }else{
        this.#blit(dm,this.#backdrop(),1);
        dm.fillStyle=BACKDROP_TINT;dm.fillRect(0,0,W,H);
      }
      this.#blit(oc,this.#cutout(),1);
    }
    if(this.mode==='rim'||this.mode==='both')
      this.#blit(rc,this.#rimBand(spellColor),RIM_FLOOR+RIM_GAIN*(intensity||0));
  }

  // The generated backdrop, once it has frames. Created on first use so a page
  // that never turns segmentation on never fetches it.
  #sceneFrame(){
    if(!SCENE_CLIP)return null;
    if(!this.#scene){
      const v=document.createElement('video');
      v.src=SCENE_CLIP;v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';
      v.play().catch(()=>{});this.#scene=v;
    }
    const v=this.#scene;
    return v.videoWidth&&v.readyState>=2?v:null;}

  // Half-res blurred copy of the whole frame. Upscaling it on the way to the
  // screen costs nothing and deepens the blur, so BLUR_PX can stay small.
  #backdrop(){const v=this.#video,b=this.#bg,w=(v.videoWidth||640)>>1,h=(v.videoHeight||480)>>1;
    if(b.width!==w){b.width=w;b.height=h;}
    const x=b.getContext('2d');
    x.globalCompositeOperation='source-over';x.clearRect(0,0,w,h);
    x.filter=`blur(${BLUR_PX}px)`;x.drawImage(v,0,0,w,h);x.filter='none';return b;}

  // An S-curve on the mask's alpha, so OCCLUSION IS DECISIVE. The raw model
  // output is a probability map with soft edges, and anything less than fully
  // opaque over the head lets the spell shine through the caster's face — the
  // exact complaint this layer exists to answer. Square first (a^2 kills the
  // background haze), then two self-composites with 'lighter'
  // (v -> 1-(1-v)^2 each) drive the body to solid:
  //   0.90 -> 0.81 -> 0.96 -> 0.999   (head: opaque, spell cannot pass)
  //   0.05 -> 0.003 -> 0.005 -> 0.01  (room: still transparent)
  #solidMask(){const s=this.#solid,x=s.getContext('2d');
    x.globalCompositeOperation='source-over';x.clearRect(0,0,s.width,s.height);
    x.drawImage(this.#accum,0,0);
    x.globalCompositeOperation='destination-in';x.drawImage(this.#accum,0,0);
    x.globalCompositeOperation='lighter';x.drawImage(s,0,0);x.drawImage(s,0,0);
    x.globalCompositeOperation='source-over';return s;}

  #cutout(){const p=this.#person,x=p.getContext('2d');
    x.globalCompositeOperation='source-over';x.clearRect(0,0,p.width,p.height);
    x.drawImage(this.#solidMask(),0,0);
    x.globalCompositeOperation='source-in';x.drawImage(this.#video,0,0,p.width,p.height);
    x.globalCompositeOperation='source-over';return p;}

  #rimBand(color){const r=this.#rim,x=r.getContext('2d'),k=RIM_PX*r.width/720;
    x.globalCompositeOperation='source-over';x.clearRect(0,0,r.width,r.height);
    x.filter=`blur(${k}px)`;x.drawImage(this.#accum,0,0);x.filter='none';
    x.globalCompositeOperation='destination-out';x.drawImage(this.#accum,0,0);
    x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,r.width,r.height);
    x.globalCompositeOperation='source-over';return r;}

  // Blit a video-space canvas to the screen with object-fit:cover + the mirror
  // the camera layer applies in CSS, so mask and video stay registered.
  #blit(ctx,src,alpha){const W=ctx.canvas.width,H=ctx.canvas.height;
    const s=Math.max(W/src.width,H/src.height)*COVER,dw=src.width*s,dh=src.height*s;
    ctx.save();ctx.setTransform(-1,0,0,1,W,0);   // scaleX(-1) about the canvas centre
    ctx.globalAlpha=alpha;ctx.drawImage(src,(W-dw)/2,(H-dh)/2,dw,dh);ctx.restore();}
}
