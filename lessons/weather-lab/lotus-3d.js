import * as THREE from "../vendor/three/three.module.min.js";

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const phase = (age, start, end) => clamp01((age - start) / (end - start));
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

function makePetalGeometry() {
  const geometry = new THREE.PlaneGeometry(1.46, 2.25, 28, 40);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let index = 0; index < positions.count; index += 1) {
    const u = uvs.getX(index);
    const v = uvs.getY(index);
    const across = u * 2 - 1;
    const baseOpen = smooth(v / .3);
    const tipTaper = 1 - smooth((v - .7) / .3);
    const envelope = .15 + .85 * Math.pow(baseOpen * tipTaper, .58);
    const organicLean = Math.sin(v * Math.PI) * (v - .38) * .035;
    positions.setX(index, across * .73 * envelope + organicLean);

    const tipCurl = smooth((v - .69) / .31);
    const roundedTip = Math.pow(Math.abs(across), 1.7) * tipCurl * .18;
    positions.setY(index, v * 2.25 - tipCurl * tipCurl * .13 - roundedTip);

    const center = 1 - across * across;
    const bodyCup = center * Math.sin(Math.PI * v) * .2;
    const softEdges = -across * across * Math.sin(Math.PI * v) * .065;
    const backBentTip = tipCurl * tipCurl * (.25 + center * .13);
    const tipTwist = across * tipCurl * tipCurl * .075;
    positions.setZ(index, bodyCup + softEdges + backBentTip + tipTwist);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makePetalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(242, 30);
  ctx.quadraticCurveTo(256, 8, 270, 30);
  ctx.bezierCurveTo(342, 92, 450, 370, 442, 690);
  ctx.bezierCurveTo(438, 850, 340, 982, 256, 1018);
  ctx.bezierCurveTo(172, 982, 74, 850, 70, 690);
  ctx.bezierCurveTo(62, 360, 170, 92, 242, 30);
  ctx.closePath();
  ctx.clip();
  const base = ctx.createLinearGradient(0, 1024, 0, 0);
  base.addColorStop(0, "#071b62");
  base.addColorStop(.24, "#0b4aa0");
  base.addColorStop(.64, "#1b91c2");
  base.addColorStop(1, "#4eb3c5");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 1024);
  ctx.globalCompositeOperation = "source-over";
  for (let index = 0; index < 18; index += 1) {
    const side = index % 2 ? 1 : -1;
    const spread = 28 + (index % 9) * 19;
    ctx.beginPath();
    ctx.moveTo(256 + (index % 3 - 1) * 4, 1000);
    ctx.bezierCurveTo(256 + side * spread * .13, 770 - index * 5, 256 + side * spread * .58, 470 - index * 3, 256 + side * spread, 150 + (index % 6) * 48);
    ctx.strokeStyle = `rgba(${26 + index % 3 * 8},${96 + index % 4 * 7},${144 + index % 3 * 9},${.035 + (index % 4) * .008})`;
    ctx.lineWidth = .7 + (index % 4) * .25;
    ctx.stroke();
  }
  const midrib = ctx.createLinearGradient(252, 0, 260, 0);
  midrib.addColorStop(0, "rgba(3,29,74,0)");
  midrib.addColorStop(.5, "rgba(3,29,74,.12)");
  midrib.addColorStop(1, "rgba(3,29,74,0)");
  ctx.fillStyle = midrib;
  ctx.fillRect(246, 84, 20, 900);
  ctx.globalCompositeOperation = "multiply";
  for (let index = 0; index < 44; index += 1) {
    const x = 80 + ((index * 97) % 350);
    const y = 80 + ((index * 193) % 850);
    const radius = 18 + index % 7 * 9;
    const shade = ctx.createRadialGradient(x, y, 0, x, y, radius);
    shade.addColorStop(0, "rgba(0,18,72,.13)");
    shade.addColorStop(1, "rgba(0,18,72,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makePetalGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(242, 30);
  ctx.quadraticCurveTo(256, 8, 270, 30);
  ctx.bezierCurveTo(342, 92, 450, 370, 442, 690);
  ctx.bezierCurveTo(438, 850, 340, 982, 256, 1018);
  ctx.bezierCurveTo(172, 982, 74, 850, 70, 690);
  ctx.bezierCurveTo(62, 360, 170, 92, 242, 30);
  ctx.closePath();
  ctx.clip();
  const vertical = ctx.createLinearGradient(0, 1024, 0, 0);
  vertical.addColorStop(0, "rgb(10,10,10)");
  vertical.addColorStop(.4, "rgb(28,28,28)");
  vertical.addColorStop(.78, "rgb(82,82,82)");
  vertical.addColorStop(1, "rgb(150,150,150)");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, 512, 1024);
  ctx.globalCompositeOperation = "lighter";
  const center = ctx.createLinearGradient(80, 0, 430, 0);
  center.addColorStop(0, "rgba(0,0,0,0)");
  center.addColorStop(.46, "rgba(95,95,95,.035)");
  center.addColorStop(.5, "rgba(210,210,210,.17)");
  center.addColorStop(.54, "rgba(95,95,95,.035)");
  center.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, 512, 1024);
  for (const side of [-1, 1]) {
    for (let index = 0; index < 8; index += 1) {
      ctx.beginPath();
      ctx.moveTo(256, 990);
      ctx.quadraticCurveTo(256 + side * (36 + index * 18), 650, 256 + side * (68 + index * 19), 210 + index * 42);
      ctx.strokeStyle = `rgba(190,220,255,${.012 + index * .003})`;
      ctx.lineWidth = .7 + index * .08;
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

function attachPetalDeformation(material, phase) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uPetalTime = { value: 0 };
    shader.uniforms.uPetalEnergy = { value: 0 };
    shader.uniforms.uPetalPhase = { value: phase };
    shader.uniforms.uPetalOpen = { value: 0 };
    shader.uniforms.uPetalHeat = { value: 0 };
    shader.uniforms.uPetalFlow = { value: 0 };
    shader.vertexShader = `
      uniform float uPetalTime;
      uniform float uPetalEnergy;
      uniform float uPetalPhase;
      uniform float uPetalOpen;
    ` + shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
        vec3 transformed = vec3(position);
        float petalTip = smoothstep(0.55, 1.0, uv.y);
        float closedPetal = 1.0 - uPetalOpen;
        transformed.x *= mix(0.48, 1.0, uPetalOpen);
        transformed.z -= closedPetal * petalTip * petalTip * 0.39;
        transformed.z += closedPetal * sin(uv.y * 3.14159265) * 0.12;
        transformed.y -= closedPetal * petalTip * 0.1;
        float petalEnvelope = sin(uv.y * 3.14159265) * uPetalEnergy;
        float petalWave = sin(uPetalTime * 1.75 + uv.y * 7.2 + uPetalPhase);
        transformed.z += petalWave * petalEnvelope * 0.032;
        transformed.x += sin(uPetalTime * 1.1 + uv.y * 4.6 + uPetalPhase) * petalEnvelope * 0.012;
      `,
    );
    shader.fragmentShader = `
      uniform float uPetalHeat;
      uniform float uPetalFlow;
    ` + shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
        #include <map_fragment>
        vec3 lotusBase = vec3(0.025, 0.19, 0.58);
        vec3 lotusCyan = vec3(0.08, 0.72, 0.9);
        vec3 lotusViolet = vec3(0.2, 0.1, 0.72);
        vec3 lotusDeep = vec3(0.025, 0.12, 0.52);
        vec3 coolGradient = mix(lotusBase, lotusCyan, smoothstep(0.08, 0.92, vMapUv.y));
        vec3 hotGradient = mix(lotusDeep, lotusViolet, smoothstep(0.12, 0.96, vMapUv.y));
        vec3 flowingColor = mix(coolGradient, hotGradient, uPetalHeat);
        float movingBand = exp(-pow((fract(vMapUv.y - uPetalFlow + 1.0) - 0.5) * 7.0, 2.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, flowingColor, 0.54);
        diffuseColor.rgb += movingBand * mix(vec3(0.03, 0.24, 0.38), vec3(0.08, 0.18, 0.5), uPetalHeat) * 0.42;
      `,
    );
    material.userData.deformShader = shader;
  };
  material.customProgramCacheKey = () => "magic-petal-deform-v3";
}

function makeSparkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(.18, "rgba(255,255,255,.95)");
  glow.addColorStop(.55, "rgba(255,255,255,.28)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = false;
  return texture;
}

function makeContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const shadow = ctx.createRadialGradient(256, 128, 8, 256, 128, 244);
  shadow.addColorStop(0, "rgba(0,6,18,.62)");
  shadow.addColorStop(.3, "rgba(0,9,25,.38)");
  shadow.addColorStop(.72, "rgba(0,12,30,.1)");
  shadow.addColorStop(1, "rgba(0,15,35,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

function makeShardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(64, 10, 64, 118);
  gradient.addColorStop(0, "rgba(221,254,255,0)");
  gradient.addColorStop(.3, "rgba(174,245,255,.88)");
  gradient.addColorStop(.52, "rgba(255,255,255,1)");
  gradient.addColorStop(.72, "rgba(55,167,255,.72)");
  gradient.addColorStop(1, "rgba(21,62,210,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(64, 4);
  ctx.lineTo(78, 64);
  ctx.lineTo(64, 124);
  ctx.lineTo(50, 64);
  ctx.closePath();
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

let swordDamascusTexture;
function getSwordDamascusTexture() {
  if (swordDamascusTexture) return swordDamascusTexture;
  swordDamascusTexture = new THREE.TextureLoader().load("../assets/camera-effects/materials/sword-damascus-v1.webp");
  swordDamascusTexture.colorSpace = THREE.SRGBColorSpace;
  swordDamascusTexture.wrapS = THREE.MirroredRepeatWrapping;
  swordDamascusTexture.wrapT = THREE.MirroredRepeatWrapping;
  swordDamascusTexture.repeat.set(2.2, 4.2);
  return swordDamascusTexture;
}

function makeSword() {
  const sword = new THREE.Group();
  const damascusTexture = getSwordDamascusTexture();
  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd4d9db, bumpMap: damascusTexture, bumpScale: .006,
    emissive: 0x10171b, emissiveIntensity: .16,
    metalness: .84, roughness: .22, clearcoat: .08, clearcoatRoughness: .42,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x111821, metalness: .94, roughness: .24, emissive: 0x010306,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: 0x756044, metalness: .88, roughness: .3, emissive: 0x080501,
  });
  const profile = new THREE.Shape();
  profile.moveTo(-.105, 0);
  profile.lineTo(-.098, .17);
  profile.quadraticCurveTo(-.075, .93, -.048, 1.24);
  profile.quadraticCurveTo(-.028, 1.43, 0, 1.58);
  profile.quadraticCurveTo(.028, 1.43, .048, 1.24);
  profile.quadraticCurveTo(.075, .93, .098, .17);
  profile.lineTo(.105, 0);
  profile.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(profile, {
    depth: .045, bevelEnabled: true, bevelSegments: 2, bevelSize: .014, bevelThickness: .012,
  }), bladeMaterial);
  blade.position.z = -.022;
  sword.add(blade);
  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(.014, 1.08, .05),
    new THREE.MeshStandardMaterial({ color: 0x1d2730, metalness: .98, roughness: .18 }),
  );
  fuller.position.set(0, .59, .015);
  sword.add(fuller);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.42, .045, .085), darkMetal);
  guard.position.y = -.015;
  sword.add(guard);
  const guardRing = new THREE.Mesh(new THREE.TorusGeometry(.105, .016, 10, 24), bronze);
  guardRing.position.set(0, -.012, .055);
  sword.add(guardRing);
  for (const side of [-1, 1]) {
    const quillon = new THREE.Mesh(new THREE.ConeGeometry(.028, .24, 12), bronze);
    quillon.position.set(side * .245, -.012, 0);
    quillon.rotation.z = side * Math.PI / 2;
    sword.add(quillon);
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.045, .052, .42, 8), darkMetal);
  grip.position.y = -.25;
  sword.add(grip);
  for (const y of [-.13, -.25, -.37]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(.052, .009, 5, 10), bronze);
    band.position.y = y;
    band.rotation.x = Math.PI / 2;
    sword.add(band);
  }
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(.085), bladeMaterial);
  pommel.position.y = -.49;
  sword.add(pommel);
  const trails = [];
  sword.userData = { trails, bladeMaterial, darkMetal, bronze };
  return sword;
}

export class Magic3DEngine {
  constructor(stage, { mirrorInput = true, autoStart = true } = {}) {
    this.stage = stage;
    this.mirrorInput = mirrorInput;
    this.anchor = { x: .5, y: .55 };
    this.aim = { x: .5, y: .35 };
    this.target = { x: .78, y: .25 };
    this.grip = 1;
    this.swordVolleyAt = Infinity;
    this.swordManualVolley = false;
    this.swordFingerSpan = null;
    this.mode = "clear";
    this.visible = false;
    this.startedAt = 0;
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.lastPixelRatio = 0;
    this.pixelRatio = Math.min(1, devicePixelRatio || 1);
    this.frameTimes = [];
    this.lastFrameAt = performance.now();
    this.performanceSampled = false;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "lotus-3d-layer magic-3d-layer";
    stage.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, premultipliedAlpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(31, 1, .1, 100);
    this.camera.position.set(0, 2.35, 8.7);
    this.camera.lookAt(0, .7, 0);
    this.scene.add(new THREE.AmbientLight(0x071b52, 1.5));
    for (const [color, intensity, position] of [
      [0x50dfff, 4.5, [-3, 5, 5]],
      [0x264cff, 5.5, [4, 2, -4]],
      [0x71f6ff, 6.5, [0, .8, 0]],
    ]) {
      const light = new THREE.PointLight(color, intensity, 18);
      light.position.set(...position);
      this.scene.add(light);
    }
    this.root = new THREE.Group();
    this.root.rotation.x = -.08;
    this.scene.add(this.root);
    this.petals = [];
    this.materials = [];
    this.buildLotus();
    this.loop = this.loop.bind(this);
    if (autoStart) requestAnimationFrame(this.loop);
  }

  buildSwords() {
    this.swordRoot = new THREE.Group();
    this.swordRoot.visible = false;
    this.scene.add(this.swordRoot);
    this.swords = [];
    for (let index = 0; index < 24; index += 1) {
      const sword = makeSword();
      const fingerSlot = index % 2;
      const ringIndex = Math.floor(index / 2);
      const angle = ringIndex * 2.399963 + fingerSlot * .38;
      const radius = .18 + Math.sqrt(ringIndex / 11) * .54;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * .58;
      const z = -.62 + (ringIndex % 4) * .34 + fingerSlot * .09;
      const { trails, bladeMaterial, darkMetal, bronze } = sword.userData;
      sword.userData = {
        index,
        fingerSlot,
        riseDelay: (index % 8) * 62 + Math.floor(index / 8) * 105,
        launchDelay: (index * 431) % 2600,
        formation: new THREE.Vector3(x, y, z),
        crossDepth: ((index % 5) - 2) * .23,
        laneAngle: angle,
        laneRadius: .22 + (index % 6) * .055,
        spin: (index % 2 ? 1 : -1) * (.15 + index % 4 * .04),
        trails,
        bladeMaterial,
        darkMetal,
        bronze,
      };
      sword.scale.setScalar(.18 + (ringIndex % 4) * .018 + (z + .62) * .012);
      this.swordRoot.add(sword);
      this.swords.push(sword);
    }
    this.swordLight = new THREE.PointLight(0x46cfff, 0, 13);
    this.scene.add(this.swordLight);
    this.swordKey = new THREE.DirectionalLight(0xf0f7ff, 4.2);
    this.swordKey.position.set(-3, 5, 6);
    this.swordKey.visible = false;
    this.scene.add(this.swordKey);
    this.swordFill = new THREE.HemisphereLight(0xddeeff, 0x090d13, 3.1);
    this.swordFill.visible = false;
    this.scene.add(this.swordFill);
    this.impactDirections = [];
    this.impactPositions = new Float32Array(110 * 3);
    for (let index = 0; index < 110; index += 1) {
      const angle = index * 2.399963;
      const lift = ((index * 47) % 100) / 100 * 2 - 1;
      const radial = Math.sqrt(1 - lift * lift);
      this.impactDirections.push(new THREE.Vector3(
        Math.cos(angle) * radial,
        Math.sin(angle) * radial,
        lift * .48,
      ).multiplyScalar(.34 + (index % 9) * .052));
    }
    const impactGeometry = new THREE.BufferGeometry();
    impactGeometry.setAttribute("position", new THREE.BufferAttribute(this.impactPositions, 3));
    this.swordImpact = new THREE.Points(impactGeometry, new THREE.PointsMaterial({
      color: 0xa8efff, map: makeShardTexture(), size: .13, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.swordImpact.visible = false;
    this.scene.add(this.swordImpact);
  }

  buildLightning() {
    this.lightningRoot = new THREE.Group();
    this.lightningRoot.visible = false;
    this.scene.add(this.lightningRoot);
    this.bolts = [];
    this.boltCores = [];
    this.boltGlows = [];
    const makeLine = (opacity, color = 0x9ef4ff) => {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color, transparent: true, opacity, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false,
      });
      const line = new THREE.Line(geometry, material);
      this.lightningRoot.add(line);
      this.bolts.push(line);
    };
    for (let index = 0; index < 9; index += 1) makeLine(index < 3 ? .95 : .42, index % 2 ? 0x4bbdff : 0xd8fbff);
    for (let index = 0; index < 9; index += 1) {
      const glow = new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({
          color: 0x246eff, transparent: true, opacity: .14,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }),
      );
      this.lightningRoot.add(glow);
      this.boltGlows.push(glow);
      const core = new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0xa8f4ff : index < 3 ? 0x56cfff : 0x48b7ff, transparent: true,
          opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }),
      );
      this.lightningRoot.add(core);
      this.boltCores.push(core);
    }
    this.sparkPositions = new Float32Array(150 * 3);
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({
      color: 0x85eaff, map: makeSparkTexture(), size: .22, transparent: true,
      opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true,
    }));
    this.lightningRoot.add(this.sparks);
    this.lightningLight = new THREE.PointLight(0x72dfff, 0, 14);
    this.scene.add(this.lightningLight);
    this.lastBoltRefresh = -Infinity;
    this.lastLightningCycle = -1;
  }

  buildOrb() {
    this.orbRoot = new THREE.Group();
    this.orbRoot.visible = false;
    this.scene.add(this.orbRoot);

    const vertexShader = `
      uniform float uTime;
      uniform float uPulse;
      varying vec3 vNormalView;
      varying vec3 vPosition;
      varying float vWarp;
      void main() {
        float warp =
          sin(position.x * 7.0 + uTime * 2.7) *
          sin(position.y * 9.0 - uTime * 2.1) *
          sin(position.z * 8.0 + uTime * 1.8);
        vec3 displaced = position + normal * warp * (0.055 + uPulse * 0.025);
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vPosition = displaced;
        vWarp = warp;
        gl_Position = projectionMatrix * viewPosition;
      }`;
    const fragmentShader = `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vNormalView;
      varying vec3 vPosition;
      varying float vWarp;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + .1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), vec3(0.0, 0.0, 1.0))), 2.2);
        float cells = hash(floor((vPosition + uTime * .035) * 19.0));
        float filaments = smoothstep(.43, .78, abs(vWarp) * .72 + cells * .52);
        float alpha = (fresnel * .34 + filaments * .66) * uOpacity;
        if (alpha < .035) discard;
        vec3 cyan = vec3(.09, .72, 1.0);
        vec3 violet = vec3(.3, .08, 1.0);
        vec3 color = mix(violet, cyan, fresnel + filaments * .35);
        color += vec3(.72, .95, 1.0) * filaments * .7;
        gl_FragColor = vec4(color, alpha);
      }`;
    this.orbShellMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.orbShell = new THREE.Mesh(new THREE.SphereGeometry(.72, 64, 44), this.orbShellMaterial);
    this.orbRoot.add(this.orbShell);

    this.orbCore = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xdafaff,
        map: makeSparkTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.orbRoot.add(this.orbCore);
    this.orbHalos = [0x72dcff, 0x416cff, 0x772dff].map((color, index) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        color,
        map: makeSparkTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      sprite.userData.baseScale = 1.05 + index * .54;
      this.orbRoot.add(sprite);
      return sprite;
    });

    this.orbFilaments = Array.from({ length: 5 }, (_, stream) => {
      const points = Array.from({ length: 28 }, (_, index) => {
        const t = index / 27;
        const angle = t * Math.PI * (2.7 + stream * .17) + stream * .91;
        const radius = .14 + Math.sin(t * Math.PI) * (.72 + stream * .025);
        return new THREE.Vector3(
          Math.cos(angle) * radius,
          (t - .5) * (.42 + stream * .025) + Math.sin(angle * 1.31) * radius * .18,
          Math.sin(angle) * radius * .72,
        );
      });
      const material = new THREE.MeshBasicMaterial({
        color: stream % 3 === 0 ? 0x8af3ff : stream % 3 === 1 ? 0x4e93ff : 0x8d5cff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const filament = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 52, .008 + stream * .0008, 5, false),
        material,
      );
      filament.userData.spin = (stream % 2 ? -1 : 1) * (.00016 + stream * .000025);
      filament.userData.phase = stream * 1.27;
      this.orbRoot.add(filament);
      return filament;
    });

    this.orbParticleCount = 220;
    this.orbParticlePositions = new Float32Array(this.orbParticleCount * 3);
    this.orbParticleData = Array.from({ length: this.orbParticleCount }, (_, index) => ({
      radius: .1 + Math.pow(seeded(index, 301), 2.15) * 1.12,
      phase: seeded(index, 302) * Math.PI * 2,
      speed: .28 + seeded(index, 303) * 1.15,
      lift: (seeded(index, 304) - .5) * 1.35,
      stream: index % 5,
    }));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.orbParticlePositions, 3));
    this.orbParticleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uSize: { value: 11 },
      },
      vertexShader: `
        uniform float uSize;
        varying float vDepth;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vDepth = clamp((-viewPosition.z - 2.0) / 5.0, 0.0, 1.0);
          gl_PointSize = uSize * (3.2 / max(1.2, -viewPosition.z));
          gl_Position = projectionMatrix * viewPosition;
        }`,
      fragmentShader: `
        uniform float uOpacity;
        varying float vDepth;
        void main() {
          float distanceFromCenter = length(gl_PointCoord - vec2(.5));
          float softDisc = smoothstep(.5, .08, distanceFromCenter);
          if (softDisc < .01) discard;
          vec3 color = mix(vec3(.08, .48, 1.0), vec3(.72, .98, 1.0), softDisc);
          color = mix(color, vec3(.42, .24, 1.0), vDepth * .28);
          gl_FragColor = vec4(color, softDisc * uOpacity);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.orbParticles = new THREE.Points(
      geometry,
      this.orbParticleMaterial,
    );
    this.orbRoot.add(this.orbParticles);
    this.orbLight = new THREE.PointLight(0x55cfff, 0, 11);
    this.scene.add(this.orbLight);
  }

  buildLotus() {
    this.lotusKey = new THREE.DirectionalLight(0xbdd9e8, 1.65);
    this.lotusKey.position.set(-3, 5, 6);
    this.lotusKey.visible = false;
    this.scene.add(this.lotusKey);
    this.lotusFill = new THREE.HemisphereLight(0xa9d7e5, 0x102038, 2.15);
    this.lotusFill.visible = false;
    this.scene.add(this.lotusFill);
    this.lotusShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.15, 1.48),
      new THREE.MeshBasicMaterial({
        color: 0x020815,
        map: makeContactShadowTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.lotusShadow.rotation.x = -Math.PI / 2;
    this.lotusShadow.position.set(0, -.51, .14);
    this.lotusShadow.renderOrder = -2;
    this.root.add(this.lotusShadow);
    const receptacleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a2e50,
      emissive: 0x041d3e,
      emissiveIntensity: .34,
      roughness: .8,
      metalness: 0,
      clearcoat: 0,
      sheen: .12,
      sheenRoughness: .92,
      sheenColor: new THREE.Color(0x5bd6e8),
    });
    this.receptacle = new THREE.Mesh(
      new THREE.SphereGeometry(.9, 48, 28),
      receptacleMaterial,
    );
    this.receptacle.position.set(0, -.3, 0);
    this.receptacle.scale.set(.64, .26, .64);
    this.root.add(this.receptacle);
    const centerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x6ac8c4,
      emissive: 0x0d6875,
      emissiveIntensity: .58,
      roughness: .72,
      metalness: 0,
    });
    this.receptacleCenter = new THREE.Mesh(
      new THREE.CylinderGeometry(.25, .38, .18, 32, 2),
      centerMaterial,
    );
    this.receptacleCenter.position.set(0, .18, 0);
    this.root.add(this.receptacleCenter);
    this.lotusAura = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x36bfff,
      map: makeSparkTexture(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    this.lotusAura.position.set(0, .08, -.9);
    this.lotusAura.scale.set(4.8, 4.8, 1);
    this.lotusAura.renderOrder = -1;
    this.root.add(this.lotusAura);
    this.lotusMist = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x55e6ff,
      map: makeSparkTexture(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    this.lotusMist.position.set(0, -.42, .35);
    this.lotusMist.scale.set(3.7, .72, 1);
    this.root.add(this.lotusMist);
    this.lotusOrbits = [0, 1].map(index => {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(1.12 + index * .26, .012 + index * .004, 8, 96),
        new THREE.MeshBasicMaterial({
          color: index ? 0x7068ff : 0x63eaff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      orbit.position.y = -.08 + index * .22;
      orbit.rotation.x = Math.PI / 2 + (index ? .34 : -.2);
      this.root.add(orbit);
      return orbit;
    });
    this.lotusParticleCount = 180;
    this.lotusParticlePositions = new Float32Array(this.lotusParticleCount * 3);
    this.lotusParticleData = Array.from({ length: this.lotusParticleCount }, (_, index) => ({
      phase: seeded(index, 811) * Math.PI * 2,
      radius: .28 + Math.pow(seeded(index, 812), .72) * 1.5,
      speed: .35 + seeded(index, 813) * 1.15,
      lift: seeded(index, 814),
      wobble: seeded(index, 815) * Math.PI * 2,
    }));
    const lotusParticleGeometry = new THREE.BufferGeometry();
    lotusParticleGeometry.setAttribute("position", new THREE.BufferAttribute(this.lotusParticlePositions, 3));
    this.lotusParticles = new THREE.Points(lotusParticleGeometry, new THREE.PointsMaterial({
      color: 0x83edff,
      map: makeSparkTexture(),
      size: .105,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    }));
    this.root.add(this.lotusParticles);
    this.lotusLight = new THREE.PointLight(0x4adfff, 0, 8);
    this.lotusLight.position.set(0, .25, 1.1);
    this.root.add(this.lotusLight);
    const geometry = makePetalGeometry();
    const texture = makePetalTexture();
    const glowTexture = makePetalGlowTexture();
    const makeMaterial = (color, emissive) => {
      const material = new THREE.MeshPhysicalMaterial({
        color, map: texture, emissive, emissiveMap: glowTexture, emissiveIntensity: .38,
        roughness: .94, metalness: 0, transmission: 0,
        thickness: .12, ior: 1.18, transparent: true, opacity: .98,
        alphaTest: .018, clearcoat: 0,
        sheen: .035, sheenRoughness: 1, sheenColor: new THREE.Color(0x174965),
        iridescence: 0,
        bumpMap: texture, bumpScale: .0035, side: THREE.DoubleSide, depthWrite: true,
      });
      attachPetalDeformation(material, this.materials.length * 1.73);
      this.materials.push(material);
      return material;
    };
    const materials = [
      makeMaterial(0x5279b8, 0x04132f),
      makeMaterial(0x4d91b5, 0x05243a),
      makeMaterial(0x76b5bd, 0x07303a),
    ];
    const addRing = (count, radius, scale, height, openTilt, materialIndex, delay, offset = 0) => {
      for (let index = 0; index < count; index += 1) {
        const angle = offset + index / count * Math.PI * 2;
        const mesh = new THREE.Mesh(geometry, materials[materialIndex]);
        mesh.scale.set(scale * (.94 + Math.sin(index * 4.17) * .05), scale, scale);
        mesh.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
        mesh.rotation.order = "YXZ";
        mesh.rotation.y = angle;
        mesh.rotation.x = .08;
        mesh.userData = {
          openTilt,
          closedTilt: .08,
          delay: delay + index * 24,
          baseX: mesh.position.x,
          baseY: height,
          baseZ: mesh.position.z,
          baseScaleX: mesh.scale.x,
          baseScaleY: mesh.scale.y,
          baseScaleZ: mesh.scale.z,
          baseRotationY: angle,
          flutterPhase: angle * 1.7 + materialIndex * .83,
          releaseSpeed: 1.25 + seeded(this.petals.length, 611) * 1.05,
          releaseLift: .38 + seeded(this.petals.length, 612) * .74,
          releaseDrag: .72 + seeded(this.petals.length, 613) * .38,
          releaseSwirl: (seeded(this.petals.length, 616) - .5) * .72,
          tumbleX: (seeded(this.petals.length, 614) - .5) * 4.8,
          tumbleZ: (seeded(this.petals.length, 615) - .5) * 4.2,
          openFactor: 0,
        };
        mesh.onBeforeRender = () => {
          const shader = mesh.material.userData.deformShader;
          if (shader) shader.uniforms.uPetalOpen.value = mesh.userData.openFactor;
        };
        this.root.add(mesh);
        this.petals.push(mesh);
      }
    };
    addRing(12, .82, .72, -.48, 1.16, 0, 400, Math.PI / 12);
    addRing(9, .56, .78, -.24, .92, 1, 780);
    addRing(7, .31, .66, .02, .6, 2, 1120, Math.PI / 7);
    addRing(5, .12, .48, .23, .3, 2, 1420);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a3f73, emissive: 0x073b84, emissiveIntensity: .48,
      roughness: .72, transmission: .06, thickness: .3, ior: 1.18,
      clearcoat: 0, transparent: true, opacity: .34, depthWrite: false,
    });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(.48, 3), coreMaterial);
    this.core.position.y = .12;
    this.core.scale.set(.28, .48, .28);
    this.core.visible = false;
    this.root.add(this.core);
  }

  cast(mode = "lotus", { target, manualVolley = false } = {}) {
    if (mode !== "lotus") return this.clear();
    this.startedAt = performance.now();
    this.releasedAt = Infinity;
    this.frameTimes.length = 0;
    this.performanceSampled = false;
    this.mode = mode;
    if (target) this.target = { x: this.mirrorInput ? 1 - target.x : target.x, y: target.y };
    this.visible = true;
    this.root.visible = mode === "lotus";
    this.lotusKey.visible = mode === "lotus";
    this.lotusFill.visible = mode === "lotus";
    this.canvas.dataset.spell = mode;
    this.canvas.classList.add("visible");
  }

  clear() {
    this.visible = false;
    this.mode = "clear";
    this.lotusKey.visible = false;
    this.lotusFill.visible = false;
    this.canvas.dataset.spell = "clear";
    this.canvas.classList.remove("visible");
  }

  release() {
    if (this.mode !== "lotus" || Number.isFinite(this.releasedAt)) return false;
    this.releasedAt = performance.now();
    return true;
  }

  renderLotusFrame(age, yaw = 0) {
    this.mode = "lotus";
    this.visible = true;
    this.root.visible = true;
    this.lotusKey.visible = true;
    this.lotusFill.visible = true;
    this.canvas.classList.add("visible");
    this.resize();
    this.updateLotus(age, age);
    this.root.rotation.y += yaw;
    this.renderer.render(this.scene, this.camera);
  }

  signalSwordVolley(target) {
    if (this.mode !== "swords" || Number.isFinite(this.swordVolleyAt)) return false;
    if (target) this.target = { x: this.mirrorInput ? 1 - target.x : target.x, y: target.y };
    this.swordVolleyAt = performance.now();
    return true;
  }

  setTracking({ anchor, aim, grip, span } = {}) {
    if (anchor) this.anchor = { x: this.mirrorInput ? 1 - anchor.x : anchor.x, y: anchor.y };
    if (aim) this.aim = { x: this.mirrorInput ? 1 - aim.x : aim.x, y: aim.y };
    if (span?.length === 2) {
      this.swordFingerSpan = span.map(point => ({
        x: this.mirrorInput ? 1 - point.x : point.x,
        y: point.y,
      }));
    }
    if (Number.isFinite(grip)) this.grip = Math.max(.72, Math.min(1.22, grip));
  }

  screenToWorld(point, z = 0) {
    const aspect = this.lastWidth / Math.max(1, this.lastHeight);
    return new THREE.Vector3((point.x - .5) * 5.7 * aspect, (.5 - point.y) * 4.1, z);
  }

  updateLotus(age, now) {
    const bloom = smooth(age / 2600);
    const energy = smooth((age - 1700) / 2600);
    const heat = smooth((age - 3200) / 3600);
    const breathingAge = Math.max(0, age - 3000);
    const breathingPhase = (breathingAge % 2100) / 2100;
    const breathing = .5 - .5 * Math.cos(breathingPhase * Math.PI * 2);
    const breathingOpen = age < 3000 ? 1 : .32 + breathing * .68;
    const cycleGrowth = 1 + Math.min(.34, breathingAge / 2100 * .06);
    const releaseAge = Number.isFinite(this.releasedAt) ? now - this.releasedAt : -1;
    const compression = phase(releaseAge, 0, 185) * (1 - phase(releaseAge, 185, 275));
    const explosion = phase(releaseAge, 255, 1320);
    const fade = phase(releaseAge, 780, 1450);
    const destination = this.screenToWorld(this.anchor);
    destination.y += .18;
    this.root.position.lerp(destination, .15);
    const targetScale = (.08 + bloom * .25 * cycleGrowth + Math.sin(explosion * Math.PI) * .04) * this.grip * (1 - compression * .3);
    this.root.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), .12);
    this.lotusShadow.material.opacity = (.08 + bloom * .32) * (1 - smooth((age - 8200) / 900));
    this.lotusShadow.scale.set(1 + bloom * .12, 1 + bloom * .05, 1);
    const summonSpin = smooth(age / 2400);
    this.root.rotation.y = age * (.00024 + (1 - summonSpin) * .00042) + Math.sin(age * .00042) * .055;
    this.root.rotation.x = -.08 + Math.sin(age * .0007) * .018;
    this.root.rotation.z = Math.sin(age * .00053 + .8) * .012;
    for (const petal of this.petals) {
      const open = smooth((age - petal.userData.delay) / 1250);
      const animatedOpen = open * breathingOpen * (1 - compression * .68);
      petal.userData.openFactor = animatedOpen;
      const flutter = Math.sin(age * .00135 + petal.userData.flutterPhase) * .011 * animatedOpen;
      const desiredTilt = petal.userData.closedTilt + (petal.userData.openTilt - petal.userData.closedTilt) * animatedOpen + flutter;
      petal.rotation.x += (desiredTilt - petal.rotation.x) * .13;
      const scatter = explosion * explosion;
      if (releaseAge >= 255) {
        const flightTime = Math.min(2.6, (releaseAge - 255) / 1000);
        const dragTravel = (1 - Math.exp(-petal.userData.releaseDrag * flightTime)) / petal.userData.releaseDrag;
        const radialLength = Math.hypot(petal.userData.baseX, petal.userData.baseZ) || 1;
        const directionX = petal.userData.baseX / radialLength;
        const directionZ = petal.userData.baseZ / radialLength;
        const tangentX = -directionZ;
        const tangentZ = directionX;
        const swirl = petal.userData.releaseSwirl * (1 - Math.exp(-flightTime * 2.2));
        petal.position.x = petal.userData.baseX
          + (directionX * petal.userData.releaseSpeed + tangentX * swirl) * dragTravel;
        petal.position.z = petal.userData.baseZ
          + (directionZ * petal.userData.releaseSpeed + tangentZ * swirl) * dragTravel;
        petal.position.y = petal.userData.baseY
          + petal.userData.releaseLift * dragTravel
          - .72 * flightTime * flightTime;
        petal.rotation.x = desiredTilt + petal.userData.tumbleX * flightTime;
        petal.rotation.y = petal.userData.baseRotationY + flightTime * (.7 + petal.userData.releaseSpeed * .35);
        petal.rotation.z = petal.userData.tumbleZ * flightTime;
      } else {
        petal.position.x = petal.userData.baseX * (1 + scatter * 1.65);
        petal.position.z = petal.userData.baseZ * (1 + scatter * 1.65);
        petal.position.y = petal.userData.baseY
          + Math.sin(age * .0011 + petal.userData.flutterPhase) * .008 * animatedOpen
          + scatter * (.18 + Math.sin(petal.userData.flutterPhase) * .22);
        petal.rotation.y = petal.userData.baseRotationY;
        petal.rotation.z = 0;
      }
      const breathe = Math.sin(age * .00155 + petal.userData.flutterPhase) * .012 * animatedOpen;
      petal.scale.x = petal.userData.baseScaleX * (.9 + animatedOpen * .1 + breathe);
      petal.scale.y = petal.userData.baseScaleY * (.72 + animatedOpen * .28 + breathe * .7);
      petal.scale.z = petal.userData.baseScaleZ * (1 + breathe * .35);
    }
    this.materials.forEach((material, index) => {
        const targetHue = [.56, .53, .61][index] ?? .57;
        const hue = .59 + (targetHue - .59) * heat;
        material.color.setHSL(hue, .5 + heat * .08, .48 + energy * .02 - heat * .09);
        material.emissive.setHSL(hue, .7, .12 + heat * .04);
        material.emissiveIntensity = .34 + energy * .15 + heat * .28 + Math.sin(explosion * Math.PI) * 1.8;
        material.opacity = .98 * (1 - fade);
        const shader = material.userData.deformShader;
        if (shader) {
          shader.uniforms.uPetalTime.value = age / 1000;
          shader.uniforms.uPetalEnergy.value = bloom * (.48 + heat * .22) + Math.sin(explosion * Math.PI) * .5;
          shader.uniforms.uPetalHeat.value = heat;
          shader.uniforms.uPetalFlow.value = (age * .00011 + index * .09) % 1;
        }
    });
    this.lotusKey.color.setHSL(.55 + heat * .38, .5, .72);
    this.lotusFill.color.setHSL(.55 + heat * .25, .42, .68);
    const lightBreath = age < 3000 ? bloom : .72 + breathing * .28;
    this.lotusKey.intensity = .88 + energy * .5 + heat * .62 + lightBreath * .32 + Math.sin(explosion * Math.PI) * 5;
    this.lotusFill.intensity = 1.24 + energy * .34 + heat * .42 + lightBreath * .2;
    const pulse = 1 + Math.sin(age / 170) * (.035 + energy * .04);
    this.core.scale.set(.28 * pulse, .48 * pulse, .28 * pulse);
    this.core.material.opacity = .24 * energy * (1 - fade);
    this.core.material.emissiveIntensity = .28 + energy * .32 + heat * .16 + Math.sin(explosion * Math.PI) * 1.2;
    this.receptacle.material.emissiveIntensity = .2 + energy * .2 + heat * .16;
    this.receptacleCenter.material.emissiveIntensity = .42 + energy * .34 + heat * .22;
    const auraPulse = .5 - .5 * Math.cos(age * .0028);
    this.lotusAura.material.opacity = bloom * (1 - fade) * (.13 + auraPulse * .075);
    this.lotusAura.scale.setScalar(4.5 + auraPulse * .5);
    this.lotusMist.material.opacity = bloom * (1 - fade) * (.27 + auraPulse * .12);
    this.lotusMist.material.rotation = age * .00008;
    this.lotusOrbits.forEach((orbit, index) => {
      orbit.rotation.z = age * (index ? -.00028 : .00036);
      orbit.rotation.y = Math.sin(age * .0005 + index) * .22;
      orbit.material.opacity = energy * (1 - fade) * (.12 - index * .025 + auraPulse * .035);
    });
    for (let index = 0; index < this.lotusParticleCount; index += 1) {
      const data = this.lotusParticleData[index];
      const cycle = (data.lift + age * .00012 * data.speed) % 1;
      const radius = data.radius * (.72 + cycle * .28);
      const angle = data.phase + age * .00042 * data.speed + Math.sin(cycle * Math.PI * 2 + data.wobble) * .18;
      this.lotusParticlePositions[index * 3] = Math.cos(angle) * radius;
      this.lotusParticlePositions[index * 3 + 1] = -.5 + cycle * 2.45;
      this.lotusParticlePositions[index * 3 + 2] = Math.sin(angle) * radius * .62;
    }
    this.lotusParticles.geometry.attributes.position.needsUpdate = true;
    this.lotusParticles.material.opacity = bloom * (1 - fade) * (.68 + auraPulse * .22);
    this.lotusParticles.material.size = .095 + energy * .055;
    this.lotusLight.intensity = bloom * (1 - fade) * (7 + energy * 14 + auraPulse * 7);
  }

  updateSwords(age) {
    const now = this.startedAt + age;
    const anchor = this.screenToWorld(this.anchor, -.15);
    const target = this.screenToWorld(this.target, -.2);
    const volleyAge = Number.isFinite(this.swordVolleyAt) ? Math.max(0, now - this.swordVolleyAt) : 0;
    const release = smooth(volleyAge / 420);
    const charged = smooth((age - 1350) / 2600);
    const fingerDirection = target.clone().sub(anchor).normalize();
    const tangent = new THREE.Vector3(-fingerDirection.y, fingerDirection.x, 0).normalize();
    const direction = fingerDirection.clone();
    const overshoot = target.clone().add(direction.multiplyScalar(5.5));
    for (const sword of this.swords) {
      const data = sword.userData;
      const rise = smooth((age - data.riseDelay) / 1150);
      const launch = smooth((volleyAge - data.launchDelay * .16) / 480);
      const orbit = charged * Math.max(0, age - 700) * (.00034 + (data.index % 3) * .000025);
      const orbitCos = Math.cos(orbit);
      const orbitSin = Math.sin(orbit);
      const centeredY = data.formation.y;
      const orbitX = data.formation.x * orbitCos - centeredY * orbitSin;
      const orbitY = data.formation.x * orbitSin + centeredY * orbitCos;
      const orbitDx = -data.formation.x * orbitSin - centeredY * orbitCos;
      const orbitDy = data.formation.x * orbitCos - centeredY * orbitSin;
      const orbitTangent = tangent.clone().multiplyScalar(orbitDx)
        .addScaledVector(fingerDirection, orbitDy)
        .normalize();
      const fingerAnchor = this.swordFingerSpan
        ? this.screenToWorld(this.swordFingerSpan[data.fingerSlot], -.15)
        : anchor;
      const start = fingerAnchor.clone()
        .addScaledVector(tangent, orbitX)
        .addScaledVector(fingerDirection, orbitY)
        .add(new THREE.Vector3(0, 0, data.formation.z + Math.sin(orbit * 1.7 + data.index) * charged * .09));
      start.y -= 2.4 * (1 - rise);
      const laneTarget = target.clone().add(new THREE.Vector3(
        Math.cos(data.laneAngle) * data.laneRadius,
        Math.sin(data.laneAngle) * data.laneRadius * .64,
        data.crossDepth,
      ));
      if (launch < .72) {
        const travel = launch / .72;
        const inverse = 1 - travel;
        const crossControl = new THREE.Vector3(
          start.x + tangent.x * (.35 + (data.index % 5) * .08),
          start.y + tangent.y * (.35 + (data.index % 5) * .08),
          data.formation.z * .2 + data.crossDepth * 1.4,
        );
        sword.position.copy(start).multiplyScalar(inverse * inverse)
          .addScaledVector(crossControl, 2 * inverse * travel)
          .addScaledVector(laneTarget, travel * travel);
      }
      else if (launch < .84) {
        const converge = smooth((launch - .72) / .12);
        sword.position.copy(laneTarget).lerp(target, converge);
      }
      else sword.position.copy(target).lerp(overshoot, (launch - .84) / .16);
      const aimPoint = launch < .68 ? laneTarget : target;
      const aimDirection = aimPoint.clone().sub(sword.position).normalize();
      const desired = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), aimDirection);
      if (release > .02) sword.quaternion.slerp(desired, .18 + launch * .42);
      else {
        const tremor = .035 + charged * .02;
        const flowDirection = orbitTangent.add(new THREE.Vector3(
          Math.sin(age * .0007 + data.index * 1.73) * tremor,
          Math.sin(age * .0005 + data.index * .91) * tremor,
          Math.sin(age * .00032 * data.spin + data.index * .71) * .12,
        )).normalize();
        const flowQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), flowDirection);
        sword.quaternion.slerp(flowQuaternion, .09 + charged * .07);
        sword.position.x += Math.sin(age * .017 + data.index * 2.4) * charged * .008;
        sword.position.y += Math.sin(age * .0014 + data.index * 1.17) * (.035 + charged * .018);
      }
      const colorStep = Math.round(charged * 30);
      if (colorStep !== data.colorStep) {
        data.colorStep = colorStep;
        const steppedCharge = colorStep / 30;
        const steelLight = .81 + steppedCharge * .055 + (data.index % 5) * .004;
        data.bladeMaterial.color.setHSL(.56, .035 + steppedCharge * .025, steelLight);
        data.bladeMaterial.emissive.setHSL(.54, .2, .075 + steppedCharge * .025);
        data.bladeMaterial.emissiveIntensity = .16 + steppedCharge * .16;
        data.bronze.emissiveIntensity = .04 + steppedCharge * .08;
      }
      sword.visible = rise > .01 && launch < .995;
      for (const trail of data.trails) {
        trail.material.opacity = trail.userData.maxOpacity * smooth((launch - .08) / .28) * (1 - smooth((launch - .9) / .1));
        trail.scale.y = .45 + launch * 1.45;
      }
    }
    this.swordLight.position.copy(target);
    this.swordLight.intensity = Math.sin(release * Math.PI) * 75;
    const impactIn = smooth((volleyAge - 1780) / 220);
    const impactOut = smooth((volleyAge - 2980) / 650);
    const impact = impactIn * (1 - impactOut);
    this.swordImpact.visible = impact > .01;
    this.swordImpact.position.copy(target);
    for (let index = 0; index < this.impactDirections.length; index += 1) {
      const direction = this.impactDirections[index];
      const travel = impactIn * (.9 + (index % 7) * .11);
      this.impactPositions[index * 3] = direction.x * travel;
      this.impactPositions[index * 3 + 1] = direction.y * travel - impactIn * impactIn * .22;
      this.impactPositions[index * 3 + 2] = direction.z * travel;
    }
    this.swordImpact.geometry.attributes.position.needsUpdate = true;
    this.swordImpact.material.opacity = impact * .9;
    this.swordImpact.material.size = .08 + impact * .11;
  }

  refreshBolts(age) {
    const target = this.screenToWorld(this.aim, 0);
    const sources = [
      this.screenToWorld({ x: .5 + (this.aim.x - .5) * .16, y: -.05 }, .18),
      this.screenToWorld({ x: .24 + this.aim.x * .08, y: -.06 }, -.55),
      this.screenToWorld({ x: .76 + this.aim.x * .08, y: -.045 }, -.72),
    ];
    this.bolts.forEach((line, lineIndex) => {
      const sourceIndex = lineIndex % 3;
      const source = sources[sourceIndex];
      const channelTarget = target.clone();
      if (sourceIndex === 1) channelTarget.add(new THREE.Vector3(-1.42, .16, -.08));
      if (sourceIndex === 2) channelTarget.add(new THREE.Vector3(1.48, .08, -.12));
      const branch = lineIndex >= 3;
      const branchLayer = Math.max(0, Math.floor(lineIndex / 3) - 1);
      line.visible = true;
      const branchT = .28 + sourceIndex * .17 + branchLayer * .19;
      const branchStart = source.clone().lerp(channelTarget, branchT);
      const baseSide = sourceIndex === 1 ? -1 : sourceIndex === 0 ? 1 : -1;
      const side = branchLayer % 2 ? -baseSide : baseSide;
      const branchEnd = branchStart.clone().add(new THREE.Vector3(side * (1.05 + sourceIndex * .28), -.52 - sourceIndex * .16, .18));
      const pathStart = branch ? branchStart : source;
      const end = branch ? branchEnd : channelTarget;
      const count = branch ? 10 : 29;
      const points = [];
      for (let index = 0; index < count; index += 1) {
        const t = index / (count - 1);
        const point = pathStart.clone().lerp(end, t);
        const envelope = Math.sin(Math.PI * t);
        const coarse = Math.sin(index * 2.17 + age * .006 + lineIndex * 1.37);
        const fine = Math.sin(index * 7.13 + age * .019 + lineIndex * 2.1);
        const jitter = seeded(index + lineIndex * 41, Math.floor(age / 37)) - .5;
        point.x += (coarse * (branch ? .055 : .11) + fine * (branch ? .035 : .065) + jitter * (branch ? .045 : .07)) * envelope;
        point.y += (Math.sin(index * 3.71 + age * .011 + lineIndex) * (branch ? .035 : .07) + jitter * .025) * envelope;
        point.z += Math.cos(index * 3.3 + lineIndex) * (branch ? .055 : .11) * envelope;
        points.push(point);
      }
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(points);
      line.material.opacity = (branch ? .28 : .68) + Math.random() * (branch ? .35 : .32);
      const curve = new PolylineCurve(points);
      const glow = this.boltGlows[lineIndex];
      glow.geometry.dispose();
      glow.geometry = new THREE.TubeGeometry(curve, branch ? 16 : 36, branch ? .026 : .065, branch ? 4 : 5, false);
      glow.material.opacity = (branch ? .1 : .08) + Math.random() * .1;
      const core = this.boltCores[lineIndex];
      core.geometry.dispose();
      core.geometry = new THREE.TubeGeometry(
        curve,
        branch ? 18 : 40,
        branch ? .006 : lineIndex === 0 ? .025 : lineIndex === 1 ? .009 : .007,
        4,
        false,
      );
      core.material.opacity = (branch ? .5 : .62) + Math.random() * .34;
    });
    for (let index = 0; index < 150; index += 1) {
      const radius = Math.pow(Math.random(), 1.8) * 1.7;
      const angle = Math.random() * Math.PI * 2;
      this.sparkPositions[index * 3] = target.x + Math.cos(angle) * radius;
      this.sparkPositions[index * 3 + 1] = target.y + Math.sin(angle) * radius;
      this.sparkPositions[index * 3 + 2] = (Math.random() - .5) * 1.3;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.lightningLight.position.copy(target);
  }

  updateLightning(age, now) {
    const cycleDuration = 2400;
    const cycleIndex = Math.floor(age / cycleDuration);
    const cycleAge = age - cycleIndex * cycleDuration;
    if (cycleIndex !== this.lastLightningCycle) {
      this.refreshBolts(age);
      this.lastBoltRefresh = now;
      this.lastLightningCycle = cycleIndex;
    }
    const charge = smooth(cycleAge / 520);
    const leader = smooth((cycleAge - 340) / 180) * (1 - smooth((cycleAge - 620) / 180));
    const returnStroke = smooth((cycleAge - 560) / 35) * (1 - smooth((cycleAge - 1050) / 450));
    const reStrike = smooth((cycleAge - 1500) / 30) * (1 - smooth((cycleAge - 1610) / 230));
    const strike = Math.max(returnStroke, reStrike * .74);
    const afterglow = smooth((cycleAge - 920) / 100) * (1 - smooth((cycleAge - 1900) / 420));
    const decay = 1 - phase(age, 6900, 7600);
    this.lightningRoot.visible = decay > .01 && (charge > .02 || leader > .01 || strike > .01 || afterglow > .01);
    this.bolts.forEach(bolt => {
      bolt.material.opacity = 0;
    });
    this.boltCores.forEach((core, index) => {
      const main = index < 3;
      if (!main) {
        core.material.opacity = 0;
        return;
      }
      const hierarchy = main ? [.06, .54, .38][index] : .17 + (index % 3) * .045;
      core.material.opacity = decay * (leader * hierarchy * .22 + strike * hierarchy * (main ? .96 : .56) + afterglow * hierarchy * .16);
    });
    this.boltGlows.forEach((glow, index) => {
      const main = index < 3;
      if (!main) {
        glow.material.opacity = 0;
        return;
      }
      const hierarchy = main ? [.1, .62, .45][index] : .2;
      glow.material.opacity = decay * (leader * hierarchy * .045 + strike * hierarchy * (main ? .18 : .07) + afterglow * hierarchy * .055);
    });
    this.lightningLight.intensity = decay * (charge * 7 + leader * 18 + returnStroke * 156 + reStrike * 98 + afterglow * 24);
    this.sparks.material.opacity = decay * (charge * .12 + leader * .16 + strike * .46 + afterglow * .08);
    this.sparks.material.size = .08 + charge * .04 + strike * .07;
    this.sparks.rotation.z += .012;
  }

  updateOrb(age) {
    const gather = smooth(age / 1350);
    const fade = 1 - phase(age, 7000, 8200);
    const pulse = .5 - .5 * Math.cos(age * .0046);
    const destination = this.screenToWorld(this.anchor, .05);
    destination.y += .14;
    this.orbRoot.position.lerp(destination, .18);
    const scale = (.42 + gather * .5 + pulse * .045) * this.grip;
    this.orbRoot.scale.lerp(new THREE.Vector3(scale, scale, scale), .16);
    this.orbRoot.rotation.y = age * .00031;
    this.orbRoot.rotation.x = Math.sin(age * .00053) * .16;
    this.orbRoot.rotation.z = Math.sin(age * .00037) * .08;

    this.orbShellMaterial.uniforms.uTime.value = age * .001;
    this.orbShellMaterial.uniforms.uPulse.value = pulse;
    this.orbShellMaterial.uniforms.uOpacity.value = gather * fade * (.035 + pulse * .018);
    this.orbCore.material.opacity = gather * fade * (.8 + pulse * .18);
    this.orbCore.scale.set(.64 + pulse * .16, .64 + pulse * .16, 1);
    this.orbHalos.forEach((sprite, index) => {
      const breathing = 1 + Math.sin(age * (.0014 + index * .00019) + index * 1.8) * .09;
      const size = sprite.userData.baseScale * breathing;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = gather * fade * (.12 - index * .018 + pulse * .025);
      sprite.material.rotation = age * .00014 * (index % 2 ? -1 : 1);
    });
    this.orbFilaments.forEach((filament, index) => {
      filament.rotation.y = age * filament.userData.spin;
      filament.rotation.x = Math.sin(age * .00031 + filament.userData.phase) * .34;
      filament.rotation.z = Math.cos(age * .00027 + filament.userData.phase) * .16;
      filament.scale.setScalar(.88 + pulse * .13 + Math.sin(age * .0011 + index) * .025);
      filament.material.opacity = gather * fade * (.2 + pulse * .08);
    });

    const inward = 1 - gather;
    for (let index = 0; index < this.orbParticleCount; index += 1) {
      const item = this.orbParticleData[index];
      const direction = item.stream % 2 ? -1 : 1;
      const angle = item.phase + age * .001 * item.speed * direction;
      const secondary = angle * (1.45 + item.stream * .13) + item.phase;
      const radius = item.radius * (1 + inward * 3.6);
      const wobble = Math.sin(secondary) * (.08 + item.stream * .018);
      this.orbParticlePositions[index * 3] = Math.cos(angle) * radius;
      this.orbParticlePositions[index * 3 + 1] = item.lift * (.14 + radius * .18 + inward * .42) + Math.sin(angle * 1.7) * radius * .25;
      this.orbParticlePositions[index * 3 + 2] = Math.sin(angle) * radius * .72 + wobble;
    }
    this.orbParticles.geometry.attributes.position.needsUpdate = true;
    this.orbParticleMaterial.uniforms.uOpacity.value = gather * fade * (.28 + pulse * .1);
    this.orbParticleMaterial.uniforms.uSize.value = 9 + gather * 4 + pulse * 2;
    this.orbLight.position.copy(destination);
    this.orbLight.intensity = gather * fade * (38 + pulse * 28);
  }

  resize() {
    const width = Math.max(1, this.stage.clientWidth);
    const height = Math.max(1, this.stage.clientHeight);
    if (width === this.lastWidth && height === this.lastHeight && this.pixelRatio === this.lastPixelRatio) return;
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastPixelRatio = this.pixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  loop(now) {
    const frameMs = Math.min(80, Math.max(1, now - this.lastFrameAt));
    this.lastFrameAt = now;
    if (this.visible && !this.performanceSampled) {
      this.frameTimes.push(frameMs);
      if (this.frameTimes.length >= 120) {
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const p90 = sorted[Math.floor(sorted.length * .9)];
        const targetRatio = Math.min(p90 > 24 ? .8 : 1, devicePixelRatio || 1);
        this.pixelRatio = Math.min(this.pixelRatio, targetRatio);
        this.performanceSampled = true;
      }
    }
    this.resize();
    if (this.visible) {
      const age = now - this.startedAt;
      if (this.mode === "lotus") this.updateLotus(age, now);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
    }
    requestAnimationFrame(this.loop);
  }
}

export const Lotus3DEngine = Magic3DEngine;
