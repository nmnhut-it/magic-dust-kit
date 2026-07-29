import { MY_FX_CLIPS } from './spells.js?v=4';
const TAU=Math.PI*2;
const LOTUS_COLORS=[0xf8fcff,0xff76b8,0xff4f55,0xffc84f,0x62e58c,0x4ddfff,0xa978ff];

export class StudioEffects{
  constructor({THREE,scene,camera,renderer,video,handCanvas,statusEl}){
    this.THREE=THREE;this.scene=scene;this.camera=camera;this.renderer=renderer;
    this.video=video;this.handCanvas=handCanvas;this.statusEl=statusEl;
    this.mode='clear';this.blur=false;this.flip=false;this.lighting='normal';this.until=0;this.photoPending=false;
    this.segmentation=null;   // set by main.js; capture() must mirror its layers
    this.activeOverlayFront=false;
    this.activeOverlay=null;this.overlayTimer=null;
    this.buildVideoOverlays();
    this.buildWeather();
    this.buildLotus();
  }

  buildVideoOverlays(){
    const sources={
      koto:'./lessons/assets/camera-effects/overlays/koto-stag.mp4',
      dragon:'./lessons/assets/camera-effects/overlays/dragon-strike.mp4',
      rose:'./lessons/assets/camera-effects/overlays/spirit-rose.mp4',
      phoenix:'./lessons/assets/camera-effects/overlays/spirit-phoenix.mp4',
      butterfly:'./lessons/assets/camera-effects/overlays/crystal-butterflies.mp4',
      sakura:'./lessons/assets/camera-effects/overlays/sakura-bloom.mp4',
      smoke:'./lessons/assets/camera-effects/overlays/smoke-blue.mp4',
      lightning:'./lessons/assets/camera-effects/overlays/lightning-ground.mp4',
      rain:'./lessons/assets/camera-effects/overlays/rain-storm.mp4',
      flower:'./lessons/assets/camera-effects/overlays/flower-pink.mp4',
      magic:'./lessons/assets/camera-effects/overlays/glyph-white.mp4',
      ...MY_FX_CLIPS,          // video bạn tự bỏ vào assets/my-fx/ (xem my-spells.js)
    };
    this.videoOverlays={};
    for(const [kind,src] of Object.entries(sources)){
      // ambient atmospheres loop; a creature that makes ONE entrance (the stag,
      // the phoenix rising) plays through and clears itself
      const loops=kind==='smoke'||kind==='flower'||kind==='magic'||kind==='butterfly'||kind==='sakura';
      this.addOverlay(kind,src,loops);
    }
  }

  // Học sinh tự thêm clip lúc đang chạy (xem my-fx-panel.js): dựng thêm một
  // <video> đúng như mấy clip có sẵn, nên playOverlay không cần biết khác biệt.
  addOverlay(kind,src,loops=false){
    this.videoOverlays[kind]?.remove();
    const video=document.createElement('video');
    video.className='spell-video-overlay';video.dataset.spell=kind;
    video.src=src;video.muted=true;video.playsInline=true;video.preload='auto';video.loop=loops;
    document.body.appendChild(video);this.videoOverlays[kind]=video;
    if(!loops)video.addEventListener('ended',()=>this.stopOverlay());
    return video;
  }

  // front: draw this plate ABOVE the cut-out person (petals/dust near the lens)
  // instead of behind them. See FRONT_SPELLS in spells.js.
  playOverlay(kind,front=false){
    const video=this.videoOverlays[kind];if(!video)return false;
    this.stopOverlay();this.activeOverlay=kind;this.activeOverlayFront=front;
    video.classList.toggle('front',!!front);
    video.currentTime=kind==='lightning'?1.35:0;video.classList.add('visible');
    void video.play().catch(()=>this.status(`${kind.toUpperCase()} · tap once to allow video playback`));
    clearTimeout(this.overlayTimer);
    if(kind==='smoke')this.overlayTimer=setTimeout(()=>this.stopOverlay(),45000);
    this.status(`${kind.toUpperCase()} · VIDEO SPELL`);
    return true;
  }

  stopOverlay(){
    clearTimeout(this.overlayTimer);this.overlayTimer=null;
    for(const video of Object.values(this.videoOverlays||{})){video.pause();video.classList.remove('visible');}
    this.activeOverlay=null;
  }

  buildWeather(){
    const T=this.THREE,count=2200;
    this.weatherCount=count;
    this.weatherPositions=new Float32Array(count*3);
    this.weatherVelocity=new Float32Array(count*2);
    this.weatherDepth=new Float32Array(count);
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(this.weatherPositions,3));
    this.weatherMaterial=new T.ShaderMaterial({
      uniforms:{uMode:{value:0},uOpacity:{value:0}},
      vertexShader:`varying float vDepth;uniform float uMode;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vDepth=clamp((position.z+20.0)/40.0,0.0,1.0);
        gl_PointSize=(uMode>.5?16.0:2.5)+(uMode>.5?vDepth*30.0:vDepth*4.0);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float vDepth;uniform float uMode;uniform float uOpacity;
        void main(){vec2 p=gl_PointCoord-vec2(.5);float a;
        if(uMode>.5){
          float core=1.0-smoothstep(.025,.105,abs(p.x));
          float tip=1.0-smoothstep(.34,.5,abs(p.y));
          a=core*tip;
        }
        else a=smoothstep(.5,.08,length(p));
        if(a<.02)discard;vec3 c=uMode>.5?mix(vec3(.34,.62,.86),vec3(.82,.94,1.0),vDepth):mix(vec3(.62,.78,.92),vec3(1.0),vDepth);
        gl_FragColor=vec4(c,a*uOpacity*(uMode>.5?.12+vDepth*.34:.35+vDepth*.65));}`,
      transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
    });
    this.weatherPoints=new T.Points(geometry,this.weatherMaterial);
    this.weatherPoints.visible=false;this.scene.add(this.weatherPoints);
  }

  buildLotus(){
    const T=this.THREE,count=42;
    this.lotusCount=count;
    this.lotusPositions=new Float32Array(count*3);
    this.lotusSizes=new Float32Array(count);
    this.lotusFrames=new Float32Array(count);
    this.lotusTints=new Float32Array(count*3);
    this.lotusData=Array.from({length:count},(_,index)=>({
      phase:index*3%20,angle:index%4,
      speed:4.2+Math.random()*5.4,drift:(Math.random()-.5)*3.4,
      depth:Math.random(),
    }));
    this.lotusTexture=new T.TextureLoader().load('./lessons/assets/camera-effects/generated/lotus-neutral-atlas-20x4.png');
    this.lotusTexture.colorSpace=T.SRGBColorSpace;
    this.lotusTexture.wrapS=this.lotusTexture.wrapT=T.ClampToEdgeWrapping;
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(this.lotusPositions,3));
    geometry.setAttribute('lotusSize',new T.BufferAttribute(this.lotusSizes,1));
    geometry.setAttribute('lotusFrame',new T.BufferAttribute(this.lotusFrames,1));
    geometry.setAttribute('lotusTint',new T.BufferAttribute(this.lotusTints,3));
    this.lotusMaterial=new T.ShaderMaterial({
      uniforms:{uAtlas:{value:this.lotusTexture},uOpacity:{value:.9},uScale:{value:620}},
      vertexShader:`attribute float lotusSize;attribute float lotusFrame;attribute vec3 lotusTint;
        varying float vFrame;varying vec3 vTint;uniform float uScale;
        void main(){vFrame=lotusFrame;vTint=lotusTint;vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=lotusSize*uScale/max(12.0,-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform sampler2D uAtlas;uniform float uOpacity;varying float vFrame;varying vec3 vTint;
        void main(){float column=mod(floor(vFrame),20.0);float row=floor(floor(vFrame)/20.0);
        vec2 uv=vec2((column+gl_PointCoord.x)/20.0,(4.0-row-gl_PointCoord.y)/4.0);
        vec4 texel=texture2D(uAtlas,uv);if(texel.a<.04)discard;
        gl_FragColor=vec4(texel.rgb*vTint,texel.a*uOpacity);}`,
      transparent:true,depthWrite:false,blending:T.NormalBlending,toneMapped:false,
    });
    this.lotusPoints=new T.Points(geometry,this.lotusMaterial);
    this.lotusPoints.visible=false;this.scene.add(this.lotusPoints);
  }

  viewport(){
    const h=2*Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov/2))*this.camera.position.z;
    return{h,w:h*this.camera.aspect};
  }

  seedWeather(mode){
    const {w,h}=this.viewport();
    const active=mode==='rain'?1400:1200;
    for(let i=0;i<this.weatherCount;i++){
      const p=i*3,v=i*2,live=i<active;
      this.weatherPositions[p]=(Math.random()-.5)*w*1.2;
      this.weatherPositions[p+1]=(Math.random()-.5)*h*1.35;
      this.weatherPositions[p+2]=(Math.random()-.5)*40;
      this.weatherDepth[i]=Math.random();
      this.weatherVelocity[v]=mode==='rain'?-5-Math.random()*7:(Math.random()-.5)*2.4;
      this.weatherVelocity[v+1]=mode==='rain'?-45-Math.random()*42:-5-Math.random()*10;
      if(!live)this.weatherPositions[p+2]=-999;
    }
    this.weatherPoints.geometry.attributes.position.needsUpdate=true;
  }

  seedLotus(){
    const {w,h}=this.viewport();
    const color=new this.THREE.Color();
    this.lotusData.forEach((data,index)=>{
      const p=index*3;
      this.lotusPositions[p]=(Math.random()-.5)*w*1.08;
      this.lotusPositions[p+1]=(Math.random()-.5)*h*1.3;
      this.lotusPositions[p+2]=(data.depth-.5)*25;
      this.lotusSizes[index]=4.6+data.depth*6.4;
      this.lotusFrames[index]=data.angle*20+Math.floor(data.phase);
      color.setHex(LOTUS_COLORS[index%LOTUS_COLORS.length]);
      color.toArray(this.lotusTints,p);
    });
    for(const attribute of Object.values(this.lotusPoints.geometry.attributes))attribute.needsUpdate=true;
    this.lotusPoints.visible=true;
  }

  activate(kind,duration=kind==='lotus'?60000:26000){
    if(kind==='blur'){
      this.blur=!this.blur;
      this.video.classList.toggle('studio-blur',this.blur);
      this.status(`BLUR ${this.blur?'ON':'OFF'} · Camera mềm, phép vẫn sắc nét`);
      return;
    }
    this.mode=kind;this.until=performance.now()+duration;
    this.weatherPoints.visible=kind==='rain';
    this.lotusPoints.visible=kind==='lotus';
    if(kind==='rain'){
      this.seedWeather(kind);this.weatherMaterial.uniforms.uMode.value=kind==='rain'?1:0;
      this.weatherMaterial.uniforms.uOpacity.value=kind==='rain'?.82:.9;
    }
    if(kind==='lotus')this.seedLotus();
    this.status(kind==='rain'?'RAIN · Mưa phủ toàn sân khấu':'LOTUS FALL · Liên Hoa Vũ 7 màu');
  }

  setLighting(kind='normal'){
    this.lighting=kind;
    document.body.classList.toggle('studio-lumos',kind==='lumos');
    document.body.classList.toggle('studio-nox',kind==='nox');
    this.status(kind==='lumos'?'LUMOS · Camera sáng lên':kind==='nox'?'NOX · Camera chìm vào bóng tối':'LIGHTING · NORMAL');
  }

  toggleFlip(){
    this.flip=!this.flip;
    document.body.classList.toggle('studio-flip',this.flip);
    this.status(`FLIP · Camera ${this.flip?'NORMAL':'MIRRORED'}`);
    return this.flip;
  }

  clear(){
    this.mode='clear';this.until=0;this.weatherPoints.visible=false;
    this.lotusPoints.visible=false;
    this.stopOverlay();
    this.status('ATMOSPHERE CLEARED');
  }

  status(text){if(this.statusEl)this.statusEl.textContent=text;}

  update(dt,now){
    if(this.until&&now>=this.until)this.clear();
    const {w,h}=this.viewport();
    if(this.mode==='rain'){
      const rain=this.mode==='rain',active=rain?1400:1200;
      for(let i=0;i<active;i++){
        const p=i*3,v=i*2;
        if(!rain)this.weatherVelocity[v]+=Math.sin(now*.001+i)*dt*.75;
        this.weatherPositions[p]+=this.weatherVelocity[v]*dt;
        this.weatherPositions[p+1]+=this.weatherVelocity[v+1]*dt;
        if(this.weatherPositions[p+1]<-h*.62||this.weatherPositions[p]<-w*.65){
          this.weatherPositions[p]=(Math.random()-.35)*w;
          this.weatherPositions[p+1]=h*.58+Math.random()*h*.18;
        }
      }
      this.weatherPoints.geometry.attributes.position.needsUpdate=true;
    }
    if(this.mode==='lotus'){
      this.lotusData.forEach((data,index)=>{
        const p=index*3;
        this.lotusPositions[p+1]-=data.speed*dt;
        this.lotusPositions[p]+=(data.drift+Math.sin(now*.0008+index)*1.2)*dt;
        data.phase=(data.phase+dt*10)%20;
        this.lotusFrames[index]=data.angle*20+Math.floor(data.phase);
        if(this.lotusPositions[p+1]<-h*.62){
          this.lotusPositions[p+1]=h*.62+Math.random()*h*.2;
          this.lotusPositions[p]=(Math.random()-.5)*w*1.08;
        }
      });
      this.lotusPoints.geometry.attributes.position.needsUpdate=true;
      this.lotusPoints.geometry.attributes.lotusFrame.needsUpdate=true;
    }
  }

  async capture(){
    if(this.photoPending)return false;
    this.photoPending=true;
    const badge=document.getElementById('photoCountdown');
    if(badge)badge.classList.add('show');
    for(const value of [3,2,1]){
      if(badge)badge.textContent=value;
      await new Promise(resolve=>setTimeout(resolve,650));
    }
    const width=Math.min(1920,Math.max(960,innerWidth)),height=Math.round(width*innerHeight/innerWidth);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    const vw=this.video.videoWidth||width,vh=this.video.videoHeight||height;
    const scale=Math.max(width/vw,height/vh),sw=width/scale,sh=height/scale;
    ctx.save();
    if(!this.flip){ctx.translate(width,0);ctx.scale(-1,1);}
    const lighting=this.lighting==='lumos'
      ?'brightness(1.34) contrast(1.07) saturate(1.08)'
      :this.lighting==='nox'
        ?'brightness(.46) contrast(1.12) saturate(.76)'
        :'brightness(1)';
    ctx.filter=`${this.blur?'blur(12px) ':''}${lighting}`;
    ctx.drawImage(this.video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,width,height);
    ctx.restore();ctx.filter='none';
    // Segmentation splits the frame into layers on screen, so the photo has to
    // be built the same way or it silently saves the pre-segmentation look:
    // blurred backdrop over the camera, then FX, then the sharp person on top.
    const seg=this.segmentation&&this.segmentation.layers;
    if(seg)ctx.drawImage(seg.backdrop,0,0,seg.backdrop.width,seg.backdrop.height,0,0,width,height);
    // The dust canvas (#cv) is composited on screen with mix-blend-mode:screen,
    // because the bloom composer writes an OPAQUE BLACK background. Drawing it
    // source-over here painted that black straight over the camera and the
    // photo came out black — the capture has to repeat the CSS blend.
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.drawImage(this.renderer.domElement,0,0,this.renderer.domElement.width,this.renderer.domElement.height,0,0,width,height);
    ctx.restore();
    const overlay=this.activeOverlay&&this.videoOverlays[this.activeOverlay];
    const front=!!this.activeOverlayFront;
    const drawPlate=()=>{
      if(!overlay||overlay.readyState<2)return;
      ctx.save();ctx.globalCompositeOperation=this.activeOverlay==='rain'?'source-over':'screen';
      ctx.globalAlpha=this.activeOverlay==='rain'?.66:this.activeOverlay==='smoke'?.78:this.activeOverlay==='flower'?.9:.92;
      // same grade the CSS puts on .spell-video-overlay, so the saved frame
      // matches what was on screen instead of a flatter version of it
      ctx.filter=this.activeOverlay==='rain'?'contrast(1.08) brightness(.88) saturate(.82)':'contrast(1.28) brightness(1.06) saturate(1.2)';
      const ow=overlay.videoWidth||1280,oh=overlay.videoHeight||720;
      const overlayScale=Math.max(width/ow,height/oh),sourceW=width/overlayScale,sourceH=height/overlayScale;
      ctx.drawImage(overlay,(ow-sourceW)/2,(oh-sourceH)/2,sourceW,sourceH,0,0,width,height);ctx.restore();
    };
    // Depth order, and it has to match the screen exactly: a BEHIND plate goes
    // under the caster, a FRONT plate (petals, dust) goes over them. Drawing
    // every plate before the person flattens near-camera weather into the
    // backdrop and loses the whole point of the mask.
    if(!front)drawPlate();
    if(seg){
      ctx.drawImage(seg.person,0,0,seg.person.width,seg.person.height,0,0,width,height);
      ctx.save();ctx.globalCompositeOperation='screen';
      ctx.drawImage(seg.rim,0,0,seg.rim.width,seg.rim.height,0,0,width,height);ctx.restore();
    }
    if(front)drawPlate();
    const link=document.createElement('a');
    link.download=`magic-dust-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;
    link.href=canvas.toDataURL('image/png');link.click();
    if(badge){badge.textContent='✓';badge.classList.add('flash');setTimeout(()=>badge.classList.remove('show','flash'),650);}
    this.status('PHOTO SAVED · Camera + Magic Dust VFX');
    this.photoPending=false;return true;
  }

  getState(){return{
    mode:this.mode,
    blur:this.blur,
    flip:this.flip,
    lighting:this.lighting,
    activeOverlay:this.activeOverlay,
    photoPending:this.photoPending,
    weatherVisible:this.weatherPoints.visible,
    lotusVisible:this.lotusPoints.visible?this.lotusCount:0,
    lotusReady:Boolean(this.lotusTexture.image?.complete&&this.lotusTexture.image?.naturalWidth),
  };}
}
