// Effekseer WebGL controller — plays pro-authored particle effects (.efk) on top
// of the composited three.js scene by sharing its WebGL context. The runtime
// (effekseer.min.js + effekseer.wasm, vendored under vendor/effekseer/) exposes a
// global `effekseer`; src/effekseer.js wraps it.
//
// Effects are keyed logically (charge/fireball/lightning/ring). Each key first
// tries a LOCAL file under assets/efk/ (your own exports from the Effekseer
// desktop editor — see assets/efk/README.md), and falls back to a bundled
// official sample effect streamed from jsdelivr if the local file is absent.
// So the app looks good out of the box and upgrades the instant you drop in a
// real rune-circle .efk. Handles from play() expose
// setLocation/setScale/setRotation/setSpeed/stop/exists for per-frame tracking.
const CDN='https://cdn.jsdelivr.net/gh/effekseer/EffekseerForWebGL@170e/';

// logical key → {local:[candidate export paths], cdn: bundled fallback sample}.
// Local candidates cover both editor outputs: "Save As" (.efkefc) and
// "Export" (.efk). First one that loads wins; else the CDN sample is used.
const L=name=>[`assets/efk/${name}.efkefc`,`assets/efk/${name}.efk`];
export const EFFECTS={
  fireball: {local:L('fireball'),  cdn:CDN+'tests/Resources/Blow1.efkefc'},           // fireball cast burst
  lightning:{local:L('lightning'), cdn:CDN+'Release/Resources/Laser02.efk'},          // lightning cast
  ring:     {local:L('cast'),      cdn:CDN+'Release/Resources/Simple_Ring_Shape1.efk'}, // expanding shockwave on any cast
};

export class Efk{
  constructor(){this.ctx=null;this.fx={};this.ready=false;this.usingLocal={};}
  // gl: renderer.getContext(); wasmPath: URL to vendored effekseer.wasm.
  init(gl,wasmPath,onready){
    const E=window.effekseer;
    if(!E){console.warn('[efk] runtime global missing — effekseer.min.js not loaded');return;}
    E.initRuntime(wasmPath,()=>{
      this.ctx=E.createContext();
      this.ctx.init(gl);
      this.ctx.setRestorationOfStatesFlag(true); // restore GL state so three.js stays intact
      const keys=Object.keys(EFFECTS);let pending=keys.length;
      const done=()=>{if(--pending===0){this.ready=true;onready&&onready();}};
      for(const k of keys)this.loadChain(k,[...EFFECTS[k].local,EFFECTS[k].cdn],0,done);
    },()=>console.warn('[efk] wasm init failed'));
  }
  // Walk the candidate URL list, using the first that exists and parses.
  // Two hazards to guard against: (1) loadEffect hangs (never fires either
  // callback) on non-effect data — a 404 body or a corrupt file — so we
  // pre-probe local URLs with fetch() and skip misses; (2) even a fetch-OK file
  // could still hang the parser, so a timeout falls through to the next source.
  // done() runs exactly once per key, guaranteeing efkReady eventually resolves.
  loadChain(key,urls,i,done){
    if(i>=urls.length){console.warn('[efk] all sources failed',key);return done();}
    const url=urls[i],isLocal=!url.startsWith('http'),next=()=>this.loadChain(key,urls,i+1,done);
    const load=()=>{let settled=false;const fin=ok=>{if(settled)return;settled=true;if(ok){if(isLocal){this.usingLocal[key]=true;console.info('[efk] using local',key,url);}done();}else next();};
      this.fx[key]=this.ctx.loadEffect(url,1,()=>fin(true),()=>fin(false));
      setTimeout(()=>fin(false),5000);}; // parser-hang guard
    if(isLocal)fetch(url,{method:'HEAD'}).then(r=>r.ok?load():next()).catch(next);
    else load();
  }
  play(key,x,y,z){if(!this.ctx||!this.fx[key])return null;return this.ctx.play(this.fx[key],x,y,z);}
  update(dt){if(this.ctx)this.ctx.update(dt*60);} // Effekseer counts in 60fps frames
  // Draw Effekseer into `target` (a WebGLRenderTarget, or null for screen) as an
  // EffectComposer pass. Must be invoked mid-composer so a valid framebuffer is
  // bound — drawing after composer.render() leaves no target bound and shows
  // nothing. resetState() re-syncs three.js's cached GL state afterward.
  drawPass(renderer,target,cam){
    if(!this.ctx)return;
    renderer.setRenderTarget(target);
    this.ctx.setProjectionMatrix(cam.projectionMatrix.elements);
    this.ctx.setCameraMatrix(cam.matrixWorldInverse.elements);
    this.ctx.draw();
    renderer.resetState();
  }
}
