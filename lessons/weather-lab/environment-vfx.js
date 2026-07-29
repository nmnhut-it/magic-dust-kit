const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function seeded(index, salt = 0) {
  const value = Math.sin(index * 91.917 + salt * 47.113) * 43758.5453;
  return value - Math.floor(value);
}

function hexToRgb(hex = "#72e4ff") {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "72e4ff";
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function makeRainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const body = ctx.createLinearGradient(0, 0, 0, 256);
  body.addColorStop(0, "rgba(210,235,255,0)");
  body.addColorStop(.18, "rgba(220,242,255,.12)");
  body.addColorStop(.72, "rgba(235,249,255,.9)");
  body.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = body;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(22, -8);
  ctx.bezierCurveTo(19, 68, 13, 151, 10, 264);
  ctx.stroke();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(21, 34);
  ctx.bezierCurveTo(18, 92, 14, 170, 11, 228);
  ctx.stroke();
  return canvas;
}

function makeSplashTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 12, 0, 88);
  gradient.addColorStop(0, "rgba(220,246,255,0)");
  gradient.addColorStop(.35, "rgba(225,248,255,.76)");
  gradient.addColorStop(1, "rgba(160,211,235,0)");
  ctx.strokeStyle = gradient;
  ctx.lineCap = "round";
  for (let index = 0; index < 7; index += 1) {
    const side = (index - 3) / 3;
    ctx.lineWidth = 1.2 + (index % 3) * .55;
    ctx.beginPath();
    ctx.moveTo(80 + side * 8, 82);
    ctx.quadraticCurveTo(80 + side * 34, 48 - Math.abs(side) * 8, 80 + side * 62, 32 + Math.abs(side) * 18);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(215,244,255,.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(80, 82, 58, 9, 0, Math.PI * .08, Math.PI * .92);
  ctx.stroke();
  return canvas;
}

function makeVolumeBankTexture(source, seed, isFog = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = isFog ? 300 : 420;
  const mask = document.createElement("canvas");
  mask.width = canvas.width;
  mask.height = canvas.height;
  const maskCtx = mask.getContext("2d");
  const lobeCount = isFog ? 13 : 7;
  for (let index = 0; index < lobeCount; index += 1) {
    const depth = seeded(index, seed + 1);
    const x = canvas.width * (isFog
      ? .12 + seeded(index, seed + 2) * .76
      : .2 + seeded(index, seed + 2) * .6);
    const y = canvas.height * (isFog
      ? .36 + seeded(index, seed + 3) * .36
      : .18 + seeded(index, seed + 3) * .48);
    const width = canvas.width * (isFog ? .22 : .25) * (.72 + depth * .72);
    const height = width * (isFog ? .3 : .72) * (.7 + seeded(index, seed + 4) * .42);
    maskCtx.save();
    maskCtx.translate(x, y);
    maskCtx.rotate((seeded(index, seed + 5) - .5) * (isFog ? .18 : .52));
    maskCtx.globalAlpha = isFog ? .34 + depth * .28 : .58 + depth * .38;
    maskCtx.drawImage(source, -width / 2, -height / 2, width, height);
    maskCtx.restore();
  }

  const ctx = canvas.getContext("2d");
  const color = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (isFog) {
    color.addColorStop(0, "rgba(106,132,148,.06)");
    color.addColorStop(.42, "rgba(164,187,197,.58)");
    color.addColorStop(1, "rgba(43,63,79,.28)");
  } else {
    color.addColorStop(0, "rgba(6,11,22,.96)");
    color.addColorStop(.48, "rgba(25,39,59,.96)");
    color.addColorStop(.8, "rgba(96,118,134,.68)");
    color.addColorStop(1, "rgba(157,174,184,.08)");
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);

  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = isFog ? .18 : .1;
  ctx.filter = `blur(${isFog ? 7 : 4}px)`;
  ctx.drawImage(mask, 0, isFog ? -5 : 7);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

function makeCloudFieldTexture(seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(canvas.width, canvas.height);
  const lattice = (x, y, cells) => {
    const wrappedX = ((x % cells) + cells) % cells;
    const wrappedY = ((y % cells) + cells) % cells;
    return seeded(wrappedX + wrappedY * cells, seed + cells * 17);
  };
  const valueNoise = (u, v, cells) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const top = lattice(x0, y0, cells) * (1 - tx) + lattice(x0 + 1, y0, cells) * tx;
    const bottom = lattice(x0, y0 + 1, cells) * (1 - tx) + lattice(x0 + 1, y0 + 1, cells) * tx;
    return top * (1 - ty) + bottom * ty;
  };
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const u = x / canvas.width;
      const v = y / canvas.height;
      let noise = 0;
      let weight = 0;
      for (const [cells, amplitude] of [[3, .5], [6, .27], [12, .15], [24, .08]]) {
        noise += valueNoise(u, v, cells) * amplitude;
        weight += amplitude;
      }
      noise /= weight;
      const density = smooth((noise - .41) / .34);
      const lowerLight = smooth((v - .15) / .7);
      const verticalFade = 1 - smooth((v - .57) / .4);
      const shade = 10 + density * 42 + lowerLight * 18;
      const offset = (y * canvas.width + x) * 4;
      image.data[offset] = shade * .72;
      image.data[offset + 1] = shade * .88;
      image.data[offset + 2] = shade * 1.08;
      image.data[offset + 3] = Math.round(density * verticalFade * 188);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export const ENVIRONMENT_DURATION = Object.freeze({
  fog: 30000,
  cloud: 36000,
  rain: 26000,
  snow: 36000,
  mist: 60000,
});

export class EnvironmentVfxEngine {
  constructor(canvas, {
    assetRoot = "../assets/camera-effects/brackeys-runtime/",
    mirrorInput = true,
    autoStart = true,
    foregroundCanvas = null,
  } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.foregroundCanvas = foregroundCanvas;
    this.foregroundCtx = foregroundCanvas?.getContext("2d", { alpha: true }) || null;
    this.mirrorInput = mirrorInput;
    this.levels = { fog: 0, cloud: 0, rain: 0, snow: 0 };
    this.targets = { fog: 0, cloud: 0, rain: 0, snow: 0 };
    this.expiresAt = { fog: 0, cloud: 0, rain: 0, snow: 0 };
    this.wind = .035;
    this.targetWind = .035;
    this.heroSpell = "clear";
    this.heroStartedAt = performance.now();
    this.heroTarget = { x: .5, y: .43 };
    this.focus = 0;
    this.focusTarget = 0;
    this.focusCenter = { x: .5, y: .5 };
    this.focusRadius = .16;
    this.focusAngle = 0;
    this.cloudScroll = 0;
    this.cloudField = makeCloudFieldTexture(1041);
    this.disturbances = [];
    this.fingerMist = [];
    this.mistEmitters = [];
    this.mistExpiresAt = 0;
    this.mistStartedAt = 0;
    this.mistFogTargetAt = 0;
    this.mistPalette = localStorage.getItem("magicdust.mistPalette") || "auto";
    this.mistColor = localStorage.getItem("magicdust.mistColor") || "#72e4ff";
    this.ritualPath = [];
    this.ritualPathProgress = 0;
    this.ritualPathActive = false;
    this.ritualPathFadeAt = 0;
    this.ritualTransformAt = 0;
    this.ritualSeal = null;
    this.ritualClouds = [];
    this.ritualBurstCenter = { x: .5, y: .5 };
    this.last = performance.now();
    this.running = false;
    this.smoke = new Image();
    this.smoke.decoding = "async";
    this.smoke.onload = () => {
      this.smokeCloud = this.makeImageVariant(this.smoke, "brightness(.2) saturate(.42) hue-rotate(174deg) contrast(1.55)");
      this.smokeCloudLit = this.makeImageVariant(this.smoke, "brightness(1.3) saturate(.3) hue-rotate(174deg) contrast(1.18)");
      this.smokeFog = this.makeImageVariant(this.smoke, "brightness(1.08) saturate(.14) hue-rotate(165deg) blur(1.5px)");
      this.smokeFogShadow = this.makeImageVariant(this.smoke, "brightness(.3) saturate(.34) hue-rotate(165deg) contrast(1.25)");
      this.smokeMistPink = this.makeImageVariant(this.smoke, "brightness(1.35) saturate(1.35) sepia(.12) hue-rotate(278deg)");
      this.smokeMistBlue = this.makeImageVariant(this.smoke, "brightness(1.3) saturate(1.3) hue-rotate(168deg)");
      this.cloudBankTextures = Array.from({ length: 4 }, (_, index) => makeVolumeBankTexture(this.smoke, 700 + index * 31));
      this.fogBankTextures = Array.from({ length: 4 }, (_, index) => makeVolumeBankTexture(this.smoke, 900 + index * 37, true));
    };
    this.smoke.src = `${assetRoot}smoke_03_a.png`;
    this.spark = new Image();
    this.spark.decoding = "async";
    this.spark.onload = () => {
      this.sparkGold = this.makeImageVariant(this.spark, "sepia(1) saturate(9) hue-rotate(338deg) brightness(1.15)");
      this.sparkPink = this.makeImageVariant(this.spark, "brightness(1.45) saturate(2.2) hue-rotate(278deg)");
      this.sparkBlue = this.makeImageVariant(this.spark, "brightness(1.5) saturate(2) hue-rotate(168deg)");
    };
    this.spark.src = `${assetRoot}spark_05_a.png`;
    this.footageRoot = "../assets/camera-effects/footagecrate-runtime/";
    this.fogPlate = document.createElement("video");
    this.fogPlate.muted = true;
    this.fogPlate.loop = true;
    this.fogPlate.playsInline = true;
    this.fogPlate.preload = "auto";
    this.fogPlate.src = `${this.footageRoot}atmospheric-fog-23-alpha.webm`;
    this.fogPlate.addEventListener("loadedmetadata", () => {
      this.fogPlate.play().catch(() => {});
    }, { once: true });
    this.fogPlateB = this.fogPlate.cloneNode();
    this.fogPlateB.addEventListener("loadedmetadata", () => {
      this.fogPlateB.currentTime = Math.min(7.5, this.fogPlateB.duration / 2);
      this.fogPlateB.play().catch(() => {});
    }, { once: true });
    this.fogTintCanvas = document.createElement("canvas");
    this.fogTintCanvas.width = 480;
    this.fogTintCanvas.height = 270;
    this.fogTintCtx = this.fogTintCanvas.getContext("2d", { alpha: true });
    this.trace = new Image();
    this.trace.decoding = "async";
    this.trace.onload = () => {
      this.traceGold = this.makeImageVariant(this.trace, "sepia(1) saturate(9) hue-rotate(338deg) brightness(1.1)");
    };
    this.trace.src = `${assetRoot}trace_03_a.png`;
    this.traceRain = makeRainTexture();
    this.splashTexture = makeSplashTexture();
    this.rainSplashes = Array.from({ length: 16 }, (_, index) => ({
      x: seeded(index, 154),
      y: .72 + seeded(index, 155) * .25,
      phase: seeded(index, 156),
      size: .024 + seeded(index, 157) * .035,
    }));
    this.clouds = Array.from({ length: 4 }, (_, index) => ({
      x: seeded(index, 101) * 1.35 - .18,
      y: -.08 + seeded(index, 102) * .31,
      scale: .68 + seeded(index, 103) * .48,
      depth: .32 + seeded(index, 104) * .68,
      speed: .004 + seeded(index, 105) * .011,
      rotation: (seeded(index, 106) - .5) * .36,
      textureIndex: index % 4,
    }));
    this.fogBanks = Array.from({ length: 6 }, (_, index) => ({
      x: seeded(index, 111) * 1.4 - .2,
      y: .7 + seeded(index, 112) * .28,
      scale: .38 + seeded(index, 113) * .58,
      depth: .25 + seeded(index, 114) * .75,
      speed: .006 + seeded(index, 115) * .014,
      rotation: (seeded(index, 116) - .5) * .24,
      textureIndex: index % 4,
    }));
    this.rain = Array.from({ length: 150 }, (_, index) => this.makeDrop(index));
    this.snow = Array.from({ length: 92 }, (_, index) => ({
      x: seeded(index, 1511),
      y: seeded(index, 1512),
      depth: .22 + seeded(index, 1513) * .78,
      speed: .035 + seeded(index, 1514) * .075,
      drift: (seeded(index, 1515) - .5) * .055,
      phase: seeded(index, 1516) * Math.PI * 2,
    }));
    this.lensDrops = Array.from({ length: 10 }, (_, index) => ({
      x: seeded(index, 141),
      y: seeded(index, 142),
      size: .008 + seeded(index, 143) * .025,
      opacity: .05 + seeded(index, 144) * .11,
    }));
    this.loop = this.loop.bind(this);
    if (autoStart) this.start();
  }

  makeDrop(index) {
    const depth = .18 + seeded(index, 124) * .82;
    return {
      x: seeded(index, 121),
      y: seeded(index, 122),
      depth,
      speed: .52 + depth * 1.42 + seeded(index, 123) * .28,
      length: .018 + depth * .055,
    };
  }

  makeImageVariant(image, filter) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.filter = filter;
    ctx.drawImage(image, 0, 0);
    return canvas;
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

  summon(kind, { intensity = 1, wind = this.targetWind } = {}) {
    if (!(kind in this.targets)) return false;
    const now = performance.now();
    this.targets[kind] = Math.max(this.targets[kind], clamp01(intensity));
    this.expiresAt[kind] = now + ENVIRONMENT_DURATION[kind];
    if (kind === "rain") {
      this.targets.cloud = Math.max(this.targets.cloud, .72);
      this.expiresAt.cloud = Math.max(this.expiresAt.cloud, now + ENVIRONMENT_DURATION.rain + 3000);
    }
    if (kind === "snow") {
      this.targets.cloud = Math.max(this.targets.cloud, .34);
      this.expiresAt.cloud = Math.max(this.expiresAt.cloud, now + ENVIRONMENT_DURATION.snow);
    }
    this.setWind(wind);
    return true;
  }

  setMistPalette(palette = "auto") {
    if (!["pink", "blue", "auto", "custom"].includes(palette)) return false;
    this.mistPalette = palette;
    localStorage.setItem("magicdust.mistPalette", palette);
    return true;
  }

  setMistColor(color = "#72e4ff") {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return false;
    this.mistColor = color;
    this.setMistPalette("custom");
    localStorage.setItem("magicdust.mistColor", color);
    return true;
  }

  mistRgb(now = performance.now()) {
    if (this.mistPalette === "custom") return hexToRgb(this.mistColor);
    const palette = this.mistPalette === "auto" ? (Math.floor(now / 6000) % 2 ? "blue" : "pink") : this.mistPalette;
    return palette === "pink" ? [255, 104, 206] : [80, 190, 255];
  }

  setMistEmitters(points = []) {
    this.mistEmitters = points.map(point => ({
      x: this.mirrorInput ? 1 - point.x : point.x,
      y: point.y,
    }));
  }

  setRitualPath({ points = [], value = 0, active = false, completed = false } = {}) {
    if (active && !this.ritualPathActive) this.ritualTransformAt = 0;
    if (points.length) this.ritualPath = points.map(point => ({
      x: this.mirrorInput ? 1 - point.x : point.x,
      y: point.y,
    }));
    this.ritualPathProgress = clamp01(value);
    this.ritualPathActive = active;
    if (completed) this.ritualPathFadeAt = performance.now() + 3200;
    else if (!active && !points.length && performance.now() >= this.ritualPathFadeAt) this.ritualPath = [];
  }

  confirmRitual(points = this.ritualPath, {
    center = points.at(-1) || { x: .5, y: .5 },
    kind = "mist",
  } = {}) {
    const now = performance.now();
    const screenCenter = {
      x: this.mirrorInput ? 1 - center.x : center.x,
      y: center.y,
    };
    this.ritualSeal = { center: screenCenter, kind, startedAt: now, duration: 2400 };
    this.ritualPathActive = false;
    this.ritualPathFadeAt = now + 2200;
    return true;
  }

  castFingerMist(points = this.mistEmitters, { palette = this.mistPalette, duration = ENVIRONMENT_DURATION.mist } = {}) {
    this.setMistPalette(palette);
    this.setMistEmitters(points);
    const now = performance.now();
    this.ritualTransformAt = now;
    this.mistStartedAt = now;
    this.mistExpiresAt = now + duration;
    this.mistFogTargetAt = now + 1800;
    this.targets.fog = Math.max(this.targets.fog, .16);
    this.expiresAt.fog = Math.max(this.expiresAt.fog, this.mistExpiresAt);
    const pathEmitters = this.mistEmitters.length
      ? this.mistEmitters
      : [{ x: .5, y: .5 }];
    this.ritualBurstCenter = pathEmitters.reduce((center, point) => ({
      x: center.x + point.x / pathEmitters.length,
      y: center.y + point.y / pathEmitters.length,
    }), { x: 0, y: 0 });
    this.fingerMist = Array.from({ length: Math.min(68, Math.max(44, pathEmitters.length * 2)) }, (_, index) => {
      const emitter = this.mistEmitters[index % Math.max(1, this.mistEmitters.length)] || { x: .5, y: .5 };
      return this.makeMistParticle(index, emitter, now + (index % pathEmitters.length) * 7 - seeded(index, 945) * 420);
    });
    this.ritualClouds = pathEmitters
      .filter((_, index) => index % Math.max(1, Math.floor(pathEmitters.length / 30)) === 0)
      .slice(0, 18)
      .map((emitter, index) => {
        const dx = emitter.x - this.ritualBurstCenter.x;
        const dy = emitter.y - this.ritualBurstCenter.y;
        const distance = Math.hypot(dx, dy) || 1;
        const impulse = .035 + seeded(index, 966) * .055;
        return {
          x: emitter.x,
          y: emitter.y,
          bornAt: now + index * 18,
          phase: seeded(index, 963) * Math.PI * 2,
          size: .026 + seeded(index, 964) * .026,
          drift: (seeded(index, 965) - .5) * .018 + this.wind * .2,
          burstX: dx / distance * impulse,
          burstY: dy / distance * impulse - .025,
        };
      });
    return true;
  }

  makeMistParticle(index, emitter, bornAt = performance.now()) {
    const angle = (seeded(index, 941) - .5) * 1.5 - Math.PI / 2;
    const speed = .012 + seeded(index, 942) * .026;
    const vx = Math.cos(angle) * speed + this.wind * .035;
    const vy = Math.sin(angle) * speed - .008;
    const preAge = Math.max(0, performance.now() - bornAt) / 1000;
    return {
      index,
      x: emitter.x + vx * preAge,
      y: emitter.y + vy * preAge,
      vx,
      vy,
      bornAt,
      life: 10500 + seeded(index, 943) * 11000,
      size: .024 + seeded(index, 944) * .044,
      phase: seeded(index, 946) * Math.PI * 2,
      sparkle: seeded(index, 947) > .72,
    };
  }

  clear(kind) {
    if (kind && kind in this.targets) {
      this.targets[kind] = 0;
      this.expiresAt[kind] = 0;
      if (kind === "cloud") this.clear("rain");
      return;
    }
    for (const key of Object.keys(this.targets)) {
      this.targets[key] = 0;
      this.expiresAt[key] = 0;
    }
    this.fingerMist = [];
    this.mistEmitters = [];
    this.mistExpiresAt = 0;
    this.ritualPath = [];
    this.ritualPathActive = false;
    this.ritualPathFadeAt = 0;
    this.ritualTransformAt = 0;
    this.ritualSeal = null;
    this.ritualClouds = [];
  }

  setWind(value) {
    this.targetWind = Math.max(-.28, Math.min(.28, Number(value) || 0));
  }

  setHeroSpell(mode) {
    this.heroSpell = mode;
    this.heroStartedAt = performance.now();
  }

  setHeroTarget(point) {
    if (!point) return;
    this.heroTarget = {
      x: this.mirrorInput ? 1 - point.x : point.x,
      y: point.y,
    };
  }

  setMagicFocus(focus) {
    if (!focus) {
      this.focusTarget = 0;
      return;
    }
    this.focusTarget = 1;
    this.focusCenter = {
      x: this.mirrorInput ? 1 - focus.center.x : focus.center.x,
      y: focus.center.y,
    };
    this.focusRadius = Math.max(.08, Math.min(.28, focus.radius));
    this.focusAngle = -focus.angle;
  }

  disturb(point, strength = 1, color = "210,92,255") {
    const screenPoint = {
      x: this.mirrorInput ? 1 - point.x : point.x,
      y: point.y,
    };
    this.disturbances.push({
      ...screenPoint,
      strength: clamp01(strength),
      color,
      startedAt: performance.now(),
      duration: 2200,
    });
    for (const drop of this.rain) {
      const dx = drop.x - screenPoint.x;
      const dy = drop.y - screenPoint.y;
      const distance = Math.hypot(dx, dy) || .001;
      if (distance < .3) {
        const push = (1 - distance / .3) * .14 * strength;
        drop.x += dx / distance * push;
        drop.y += dy / distance * push;
      }
    }
  }

  getState(now = performance.now()) {
    const remaining = {};
    for (const key of Object.keys(this.targets)) remaining[key] = Math.max(0, this.expiresAt[key] - now);
    return {
      levels: { ...this.levels },
      targets: { ...this.targets },
      remaining,
      wind: this.wind,
      active: Object.keys(this.levels).filter(key => this.levels[key] > .03),
      mist: {
        palette: this.mistPalette,
        particles: this.fingerMist.length,
        remaining: Math.max(0, this.mistExpiresAt - now),
      },
    };
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || 1280);
    const height = Math.max(1, this.canvas.clientHeight || 720);
    const dpr = Math.min(.72, devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.foregroundCanvas) {
      if (this.foregroundCanvas.width !== pixelWidth || this.foregroundCanvas.height !== pixelHeight) {
        this.foregroundCanvas.width = pixelWidth;
        this.foregroundCanvas.height = pixelHeight;
      }
      this.foregroundCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { width, height };
  }

  update(now, dt) {
    for (const key of Object.keys(this.targets)) {
      if (this.expiresAt[key] && now >= this.expiresAt[key]) this.targets[key] = 0;
      const response = this.targets[key] > this.levels[key] ? 1.6 : .48;
      this.levels[key] += (this.targets[key] - this.levels[key]) * Math.min(1, dt * response);
    }
    this.wind += (this.targetWind - this.wind) * Math.min(1, dt * 2.4);
    this.focus += (this.focusTarget - this.focus) * Math.min(1, dt * (this.focusTarget ? 7 : 2.2));
    this.disturbances = this.disturbances.filter(item => now - item.startedAt < item.duration);
    if (this.ritualSeal && now - this.ritualSeal.startedAt >= this.ritualSeal.duration) this.ritualSeal = null;
    this.ritualClouds = this.ritualClouds.filter(item => now - item.bornAt < 14500);
    if (this.mistFogTargetAt && now >= this.mistFogTargetAt && now < this.mistExpiresAt) {
      this.targets.fog = Math.max(this.targets.fog, .94);
      this.mistFogTargetAt = 0;
    }
    if (now >= this.mistExpiresAt) this.fingerMist = this.fingerMist.filter(item => now - item.bornAt < item.life);
    for (let index = 0; index < this.fingerMist.length; index += 1) {
      let item = this.fingerMist[index];
      if (now - item.bornAt >= item.life && now < this.mistExpiresAt && this.mistEmitters.length) {
        item = this.makeMistParticle(item.index + 73, this.mistEmitters[index % this.mistEmitters.length], now);
        this.fingerMist[index] = item;
      }
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx += Math.sin(now * .00055 + item.phase) * dt * .0015;
      item.vy -= dt * .0008;
    }
  }

  renderFingerMist(width, height, now) {
    if (!this.fingerMist.length && !this.ritualClouds.length) return;
    const palette = this.mistPalette === "auto" ? (Math.floor(now / 6000) % 2 ? "blue" : "pink") : this.mistPalette;
    const [red, green, blue] = this.mistRgb(now);
    const spark = palette === "pink" ? this.sparkPink : this.sparkBlue;
    const glow = `${red},${green},${blue}`;
    const base = Math.min(width, height);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const plumeAge = now - this.mistStartedAt;
    const plumeAlpha = 1 - smooth((plumeAge - 2400) / 2200);
    for (const cloud of this.ritualClouds) {
      const age = now - cloud.bornAt;
      if (age < 0) continue;
      const t = clamp01(age / 12500);
      const reveal = smooth(age / 720);
      const burst = smooth(age / 620);
      const fadeOut = 1 - smooth((t - .72) / .28);
      const rise = smooth(t) * height * (.24 + cloud.size * 1.4);
      const x = cloud.x * width
        + cloud.burstX * width * burst
        + cloud.drift * width * t
        + Math.sin(now * .00048 + cloud.phase) * width * .018;
      const y = cloud.y * height + cloud.burstY * height * burst - rise;
      const radius = base * cloud.size * (.55 + reveal * 1.45);
      const cloudTexture = palette === "pink" ? this.smokeMistPink : this.smokeMistBlue;
      if (cloudTexture) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(cloud.phase) * .34 + t * .12);
        ctx.globalAlpha = reveal * fadeOut * (.14 + seeded(Math.round(cloud.phase * 100), 1271) * .09);
        ctx.shadowColor = `rgba(${red},${green},${blue},.34)`;
        ctx.shadowBlur = radius * .32;
        ctx.drawImage(
          cloudTexture,
          -radius * 2.3,
          -radius * 1.35,
          radius * 4.6,
          radius * 2.7,
        );
        ctx.restore();
      }
      const volume = ctx.createRadialGradient(
        x - radius * .18,
        y - radius * .15,
        radius * .04,
        x,
        y,
        radius,
      );
      volume.addColorStop(0, `rgba(${Math.min(255, red + 58)},${Math.min(255, green + 58)},${Math.min(255, blue + 58)},.14)`);
      volume.addColorStop(.32, `rgba(${red},${green},${blue},.08)`);
      volume.addColorStop(.72, `rgba(${red},${green},${blue},.026)`);
      volume.addColorStop(1, `rgba(${red},${green},${blue},0)`);
      ctx.globalAlpha = reveal * fadeOut;
      ctx.fillStyle = volume;
      ctx.shadowColor = `rgba(${red},${green},${blue},.28)`;
      ctx.shadowBlur = radius * .22;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * (1.18 + t * .62), radius * (.66 + t * .24), Math.sin(cloud.phase) * .22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (const item of this.fingerMist) {
      const age = now - item.bornAt;
      if (age < 0 || age > item.life) continue;
      const t = age / item.life;
      const fade = smooth(t / .12) * (1 - smooth((t - .68) / .32));
      const x = item.x * width + Math.sin(now * .0007 + item.phase) * base * .018 * t;
      const y = item.y * height;
      if (plumeAlpha > .01 && this.smokeFog) {
        const length = base * item.size * (1.8 + t * 2.4);
        const thickness = length * (.28 + item.size * .65);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(item.vy * height, item.vx * width) + Math.PI / 2);
        ctx.scale(1, 1.7);
        const cloud = ctx.createRadialGradient(0, -length * .18, 0, 0, -length * .18, length * .52);
        cloud.addColorStop(0, `rgba(${glow},${.12 + (item.index % 5) * .012})`);
        cloud.addColorStop(.34, `rgba(${glow},.075)`);
        cloud.addColorStop(.72, `rgba(${glow},.028)`);
        cloud.addColorStop(1, `rgba(${glow},0)`);
        ctx.globalAlpha = fade * plumeAlpha;
        ctx.fillStyle = cloud;
        ctx.shadowColor = `rgba(${glow},.38)`;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(0, -length * .18, thickness * 1.8, length * .52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (item.sparkle && spark && this.foregroundCtx) {
        const pulse = Math.max(0, Math.sin(now * .004 + item.phase));
        if (pulse > .72) {
          const front = this.foregroundCtx;
          const sparkleSize = base * (.008 + item.size * .08) * pulse;
          front.save();
          front.globalCompositeOperation = "lighter";
          front.globalAlpha = fade * pulse * .7;
          front.shadowColor = `rgb(${glow})`;
          front.shadowBlur = 9;
          front.drawImage(spark, x - sparkleSize / 2, y - sparkleSize / 2, sparkleSize, sparkleSize);
          front.restore();
        }
      }
    }
    ctx.restore();
  }

  renderRitualPath(width, height, now) {
    if (this.ritualPath.length < 2 || !this.foregroundCtx) return;
    const transformFade = this.ritualTransformAt
      ? 1 - smooth((now - this.ritualTransformAt) / 620)
      : 1;
    const fade = (this.ritualPathActive
      ? 1
      : clamp01((this.ritualPathFadeAt - now) / 1400)) * transformFade;
    if (fade <= 0) return;
    const ctx = this.foregroundCtx;
    const [red, green, blue] = this.mistRgb(now);
    const points = this.ritualPath.map(point => ({ x: point.x * width, y: point.y * height }));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const stroke = (lineWidth, color, alpha, blur = 0, shadow = `rgb(${red},${green},${blue})`) => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length - 1; index += 1) {
        const midpoint = {
          x: (points[index].x + points[index + 1].x) / 2,
          y: (points[index].y + points[index + 1].y) / 2,
        };
        ctx.quadraticCurveTo(points[index].x, points[index].y, midpoint.x, midpoint.y);
      }
      ctx.lineTo(points.at(-1).x, points.at(-1).y);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * fade;
      ctx.shadowColor = shadow;
      ctx.shadowBlur = blur;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    for (let index = 1; index < points.length; index += 2) {
      const previous = points[index - 1];
      const point = points[index];
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const distance = Math.hypot(dx, dy) || 1;
      const nx = -dy / distance;
      const ny = dx / distance;
      const pulse = .72 + Math.sin(now * .008 - index * .48) * .28;
      const ribbonWidth = 6 + Math.min(13, distance * .31) + pulse * 3.6;
      const tail = index / points.length;
      const gradient = ctx.createLinearGradient(previous.x, previous.y, point.x, point.y);
      const chroma = (Math.sin(now * .0024 - index * .34) + 1) / 2;
      const accentRed = Math.round(red * (1 - chroma) + 255 * chroma);
      const accentGreen = Math.round(green * (1 - chroma) + (105 + chroma * 65) * chroma);
      const accentBlue = Math.round(blue * (1 - chroma) + 246 * chroma);
      gradient.addColorStop(0, `rgba(${Math.round(red * .72 + 58)},${Math.min(255, green + 34)},255,${.24 + tail * .22})`);
      gradient.addColorStop(.48, `rgba(${accentRed},${accentGreen},${accentBlue},.82)`);
      gradient.addColorStop(.76, `rgba(${Math.min(255, red + 64)},${Math.min(255, green + 82)},255,.72)`);
      gradient.addColorStop(1, `rgba(${red},${green},${blue},${.38 + pulse * .28})`);
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.quadraticCurveTo(
        (previous.x + point.x) / 2 + nx * pulse * 1.8,
        (previous.y + point.y) / 2 + ny * pulse * 1.8,
        point.x,
        point.y,
      );
      ctx.lineWidth = Math.min(4.5, ribbonWidth * .34);
      ctx.strokeStyle = gradient;
      ctx.globalAlpha = fade * (.16 + tail * .26);
      ctx.shadowColor = `rgb(${red},${green},${blue})`;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const pathGradient = ctx.createLinearGradient(
      Math.min(...points.map(point => point.x)),
      Math.min(...points.map(point => point.y)),
      Math.max(...points.map(point => point.x)),
      Math.max(...points.map(point => point.y)),
    );
    pathGradient.addColorStop(0, `rgba(96,226,255,.78)`);
    pathGradient.addColorStop(.28, `rgba(${red},${Math.min(255, green + 34)},255,.94)`);
    pathGradient.addColorStop(.58, "rgba(255,112,226,.96)");
    pathGradient.addColorStop(.82, `rgba(${Math.min(255, red + 72)},${Math.min(255, green + 88)},255,.94)`);
    pathGradient.addColorStop(1, "rgba(162,238,255,.84)");
    stroke(38, `rgba(${red},${green},${blue},.09)`, .58, 26);
    stroke(14, pathGradient, .88, 18);
    stroke(4.2, `rgba(${Math.min(255, red + 96)},${Math.min(255, green + 112)},255,.96)`, .95, 8);
    stroke(1.25, "rgba(255,255,255,.96)", .82, 3);

    for (let index = 3; index < points.length; index += 5) {
      const point = points[index];
      const seed = seeded(index, 981);
      const previous = points[index - 2];
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const distance = Math.hypot(dx, dy) || 1;
      const side = index % 2 ? 1 : -1;
      const nx = -dy / distance * side;
      const ny = dx / distance * side;
      const wispLength = 18 + seed * 36;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.bezierCurveTo(
        point.x + nx * wispLength * .35,
        point.y + ny * wispLength * .35,
        point.x + nx * wispLength + dx * .18,
        point.y + ny * wispLength + dy * .18,
        point.x + nx * wispLength * .82 + Math.sin(now * .002 + index) * 8,
        point.y + ny * wispLength * .82 - 10 - seed * 14,
      );
      ctx.lineWidth = .8 + seed * 1.5;
      ctx.strokeStyle = `rgba(${red},${green},${blue},${.14 + seed * .18})`;
      ctx.globalAlpha = fade;
      ctx.shadowColor = `rgb(${red},${green},${blue})`;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (this.spark.complete && this.spark.naturalWidth) {
        const size = 2 + seed * 6;
        ctx.globalAlpha = fade * (.32 + seed * .5);
        ctx.shadowColor = `rgb(${red},${green},${blue})`;
        ctx.shadowBlur = 10;
        ctx.drawImage(this.spark, point.x - size / 2, point.y - size / 2, size, size);
        ctx.shadowBlur = 0;
      }
      for (let mote = 0; mote < 2; mote += 1) {
        const moteSeed = seeded(index * 3 + mote, 989);
        const moteAngle = now * (.0012 + moteSeed * .0011) + moteSeed * Math.PI * 2;
        const moteRadius = 7 + moteSeed * 18;
        const moteX = point.x + Math.cos(moteAngle) * moteRadius;
        const moteY = point.y + Math.sin(moteAngle) * moteRadius * .62;
        const moteSize = .8 + moteSeed * 1.8;
        ctx.globalAlpha = fade * (.42 + Math.sin(now * .006 + moteSeed * 8) * .28);
        ctx.fillStyle = `rgb(${Math.min(255,red + 100)},${Math.min(255,green + 100)},${Math.min(255,blue + 100)})`;
        ctx.shadowColor = `rgb(${red},${green},${blue})`;
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(moteX, moteY, moteSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    const dustCount = Math.min(110, Math.max(34, Math.round(points.length * 1.15)));
    for (let index = 0; index < dustCount; index += 1) {
      const pointIndex = Math.min(points.length - 1, Math.floor(seeded(index, 996) * points.length));
      const point = points[pointIndex];
      const seed = seeded(index, 997);
      const age = (now * (.00018 + seed * .00012) + seed * 7.3) % 1;
      const spread = 12 + seed * 48;
      const x = point.x + (seeded(index, 998) - .5) * spread + Math.sin(now * .0014 + index) * 5;
      const y = point.y - age * (18 + seed * 42) + Math.cos(now * .0011 + index * 2.1) * 4;
      const particleFade = Math.sin(age * Math.PI);
      const size = .65 + seed * 2.9;
      ctx.globalAlpha = fade * particleFade * (.32 + seed * .6);
      ctx.fillStyle = `rgba(${Math.min(255, red + 115)},${Math.min(255, green + 115)},${Math.min(255, blue + 115)},1)`;
      ctx.shadowColor = `rgb(${red},${green},${blue})`;
      ctx.shadowBlur = 8 + seed * 10;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  renderRitualBurst(width, height, now) {
    if (!this.ritualTransformAt || !this.foregroundCtx) return;
    const age = now - this.ritualTransformAt;
    if (age < 0 || age > 1050) return;
    const t = smooth(age / 820);
    const fade = 1 - smooth((age - 420) / 630);
    const ctx = this.foregroundCtx;
    const [red, green, blue] = this.mistRgb(now);
    const base = Math.min(width, height);
    const x = this.ritualBurstCenter.x * width;
    const y = this.ritualBurstCenter.y * height;
    const radius = base * (.035 + t * .34);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const flash = ctx.createRadialGradient(x, y, 0, x, y, radius * .65);
    flash.addColorStop(0, `rgba(255,255,255,${.42 * fade})`);
    flash.addColorStop(.22, `rgba(${red},${green},${blue},${.26 * fade})`);
    flash.addColorStop(1, `rgba(${red},${green},${blue},0)`);
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(x, y, radius * .65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${Math.min(255, red + 90)},${Math.min(255, green + 100)},255,${.82 * fade})`;
    ctx.lineWidth = 2.5 + (1 - t) * 5;
    ctx.shadowColor = `rgb(${red},${green},${blue})`;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let ray = 0; ray < 24; ray += 1) {
      const angle = seeded(ray, 1281) * Math.PI * 2;
      const inner = radius * (.12 + seeded(ray, 1282) * .28);
      const outer = radius * (.52 + seeded(ray, 1283) * .62);
      ctx.globalAlpha = fade * (.2 + seeded(ray, 1284) * .45);
      ctx.lineWidth = .7 + seeded(ray, 1285) * 1.8;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderRitualSeal(width, height, now) {
    if (!this.ritualSeal || !this.foregroundCtx) return;
    const age = now - this.ritualSeal.startedAt;
    if (age < 0 || age >= this.ritualSeal.duration) return;
    const ctx = this.foregroundCtx;
    const [red, green, blue] = this.mistRgb(now);
    const base = Math.min(width, height);
    const x = this.ritualSeal.center.x * width;
    const y = this.ritualSeal.center.y * height;
    const build = smooth(age / 320);
    const lock = smooth((age - 250) / 520);
    const pulse = smooth((age - 780) / 280);
    const fade = 1 - smooth((age - 2020) / 360);
    const radius = base * (.055 + build * .105 + pulse * .035);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, .68);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.5);
    halo.addColorStop(0, `rgba(${red},${green},${blue},${.24 * fade})`);
    halo.addColorStop(.38, `rgba(${red},${green},${blue},${.09 * fade})`);
    halo.addColorStop(1, `rgba(${red},${green},${blue},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    for (let ring = 0; ring < 4; ring += 1) {
      const ringRadius = radius * (.48 + ring * .19);
      const direction = ring % 2 ? -1 : 1;
      const rotation = now * .001 * direction * (.26 + ring * .08);
      const segments = 6 + ring * 3;
      ctx.lineWidth = Math.max(1, radius * (.012 - ring * .0015));
      ctx.strokeStyle = `rgba(${Math.min(255, red + ring * 24)},${Math.min(255, green + ring * 18)},255,${(.42 + ring * .1) * fade})`;
      ctx.shadowColor = `rgb(${red},${green},${blue})`;
      ctx.shadowBlur = 8 + ring * 2;
      for (let segment = 0; segment < segments; segment += 1) {
        const start = rotation + segment * Math.PI * 2 / segments;
        const length = Math.PI * (1.1 + seeded(segment, ring + 1200) * .55) / segments;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, start, start + length);
        ctx.stroke();
      }
    }

    ctx.rotate(-now * .00032);
    for (let tick = 0; tick < 24; tick += 1) {
      const angle = tick * Math.PI * 2 / 24;
      const inner = radius * (tick % 3 ? .88 : .82);
      const outer = radius * (tick % 3 ? .96 : 1.04);
      ctx.strokeStyle = `rgba(${red},${green},${blue},${(.46 + lock * .4) * fade})`;
      ctx.lineWidth = tick % 3 ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }

    for (let mote = 0; mote < 46; mote += 1) {
      const seed = seeded(mote, 1217);
      const incoming = 1 - lock;
      const angle = seed * Math.PI * 2 + now * .001 * (mote % 2 ? -1 : 1);
      const orbit = radius * (.35 + seeded(mote, 1218) * (1.3 + incoming * 1.7));
      const px = Math.cos(angle) * orbit;
      const py = Math.sin(angle) * orbit;
      const size = .7 + seeded(mote, 1219) * 2.7;
      ctx.globalAlpha = fade * (.3 + seed * .68);
      ctx.fillStyle = `rgb(${Math.min(255, red + 110)},${Math.min(255, green + 110)},255)`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (pulse > 0) {
      ctx.globalAlpha = (1 - pulse) * fade;
      ctx.strokeStyle = `rgba(235,252,255,.94)`;
      ctx.lineWidth = 3;
      ctx.shadowColor = `rgb(${red},${green},${blue})`;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (1 + pulse * 1.8), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderMagicCircle(width, height, now) {
    if (this.focus < .01) return;
    const ctx = this.ctx;
    const base = Math.min(width, height);
    const x = this.focusCenter.x * width;
    const y = this.focusCenter.y * height;
    const radius = this.focusRadius * base;
    const age = now * .001;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.focusAngle * .35);
    ctx.scale(1, .64);
    ctx.globalCompositeOperation = "lighter";

    if (this.smoke.complete && this.smoke.naturalWidth) {
      ctx.save();
      ctx.filter = "sepia(1) saturate(5.2) hue-rotate(338deg) brightness(.82)";
      for (let index = 0; index < 4; index += 1) {
        const orbit = age * (index % 2 ? -.08 : .065) + index * 1.57;
        const size = radius * (1.15 + index * .12);
        ctx.globalAlpha = this.focus * (.065 + index * .012);
        ctx.save();
        ctx.rotate(orbit);
        ctx.drawImage(this.smoke, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
      ctx.restore();
    }

    if (this.trace.complete && this.trace.naturalWidth) {
      ctx.shadowColor = "rgba(255,132,38,.9)";
      ctx.shadowBlur = 10;
      for (let index = 0; index < 84; index += 1) {
        const band = index % 4;
        const direction = band % 2 ? -1 : 1;
        const angle = index * 2.399963 + age * direction * (.09 + band * .027);
        const broken = seeded(index, 171);
        if (broken < .17 || (index + Math.floor(age * 1.7)) % 19 === 0) continue;
        const jitter = Math.sin(age * 1.3 + index * 4.7) * radius * .018;
        const ringRadius = radius * (.43 + band * .16) + jitter;
        const px = Math.cos(angle) * ringRadius;
        const py = Math.sin(angle) * ringRadius;
        const length = radius * (.13 + seeded(index, 172) * .22);
        const thickness = Math.max(3.4, radius * (.022 + seeded(index, 173) * .022));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle + (seeded(index, 174) - .5) * .12);
        ctx.globalAlpha = this.focus * (.72 + seeded(index, 175) * .28);
        ctx.drawImage(this.traceGold || this.trace, -thickness / 2, -length / 2, thickness, length);
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    }

    if (this.spark.complete && this.spark.naturalWidth) {
      for (let index = 0; index < 34; index += 1) {
        const angle = age * (.14 + index % 3 * .035) + index * 2.399963;
        const orbitRadius = radius * (.38 + seeded(index, 181) * .72);
        const px = Math.cos(angle) * orbitRadius;
        const py = Math.sin(angle) * orbitRadius;
        const size = 5 + seeded(index, 182) * 12;
        ctx.globalAlpha = this.focus * (.65 + seeded(index, 183) * .35);
        ctx.drawImage(this.sparkGold || this.spark, px - size / 2, py - size / 2, size, size);
      }
    }
    const centerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * .44);
    centerGlow.addColorStop(0, `rgba(255,198,102,${this.focus * .2})`);
    centerGlow.addColorStop(1, "rgba(255,130,45,0)");
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * .44, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSmokeLayer(item, width, height, alpha, tint, isFog = false, imageOverride = null) {
    if (!this.smoke.complete || !this.smoke.naturalWidth) return;
    const ctx = this.ctx;
    const bankTextures = isFog ? this.fogBankTextures : this.cloudBankTextures;
    const bankTexture = bankTextures?.[item.textureIndex ?? 0];
    const image = imageOverride || bankTexture || (isFog ? this.smokeFog : this.smokeCloud) || this.smoke;
    const drawWidth = width * item.scale * (bankTexture && !imageOverride ? (isFog ? .92 : .78) : (isFog ? .72 : .64));
    const drawHeight = height * item.scale * (bankTexture && !imageOverride ? (isFog ? .38 : .48) : (isFog ? .34 : .43));
    ctx.save();
    ctx.translate(item.x * width, item.y * height);
    ctx.rotate(item.rotation);
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  renderClouds(width, height, dt, flash) {
    const level = this.levels.cloud;
    if (level < .005) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    this.cloudScroll = (this.cloudScroll + (this.wind * .55 + .012) * dt) % 1;
    const fieldWidth = width * 1.18;
    const fieldHeight = height * .72;
    const fieldX = -this.cloudScroll * fieldWidth;
    ctx.globalAlpha = level * (.31 + flash * .15);
    ctx.drawImage(this.cloudField, fieldX, -height * .035, fieldWidth, fieldHeight);
    ctx.drawImage(this.cloudField, fieldX + fieldWidth, -height * .035, fieldWidth, fieldHeight);
    ctx.globalAlpha = 1;
    for (const cloud of this.clouds) {
      cloud.x += (this.wind * .035 + cloud.speed) * dt * (1.2 - cloud.depth * .35);
      if (cloud.x > 1.28) cloud.x = -.28;
      const alpha = level * (.1 + cloud.depth * .14);
      this.drawSmokeLayer(
        cloud,
        width,
        height,
        alpha,
        "",
      );
      if (this.smokeCloudLit) {
        this.drawSmokeLayer(cloud, width, height, level * (.014 + cloud.depth * .022), "", false, this.smokeCloudLit);
      }
      if (flash > .01 && this.smokeCloudLit) {
        this.drawSmokeLayer(cloud, width, height, flash * (.1 + cloud.depth * .16), "", false, this.smokeCloudLit);
      }
    }
    const topShade = ctx.createLinearGradient(0, 0, 0, height * .72);
    topShade.addColorStop(0, `rgba(3,9,22,${level * .3})`);
    topShade.addColorStop(.54, `rgba(8,15,30,${level * .09})`);
    topShade.addColorStop(1, "rgba(8,15,30,0)");
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, width, height * .72);
    ctx.restore();
  }

  renderFog(width, height, dt) {
    const level = this.levels.fog;
    if (level < .005) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    if (this.fogPlate.readyState >= 2) {
      const [red, green, blue] = this.mistRgb();
      const tintPlate = video => {
        const tint = this.fogTintCtx;
        tint.clearRect(0, 0, 480, 270);
        tint.globalCompositeOperation = "source-over";
        tint.filter = "brightness(1.28) contrast(1.16)";
        tint.drawImage(video, 0, 0, 480, 270);
        tint.filter = "none";
        tint.globalCompositeOperation = "source-atop";
        const color = tint.createLinearGradient(0, 0, 480, 270);
        color.addColorStop(0, `rgba(${Math.min(255,red + 50)},${Math.min(255,green + 50)},${Math.min(255,blue + 50)},.42)`);
        color.addColorStop(.55, `rgba(${red},${green},${blue},.3)`);
        color.addColorStop(1, `rgba(${Math.round(red * .45)},${Math.round(green * .45)},${Math.round(blue * .45)},.5)`);
        tint.fillStyle = color;
        tint.fillRect(0, 0, 480, 270);
        tint.globalCompositeOperation = "source-over";
        return this.fogTintCanvas;
      };
      const plateRatio = this.fogPlate.videoWidth / this.fogPlate.videoHeight || 16 / 9;
      const drawWidth = Math.max(width * 1.08, height * plateRatio);
      const drawHeight = drawWidth / plateRatio;
      ctx.globalCompositeOperation = "screen";
      ctx.filter = "blur(.7px)";
      ctx.globalAlpha = level * .74;
      ctx.drawImage(tintPlate(this.fogPlate), (width - drawWidth) / 2, height - drawHeight * .88, drawWidth, drawHeight);
      if (this.fogPlateB.readyState >= 2) {
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.globalAlpha = level * .46;
        ctx.filter = "blur(2.2px)";
        ctx.drawImage(tintPlate(this.fogPlateB), (width - drawWidth * 1.08) / 2, height - drawHeight * .82, drawWidth * 1.08, drawHeight);
        ctx.restore();
      }
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
    }
    const [fogRed, fogGreen, fogBlue] = this.mistRgb();
    const fogAge = performance.now() * .00006;
    ctx.globalCompositeOperation = "screen";
    for (let index = 0; index < 7; index += 1) {
      const depth = .45 + seeded(index, 1002) * .75;
      const x = ((seeded(index, 1003) + fogAge * (.06 + depth * .035)) % 1.35 - .17) * width;
      const y = height * (.25 + seeded(index, 1004) * .57 + Math.sin(fogAge * 9 + index) * .025);
      const radius = Math.min(width, height) * (.16 + seeded(index, 1005) * .16) * depth;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.8 + seeded(index, 1006) * 1.4, .55 + seeded(index, 1007) * .42);
      const volume = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      volume.addColorStop(0, `rgba(${fogRed},${fogGreen},${fogBlue},${level * (.13 + depth * .07)})`);
      volume.addColorStop(.38, `rgba(${fogRed},${fogGreen},${fogBlue},${level * .085})`);
      volume.addColorStop(.76, `rgba(${Math.round(fogRed * .7)},${Math.round(fogGreen * .7)},${Math.round(fogBlue * .7)},${level * .034})`);
      volume.addColorStop(1, `rgba(${fogRed},${fogGreen},${fogBlue},0)`);
      ctx.fillStyle = volume;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
    const aura = ctx.createRadialGradient(
      width * (.5 + Math.sin(fogAge * 7) * .06),
      height * .54,
      0,
      width * .5,
      height * .54,
      Math.max(width, height) * .62,
    );
    aura.addColorStop(0, `rgba(${fogRed},${fogGreen},${fogBlue},${level * .16})`);
    aura.addColorStop(.42, `rgba(${fogRed},${fogGreen},${fogBlue},${level * .09})`);
    aura.addColorStop(.78, `rgba(${fogRed},${fogGreen},${fogBlue},${level * .035})`);
    aura.addColorStop(1, `rgba(${fogRed},${fogGreen},${fogBlue},0)`);
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";
    const haze = ctx.createLinearGradient(0, height * .55, 0, height);
    haze.addColorStop(0, "rgba(156,184,196,0)");
    const [red, green, blue] = this.mistRgb();
    haze.addColorStop(.48, `rgba(${red},${green},${blue},0)`);
    haze.addColorStop(.78, `rgba(${red},${green},${blue},${level * .08})`);
    haze.addColorStop(1, `rgba(${Math.min(255,red + 70)},${Math.min(255,green + 70)},${Math.min(255,blue + 70)},${level * .14})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, height * .5, width, height * .5);
    ctx.restore();
  }

  renderSnow(width, height, dt, now) {
    const level = this.levels.snow;
    if (level < .005) return;
    const ctx = this.foregroundCtx || this.ctx;
    const base = Math.min(width, height);
    const visibleCount = Math.round(this.snow.length * (.3 + level * .7));
    ctx.save();
    const winterVeil = ctx.createLinearGradient(0, 0, 0, height);
    winterVeil.addColorStop(0, `rgba(115,161,194,${level * .1})`);
    winterVeil.addColorStop(.58, `rgba(59,92,126,${level * .035})`);
    winterVeil.addColorStop(1, `rgba(219,239,247,${level * .075})`);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = winterVeil;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";
    for (let index = 0; index < visibleCount; index += 1) {
      const flake = this.snow[index];
      flake.y += flake.speed * dt * (.7 + level * .65);
      flake.x += (flake.drift + this.wind * .12 + Math.sin(now * .0012 + flake.phase) * .018) * dt;
      if (flake.y > 1.08 || flake.x < -.08 || flake.x > 1.08) {
        flake.y = -.06 - seeded(index + Math.floor(now / 1200), 1521) * .2;
        flake.x = seeded(index + Math.floor(now / 900), 1522);
      }
      const x = flake.x * width;
      const y = flake.y * height;
      const radius = base * (.0022 + flake.depth * .0048);
      const pulse = .72 + Math.sin(now * .004 + flake.phase) * .28;
      ctx.globalAlpha = level * (.28 + flake.depth * .62) * pulse;
      ctx.fillStyle = flake.depth > .68 ? "#f7fdff" : "#bfe7ff";
      ctx.shadowColor = "#9fdcff";
      ctx.shadowBlur = flake.depth > .7 ? 4 + flake.depth * 7 : 0;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (flake.depth > .76) {
        ctx.lineWidth = Math.max(.6, radius * .22);
        ctx.strokeStyle = "rgba(235,250,255,.72)";
        for (let arm = 0; arm < 3; arm += 1) {
          const angle = arm * Math.PI / 3 + flake.phase;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(angle) * radius * 1.8, y - Math.sin(angle) * radius * 1.8);
          ctx.lineTo(x + Math.cos(angle) * radius * 1.8, y + Math.sin(angle) * radius * 1.8);
          ctx.stroke();
          for (const direction of [-1, 1]) {
            const armX = x + Math.cos(angle) * radius * direction;
            const armY = y + Math.sin(angle) * radius * direction;
            const branch = angle + direction * .72;
            ctx.beginPath();
            ctx.moveTo(armX, armY);
            ctx.lineTo(armX - Math.cos(branch) * radius * .55, armY - Math.sin(branch) * radius * .55);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  renderRain(width, height, dt) {
    const level = this.levels.rain;
    if (level < .005) return;
    const ctx = this.ctx;
    const front = this.foregroundCtx || ctx;
    const slant = this.wind * width * .045;
    ctx.save();
    if (front !== ctx) front.save();
    ctx.globalCompositeOperation = "screen";
    front.globalCompositeOperation = "screen";
    const visibleCount = Math.round(this.rain.length * (.24 + level * .76));
    for (let index = 0; index < visibleCount; index += 1) {
      const drop = this.rain[index];
      drop.y += drop.speed * dt * (.55 + level * .65);
      drop.x += this.wind * dt * (.18 + drop.depth * .16);
      if (drop.y > 1.12 || drop.x < -.12 || drop.x > 1.12) {
        drop.y = -.08 - seeded(index + Math.floor(performance.now() / 700), 151) * .28;
        drop.x = seeded(index + Math.floor(performance.now() / 900), 152);
      }
      const x = drop.x * width;
      const y = drop.y * height;
      const length = drop.length * height * (1.35 + level * .62);
      const targetCtx = drop.depth > .72 ? front : ctx;
      const rainSprite = this.traceRain || this.trace;
      if (rainSprite && (rainSprite.naturalWidth || rainSprite.width)) {
        const angle = -Math.atan2(slant, Math.max(1, length));
        const thickness = 1.4 + drop.depth * 2.7;
        targetCtx.save();
        targetCtx.translate(x - slant / 2, y - length / 2);
        targetCtx.rotate(angle);
        targetCtx.globalAlpha = level * (.2 + drop.depth * .48);
        targetCtx.drawImage(rainSprite, -thickness / 2, -length / 2, thickness, length);
        targetCtx.restore();
      }
    }
    if (level > .48) {
      for (const drop of this.lensDrops) {
        const radius = drop.size * Math.min(width, height);
        const x = drop.x * width;
        const y = drop.y * height;
        const lens = front.createRadialGradient(x - radius * .22, y - radius * .28, radius * .08, x, y, radius);
        lens.addColorStop(0, `rgba(235,248,255,${drop.opacity * level})`);
        lens.addColorStop(.28, "rgba(210,235,246,.015)");
        lens.addColorStop(.78, "rgba(20,45,68,.025)");
        lens.addColorStop(1, "rgba(229,245,251,0)");
        front.fillStyle = lens;
        front.beginPath();
        front.ellipse(x, y, radius * .72, radius, 0, 0, Math.PI * 2);
        front.fill();
      }
      for (const [index, splash] of this.rainSplashes.entries()) {
        const life = (performance.now() * .0013 + splash.phase + index * .071) % 1;
        if (life > .34) continue;
        const t = life / .34;
        const splashWidth = splash.size * width * (.65 + t * .72);
        const splashHeight = splashWidth * (.34 + t * .16);
        front.globalAlpha = level * Math.sin(t * Math.PI) * (.18 + splash.y * .18);
        front.drawImage(
          this.splashTexture,
          splash.x * width - splashWidth / 2,
          splash.y * height - splashHeight,
          splashWidth,
          splashHeight,
        );
      }
    }
    ctx.restore();
    if (front !== ctx) front.restore();
  }

  renderDisturbances(width, height, now) {
    if (!this.disturbances.length) return;
    const ctx = this.ctx;
    for (const item of this.disturbances) {
      const age = now - item.startedAt;
      const progress = clamp01(age / item.duration);
      const radius = Math.min(width, height) * (.04 + smooth(progress) * .54) * item.strength;
      const x = item.x * width;
      const y = item.y * height;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const hole = ctx.createRadialGradient(x, y, radius * .12, x, y, radius);
      hole.addColorStop(0, `rgba(0,0,0,${(1 - progress) * .9})`);
      hole.addColorStop(.68, `rgba(0,0,0,${(1 - progress) * .5})`);
      hole.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hole;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const rim = ctx.createRadialGradient(x, y, radius * .54, x, y, radius * 1.08);
      rim.addColorStop(0, `rgba(${item.color},0)`);
      rim.addColorStop(.7, `rgba(${item.color},${Math.sin(progress * Math.PI) * .08})`);
      rim.addColorStop(1, `rgba(${item.color},0)`);
      ctx.fillStyle = rim;
      ctx.fillRect(x - radius * 1.1, y - radius * 1.1, radius * 2.2, radius * 2.2);
      ctx.restore();
      if (this.foregroundCtx) {
        const front = this.foregroundCtx;
        front.save();
        front.globalCompositeOperation = "destination-out";
        const frontHole = front.createRadialGradient(x, y, radius * .08, x, y, radius * 1.08);
        frontHole.addColorStop(0, `rgba(0,0,0,${(1 - progress) * .98})`);
        frontHole.addColorStop(.62, `rgba(0,0,0,${(1 - progress) * .72})`);
        frontHole.addColorStop(1, "rgba(0,0,0,0)");
        front.fillStyle = frontHole;
        front.fillRect(x - radius * 1.1, y - radius * 1.1, radius * 2.2, radius * 2.2);
        front.restore();
      }
    }
  }

  renderLightningChannel(width, height, heroAge) {
    if (this.heroSpell !== "lightning" || !this.foregroundCtx) return;
    const cycleAge = heroAge % 2400;
    const leader = smooth((cycleAge - 340) / 180) * (1 - smooth((cycleAge - 620) / 180));
    const returnStroke = smooth((cycleAge - 560) / 35) * (1 - smooth((cycleAge - 1050) / 450));
    const reStrike = smooth((cycleAge - 1500) / 30) * (1 - smooth((cycleAge - 1610) / 230));
    const alpha = Math.max(leader * .32, returnStroke, reStrike * .78);
    if (alpha < .015) return;
    const cycle = Math.floor(heroAge / 2400);
    const target = { x: this.heroTarget.x * width, y: this.heroTarget.y * height };
    const start = { x: target.x + (seeded(cycle, 811) - .5) * width * .16, y: -height * .04 };
    const segments = 37;
    const points = [];
    let channelOffset = 0;
    const stepWeights = Array.from({ length: segments }, (_, index) => .55 + seeded(index, 845 + cycle) * 1.1);
    const totalWeight = stepWeights.reduce((sum, weight) => sum + weight, 0);
    let traveled = 0;
    for (let index = 0; index <= segments; index += 1) {
      const t = index === 0 ? 0 : (traveled += stepWeights[index - 1]) / totalWeight;
      const envelope = Math.sin(t * Math.PI);
      const coarse = Math.sin(index * .67 + cycle * 1.83) * width * .0045;
      channelOffset = channelOffset * .62 + (seeded(index, 812 + cycle) - .5) * width * .016 + coarse;
      points.push({
        x: start.x + (target.x - start.x) * t + channelOffset * envelope,
        y: start.y + (target.y - start.y) * t,
      });
    }
    const ctx = this.foregroundCtx;
    const strokePath = (path, lineWidth, color, opacity, blur = 0) => {
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      path.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.globalAlpha = clamp01(opacity);
      ctx.shadowBlur = blur;
      ctx.shadowColor = color;
      ctx.stroke();
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    strokePath(points, Math.max(7, height * .017), "#256dff", alpha * .16, 18);
    strokePath(points, Math.max(2.4, height * .0055), "#73cfff", alpha * .66, 9);
    strokePath(points, Math.max(.85, height * .0018), "#f5ffff", alpha * .92, 3);
    for (let branchIndex = 0; branchIndex < 8; branchIndex += 1) {
      const jointIndex = 4 + branchIndex * 4;
      const joint = points[Math.min(points.length - 2, jointIndex)];
      const side = (branchIndex + cycle) % 2 ? 1 : -1;
      const branchLength = width * (.026 + seeded(branchIndex, 830 + cycle) * .062);
      const branch = [joint];
      for (let step = 1; step <= 5; step += 1) {
        const t = step / 5;
        branch.push({
          x: joint.x + side * branchLength * t + (seeded(step + branchIndex * 7, 834 + cycle) - .5) * branchLength * .22,
          y: joint.y + height * (.038 + seeded(branchIndex, 832 + cycle) * .052) * t,
        });
      }
      const branchAlpha = alpha * (.13 + seeded(branchIndex, 833) * .18);
      strokePath(branch, Math.max(1.6, height * .0032), "#286fd8", branchAlpha * .25, 6);
      strokePath(branch, Math.max(.55, height * .00105), "#c9f3ff", branchAlpha, 2);
    }
    ctx.restore();
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(.04, Math.max(.001, (now - this.last) / 1000));
    this.last = now;
    const { width, height } = this.resize();
    this.update(now, dt);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    this.foregroundCtx?.clearRect(0, 0, width, height);
    const heroAge = now - this.heroStartedAt;
    const lightningCycle = heroAge % 2400;
    const lightningFlash = this.heroSpell === "lightning"
      ? Math.max(
          smooth((lightningCycle - 560) / 35) * (1 - smooth((lightningCycle - 1050) / 450)),
          smooth((lightningCycle - 1500) / 30) * (1 - smooth((lightningCycle - 1610) / 230)) * .62,
        )
      : 0;
    if (this.levels.cloud > .005 || this.levels.rain > .005) {
      ctx.fillStyle = `rgba(2,8,20,${this.levels.cloud * .1 + this.levels.rain * .075})`;
      ctx.fillRect(0, 0, width, height);
    }
    this.renderClouds(width, height, dt, lightningFlash);
    this.renderFog(width, height, dt);
    this.renderFingerMist(width, height, now);
    this.renderMagicCircle(width, height, now);
    this.renderSnow(width, height, dt, now);
    this.renderRain(width, height, dt);
    this.renderRitualPath(width, height, now);
    this.renderRitualBurst(width, height, now);
    this.renderRitualSeal(width, height, now);
    this.renderLightningChannel(width, height, heroAge);
    if (lightningFlash > .01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(184,222,255,${lightningFlash * (.08 + this.levels.cloud * .14)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    this.renderDisturbances(width, height, now);
    requestAnimationFrame(this.loop);
  }
}
