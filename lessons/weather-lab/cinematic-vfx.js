export const CINEMATIC_SCENES = Object.freeze({
  lotus: { duration: 9500, label: "HỎA LIÊN · HOA VŨ" },
  flowers_sakura: { duration: 60000, label: "SAKURA RAIN" },
  flowers_blue: { duration: 60000, label: "MOON PETALS" },
  flowers_gold: { duration: 60000, label: "GOLDEN LEAVES" },
  pixie_dust: { duration: 60000, label: "PIXIE DUST" },
  vortex_fire: { duration: 12000, label: "FIRE VORTEX" },
  summon_dust: { duration: 60000, label: "SUMMON DUST" },
  lightning: { duration: 9000, label: "MIRROR STORM" },
});

export const CINEMATIC_ASSET_MANIFEST = Object.freeze({
  fire: { file: "fire_04_8x8.png", type: "flipbook", columns: 8, rows: 8, license: "CC0 · Brackeys VFX Bundle" },
  fireRing: { file: "fire_ring_6x5.png", type: "flipbook", columns: 6, rows: 5, license: "CC0 · Brackeys VFX Bundle" },
  swordImpact: { file: "impact_white_6x4.png", type: "flipbook", columns: 6, rows: 4, license: "CC0 · Brackeys VFX Bundle" },
  flare: { file: "flare_01_a.png", type: "particle", license: "CC0 · Brackeys VFX Bundle" },
  smoke: { file: "smoke_03_a.png", type: "particle", license: "CC0 · Brackeys VFX Bundle" },
  spark: { file: "spark_05_a.png", type: "particle", license: "CC0 · Brackeys VFX Bundle" },
  trace: { file: "trace_01_a.png", type: "particle", license: "CC0 · Brackeys VFX Bundle" },
  traceSoft: { file: "trace_03_a.png", type: "particle", license: "CC0 · Brackeys VFX Bundle" },
  pixieParticle: { file: "../pixi-pixiedust/particle.png", type: "particle", license: "MIT · Pixi Particle Emitter Editor" },
  lotusAtlas: { file: "../generated/lotus-neutral-atlas-20x4.png", type: "flipbook", columns: 20, rows: 4, license: "Generated from the project Thanh Lien 3D model" },
});

const clamp01 = value => Math.max(0, Math.min(1, value));
const easeOut = value => 1 - Math.pow(1 - clamp01(value), 3);
const smooth = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const phase = (age, start, end) => clamp01((age - start) / (end - start));
const LOTUS_COLORS = ["#f8fcff", "#ff76b8", "#ff4f55", "#ffc84f", "#62e58c", "#4ddfff", "#a978ff"];

function seeded(index, salt = 0) {
  const value = Math.sin(index * 91.917 + salt * 47.113) * 43758.5453;
  return value - Math.floor(value);
}

function makeFallingPetalSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(32, 8, 32, 120);
  gradient.addColorStop(0, "#efffff");
  gradient.addColorStop(.3, "#8eeaff");
  gradient.addColorStop(.68, "#4d8fe3");
  gradient.addColorStop(.92, "#8556d9");
  gradient.addColorStop(1, "rgba(36,49,132,.22)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(62, 40, 55, 96, 27, 124);
  ctx.bezierCurveTo(10, 91, 8, 43, 32, 4);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

export class CinematicVfxEngine {
  constructor(canvas, {
    assetRoot = "../assets/camera-effects/brackeys-runtime/",
    quality = "auto",
    mirrorInput = true,
    autoStart = true,
  } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.assetRoot = assetRoot;
    this.mirrorInput = mirrorInput;
    this.assets = {};
    this.mode = "clear";
    this.quality = quality;
    this.activeQuality = quality === "cinematic" ? "cinematic" : "classroom";
    this.anchor = { x: .5, y: .58 };
    this.aim = { x: .9, y: .34 };
    this.span = null;
    this.smoothedAnchor = { ...this.anchor };
    this.smoothedAim = { ...this.aim };
    this.smoothedSpan = null;
    this.startedAt = performance.now();
    this.releasedAt = Infinity;
    this.until = 0;
    this.last = this.startedAt;
    this.frameTimes = [];
    this.swords = [];
    this.swordMotes = [];
    this.embers = [];
    this.petals = [];
    this.dustMotes = [];
    this.dustSummoning = false;
    this.dustAnchor = { ...this.anchor };
    this.dustEmitCarry = 0;
    this.petalSprite = makeFallingPetalSprite();
    this.lotusTintCell = document.createElement("canvas");
    this.lotusTintCell.width = 256;
    this.lotusTintCell.height = 256;
    this.running = false;
    this.vortexFrames = 0;
    this.loadAssets();
    this.loadFootagePlates();
    this.loop = this.loop.bind(this);
    if (autoStart) this.start();
  }

  loadAssets() {
    for (const [key, spec] of Object.entries(CINEMATIC_ASSET_MANIFEST)) {
      const image = new Image();
      image.decoding = "async";
      if (key === "smoke") {
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0);
          ctx.globalCompositeOperation = "source-in";
          const tint = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          tint.addColorStop(0, "#42dfff");
          tint.addColorStop(.48, "#6848ff");
          tint.addColorStop(1, "#345dff");
          ctx.fillStyle = tint;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const tinted = new Image();
          tinted.src = canvas.toDataURL("image/png");
          this.assets.smokeLotus = tinted;
        };
      } else if (key === "spark" || key === "pixieParticle") {
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0);
          ctx.globalCompositeOperation = "source-in";
          const tint = ctx.createRadialGradient(
            canvas.width * .5,
            canvas.height * .5,
            0,
            canvas.width * .5,
            canvas.height * .5,
            canvas.width * .7,
          );
          tint.addColorStop(0, "#e8ffff");
          tint.addColorStop(.28, "#68eaff");
          tint.addColorStop(1, "#365cff");
          ctx.fillStyle = tint;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const tinted = new Image();
          tinted.src = canvas.toDataURL("image/png");
          this.assets[key === "spark" ? "sparkLotus" : "pixieLotus"] = tinted;
        };
      }
      image.src = this.assetRoot + spec.file;
      this.assets[key] = image;
    }
  }

  loadFootagePlates() {
    const root = "../assets/camera-effects/footagecrate-runtime/";
    this.footage = {};
    for (const [key, file] of Object.entries({ explosion: "simple-explosion-30.webm" })) {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = root + file;
      this.footage[key] = video;
    }
  }

  restartFootage(key, loop = false) {
    const video = this.footage?.[key];
    if (!video) return;
    video.loop = loop;
    video.currentTime = 0;
    video.play().catch(() => {});
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
  }

  cast(mode, options = {}) {
    if (typeof options === "number") options = { duration: options };
    const { anchor = this.anchor, aim = this.aim, duration, manualVolley = false } = options;
    if (mode === "petals") mode = "lotus";
    if (!CINEMATIC_SCENES[mode]) return this.clear();
    this.mode = mode;
    this.anchor = this.toScreen(anchor);
    this.aim = this.toAim(aim);
    this.smoothedAnchor = { ...this.anchor };
    this.smoothedAim = { ...this.aim };
    this.startedAt = performance.now();
    this.releasedAt = Infinity;
    this.until = 0;
    this.prepareScene(mode);
    return mode;
  }

  setMode(mode, origin = this.anchor) {
    return this.cast(mode, { anchor: origin, aim: origin });
  }

  clear() {
    this.mode = "clear";
    this.until = 0;
    this.dustSummoning = false;
    this.dustMotes.length = 0;
  }

  setDustSummon(active, point) {
    this.dustSummoning = Boolean(active);
    if (point) this.dustAnchor = this.toScreen(point);
    if (this.dustSummoning && (this.mode === "clear" || this.mode === "summon_dust")) {
      if (this.mode !== "summon_dust") {
        this.mode = "summon_dust";
        this.startedAt = performance.now();
        this.until = 0;
        for (let index = 0; index < 120; index += 1) this.dustMotes.push(this.spawnDustMote(index));
      }
      this.anchor = { ...this.dustAnchor };
      this.smoothedAnchor = { ...this.dustAnchor };
    }
  }

  spawnDustMote(index) {
    const angle = seeded(index, 1651) * Math.PI * 2;
    const speed = .035 + seeded(index, 1652) * .105;
    return {
      x: this.dustAnchor.x + (seeded(index, 1653) - .5) * .025,
      y: this.dustAnchor.y + (seeded(index, 1654) - .5) * .025,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - .035,
      life: 0,
      maxLife: 2.4 + seeded(index, 1655) * 3.4,
      size: .0025 + seeded(index, 1656) * .008,
      depth: .3 + seeded(index, 1657) * .9,
      phase: seeded(index, 1658) * Math.PI * 2,
    };
  }

  release() {
    if (this.mode !== "lotus" || Number.isFinite(this.releasedAt)) return false;
    this.releasedAt = performance.now();
    this.restartFootage("explosion");
    for (const [index, petal] of this.petals.entries()) {
      const angle = seeded(index, 81) * Math.PI * 2;
      const speed = .46 + seeded(index, 82) * .84;
      const fieldPetal = index % 3 === 0;
      petal.x = fieldPetal ? ((Math.floor(index / 3) + .5) / Math.ceil(this.petals.length / 3)) : this.smoothedAnchor.x + Math.cos(angle) * .045;
      petal.y = fieldPetal ? .04 + seeded(index, 85) * .7 : this.smoothedAnchor.y + Math.sin(angle) * .03;
      petal.vx = fieldPetal ? (seeded(index, 86) - .5) * .14 : Math.cos(angle) * speed;
      petal.vy = fieldPetal ? .025 + seeded(index, 87) * .055 : Math.sin(angle) * speed - .42 - seeded(index, 83) * .3;
    }
    return true;
  }

  signalSwordVolley(aim) {
    if (this.mode !== "swords" || Number.isFinite(this.swordVolleyAt)) return false;
    if (aim) this.aim = this.toAim(aim);
    this.cometLaunchOrigin = { ...this.smoothedAnchor };
    this.swordVolleyAt = performance.now();
    this.cometImpactStarted = false;
    this.restartFootage("explosion");
    return true;
  }

  setQuality(quality) {
    this.quality = quality;
    this.activeQuality = quality === "cinematic" ? "cinematic" : "classroom";
  }

  setTracking({ anchor, aim, span } = {}) {
    if (anchor) this.anchor = this.toScreen(anchor);
    if (aim) this.aim = this.toAim(aim);
    if (span?.length === 2) {
      this.span = span.map(point => this.toScreen(point));
      if (!this.smoothedSpan) this.smoothedSpan = this.span.map(point => ({ ...point }));
    } else if (span === null) {
      this.span = null;
      this.smoothedSpan = null;
    }
  }

  toScreen(point) {
    return { x: this.mirrorInput ? 1 - point.x : point.x, y: point.y };
  }

  toAim(point) {
    const screen = this.toScreen(point);
    return { x: Math.max(.16, Math.min(.84, screen.x)), y: Math.max(.14, Math.min(.86, screen.y)) };
  }

  setHand(point) {
    this.setTracking({ anchor: point, aim: point });
  }

  getState(now = performance.now()) {
    const scene = CINEMATIC_SCENES[this.mode];
    const age = this.mode === "clear" ? 0 : now - this.startedAt;
    return {
      mode: this.mode,
      age,
      remaining: scene ? Math.max(0, this.until - now) : 0,
      progress: scene ? clamp01(age / (this.until - this.startedAt)) : 0,
      quality: this.activeQuality,
    };
  }

  prepareScene(mode) {
    const multiplier = this.activeQuality === "cinematic" ? 1.35 : 1;
    if (mode === "swords") {
      const count = Math.round(28 * multiplier);
      this.swords = Array.from({ length: count }, (_, index) => ({
        x: .07 + seeded(index, 1) * .86,
        y: .11 + seeded(index, 2) * .38,
        depth: .48 + seeded(index, 3) * .66,
        delay: (index % 8) * 72 + Math.floor(index / 8) * 36,
        tilt: (seeded(index, 4) - .5) * .12,
      })).sort((a, b) => a.depth - b.depth);
      this.swordMotes = Array.from({ length: Math.round(44 * multiplier) }, (_, index) => ({
        x: seeded(index, 71),
        y: seeded(index, 72),
        speed: .018 + seeded(index, 73) * .055,
        drift: (seeded(index, 74) - .5) * .08,
        depth: .35 + seeded(index, 75) * .8,
      }));
    }
    if (mode === "lotus") {
      this.embers = Array.from({ length: Math.round(28 * multiplier) }, (_, index) => ({
        angle: seeded(index, 5) * Math.PI * 2,
        radius: .06 + seeded(index, 6) * .42,
        speed: .2 + seeded(index, 7) * .72,
        depth: .35 + seeded(index, 8) * .8,
      }));
      this.pixieDust = Array.from({ length: Math.round(42 * multiplier) }, (_, index) => {
        const lifetime = .34 + seeded(index, 53) * .72;
        return {
          angle: seeded(index, 51) * Math.PI * 2,
          age: seeded(index, 52) * lifetime,
          lifetime,
          speed: 34 + seeded(index, 54) * 92,
          scale: .006 + seeded(index, 55) * .024,
          spawnRadius: .018 + seeded(index, 56) * .075,
        };
      });
      this.petals = Array.from({ length: Math.round(72 * multiplier) }, (_, index) => ({
        x: seeded(index, 9),
        y: -.1 - seeded(index, 10) * .8,
        depth: .32 + seeded(index, 11) * .9,
        drift: (seeded(index, 12) - .5) * .11,
        spin: seeded(index, 13) * Math.PI * 2,
        spinSpeed: (seeded(index, 14) - .5) * 3.1,
        vx: 0,
        vy: 0,
      }));
    }
    if (mode.startsWith("flowers_")) {
      this.until = performance.now() + 60000;
      this.petals = Array.from({ length: Math.round(68 * multiplier) }, (_, index) => ({
        x: seeded(index, 1301),
        y: seeded(index, 1302) * 1.15 - .15,
        depth: .28 + seeded(index, 1303) * .86,
        drift: (seeded(index, 1304) - .5) * .1,
        spin: seeded(index, 1305) * Math.PI * 2,
        spinSpeed: (seeded(index, 1306) - .5) * 2.6,
        vx: 0,
        vy: .012 + seeded(index, 1307) * .035,
      }));
    }
    if (mode === "pixie_dust") {
      this.pixieDust = Array.from({ length: Math.round(84 * multiplier) }, (_, index) => ({
        x: seeded(index, 1601),
        y: seeded(index, 1602),
        depth: .25 + seeded(index, 1603) * .9,
        speed: .018 + seeded(index, 1604) * .052,
        drift: (seeded(index, 1605) - .5) * .065,
        phase: seeded(index, 1606) * Math.PI * 2,
      }));
      this.until = performance.now() + CINEMATIC_SCENES.pixie_dust.duration;
    }
    if (mode === "vortex_fire") {
      this.vortexFrames = 0;
      const captured = this.dustMotes.filter(mote => mote.life < mote.maxLife);
      const count = Math.max(Math.round(150 * multiplier), captured.length);
      this.embers = Array.from({ length: count }, (_, index) => {
        const mote = captured[index % Math.max(1, captured.length)];
        const dx = mote ? mote.x - this.anchor.x : Math.cos(seeded(index, 1701) * Math.PI * 2) * (.08 + seeded(index, 1702) * .42);
        const dy = mote ? mote.y - this.anchor.y : Math.sin(seeded(index, 1701) * Math.PI * 2) * (.06 + seeded(index, 1702) * .3);
        return {
          angle: Math.atan2(dy, dx),
          radius: Math.max(.035, Math.min(.58, Math.hypot(dx, dy))),
          spin: .75 + seeded(index, 1703) * .5,
          depth: mote?.depth || .28 + seeded(index, 1704) * .92,
          phase: mote?.phase || seeded(index, 1705) * Math.PI * 2,
        };
      });
      this.dustMotes.length = 0;
      this.dustSummoning = false;
      this.until = performance.now() + CINEMATIC_SCENES.vortex_fire.duration;
    }
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width || 1280);
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height || 720);
    const dpr = this.activeQuality === "cinematic" ? Math.min(1.5, devicePixelRatio || 1) : 1;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  loop(now) {
    if (!this.running) return;
    const frameMs = Math.min(80, Math.max(1, now - this.last));
    const dt = Math.min(.04, frameMs / 1000);
    this.last = now;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    if (this.quality === "auto" && this.frameTimes.length === 90) {
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      this.activeQuality = sorted[Math.floor(sorted.length * .9)] > 33 ? "classroom" : "cinematic";
    }
    const { width, height } = this.resize();
    this.smoothedAnchor.x += (this.anchor.x - this.smoothedAnchor.x) * Math.min(1, dt * 7);
    this.smoothedAnchor.y += (this.anchor.y - this.smoothedAnchor.y) * Math.min(1, dt * 7);
    this.smoothedAim.x += (this.aim.x - this.smoothedAim.x) * Math.min(1, dt * 9);
    this.smoothedAim.y += (this.aim.y - this.smoothedAim.y) * Math.min(1, dt * 9);
    if (this.span && this.smoothedSpan) {
      for (let index = 0; index < 2; index += 1) {
        this.smoothedSpan[index].x += (this.span[index].x - this.smoothedSpan[index].x) * Math.min(1, dt * 12);
        this.smoothedSpan[index].y += (this.span[index].y - this.smoothedSpan[index].y) * Math.min(1, dt * 12);
      }
    }
    this.ctx.clearRect(0, 0, width, height);
    if (this.until && now >= this.until) this.clear();
    if (this.mode !== "clear") this.render(width, height, now, dt);
    requestAnimationFrame(this.loop);
  }

  render(width, height, now, dt) {
    const age = now - this.startedAt;
    if (this.mode === "lightning") this.renderLightning(width, height, age);
    if (this.mode === "swords") this.renderSwords(width, height, age);
    if (this.mode === "lotus") this.renderLotus(width, height, age, dt);
    if (this.mode.startsWith("flowers_")) {
      const filter = this.mode === "flowers_sakura"
        ? "hue-rotate(82deg) saturate(1.35) brightness(1.12)"
        : this.mode === "flowers_gold"
          ? "sepia(1) saturate(2.4) hue-rotate(345deg) brightness(1.15)"
          : "hue-rotate(0deg) saturate(1.15) brightness(1.08)";
      this.ctx.save();
      this.ctx.filter = filter;
      if (this.mode === "flowers_blue") this.drawLotusField(width, height, dt, age, 1);
      else this.drawPetalField(width, height, dt, age, 1);
      this.ctx.restore();
    }
    if (this.mode === "pixie_dust") this.renderPixieDust(width, height, age, dt);
    if (this.mode === "summon_dust") this.renderSummonedDust(width, height, age, dt);
    if (this.mode === "vortex_fire") this.renderFireVortex(width, height, age);
    if (this.mode === "orb") this.renderEnergyBall(width, height, age);
  }

  renderPixieDust(width, height, age, dt) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let index = 0; index < this.pixieDust.length; index += 1) {
      const mote = this.pixieDust[index];
      mote.y -= mote.speed * dt;
      mote.x += (mote.drift + Math.sin(age * .0011 + mote.phase) * .018) * dt;
      if (mote.y < -.06 || mote.x < -.06 || mote.x > 1.06) {
        mote.y = 1.04 + seeded(index + Math.floor(age / 900), 1611) * .12;
        mote.x = seeded(index + Math.floor(age / 700), 1612);
      }
      const pulse = .55 + Math.sin(age * .005 + mote.phase) * .45;
      const size = base * (.006 + mote.depth * .018);
      ctx.filter = index % 3 ? "hue-rotate(18deg) saturate(1.3)" : "hue-rotate(294deg) saturate(1.45)";
      this.drawTexture(
        this.assets.pixieLotus ? "pixieLotus" : "pixieParticle",
        mote.x * width,
        mote.y * height,
        size,
        size,
        (.16 + mote.depth * .58) * pulse,
        mote.phase + age * .00025,
      );
      if (index % 7 === 0) {
        ctx.fillStyle = index % 2 ? "rgba(255,198,246,.8)" : "rgba(142,236,255,.8)";
        ctx.globalAlpha = pulse * .55;
        ctx.beginPath();
        ctx.arc(mote.x * width, mote.y * height, Math.max(1, size * .12), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderSummonedDust(width, height, age, dt) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    if (this.dustSummoning) {
      this.dustEmitCarry += dt * 1600;
      while (this.dustEmitCarry >= 1 && this.dustMotes.length < 520) {
        this.dustEmitCarry -= 1;
        const index = this.dustMotes.length + Math.floor(age);
        this.dustMotes.push(this.spawnDustMote(index));
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "#69dfff";
    ctx.shadowBlur = 7;
    for (const mote of this.dustMotes) {
      mote.life += dt;
      const turbulence = Math.sin(age * .0012 + mote.phase + mote.y * 18) * .018;
      mote.vx += turbulence * dt;
      mote.vy -= .008 * dt;
      mote.vx *= .992;
      mote.vy *= .992;
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      const life = mote.life / mote.maxLife;
      const birth = Math.min(1, mote.life / .18);
      const fade = Math.min(1, (1 - life) / .28);
      const twinkle = .62 + Math.sin(age * .005 + mote.phase) * .38;
      const alpha = birth * fade * twinkle * (.25 + mote.depth * .52);
      const radius = base * mote.size * (1 + Math.max(0, .22 - mote.life) * 5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = mote.depth > .75 ? "#efffff" : mote.depth > .48 ? "#7ce8ff" : "#557dff";
      ctx.beginPath();
      ctx.arc(mote.x * width, mote.y * height, Math.max(.8, radius), 0, Math.PI * 2);
      ctx.fill();
    }
    this.dustMotes = this.dustMotes.filter(mote => mote.life < mote.maxLife);
    ctx.restore();
  }

  renderFireVortex(width, height, age) {
    this.vortexFrames += 1;
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const anchor = { x: this.smoothedAnchor.x * width, y: this.smoothedAnchor.y * height };
    const charge = clamp01(age / 4400);
    const gather = Math.min(1, charge / .4);
    const vortexT = Math.max(0, (charge - .4) / .6);
    const collapse = vortexT * vortexT * (2.3 * vortexT - 1.3);
    const spinEnvelope = .12 + .88 * charge * charge;
    const burst = smooth((age - 4300) / 110) * (1 - smooth((age - 5350) / 900));
    const fade = 1 - phase(age, 9400, 12000);
    const coreRadius = base * (.025 + charge * .035 + burst * .05);
    this.environmentGrade(width, height, "rgba(12,3,1,ALPHA)", (.06 + charge * .2) * fade);
    this.localLight(anchor.x, anchor.y, base * (.18 + charge * .2), "255,78,18", (.09 + charge * .28 + burst * .34) * fade);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "#ff5a12";
    ctx.shadowBlur = 4;
    const frame = Math.floor(age / 36);
    ctx.filter = "none";
    for (let index = 0; index < this.embers.length; index += 1) {
      const ember = this.embers[index];
      const initialRadius = base * ember.radius;
      const gatheredRadius = initialRadius * (1 + .16 * smooth(gather));
      const radius = Math.max(base * .012, gatheredRadius * (1 - collapse));
      const shear = 1 + base * .18 / Math.max(radius, base * .018);
      const angle = ember.angle + age * .0013 * ember.spin * spinEnvelope * shear;
      const burstDistance = burst * base * (.09 + ember.radius * .7);
      const orbit = radius + burstDistance;
      const wobble = Math.sin(age * .004 + ember.phase) * base * .006 * (1 - charge);
      const x = anchor.x + Math.cos(angle) * orbit + Math.cos(ember.phase) * wobble;
      const y = anchor.y + Math.sin(angle) * orbit * (.48 + ember.depth * .18) + Math.sin(ember.phase) * wobble;
      const size = base * (.0035 + ember.depth * .009) * (1 + smooth(gather) * 1.7 - collapse * .45);
      ctx.globalAlpha = fade * (.28 + ember.depth * .54) * (.45 + charge * .55);
      ctx.fillStyle = index % 5 === 0 ? "#ffe2a0" : index % 3 === 0 ? "#ff7a1a" : "#d93408";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.1, size * .32), 0, Math.PI * 2);
      ctx.fill();
      if (index % 7 === 0) {
        const tail = size * (1.4 + Math.min(1.5, shear * .13));
        ctx.strokeStyle = index % 14 ? "#ff6c14" : "#ffd49a";
        ctx.lineWidth = Math.max(.6, size * .12);
        ctx.globalAlpha *= .46;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(angle) * tail, y - Math.sin(angle) * tail * .56);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    ctx.filter = "none";
    this.drawFrameRect(
      "fireRing",
      frame,
      anchor.x,
      anchor.y,
      coreRadius * 3,
      coreRadius * 1.15,
      fade * (.12 + Math.max(0, collapse) * .5),
      age * .00045,
    );
    if (burst > .01) {
      this.drawFrame("fire", frame, anchor.x, anchor.y, coreRadius * (3.2 + burst), burst * fade * .9);
      this.drawFrame("swordImpact", frame, anchor.x, anchor.y, coreRadius * 4.2, burst * fade * .72);
    }
    ctx.restore();
  }

  renderEnergyBall(width, height, age) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const anchor = { x: this.smoothedAnchor.x * width, y: this.smoothedAnchor.y * height };
    const gather = smooth(age / 1250);
    const stable = 1 - phase(age, 7000, 8200);
    const pulse = .5 - .5 * Math.cos(age * .0048);
    const radius = base * (.024 + gather * (.055 + pulse * .006));
    this.environmentGrade(width, height, "rgba(3,7,24,ALPHA)", (.08 + gather * .13) * stable);
    this.localLight(anchor.x, anchor.y, radius * 7.2, "48,137,255", (.1 + gather * .19) * stable);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const fireball = this.footage?.fireball;
    if (fireball?.readyState >= 2) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.filter = "hue-rotate(168deg) saturate(1.85) brightness(1.12)";
      ctx.globalAlpha = gather * stable * .9;
      ctx.drawImage(fireball, anchor.x - radius * 2.7, anchor.y - radius * 1.52, radius * 5.4, radius * 3.04);
      ctx.restore();
    }
    ctx.filter = "hue-rotate(184deg) saturate(1.5) brightness(1.12)";
    for (let index = 0; index < 38; index += 1) {
      const depth = .45 + seeded(index, 204) * .75;
      const inward = 1 - gather;
      const orbit = age * (.0012 + depth * .0011) * (index % 2 ? 1 : -1) + seeded(index, 201) * Math.PI * 2;
      const orbitRadius = radius * (1.18 + seeded(index, 202) * 1.8 + inward * 4.2);
      const x = anchor.x + Math.cos(orbit) * orbitRadius;
      const y = anchor.y + Math.sin(orbit) * orbitRadius * (.52 + depth * .16);
      const tangent = orbit + Math.PI / 2;
      const size = base * (.004 + depth * .008);
      this.drawTexture("traceSoft", x, y, size, size * (2.8 + depth * 2.2), gather * stable * (.12 + depth * .24), tangent);
    }
    ctx.filter = "hue-rotate(176deg) saturate(2.1) brightness(.72)";
    for (let index = 0; index < 5; index += 1) {
      const angle = age * .00042 * (index % 2 ? -1 : 1) + index * 1.43;
      const distance = radius * (.45 + index * .22);
      this.drawTexture(
        "smoke",
        anchor.x + Math.cos(angle) * distance,
        anchor.y + Math.sin(angle) * distance * .54,
        radius * (2.8 + index * .28),
        radius * (1.5 + index * .16),
        gather * stable * (.045 + index * .008),
        angle + age * .00008,
      );
    }
    ctx.filter = "none";

    ctx.restore();
  }

  drawFrame(key, frame, x, y, size, alpha = 1) {
    const image = this.assets[key];
    const spec = CINEMATIC_ASSET_MANIFEST[key];
    if (!image?.complete || !image.naturalWidth || spec.type !== "flipbook") return;
    const cellWidth = image.naturalWidth / spec.columns;
    const cellHeight = image.naturalHeight / spec.rows;
    const index = frame % (spec.columns * spec.rows);
    this.ctx.globalAlpha = clamp01(alpha);
    this.ctx.drawImage(
      image,
      (index % spec.columns) * cellWidth,
      Math.floor(index / spec.columns) * cellHeight,
      cellWidth,
      cellHeight,
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
  }

  drawFrameRect(key, frame, x, y, width, height, alpha = 1, angle = 0, tintColor = null) {
    const image = this.assets[key];
    const spec = CINEMATIC_ASSET_MANIFEST[key];
    if (!image?.complete || !image.naturalWidth || spec.type !== "flipbook") return;
    const cellWidth = image.naturalWidth / spec.columns;
    const cellHeight = image.naturalHeight / spec.rows;
    const index = frame % (spec.columns * spec.rows);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = clamp01(alpha);
    const sourceX = (index % spec.columns) * cellWidth;
    const sourceY = Math.floor(index / spec.columns) * cellHeight;
    if (tintColor) {
      const cell = this.lotusTintCell;
      const cellCtx = cell.getContext("2d");
      cellCtx.clearRect(0, 0, cell.width, cell.height);
      cellCtx.globalCompositeOperation = "source-over";
      cellCtx.drawImage(image, sourceX, sourceY, cellWidth, cellHeight, 0, 0, cell.width, cell.height);
      cellCtx.globalCompositeOperation = "multiply";
      cellCtx.fillStyle = tintColor;
      cellCtx.fillRect(0, 0, cell.width, cell.height);
      cellCtx.globalCompositeOperation = "destination-in";
      cellCtx.drawImage(image, sourceX, sourceY, cellWidth, cellHeight, 0, 0, cell.width, cell.height);
      ctx.drawImage(cell, -width / 2, -height / 2, width, height);
    } else {
      ctx.drawImage(image, sourceX, sourceY, cellWidth, cellHeight, -width / 2, -height / 2, width, height);
    }
    ctx.restore();
  }

  drawTexture(key, x, y, width, height, alpha = 1, angle = 0) {
    const image = this.assets[key];
    if (!image?.complete || !image.naturalWidth) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = clamp01(alpha);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  environmentGrade(width, height, color, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color.replace("ALPHA", alpha.toFixed(3));
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  localLight(x, y, radius, rgb, alpha) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
    gradient.addColorStop(.28, `rgba(${rgb},${alpha * .46})`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  renderLightning(width, height, age) {
    return this.renderCinematicLightningPlate(width, height, age);
  }

  renderCinematicLightningPlate(width, height, age) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const target = { x: this.smoothedAim.x * width, y: this.smoothedAim.y * height };
    const cycleAge = age % 2400;
    const leader = smooth((cycleAge - 300) / 220) * (1 - smooth((cycleAge - 610) / 170));
    const returnStroke = smooth((cycleAge - 540) / 32) * (1 - smooth((cycleAge - 1080) / 470));
    const reStrike = smooth((cycleAge - 1480) / 24) * (1 - smooth((cycleAge - 1710) / 250));
    const afterglow = smooth((cycleAge - 920) / 120) * (1 - smooth((cycleAge - 2100) / 500));
    const strike = Math.max(returnStroke, reStrike * .86);
    const decay = 1 - phase(age, 6900, 7600);
    this.environmentGrade(width, height, "rgba(1,4,13,ALPHA)", (.14 + strike * .2 + afterglow * .06) * decay);
    this.localLight(target.x, target.y, base * .58, "116,194,255", (leader * .06 + strike * .34 + afterglow * .07) * decay);

    const plate = this.assets.lightningPlate;
    if (plate?.complete && plate.naturalWidth && (leader > .01 || strike > .01 || afterglow > .01)) {
      const plateSize = base * 1.22;
      const x = target.x;
      const y = target.y - plateSize * .48;
      const cycle = Math.floor(age / 2400);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(cycle % 2 ? -1 : 1, 1);
      ctx.rotate((seeded(cycle, 731) - .5) * .045);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = (leader * .22 + strike * .96 + afterglow * .1) * decay;
      ctx.filter = strike > .4 ? "brightness(1.22) contrast(1.08)" : "brightness(.82) saturate(.72)";
      ctx.drawImage(plate, -plateSize / 2, -plateSize / 2, plateSize, plateSize);
      if (strike > .2) {
        ctx.globalAlpha = strike * .24 * decay;
        ctx.filter = "blur(13px) brightness(1.5)";
        ctx.drawImage(plate, -plateSize / 2, -plateSize / 2, plateSize, plateSize);
      }
      ctx.restore();
    }

    const boltAlpha = (leader * .28 + strike + reStrike * .72) * decay;
    if (boltAlpha > .01) {
      const cycle = Math.floor(age / 2400);
      const sources = [
        { x: width * (.18 + seeded(cycle, 751) * .22), y: -height * .04 },
        { x: width * (.58 + seeded(cycle, 752) * .32), y: -height * .06 },
        { x: width * (.02 + seeded(cycle, 753) * .96), y: height * (.08 + seeded(cycle, 754) * .12) },
      ];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const primary = this.drawBolt(sources[0], target, 1800 + cycle * 31, Math.max(1.4, base * .006), boltAlpha);
      this.drawBolt(sources[1], target, 1900 + cycle * 37, Math.max(1, base * .0027), boltAlpha * .5);
      if (reStrike > .04) this.drawBolt(sources[2], target, 2000 + cycle * 41, Math.max(1, base * .0021), reStrike * decay * .48);
      for (let index = 4; index < primary.length - 3; index += 6) {
        const start = primary[index];
        const side = index % 12 ? -1 : 1;
        const branchLength = base * (.07 + seeded(index, 761 + cycle) * .13);
        const end = {
          x: start.x + side * branchLength,
          y: start.y + branchLength * (.18 + seeded(index, 762 + cycle) * .45),
        };
        this.drawBolt(start, end, 2200 + cycle * 47 + index, Math.max(.7, base * .0015), boltAlpha * .34);
      }
      ctx.restore();
    }

    const impact = Math.max(strike, afterglow * .42) * decay;
    if (impact > .01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = "none";
      for (let index = 0; index < 18; index += 1) {
        const angle = index * 2.399963 + cycleAge * .001;
        const radius = base * (.025 + seeded(index, 741) * .15) * Math.max(.2, strike);
        const size = base * (.004 + seeded(index, 742) * .009);
        this.drawTexture("sparkLotus", target.x + Math.cos(angle) * radius, target.y + Math.sin(angle) * radius * .45, size, size * 1.9, impact * (.2 + seeded(index, 743) * .44), angle);
      }
      ctx.restore();
    }

    if (strike > .02) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(202,232,255,${strike * .16 * decay})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  renderLegacyLightning(width, height, age) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const anchor = { x: this.smoothedAim.x * width, y: this.smoothedAim.y * height };
    const cycleAge = age % 2400;
    const charge = smooth(cycleAge / 520);
    const leader = smooth((cycleAge - 340) / 180) * (1 - smooth((cycleAge - 620) / 180));
    const returnStroke = smooth((cycleAge - 560) / 35) * (1 - smooth((cycleAge - 1050) / 450));
    const reStrike = smooth((cycleAge - 1500) / 30) * (1 - smooth((cycleAge - 1610) / 230));
    const strike = Math.max(returnStroke, reStrike * .74);
    const afterglow = smooth((cycleAge - 920) / 100) * (1 - smooth((cycleAge - 1900) / 420));
    const decay = 1 - phase(age, 6900, 7600);
    this.environmentGrade(width, height, "rgba(2,5,16,ALPHA)", (.07 + charge * .035 + leader * .025 + strike * .09) * decay);
    this.localLight(anchor.x, anchor.y, base * .48, "70,154,255", (.035 + charge * .055 + strike * .2 + afterglow * .055) * decay);
    if (strike > .01 || leader > .01) {
      const skyLight = ctx.createRadialGradient(anchor.x, 0, 0, anchor.x, 0, Math.max(width, height) * .88);
      skyLight.addColorStop(0, `rgba(221,243,255,${(strike * .38 + leader * .08) * decay})`);
      skyLight.addColorStop(.26, `rgba(104,169,231,${(strike * .17 + leader * .035) * decay})`);
      skyLight.addColorStop(1, "rgba(26,57,111,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = skyLight;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (this.smoothedSpan) {
      const [first, second] = this.smoothedSpan.map(point => ({ x: point.x * width, y: point.y * height }));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      this.drawBolt(first, second, 1400 + Math.floor(age / 55), Math.max(1, base * .0024), charge * .3 * decay);
      this.drawEnergyOrb(anchor.x, anchor.y, base * (.018 + charge * .012), age, charge * .72 * decay);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "brightness(.22) saturate(.7)";
    for (let index = 0; index < 5; index += 1) {
      const x = width * (.08 + index * .22) + Math.sin(age / 900 + index) * width * .035;
      const y = height * (.03 + (index % 2) * .055);
      this.drawTexture("smoke", x, y, width * .48, height * .34, (.06 + charge * .08) * decay, index * .43);
    }
    ctx.filter = "none";
    if (strike > .02 || afterglow > .02) {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(157,210,255,${(strike * .095 + afterglow * .025) * decay})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  drawEnergyOrb(x, y, radius, age, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
    glow.addColorStop(0, "rgba(255,255,255,.98)");
    glow.addColorStop(.16, "rgba(142,226,255,.88)");
    glow.addColorStop(.48, "rgba(55,126,255,.3)");
    glow.addColorStop(1, "rgba(20,49,140,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.8, 0, Math.PI * 2);
    ctx.fill();
    for (let index = 0; index < 5; index += 1) {
      const angle = index / 5 * Math.PI * 2 + age * .0011;
      const start = { x: x + Math.cos(angle) * radius * .5, y: y + Math.sin(angle) * radius * .5 };
      const end = { x: x + Math.cos(angle + .45) * radius * 1.8, y: y + Math.sin(angle + .45) * radius * 1.8 };
      this.drawBolt(start, end, 800 + index + Math.floor(age / 90), Math.max(1, radius * .035), alpha * .65);
    }
    ctx.restore();
  }

  drawBolt(start, end, seed, width, alpha) {
    const ctx = this.ctx;
    const points = [start];
    const segments = Math.max(18, Math.min(36, Math.round(Math.hypot(end.x - start.x, end.y - start.y) / 24)));
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    for (let index = 1; index < segments; index += 1) {
      const t = index / segments;
      const envelope = Math.sin(t * Math.PI);
      const offset = (seeded(index, seed) - .5) * length * .065 * envelope;
      points.push({ x: start.x + dx * t + nx * offset, y: start.y + dy * t + ny * offset });
    }
    points.push(end);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const [strokeWidth, color, opacity] of [
      [width * 2.2, "rgba(54,120,255,.16)", alpha],
      [width * .82, "rgba(123,210,255,.62)", alpha],
      [Math.max(1, width * .22), "rgba(244,253,255,.98)", alpha],
    ]) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = color;
      ctx.globalAlpha = clamp01(opacity);
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    ctx.restore();
    return points;
  }

  renderSwords(width, height, age) {
    return this.renderArcaneDetonation(width, height, age);
  }

  renderArcaneDetonation(width, height, age) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const target = { x: this.smoothedAim.x * width, y: this.smoothedAim.y * height };
    const lock = smooth(age / 760);
    const volleyAge = Number.isFinite(this.swordVolleyAt)
      ? Math.max(0, this.startedAt + age - this.swordVolleyAt)
      : -1;
    const fired = volleyAge >= 0;
    const decay = 1 - phase(age, 7200, 8800);
    this.environmentGrade(width, height, "rgba(8,3,12,ALPHA)", (.055 + lock * .055 + (fired ? .08 : 0)) * decay);
    this.localLight(target.x, target.y, base * .26, "255,94,28", (lock * .08 + (fired ? .2 : 0)) * decay);

    if (!fired) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let index = 0; index < 18; index += 1) {
        const inward = 1 - lock;
        const angle = index * 2.399963 + age * (.00038 + seeded(index, 651) * .0003);
        const radius = base * (.035 + seeded(index, 652) * .12 + inward * .18);
        const x = target.x + Math.cos(angle) * radius;
        const y = target.y + Math.sin(angle) * radius * .55;
        const size = base * (.003 + seeded(index, 653) * .006);
        ctx.filter = "sepia(1) saturate(7) hue-rotate(338deg)";
        this.drawTexture("spark", x, y, size, size * 1.6, lock * (.13 + seeded(index, 654) * .28), angle);
      }
      ctx.filter = "none";
      this.drawTexture("flare", target.x, target.y, base * .038, base * .018, lock * .18);
      ctx.restore();
      return;
    }

    const explosion = this.footage?.explosion;
    if (volleyAge < 2800 && explosion?.readyState >= 2) {
      const fade = 1 - phase(volleyAge, 1750, 2800);
      const plateWidth = base * .72;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = fade * .9 * decay;
      ctx.filter = "saturate(1.08) contrast(1.04)";
      ctx.drawImage(explosion, target.x - plateWidth / 2, target.y - plateWidth * .34, plateWidth, plateWidth * 9 / 16);
      ctx.restore();
    }
    const flash = (1 - phase(volleyAge, 0, 310)) * decay;
    if (flash > .01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255,181,112,${flash * .21})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  renderAstralComet(width, height, age) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const formation = this.smoothedSpan?.length === 2
      ? {
          x: (this.smoothedSpan[0].x + this.smoothedSpan[1].x) * width / 2,
          y: (this.smoothedSpan[0].y + this.smoothedSpan[1].y) * height / 2,
        }
      : { x: this.smoothedAnchor.x * width, y: this.smoothedAnchor.y * height };
    const target = { x: this.smoothedAim.x * width, y: this.smoothedAim.y * height };
    const gather = smooth(age / 950);
    const volleyAge = Number.isFinite(this.swordVolleyAt)
      ? Math.max(0, this.startedAt + age - this.swordVolleyAt)
      : 0;
    const launched = volleyAge > 0;
    const flight = smooth(volleyAge / 920);
    const start = this.cometLaunchOrigin
      ? { x: this.cometLaunchOrigin.x * width, y: this.cometLaunchOrigin.y * height }
      : formation;
    const bend = base * .16 * (target.y < start.y ? -1 : 1);
    const control = { x: (start.x + target.x) / 2, y: (start.y + target.y) / 2 - bend };
    const inverse = 1 - flight;
    const comet = launched
      ? {
          x: inverse * inverse * start.x + 2 * inverse * flight * control.x + flight * flight * target.x,
          y: inverse * inverse * start.y + 2 * inverse * flight * control.y + flight * flight * target.y,
        }
      : formation;
    const velocity = {
      x: 2 * inverse * (control.x - start.x) + 2 * flight * (target.x - control.x),
      y: 2 * inverse * (control.y - start.y) + 2 * flight * (target.y - control.y),
    };
    const angle = Math.atan2(velocity.y, velocity.x);
    const decay = 1 - phase(age, 7200, 8800);
    this.environmentGrade(width, height, "rgba(9,3,12,ALPHA)", (.08 + gather * .1) * decay);
    this.localLight(comet.x, comet.y, base * .32, "255,92,28", (.12 + gather * .18) * decay);

    if (!launched) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "brightness(.32) sepia(.72) saturate(1.1)";
      for (let index = 0; index < 7; index += 1) {
        const orbit = index / 7 * Math.PI * 2 + age * .00017 * (index % 2 ? 1 : -1);
        const radius = base * (.015 + seeded(index, 620) * .045) * gather;
        const size = base * (.12 + seeded(index, 621) * .08);
        this.drawTexture("smoke", formation.x + Math.cos(orbit) * radius, formation.y + Math.sin(orbit) * radius * .55 - base * .025, size, size * .72, gather * (.06 + seeded(index, 622) * .07), orbit);
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = "saturate(1.28) brightness(1.12)";
      for (let index = 0; index < 13; index += 1) {
        const orbit = index / 13 * Math.PI * 2 + age * .00082 * (index % 2 ? 1 : -1);
        const radius = base * (.022 + seeded(index, 623) * .058) * gather;
        const flameWidth = base * (.026 + seeded(index, 624) * .025);
        const flameHeight = base * (.07 + seeded(index, 625) * .07);
        this.drawFrameRect("fire", Math.floor(age / 48) + index * 5, formation.x + Math.cos(orbit) * radius, formation.y + Math.sin(orbit) * radius * .52, flameWidth, flameHeight, gather * (.24 + seeded(index, 626) * .34), orbit + Math.PI / 2);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fireball = this.footage?.fireball;
    if (fireball?.readyState >= 2 && (!launched || flight < 1)) {
      const radius = base * (.075 + gather * .035);
      ctx.save();
      ctx.translate(comet.x, comet.y);
      ctx.rotate(angle);
      ctx.globalAlpha = decay * (.5 + gather * .48);
      ctx.filter = "saturate(1.2) brightness(1.08)";
      ctx.drawImage(fireball, -radius * 1.8, -radius, radius * 3.6, radius * 2);
      ctx.restore();
    }
    if (launched && flight > .72 && !this.cometImpactStarted) {
      this.cometImpactStarted = true;
      this.restartFootage("explosion");
    }
    const explosion = this.footage?.explosion;
    const impactAge = volleyAge - 700;
    if (impactAge > 0 && impactAge < 2500 && explosion?.readyState >= 2) {
      const impactFade = 1 - phase(impactAge, 1500, 2500);
      const plateWidth = base * .62;
      ctx.globalAlpha = impactFade * .86 * decay;
      ctx.drawImage(explosion, target.x - plateWidth / 2, target.y - plateWidth * .34, plateWidth, plateWidth * 9 / 16);
      this.localLight(target.x, target.y, base * .44, "255,112,34", impactFade * .3);
    }
    ctx.restore();

    if (launched && flight < 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let index = 1; index <= 11; index += 1) {
        const trailT = Math.max(0, flight - index * .045);
        if (trailT <= 0) continue;
        const trailInverse = 1 - trailT;
        const x = trailInverse * trailInverse * start.x + 2 * trailInverse * trailT * control.x + trailT * trailT * target.x;
        const y = trailInverse * trailInverse * start.y + 2 * trailInverse * trailT * control.y + trailT * trailT * target.y;
        const tail = 1 - index / 12;
        const size = base * (.018 + tail * .04);
        ctx.filter = "saturate(1.35) brightness(1.06)";
        this.drawFrameRect("fire", Math.floor(age / 42) + index * 4, x, y, size, size * 1.9, tail * .42 * decay, angle + Math.PI / 2);
        if (index % 2 === 0) {
          ctx.filter = "brightness(.34) sepia(.8)";
          this.drawTexture("smoke", x, y, size * 2.5, size * 1.45, tail * .07 * decay, angle);
        }
      }
      ctx.filter = "none";
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const moteCount = this.activeQuality === "cinematic" ? 34 : 22;
    for (let index = 0; index < moteCount; index += 1) {
      const orbit = age * (.0011 + seeded(index, 611) * .0012) + index * 2.399963;
      const radius = base * (.035 + seeded(index, 612) * .11) * (1 - flight * .72);
      const x = comet.x + Math.cos(orbit) * radius;
      const y = comet.y + Math.sin(orbit) * radius * .58;
      const size = base * (.004 + seeded(index, 613) * .009);
      ctx.filter = "sepia(1) saturate(6) hue-rotate(338deg)";
      this.drawTexture("spark", x, y, size, size * 1.8, gather * decay * (.18 + seeded(index, 614) * .42), orbit);
    }
    ctx.filter = "none";
    ctx.restore();
  }

  renderLegacySwords(width, height, age) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const target = { x: this.smoothedAim.x * width, y: this.smoothedAim.y * height };
    const portal = phase(age, 0, 1200);
    const charged = smooth((age - 1350) / 2600);
    const volleyAge = Number.isFinite(this.swordVolleyAt)
      ? Math.max(0, this.startedAt + age - this.swordVolleyAt)
      : 0;
    const launchMix = smooth(volleyAge / 1250);
    const decay = 1 - phase(age, 6700, 8800);
    const formationLight = {
      x: width * .5 + (target.x - width * .5) * launchMix,
      y: height * .43 + (target.y - height * .43) * launchMix,
    };
    this.environmentGrade(width, height, "rgba(3,8,24,ALPHA)", (.13 + portal * .18 + charged * .1) * decay);
    this.localLight(formationLight.x, formationLight.y, base * (.38 + charged * .16), "62,91,232", (.08 + charged * .09) * decay);
    this.localLight(formationLight.x, formationLight.y, base * .23, "182,64,255", charged * .085 * decay);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "brightness(.2) saturate(.72) hue-rotate(165deg)";
    for (let index = 0; index < 3; index += 1) {
      const drift = Math.sin(age * .00024 + index * 2.2) * width * .06;
      this.drawTexture(
        "smoke",
        width * (.22 + index * .29) + drift,
        height * (.31 + (index % 2) * .14),
        width * (.34 + index * .045),
        height * (.2 + index * .025),
        (.018 + portal * .042) * decay,
        index * .82 - age * .000018,
      );
    }
    ctx.restore();

    const aura = smooth((age - 850) / 1100) * (1 - smooth((age - 4500) / 850));
    if (aura > .01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const mote of this.swordMotes) {
        const x = ((mote.x + age * mote.speed * .0001) % 1) * width;
        const y = (.16 + mote.y * .58 + Math.sin(age * .0012 + mote.x * 12) * mote.drift) * height;
        const size = base * (.006 + mote.depth * .011);
        this.drawTexture("spark", x, y, size * .55, size * 2.1, aura * (.12 + mote.depth * .2), age * .0008 + mote.x * 5);
      }
      ctx.restore();
    }

    const routeAlpha = smooth(volleyAge / 100) * (1 - smooth((volleyAge - 1250) / 450));
    if (routeAlpha > .01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let index = 0; index < 7; index += 1) {
        const angle = index / 7 * Math.PI * 2 - Math.PI * .57;
        const start = {
          x: width * .5 + Math.cos(angle) * width * (.27 + (index % 2) * .035),
          y: height * .43 + Math.sin(angle) * height * (.27 + (index % 3) * .018),
        };
        const bend = (index % 2 ? 1 : -1) * base * (.1 + (index % 3) * .018);
        const dx = target.x - start.x;
        const dy = target.y - start.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / length;
        const ny = dx / length;
        const control1 = { x: start.x + dx * .34 + nx * bend, y: start.y + dy * .34 + ny * bend };
        const control2 = { x: start.x + dx * .72 - nx * bend * .42, y: start.y + dy * .72 - ny * bend * .42 };
        const drawRoute = (color, lineWidth, alpha, dash) => {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, target.x, target.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.globalAlpha = routeAlpha * alpha;
          ctx.setLineDash(dash);
          ctx.lineDashOffset = -age * (.028 + index * .0018);
          ctx.stroke();
        };
        drawRoute("rgba(133,221,255,.96)", 1.05, .54, [base * .014, base * .052]);
        drawRoute("rgba(255,255,255,.98)", .42, .76, []);
        const flow = (age * .00024 + index * .137) % 1;
        const inverse = 1 - flow;
        const flowX = inverse ** 3 * start.x
          + 3 * inverse ** 2 * flow * control1.x
          + 3 * inverse * flow ** 2 * control2.x
          + flow ** 3 * target.x;
        const flowY = inverse ** 3 * start.y
          + 3 * inverse ** 2 * flow * control1.y
          + 3 * inverse * flow ** 2 * control2.y
          + flow ** 3 * target.y;
        this.drawTexture("flare", flowX, flowY, base * .018, base * .006, routeAlpha * .22);
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const impact = phase(volleyAge, 1780, 3330);
    if (impact > 0 && impact < 1) {
      const flash = Math.sin(impact * Math.PI);
      const impactFrame = Math.min(23, Math.floor(impact * 24));
      ctx.filter = "sepia(1) saturate(4) hue-rotate(145deg) brightness(1.35)";
      this.drawFrame("swordImpact", impactFrame, target.x, target.y, base * .32, flash * .78);
      ctx.filter = "none";
      this.drawTexture("flare", target.x, target.y, base * (.07 + impact * .1), base * (.07 + impact * .1), flash * .52);
    }
    ctx.restore();
  }

  drawSword(x, y, size, angle, alpha, depth) {
    const ctx = this.ctx;
    const image = this.assets.sword;
    if (!image?.complete || !image.naturalWidth) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = Math.max(0, alpha) * (.48 + depth * .45);
    ctx.shadowBlur = 10 + depth * 15;
    ctx.shadowColor = "#6edcff";
    const ratio = image.naturalWidth / image.naturalHeight;
    const width = size * ratio * 1.45;
    ctx.drawImage(image, -width / 2, -size / 2, width, size);
    ctx.restore();
  }

  renderLotus(width, height, age, dt) {
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const anchor = { x: this.smoothedAnchor.x * width, y: this.smoothedAnchor.y * height };
    const gather = phase(age, 0, 1800);
    const bloom = phase(age, 1500, 3800);
    const heat = smooth((age - 3200) / 3600);
    const breathingAge = Math.max(0, age - 3000);
    const breathingPhase = (breathingAge % 2100) / 2100;
    const breathing = .5 - .5 * Math.cos(breathingPhase * Math.PI * 2);
    const cycleGrowth = 1 + Math.min(.34, breathingAge / 2100 * .06);
    const releaseAge = Number.isFinite(this.releasedAt) ? performance.now() - this.releasedAt : -1;
    const compression = phase(releaseAge, 0, 185) * (1 - phase(releaseAge, 185, 275));
    const burst = phase(releaseAge, 255, 1320);
    const flowerFall = phase(releaseAge, 420, 1900);
    const decay = releaseAge < 0 ? 1 : 1 - phase(releaseAge, 5600, 7200);
    this.environmentGrade(width, height, "rgba(2,8,35,ALPHA)", (.1 + gather * .2) * decay);
    this.localLight(anchor.x, anchor.y, base * (.3 + bloom * .32), "17,126,179", (.08 + bloom * .1) * decay);
    this.localLight(anchor.x, anchor.y + base * .075, base * .19, "74,161,190", (.025 + bloom * .045) * decay);
    this.localLight(anchor.x, anchor.y, base * .42, "48,105,255", heat * .085 * decay);
    this.localLight(anchor.x, anchor.y + base * .04, base * .25, "42,222,255", heat * .06 * decay);

    if (releaseAge >= 0 && releaseAge < 1500) {
      const ignition = smooth((releaseAge - 245) / 28);
      const flash = ignition * (1 - smooth((releaseAge - 390) / 260));
      const pressure = phase(releaseAge, 270, 1220);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const explosion = this.footage?.explosion;
      if (explosion?.readyState >= 2 && releaseAge < 1450) {
        const plateProgress = smooth(releaseAge / 260);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.filter = "hue-rotate(166deg) saturate(1.55) brightness(1.08)";
        ctx.globalAlpha = plateProgress * (1 - phase(releaseAge, 980, 1450)) * .72;
        const plateWidth = base * .88;
        ctx.drawImage(explosion, anchor.x - plateWidth / 2, anchor.y - plateWidth * .34, plateWidth, plateWidth * 9 / 16);
        ctx.restore();
      }
      const fireTrack = this.footage?.fireTrack;
      if (fireTrack?.readyState >= 2 && releaseAge > 180 && releaseAge < 1450) {
        const direction = Math.atan2(this.smoothedAim.y - this.smoothedAnchor.y, this.smoothedAim.x - this.smoothedAnchor.x);
        ctx.save();
        ctx.translate(anchor.x, anchor.y);
        ctx.rotate(direction);
        ctx.globalCompositeOperation = "screen";
        ctx.filter = "hue-rotate(168deg) saturate(1.6) brightness(1.15)";
        ctx.globalAlpha = Math.sin(phase(releaseAge, 180, 1450) * Math.PI) * .64;
        ctx.drawImage(fireTrack, -base * .42, -base * .118, base * .84, base * .4725);
        ctx.restore();
      }
      if (compression > .01) {
        const implosion = ctx.createRadialGradient(anchor.x, anchor.y, 0, anchor.x, anchor.y, base * (.08 + compression * .25));
        implosion.addColorStop(0, `rgba(255,255,255,${compression * .78})`);
        implosion.addColorStop(.16, `rgba(84,224,255,${compression * .55})`);
        implosion.addColorStop(.48, `rgba(130,31,221,${compression * .22})`);
        implosion.addColorStop(1, "rgba(8,0,28,0)");
        ctx.fillStyle = implosion;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, base * (.08 + compression * .25), 0, Math.PI * 2);
        ctx.fill();
      }
      if (pressure > .005) {
        for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
          const ringProgress = clamp01((pressure - ringIndex * .075) / (1 - ringIndex * .075));
          if (ringProgress <= 0) continue;
          const easedRing = 1 - (1 - ringProgress) ** 3;
          const ringRadius = base * (.055 + easedRing * (.42 + ringIndex * .11));
          const ringAlpha = Math.sin(ringProgress * Math.PI) * (.15 - ringIndex * .035);
          ctx.beginPath();
          for (let segment = 0; segment <= 72; segment += 1) {
            const angle = segment / 72 * Math.PI * 2;
            const wobble = 1
              + Math.sin(angle * 5 + ringIndex * 1.7) * .018
              + Math.sin(angle * 11 - ringIndex * .9) * .008;
            const pointX = anchor.x + Math.cos(angle) * ringRadius * wobble;
            const pointY = anchor.y + Math.sin(angle) * ringRadius * (.56 + ringIndex * .045) * wobble;
            if (segment === 0) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
          }
          ctx.closePath();
          ctx.strokeStyle = ringIndex === 0 ? "rgba(225,252,255,.94)" : "rgba(76,181,255,.7)";
          ctx.lineWidth = Math.max(1.2, base * (.012 - ringIndex * .0022) * (1 - ringProgress * .58));
          ctx.globalAlpha = ringAlpha;
          ctx.shadowColor = ringIndex === 0 ? "#c9f9ff" : "#427cff";
          ctx.shadowBlur = 30 + ringIndex * 14;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      ctx.filter = "hue-rotate(285deg) saturate(1.4) brightness(1.35)";
      this.drawTexture("flare", anchor.x, anchor.y, base * (.15 + burst * .56), base * (.15 + burst * .56), flash * .72);
      if (burst > .01) {
        const plumeRadius = base * (1 - (1 - burst) ** 2) * .44;
        ctx.filter = "hue-rotate(18deg) brightness(.78) saturate(.72) contrast(1.12)";
        for (let index = 0; index < 14; index += 1) {
          const angle = index / 14 * Math.PI * 2 + (seeded(index, 94) - .5) * .34;
          const distance = plumeRadius * (.42 + seeded(index, 95) * .92);
          const plumeSize = base * (.16 + seeded(index, 96) * .19) * (.58 + burst * 1.02);
          this.drawTexture(
            "smokeLotus",
            anchor.x + Math.cos(angle) * distance,
            anchor.y + Math.sin(angle) * distance * .76,
            plumeSize,
            plumeSize * (.58 + seeded(index, 97) * .38),
            Math.sin(burst * Math.PI) * (.1 + seeded(index, 98) * .12),
            angle + age * .0002 * (index % 2 ? 1 : -1),
          );
        }
        ctx.filter = "hue-rotate(268deg) saturate(1.3) brightness(1.1)";
        this.drawFrame("swordImpact", Math.min(23, Math.floor(burst * 24)), anchor.x, anchor.y, base * (.13 + burst * .35), flash * .56);
      }
      ctx.filter = "none";
      for (let index = 0; index < 24; index += 1) {
        const angle = index / 24 * Math.PI * 2 + (seeded(index, 90) - .5) * .24;
        const radius = base * (1 - (1 - burst) ** 2) * (.11 + seeded(index, 87) * .32);
        const size = base * (.008 + seeded(index, 88) * .026);
        const ribbon = index % 6 === 0;
        this.drawTexture(
          ribbon ? "traceSoft" : "sparkLotus",
          anchor.x + Math.cos(angle) * radius,
          anchor.y + Math.sin(angle) * radius * .78,
          size,
          size * (ribbon ? 4.2 : 1.8),
          Math.max(flash, Math.sin(burst * Math.PI) * .7) * (.22 + seeded(index, 89) * .32),
          angle + Math.PI / 2,
        );
      }
      ctx.filter = "none";
      ctx.fillStyle = `rgba(180,226,255,${flash * .24})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "brightness(.28) saturate(1.55) hue-rotate(145deg)";
    for (let index = 0; index < 3; index += 1) {
      const drift = Math.sin(age / 1100 + index * 2.1) * base * .035;
      this.drawTexture(
        "smoke",
        anchor.x + drift + (index - 1) * base * .12,
        anchor.y + base * .1,
        base * (.34 + index * .08),
        base * (.16 + index * .035),
        (.035 + bloom * .045) * decay,
        index * .7 + age * .00004,
      );
    }
    ctx.globalCompositeOperation = "lighter";
    const fireBloom = bloom * (age < 3000 ? 1 : .7 + breathing * .3);
    ctx.filter = `hue-rotate(${Math.round((1 - heat) * 182)}deg) saturate(1.2)`;
    this.drawFireLotus(anchor.x, anchor.y + base * .025, base * (.72 + cycleGrowth * .12), fireBloom, burst, age, decay);
    ctx.filter = "none";
    this.drawPixieDust(anchor.x, anchor.y, dt, base, age, (.18 + bloom * .34 + heat * .22) * decay);
    for (const [index, ember] of this.embers.entries()) {
      const orbit = ember.angle + age * .00045 * ember.speed * (index % 2 ? 1 : -1);
      const radius = base * ember.radius * (.42 + bloom * .58) * cycleGrowth;
      const x = anchor.x + Math.cos(orbit) * radius;
      const y = anchor.y + Math.sin(orbit) * radius * .34 - Math.sin(age * .0013 + index) * base * .018;
      const size = base * (.006 + ember.depth * .01);
      const alpha = (.08 + ember.depth * .18) * (bloom * .7 + heat * .3) * decay;
      const isRibbon = index % 9 === 0;
      this.drawTexture(isRibbon ? "traceSoft" : "sparkLotus", x, y, size, size * (isRibbon ? 4 : 2.5), alpha * (isRibbon ? .48 : 1), orbit + Math.PI / 2);
    }
    ctx.filter = "none";
    if (flowerFall > 0) this.drawPetalField(width, height, dt, age, flowerFall * decay);
    ctx.restore();
  }

  drawPixieDust(x, y, dt, base, age, alpha) {
    for (const [index, particle] of (this.pixieDust || []).entries()) {
      particle.age += dt / 1000;
      if (particle.age >= particle.lifetime) {
        particle.age = 0;
        particle.angle = seeded(index + Math.floor(age / 500), 61) * Math.PI * 2;
      }
      const t = particle.age / particle.lifetime;
      const distance = base * particle.spawnRadius + particle.speed * particle.age * (.45 + t * .55);
      const px = x + Math.cos(particle.angle + age * .00025) * distance;
      const py = y + Math.sin(particle.angle + age * .00025) * distance * .62;
      const size = base * particle.scale * (1 - t * .9);
      this.drawTexture("pixieLotus", px, py, size, size, (1 - t) * alpha * .74, particle.angle);
    }
  }

  drawFireLotus(x, y, base, bloom, burst, age, decay) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(age / 1700) * .025);
    for (let index = 0; index < 11; index += 1) {
      const depth = .35 + (index % 5) * .14;
      const direction = index % 2 ? 1 : -1;
      const angle = index / 11 * Math.PI * 2 + age * .00034 * direction * (1.05 - depth * .2);
      const radius = base * (.13 + depth * .075) * easeOut(bloom);
      const flameX = Math.cos(angle) * radius;
      const flameY = Math.sin(angle) * radius * .33;
      const flameWidth = base * (.025 + depth * .013);
      const flameHeight = base * (.075 + depth * .045) * (1 + burst * .14);
      this.drawTexture(
        "traceSoft",
        flameX - Math.cos(angle) * flameHeight * .38,
        flameY - Math.sin(angle) * flameHeight * .16,
        flameWidth * .7,
        flameHeight * 1.7,
        (.045 + depth * .055) * bloom * decay,
        angle + Math.PI / 2,
      );
      this.drawFrameRect(
        "fire",
        Math.floor(age / 64) + index * 5,
        flameX,
        flameY,
        flameWidth,
        flameHeight,
        (.075 + depth * .085) * bloom * decay,
        angle + Math.sin(age * .0017 + index) * .22,
      );
    }
    ctx.restore();
  }

  drawPetalField(width, height, dt, age, alpha) {
    const ctx = this.ctx;
    const wind = (this.smoothedAim.x - .5) * .2;
    const seconds = dt;
    for (const [index, petal] of this.petals.entries()) {
      petal.vy += seconds * (.16 + petal.depth * .08);
      petal.vx *= Math.pow(.86, seconds);
      petal.y += seconds * (petal.vy + .025 + petal.depth * .035);
      petal.x += seconds * (petal.vx + petal.drift + wind + Math.sin(age / 720 + index) * .018);
      petal.spin += petal.spinSpeed * seconds;
      if (petal.y > 1.12 || petal.x < -.12 || petal.x > 1.12) {
        petal.y = -.08;
        petal.x = seeded(index + Math.floor(age / 1000), 40);
        petal.vx = 0;
        petal.vy = .02;
      }
      const size = 7 + petal.depth * 15;
      ctx.save();
      ctx.translate(petal.x * width, petal.y * height);
      ctx.rotate(petal.spin);
      ctx.globalAlpha = alpha * (.34 + petal.depth * .54);
      ctx.shadowColor = "#64dfff";
      ctx.shadowBlur = 8 + petal.depth * 8;
      ctx.drawImage(this.petalSprite, -size * .5, -size, size, size * 2);
      ctx.restore();
    }
  }

  drawLotusField(width, height, dt, age, alpha) {
    const wind = (this.smoothedAim.x - .5) * .13;
    for (let index = 0; index < this.petals.length; index += 2) {
      const flower = this.petals[index];
      flower.vy += dt * (.035 + flower.depth * .025);
      flower.y += dt * (flower.vy + .018 + flower.depth * .018);
      flower.x += dt * (flower.drift + wind + Math.sin(age * .00075 + index) * .026);
      flower.spin += flower.spinSpeed * dt * .18;
      if (flower.y > 1.16 || flower.x < -.16 || flower.x > 1.16) {
        flower.y = -.12 - seeded(index + Math.floor(age / 900), 1701) * .28;
        flower.x = seeded(index + Math.floor(age / 1100), 1702);
        flower.vy = .006 + seeded(index, 1703) * .018;
      }
      const size = 34 + flower.depth * 62;
      const sway = Math.sin(age * .0011 + flower.spin) * .14;
      const cycle = Math.PI * 2;
      const phaseFrame = Math.floor(age / 75 + index * 2.3) % 20;
      const angleFrame = (Math.floor(((flower.spin % cycle) + cycle) % cycle / (cycle / 4)) % 4) * 20;
      this.drawFrameRect(
        "lotusAtlas",
        angleFrame + phaseFrame,
        flower.x * width,
        flower.y * height,
        size,
        size,
        alpha * (.28 + flower.depth * .62),
        sway,
        LOTUS_COLORS[Number.isInteger(this.lotusColorIndex) ? this.lotusColorIndex : index % LOTUS_COLORS.length],
      );
    }
  }
}
