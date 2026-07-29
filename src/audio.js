// Loads one SFX file per spell from ./assets/sfx/<key>.mp3 (see assets/sfx/README.md
// for where to download free CC0 sounds). Missing files are skipped silently so the
// VFX still works before you've added audio.
const SFX_FILES={
  fireball:  './assets/sfx/fireball.mp3',
  frost:     './assets/sfx/frost.mp3',
  lightning: './assets/sfx/lightning.mp3',
  shield:    './assets/sfx/shield.mp3',
  portal:    './assets/sfx/portal.mp3',
  heal:      './assets/sfx/heal.mp3',
};

export class AudioManager{
  constructor(){
    this.ctx=null;
    this.buffers={};
    this.muted=false;
    this.lastPlay={};
    this._loadAll();
  }

  async _loadAll(){
    for(const[key,url]of Object.entries(SFX_FILES)){
      try{
        const res=await fetch(url);
        if(!res.ok)continue;
        const arr=await res.arrayBuffer();
        this.buffers[key]=arr;
      }catch{ /* asset not present yet — VFX still runs without sound */ }
    }
  }

  unlock(){
    if(this.ctx)return;
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    for(const[key,arr]of Object.entries(this.buffers)){
      this.ctx.decodeAudioData(arr.slice(0),buf=>{this.buffers[key]=buf;},()=>{});
    }
  }

  toggleMute(){this.muted=!this.muted;return !this.muted;}

  play(key){
    if(this.muted||!this.ctx)return;
    const buf=this.buffers[key];
    if(!buf||!(buf instanceof AudioBuffer))return;
    const now=this.ctx.currentTime;
    if(this.lastPlay[key]&&now-this.lastPlay[key]<0.25)return; // debounce re-trigger spam
    this.lastPlay[key]=now;
    const src=this.ctx.createBufferSource();
    src.buffer=buf;
    const gain=this.ctx.createGain();
    gain.gain.value=0.6;
    src.connect(gain).connect(this.ctx.destination);
    src.start(0);
  }
}
