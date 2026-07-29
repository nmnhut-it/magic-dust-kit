import * as THREE from "../vendor/three/three.module.min.js";

const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, value));
const seeded = (index, salt = 0) => {
  const value = Math.sin(index * 91.917 + salt * 47.113) * 43758.5453;
  return value - Math.floor(value);
};

class PolylineCurve extends THREE.Curve {
  constructor(points) {
    super();
    this.points = points;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const scaled = clamp01(t) * (this.points.length - 1);
    const index = Math.min(this.points.length - 2, Math.floor(scaled));
    return target.copy(this.points[index]).lerp(this.points[index + 1], scaled - index);
  }
}

export class WebglParticleVfx {
  constructor(stage, { count = 2800, mirrorInput = true } = {}) {
    this.stage = stage;
    this.count = count;
    this.mirrorInput = mirrorInput;
    this.mode = "clear";
    this.anchor = { x: .5, y: .55 };
    this.summoning = false;
    this.startedAt = performance.now();
    this.until = 0;
    this.last = this.startedAt;
    this.emitCarry = 0;
    this.emitPointer = 0;
    this.summonRamp = 0;
    this.chargeCaptured = false;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "webgl-particle-layer";
    stage.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -4, 4);
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 4);
    this.sizes = new Float32Array(count);
    this.velocity = new Float32Array(count * 2);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.angle = new Float32Array(count);
    this.radius = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.spin = new Float32Array(count);
    this.baseSize = new Float32Array(count);
    this.depth = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      this.phase[index] = seeded(index, 11) * TAU;
      this.depth[index] = .35 + seeded(index, 12) * .65;
      this.baseSize[index] = 2 + seeded(index, 13) * 5;
      this.life[index] = 1;
      this.maxLife[index] = 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("particleColor", new THREE.BufferAttribute(this.colors, 4));
    geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uShape: { value: 0 },
      },
      vertexShader: `
        attribute vec4 particleColor;
        attribute float size;
        varying vec4 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = particleColor;
          gl_PointSize = size * uPixelRatio;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec4 vColor;
        uniform float uShape;
        void main() {
          vec2 p = gl_PointCoord - vec2(.5);
          float alpha;
          if (uShape > 1.5) {
            float streak = smoothstep(.5, .05, abs(p.x)) * smoothstep(.52, .18, abs(p.y));
            alpha = streak;
          } else if (uShape > .5) {
            float d = length(p);
            alpha = smoothstep(.5, .12, d);
          } else {
            float d = length(p);
            alpha = pow(max(0.0, 1.0 - d * 2.0), 2.0);
          }
          if (alpha < .015) discard;
          gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.scene.add(this.points);
    this.lightningRoot = new THREE.Group();
    this.scene.add(this.lightningRoot);
    this.lastLightningBuild = 0;
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  toWorld(point) {
    const x = this.mirrorInput ? 1 - point.x : point.x;
    return {
      x: (x - .5) * this.camera.right * 2,
      y: (.5 - point.y) * 2,
    };
  }

  resize() {
    const width = Math.max(1, this.stage.clientWidth);
    const height = Math.max(1, this.stage.clientHeight);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const aspect = width / height;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    const ratio = Math.min(1.35, devicePixelRatio || 1);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.material.uniforms.uPixelRatio.value = ratio;
  }

  setDustSummon(active, point) {
    this.summoning = Boolean(active);
    if (point) this.anchor = point;
    if (active && (this.mode === "clear" || this.mode === "summon_dust")) {
      const entering = this.mode !== "summon_dust";
      this.mode = "summon_dust";
      this.until = 0;
      this.canvas.classList.add("visible");
      if (entering) {
        const center = this.toWorld(this.anchor);
        const prewarm = Math.min(900, this.count);
        for (let index = 0; index < prewarm; index += 1) {
          this.emitDust(index, center);
          const headStart = seeded(index, 1661) * 1.25;
          this.life[index] = headStart;
          this.positions[index * 3] += this.velocity[index * 2] * headStart * .72;
          this.positions[index * 3 + 1] += this.velocity[index * 2 + 1] * headStart * .72;
        }
        this.emitPointer = prewarm % this.count;
      }
    }
  }

  cast(mode, { anchor = this.anchor, duration } = {}) {
    if (!["vortex_fire", "rain", "snow", "lightning"].includes(mode)) return false;
    this.anchor = anchor || this.anchor;
    this.mode = mode;
    this.startedAt = performance.now();
    this.until = this.startedAt + (duration || ({ vortex_fire: 9000, rain: 26000, snow: 36000, lightning: 12000 }[mode]));
    this.summoning = false;
    this.canvas.classList.add("visible");
    this.material.uniforms.uShape.value = mode === "rain" ? 2 : mode === "snow" ? 1 : 0;
    if (mode === "rain" || mode === "snow") this.seedWeather(mode);
    if (mode === "vortex_fire") this.captureVortex();
    if (mode === "lightning") this.hideParticles();
    return true;
  }

  clear() {
    this.mode = "clear";
    this.summoning = false;
    this.until = 0;
    for (let index = 0; index < this.count; index += 1) this.life[index] = this.maxLife[index];
    this.hideParticles();
    this.clearLightning();
    this.canvas.classList.remove("visible");
  }

  getState() {
    let alive = 0;
    for (let index = 0; index < this.count; index += 1) if (this.life[index] < this.maxLife[index]) alive += 1;
    return { mode: this.mode, alive };
  }

  hideParticles() {
    this.colors.fill(0);
    this.points.geometry.attributes.particleColor.needsUpdate = true;
  }

  emitDust(index, center) {
    const angle = Math.random() * TAU;
    const scatter = Math.random() * .035;
    const speed = 1.02 + this.summonRamp * 1.82;
    this.positions[index * 3] = center.x + Math.cos(angle) * scatter;
    this.positions[index * 3 + 1] = center.y + Math.sin(angle) * scatter;
    this.positions[index * 3 + 2] = (Math.random() - .5) * .8;
    this.velocity[index * 2] = Math.cos(angle) * speed * (.75 + Math.random() * .25);
    this.velocity[index * 2 + 1] = Math.sin(angle) * speed * (.75 + Math.random() * .25) + .08;
    this.life[index] = 0;
    this.maxLife[index] = 1.6 + Math.random() * 2.6;
    this.baseSize[index] = 1.7 + Math.random() * 4.6;
    this.phase[index] = Math.random() * TAU;
  }

  updateDust(dt, now) {
    const center = this.toWorld(this.anchor);
    this.summonRamp = clamp01(this.summonRamp + (this.summoning ? dt / 2.2 : -dt / 1.55));
    if (this.summoning) {
      this.emitCarry += 2600 * dt;
      while (this.emitCarry >= 1) {
        this.emitCarry -= 1;
        let attempts = 0;
        while (this.life[this.emitPointer] < this.maxLife[this.emitPointer] && attempts < this.count) {
          this.emitPointer = (this.emitPointer + 1) % this.count;
          attempts += 1;
        }
        if (attempts >= this.count) break;
        this.emitDust(this.emitPointer, center);
        this.emitPointer = (this.emitPointer + 1) % this.count;
      }
    }
    for (let index = 0; index < this.count; index += 1) {
      if (this.life[index] >= this.maxLife[index]) {
        this.colors[index * 4 + 3] = 0;
        continue;
      }
      this.life[index] += dt;
      const p = index * 3;
      const v = index * 2;
      const x = this.positions[p];
      const y = this.positions[p + 1];
      this.velocity[v] += Math.sin(y * 8 + now * .0004 + this.phase[index]) * .11 * dt;
      this.velocity[v + 1] += (Math.cos(x * 8 + now * .0003 + this.phase[index]) * .08 + .045) * dt;
      this.velocity[v] *= .972;
      this.velocity[v + 1] *= .972;
      this.positions[p] += this.velocity[v] * dt;
      this.positions[p + 1] += this.velocity[v + 1] * dt;
      const ratio = this.life[index] / this.maxLife[index];
      const birth = clamp01(this.life[index] / .05);
      const fade = clamp01((1 - ratio) / .3);
      const flash = Math.max(0, 1 - this.life[index] / .4);
      const twinkle = .65 + Math.sin(now * .0035 + this.phase[index] * 5) * .35;
      const alpha = birth * fade * twinkle * (.38 + this.depth[index] * .42);
      this.colors[p] = .34 + flash * .52;
      this.colors[p + 1] = .7 + flash * .28;
      this.colors[p + 2] = 1;
      this.colors[p + 3] = alpha;
      this.sizes[index] = this.baseSize[index] * (1 + flash * (1.8 + this.summonRamp * 1.8));
    }
    this.markChanged();
  }

  captureVortex() {
    const center = this.toWorld(this.anchor);
    let alive = 0;
    for (let index = 0; index < this.count; index += 1) {
      if (this.life[index] >= this.maxLife[index]) continue;
      const dx = this.positions[index * 3] - center.x;
      const dy = this.positions[index * 3 + 1] - center.y;
      this.angle[index] = Math.atan2(dy, dx);
      this.radius[index] = Math.max(.025, Math.hypot(dx, dy));
      this.spin[index] = .75 + Math.random() * .5;
      alive += 1;
    }
    const minimum = Math.min(650, this.count);
    for (let index = 0; alive < minimum && index < this.count; index += 1) {
      if (this.life[index] < this.maxLife[index]) continue;
      const angle = Math.random() * TAU;
      const radius = .12 + Math.random() * .82;
      this.angle[index] = angle;
      this.radius[index] = radius;
      this.spin[index] = .75 + Math.random() * .5;
      this.life[index] = 0;
      this.maxLife[index] = 12;
      this.positions[index * 3] = center.x + Math.cos(angle) * radius;
      this.positions[index * 3 + 1] = center.y + Math.sin(angle) * radius;
      alive += 1;
    }
    this.chargeCaptured = true;
  }

  updateVortex(now) {
    const age = now - this.startedAt;
    const center = this.toWorld(this.anchor);
    const charge = clamp01(age / 4400);
    const gather = Math.min(1, charge / .4);
    const t = Math.max(0, (charge - .4) / .6);
    const collapse = t * t * (2.3 * t - 1.3);
    const spinEnvelope = .12 + .88 * charge * charge;
    const burst = clamp01((age - 4300) / 110) * (1 - clamp01((age - 5350) / 900));
    for (let index = 0; index < this.count; index += 1) {
      if (this.life[index] >= this.maxLife[index]) {
        this.colors[index * 4 + 3] = 0;
        continue;
      }
      const radius = Math.max(.018, this.radius[index] * (1 - collapse));
      const shear = 1 + .3 / Math.max(radius, .025);
      const angle = this.angle[index] + age * .0013 * this.spin[index] * spinEnvelope * shear;
      const orbit = radius + burst * (.08 + this.radius[index] * .72);
      const p = index * 3;
      this.positions[p] = center.x + Math.cos(angle) * orbit;
      this.positions[p + 1] = center.y + Math.sin(angle) * orbit * (.52 + this.depth[index] * .16);
      const hot = index % 9 === 0;
      this.colors[p] = 1;
      this.colors[p + 1] = hot ? .86 : .18 + charge * .25;
      this.colors[p + 2] = hot ? .48 : .015;
      this.colors[p + 3] = .38 + this.depth[index] * .56;
      this.sizes[index] = this.baseSize[index] * (1 + gather * 2 - Math.max(0, collapse) * .6 + burst * 1.2);
    }
    this.markChanged();
  }

  seedWeather(mode) {
    const aspect = this.camera.right;
    const activeCount = mode === "rain" ? Math.min(2200, this.count) : Math.min(1250, this.count);
    for (let index = 0; index < this.count; index += 1) {
      if (index >= activeCount) {
        this.life[index] = 1;
        this.maxLife[index] = 0;
        this.colors[index * 4 + 3] = 0;
        continue;
      }
      const p = index * 3;
      this.positions[p] = (seeded(index, 201) * 2 - 1) * aspect * 1.15;
      this.positions[p + 1] = seeded(index, 202) * 2.4 - 1.2;
      this.positions[p + 2] = seeded(index, 203) * 2 - 1;
      this.velocity[index * 2] = mode === "rain" ? -.18 - seeded(index, 204) * .24 : (seeded(index, 204) - .5) * .12;
      this.velocity[index * 2 + 1] = mode === "rain" ? -1.65 - seeded(index, 205) * 2.2 : -.12 - seeded(index, 205) * .32;
      this.life[index] = 0;
      this.maxLife[index] = 999;
      this.sizes[index] = mode === "rain" ? 10 + this.depth[index] * 15 : 3 + this.depth[index] * 8;
    }
  }

  updateWeather(dt, now) {
    const rain = this.mode === "rain";
    const aspect = this.camera.right;
    for (let index = 0; index < this.count; index += 1) {
      const p = index * 3;
      if (!rain) this.velocity[index * 2] += Math.sin(now * .001 + this.phase[index]) * .025 * dt;
      this.positions[p] += this.velocity[index * 2] * dt;
      this.positions[p + 1] += this.velocity[index * 2 + 1] * dt;
      if (this.positions[p + 1] < -1.18 || this.positions[p] < -aspect * 1.2) {
        this.positions[p] = (seeded(index + Math.floor(now / 700), 211) * 2 - .75) * aspect;
        this.positions[p + 1] = 1.08 + seeded(index, 212) * .35;
      }
      const near = this.depth[index];
      this.colors[p] = rain ? .36 : .82;
      this.colors[p + 1] = rain ? .72 : .92;
      this.colors[p + 2] = 1;
      this.colors[p + 3] = rain ? .2 + near * .55 : .3 + near * .62;
    }
    this.markChanged();
  }

  buildLightning(now) {
    if (now - this.lastLightningBuild < 115) return;
    this.lastLightningBuild = now;
    this.clearLightning();
    const target = this.toWorld(this.anchor);
    const aspect = this.camera.right;
    const bolts = 5;
    for (let bolt = 0; bolt < bolts; bolt += 1) {
      const start = new THREE.Vector3((-aspect + seeded(bolt + Math.floor(now / 115), 301) * aspect * 2), 1.14, 0);
      const end = new THREE.Vector3(
        target.x + (seeded(bolt, 302) - .5) * (bolt ? .75 : .12),
        target.y + (seeded(bolt, 303) - .5) * (bolt ? .55 : .08),
        0,
      );
      const points = [];
      const segments = 18;
      for (let index = 0; index <= segments; index += 1) {
        const t = index / segments;
        const envelope = Math.sin(t * Math.PI);
        points.push(new THREE.Vector3(
          THREE.MathUtils.lerp(start.x, end.x, t) + (seeded(index + bolt * 31 + Math.floor(now / 115), 304) - .5) * .16 * envelope,
          THREE.MathUtils.lerp(start.y, end.y, t),
          0,
        ));
      }
      const curve = new PolylineCurve(points);
      const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, bolt ? .011 : .024, 5, false), new THREE.MeshBasicMaterial({
        color: 0x3c75ff, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, bolt ? .0035 : .007, 5, false), new THREE.MeshBasicMaterial({
        color: bolt ? 0x8fdcff : 0xffffff, transparent: true, opacity: bolt ? .72 : 1, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      this.lightningRoot.add(glow, core);
    }
  }

  clearLightning() {
    for (const child of [...this.lightningRoot.children]) {
      child.geometry?.dispose();
      child.material?.dispose();
      this.lightningRoot.remove(child);
    }
  }

  markChanged() {
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.particleColor.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
  }

  loop(now) {
    this.resize();
    // Giữ đúng mật độ phát hạt khi camera/headless chỉ đạt 10–20 FPS.
    // Shader vẫn render một draw call; giới hạn 100 ms chỉ để tránh bước vật lý quá lớn.
    const dt = Math.min(.1, Math.max(.001, (now - this.last) / 1000));
    this.last = now;
    if (this.until && now >= this.until) this.clear();
    if (this.mode === "summon_dust") this.updateDust(dt, now);
    else if (this.mode === "vortex_fire") this.updateVortex(now);
    else if (this.mode === "rain" || this.mode === "snow") this.updateWeather(dt, now);
    else if (this.mode === "lightning") this.buildLightning(now);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }
}
