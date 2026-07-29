import { CameraEngine, handAngleDegrees, pickClosestHand, thumbMetrics } from "../engine/camera-engine.js";
import { CinematicVfxEngine, CINEMATIC_SCENES } from "./cinematic-vfx.js";
import { EnvironmentVfxEngine } from "./environment-vfx.js";
import { Magic3DEngine } from "./lotus-3d.js";
import { WebglParticleVfx } from "./webgl-particle-vfx.js";

export const DEFAULT_MATRIX = [
  [[24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58]],
  [[24, 34, 58], [255, 116, 72], [255, 116, 72], [255, 116, 72], [255, 116, 72], [255, 116, 72], [255, 116, 72], [24, 34, 58]],
  [[24, 34, 58], [255, 116, 72], [255, 205, 92], [255, 205, 92], [255, 205, 92], [255, 205, 92], [255, 116, 72], [24, 34, 58]],
  [[24, 34, 58], [255, 116, 72], [255, 205, 92], [255, 205, 92], [255, 205, 92], [255, 205, 92], [255, 116, 72], [24, 34, 58]],
  [[24, 34, 58], [255, 116, 72], [255, 116, 72], [255, 116, 72], [255, 116, 72], [255, 116, 72], [255, 116, 72], [24, 34, 58]],
  [[24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58], [24, 34, 58]],
];

export function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

export function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  return ids.reduce((p, id) => ({ x: p.x + lm[id].x / ids.length, y: p.y + lm[id].y / ids.length }), { x: 0, y: 0 });
}

export function raisedFingerPattern(lm) {
  return [
    thumbMetrics(lm).thumbUp,
    lm[8].y < lm[6].y,
    lm[12].y < lm[10].y,
    lm[16].y < lm[14].y,
    lm[20].y < lm[18].y,
  ];
}

export function hasFingerPattern(lm, expected) {
  const actual = raisedFingerPattern(lm);
  return [0, 1, 2, 3, 4].every(index => actual[index] === expected[index]);
}

export function isSwordSeal(lm) {
  return hasFingerPattern(lm, [false, true, true, false, false]);
}

export function isMistSeal(lm) {
  return hasFingerPattern(lm, [true, false, false, false, true]);
}

export function mistFingerSpan(lm) {
  return [lm[4], lm[20]];
}

export function isLightningSeal(lm) {
  return hasFingerPattern(lm, [true, true, false, false, false]);
}

export function isOpenPalm(lm) {
  const pattern = raisedFingerPattern(lm);
  return pattern.slice(1).filter(Boolean).length >= 3;
}

export function lotusPairMetrics(hands) {
  if (hands.length < 2) return { active: false, anchor: null, grip: 1, separation: 0 };
  const pair = [...hands].sort((a, b) => palmCenter(a).x - palmCenter(b).x).slice(0, 2);
  const centers = pair.map(palmCenter);
  const separation = Math.hypot(centers[1].x - centers[0].x, centers[1].y - centers[0].y);
  const palmSize = pair.reduce(
    (sum, lm) => sum + Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) / 2,
    0,
  ) || .001;
  const normalizedSeparation = separation / palmSize;
  const active = pair.every(isOpenPalm) && normalizedSeparation > .72 && normalizedSeparation < 5.2;
  return {
    active,
    anchor: {
      x: (centers[0].x + centers[1].x) / 2,
      y: (centers[0].y + centers[1].y) / 2,
    },
    grip: Math.max(.78, Math.min(1.34, .68 + normalizedSeparation * .16)),
    separation: normalizedSeparation,
  };
}

export function heartGestureMetrics(hands) {
  if (hands.length < 2) return { active: false, center: null };
  const pair = [...hands].sort((a, b) => palmCenter(a).x - palmCenter(b).x).slice(0, 2);
  const centers = pair.map(palmCenter);
  const palmSize = pair.reduce(
    (sum, hand) => sum + Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y) / 2,
    0,
  ) || .001;
  const indexDistance = Math.hypot(pair[0][8].x - pair[1][8].x, pair[0][8].y - pair[1][8].y) / palmSize;
  const thumbDistance = Math.hypot(pair[0][4].x - pair[1][4].x, pair[0][4].y - pair[1][4].y) / palmSize;
  const fingersAboveThumbs = (pair[0][8].y + pair[1][8].y) / 2 < (pair[0][4].y + pair[1][4].y) / 2;
  const separation = Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y) / palmSize;
  return {
    active: indexDistance < .9 && thumbDistance < .9 && fingersAboveThumbs && separation > .65 && separation < 4.6,
    center: {
      x: (pair[0][8].x + pair[1][8].x + pair[0][4].x + pair[1][4].x) / 4,
      y: (pair[0][8].y + pair[1][8].y + pair[0][4].y + pair[1][4].y) / 4,
    },
  };
}

export function lightningMidpoint(lm) {
  return { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
}

export function swordMidpoint(lm) {
  return { x: (lm[8].x + lm[12].x) / 2, y: (lm[8].y + lm[12].y) / 2 };
}

export function swordDirectionTarget(lm) {
  const tip = swordMidpoint(lm);
  const base = { x: (lm[5].x + lm[9].x) / 2, y: (lm[5].y + lm[9].y) / 2 };
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const length = Math.max(.001, Math.hypot(dx, dy));
  return {
    x: Math.max(.08, Math.min(.92, tip.x + dx / length * .48)),
    y: Math.max(.08, Math.min(.86, tip.y + dy / length * .48)),
  };
}

export function swordDirectionVector(lm) {
  const tip = swordMidpoint(lm);
  const base = { x: (lm[5].x + lm[9].x) / 2, y: (lm[5].y + lm[9].y) / 2 };
  const length = Math.max(.001, Math.hypot(tip.x - base.x, tip.y - base.y));
  return { x: (tip.x - base.x) / length, y: (tip.y - base.y) / length };
}

export class SwordVolleyRecognizer {
  constructor({ minAngle = 34, maxWindowMs = 260, armMs = 720, cooldownMs = 1800 } = {}) {
    this.minAngle = minAngle * Math.PI / 180;
    this.maxWindowMs = maxWindowMs;
    this.armMs = armMs;
    this.cooldownMs = cooldownMs;
    this.reset();
  }

  reset() {
    this.samples = [];
    this.sealStartedAt = 0;
    this.lastVolleyAt = -Infinity;
    this.phase = "waiting";
  }

  sample(lm, now) {
    if (!lm || !isSwordSeal(lm)) {
      this.samples.length = 0;
      this.sealStartedAt = 0;
      this.phase = "waiting";
      return null;
    }
    if (!this.sealStartedAt) this.sealStartedAt = now || .001;
    const direction = swordDirectionVector(lm);
    this.samples.push({ ...direction, at: now });
    while (this.samples.length > 2 && now - this.samples[0].at > this.maxWindowMs) this.samples.shift();
    this.phase = now - this.sealStartedAt >= this.armMs ? "armed" : "forming";
    if (this.phase !== "armed" || now - this.lastVolleyAt < this.cooldownMs || this.samples.length < 2) return null;
    const oldest = this.samples[0];
    const dot = Math.max(-1, Math.min(1, oldest.x * direction.x + oldest.y * direction.y));
    const angle = Math.acos(dot);
    if (angle < this.minAngle) return null;
    this.lastVolleyAt = now;
    this.phase = "volley";
    this.samples = [{ ...direction, at: now }];
    return { kind: "volley", angle, target: swordDirectionTarget(lm) };
  }
}

export function magicCircleMetrics(hands) {
  const seals = hands.filter(isLightningSeal);
  if (seals.length < 2) return { active: false };
  const points = seals.slice(0, 2).map(lightningMidpoint).sort((a, b) => a.x - b.x);
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const separation = Math.hypot(dx, dy);
  return {
    active: separation > .1,
    center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
    radius: separation * .62,
    angle: Math.atan2(dy, dx),
  };
}

export class WeatherGestureRecognizer {
  constructor() {
    this.lastActionAt = -Infinity;
    this.reset();
  }

  reset() {
    this.mode = null;
    this.startedAt = 0;
    this.startCenter = null;
    this.startSeparation = 0;
    this.engaged = false;
    this.progressValue = 0;
  }

  progress() {
    return { mode: this.mode, value: this.progressValue, engaged: this.engaged };
  }

  sample(hands, now = performance.now(), { cloudLevel = 0 } = {}) {
    const openHands = hands.filter(isOpenPalm).sort((a, b) => palmCenter(a).x - palmCenter(b).x);
    const cooldown = now - this.lastActionAt < 1350;
    this.engaged = false;

    if (openHands.length >= 2) {
      const pair = openHands.slice(0, 2);
      const centers = pair.map(palmCenter);
      const center = {
        x: (centers[0].x + centers[1].x) / 2,
        y: (centers[0].y + centers[1].y) / 2,
      };
      const separation = Math.hypot(centers[1].x - centers[0].x, centers[1].y - centers[0].y);
      const skyPose = center.y < .46 || this.mode === "sky";
      if (!skyPose) {
        this.reset();
        return null;
      }
      this.engaged = true;
      if (this.mode !== "sky") {
        this.mode = "sky";
        this.startedAt = now;
        this.startCenter = center;
        this.startSeparation = separation;
        return null;
      }
      const elapsed = now - this.startedAt;
      const gather = this.startSeparation - separation;
      const downward = center.y - this.startCenter.y;
      this.progressValue = Math.min(1, Math.max(Math.max(0, gather * 8.5), Math.max(0, downward * 7)));
      if (cooldown || elapsed < 220) return null;
      if (cloudLevel > .15 && downward > .14) {
        const action = {
          kind: "rain",
          intensity: Math.min(1, .55 + downward * 2.2),
          wind: Math.max(-.24, Math.min(.24, (center.x - this.startCenter.x) * 1.4)),
        };
        this.lastActionAt = now;
        this.reset();
        return action;
      }
      if (gather > .105) {
        const action = {
          kind: "cloud",
          intensity: Math.min(1, .58 + gather * 2.5),
          wind: Math.max(-.16, Math.min(.16, (center.x - .5) * .24)),
        };
        this.lastActionAt = now;
        this.reset();
        return action;
      }
      if (elapsed > 1500) {
        this.startedAt = now;
        this.startCenter = center;
        this.startSeparation = separation;
      }
      return null;
    }

    if (openHands.length === 1) {
      const center = palmCenter(openHands[0]);
      const lowPose = center.y > .62 || this.mode === "fog";
      if (!lowPose) {
        this.reset();
        return null;
      }
      this.engaged = true;
      if (this.mode !== "fog") {
        this.mode = "fog";
        this.startedAt = now;
        this.startCenter = center;
        return null;
      }
      const elapsed = now - this.startedAt;
      const dx = center.x - this.startCenter.x;
      const dy = center.y - this.startCenter.y;
      this.progressValue = Math.min(1, Math.abs(dx) / .2);
      if (!cooldown && elapsed > 180 && elapsed < 1500 && Math.abs(dx) > .19 && Math.abs(dy) < .14) {
        const action = {
          kind: "fog",
          intensity: Math.min(1, .56 + Math.abs(dx) * 1.7),
          wind: Math.max(-.26, Math.min(.26, dx * 1.2)),
        };
        this.lastActionAt = now;
        this.reset();
        return action;
      }
      if (elapsed >= 1500) {
        this.startedAt = now;
        this.startCenter = center;
      }
      return null;
    }

    this.reset();
    return null;
  }
}

export class FingerTrailRecognizer {
  constructor({ threshold = .2, zone = { x: .38, y: .38, width: .24, height: .28 } } = {}) {
    this.threshold = threshold;
    this.zone = zone;
    this.reset();
  }

  reset() {
    this.points = [];
    this.length = 0;
    this.active = false;
    this.completed = false;
    this.awaitingConfirm = false;
    this.lastPointAt = 0;
  }

  progress() {
    const matches = this.rank(this.points);
    return {
      active: this.active,
      awaitingConfirm: this.awaitingConfirm,
      completed: this.completed,
      length: this.length,
      value: Math.min(1, this.length / .56),
      points: this.points,
      matches,
      best: matches[0] || null,
    };
  }

  rank(points = this.points) {
    if (points.length < 2) return [];
    const screen = points.map(point => ({ x: 1 - point.x, y: point.y }));
    const xs = screen.map(point => point.x);
    const ys = screen.map(point => point.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const diagonal = Math.max(.001, Math.hypot(width, height));
    const pathLength = screen.slice(1).reduce((total, point, index) => (
      total + Math.hypot(point.x - screen[index].x, point.y - screen[index].y)
    ), 0);
    const endDistance = Math.hypot(screen.at(-1).x - screen[0].x, screen.at(-1).y - screen[0].y);
    const straightness = Math.min(1, endDistance / Math.max(.001, pathLength));
    const horizontal = width / Math.max(.001, width + height);
    const vertical = height / Math.max(.001, width + height);
    const closure = Math.max(0, 1 - endDistance / Math.max(.001, diagonal * .72));
    const lengthReady = Math.min(1, pathLength / .46);
    const valleyIndex = ys.indexOf(Math.max(...ys));
    const valley = screen[valleyIndex];
    const vShape = valleyIndex > screen.length * .2 && valleyIndex < screen.length * .8
      ? Math.min(1, Math.max(0,
          Math.min(valley.y - screen[0].y, valley.y - screen.at(-1).y)
          / Math.max(.001, height * .55)))
      : 0;
    let turns = 0;
    let lastDirection = 0;
    for (let index = 1; index < screen.length; index += 1) {
      const dx = screen[index].x - screen[index - 1].x;
      const direction = Math.abs(dx) < .012 ? lastDirection : Math.sign(dx);
      if (lastDirection && direction && direction !== lastDirection) turns += 1;
      lastDirection = direction;
    }
    const candidates = [
      { kind: "mist", score: closure * .72 + lengthReady * .28 },
      { kind: "filter_blur", score: horizontal * .72 + straightness * .28 },
      { kind: "filter_sharpen", score: vShape * .78 + Math.min(1, height / .22) * .22 },
      { kind: "filter_pixel", score: vertical * .72 + straightness * .28 },
      { kind: "filter_cartoon", score: Math.min(1, turns / 4) * .82 + Math.min(1, width / .22) * .18 },
    ];
    return candidates
      .map(candidate => ({ ...candidate, score: Math.max(0, Math.min(1, candidate.score)) }))
      .sort((a, b) => b.score - a.score);
  }

  classify(points) {
    const screen = points.map(point => ({ x: 1 - point.x, y: point.y }));
    const xs = screen.map(point => point.x);
    const ys = screen.map(point => point.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const diagonal = Math.max(.001, Math.hypot(width, height));
    const endDistance = Math.hypot(screen.at(-1).x - screen[0].x, screen.at(-1).y - screen[0].y);
    const pathLength = screen.slice(1).reduce((total, point, index) => (
      total + Math.hypot(point.x - screen[index].x, point.y - screen[index].y)
    ), 0);
    if (pathLength > .42 && endDistance < diagonal * .32) return "mist";

    const valleyIndex = ys.indexOf(Math.max(...ys));
    const valley = screen[valleyIndex];
    const vShape = valleyIndex > screen.length * .25
      && valleyIndex < screen.length * .75
      && valley.y - screen[0].y > height * .35
      && valley.y - screen.at(-1).y > height * .35;
    if (vShape && height > .12) return "filter_sharpen";

    let turns = 0;
    let lastDirection = 0;
    for (let index = 1; index < screen.length; index += 1) {
      const dx = screen[index].x - screen[index - 1].x;
      const direction = Math.abs(dx) < .012 ? lastDirection : Math.sign(dx);
      if (lastDirection && direction && direction !== lastDirection) turns += 1;
      lastDirection = direction;
    }
    if (turns >= 3 && width > .16) return "filter_cartoon";
    if (width > height * 2.1) return "filter_blur";
    if (height > width * 1.8) return "filter_pixel";
    return "mist";
  }

  finish(confirmHand = null) {
    if (!this.active) return null;
    if (this.length < this.threshold || this.points.length < 6) {
      this.reset();
      return null;
    }
    const points = [...this.points];
    const kind = this.classify(points);
    this.completed = true;
    this.active = false;
    this.awaitingConfirm = false;
    return {
      kind,
      points,
      length: this.length,
      confirmCenter: confirmHand ? palmCenter(confirmHand) : points.at(-1),
    };
  }

  sample(hands, now = performance.now()) {
    const openHand = hands.find(isOpenPalm);
    if (this.active && openHand) return this.finish(openHand);

    const hand = hands.find(points => hasFingerPattern(points, [false, true, false, false, false]));
    if (!hand) {
      if (this.active) this.awaitingConfirm = true;
      return null;
    }
    if (this.completed) this.reset();
    const point = { x: hand[8].x, y: hand[8].y };
    const screenPoint = { x: 1 - point.x, y: point.y };
    if (!this.active && !this.completed) {
      const inside = screenPoint.x >= this.zone.x
        && screenPoint.x <= this.zone.x + this.zone.width
        && screenPoint.y >= this.zone.y
        && screenPoint.y <= this.zone.y + this.zone.height;
      if (!inside) return null;
      this.active = true;
      this.points = [point];
      this.length = 0;
      this.lastPointAt = now;
      return null;
    }
    if (!this.active || this.completed) return null;
    const previous = this.points.at(-1);
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance >= .004 && distance <= .2) {
      const steps = Math.max(1, Math.ceil(distance / .018));
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        this.points.push({
          x: previous.x + (point.x - previous.x) * t,
          y: previous.y + (point.y - previous.y) * t,
        });
      }
      this.length += distance;
      this.lastPointAt = now;
      this.awaitingConfirm = false;
      if (this.points.length > 160) this.points.splice(0, this.points.length - 160);
    }
    return null;
  }
}

export const ATMOSPHERE_ZONES = Object.freeze([
  { kind: "snow", x: .8075, y: .27, width: .065, height: .068 },
  { kind: "rain", x: .885, y: .31, width: .065, height: .068 },
  { kind: "lightning", x: .92, y: .432, width: .065, height: .068 },
  { kind: "vortex_fire", x: .885, y: .555, width: .065, height: .068 },
  { kind: "filter_blur", x: .8075, y: .595, width: .065, height: .068 },
  { kind: "filter_cartoon", x: .73, y: .555, width: .065, height: .068 },
  { kind: "filter_flip", x: .695, y: .432, width: .065, height: .068 },
  { kind: "reset", x: .73, y: .31, width: .065, height: .068 },
]);

export class DwellZoneRecognizer {
  constructor({ dwellMs = 1100, cooldownMs = 1700, zones = ATMOSPHERE_ZONES } = {}) {
    this.dwellMs = dwellMs;
    this.cooldownMs = cooldownMs;
    this.zones = zones;
    this.reset();
  }

  reset() {
    this.kind = null;
    this.enteredAt = 0;
    this.lastActionAt = -Infinity;
    this.point = null;
  }

  progress(now = performance.now()) {
    const value = this.kind ? Math.min(1, (now - this.enteredAt) / this.dwellMs) : 0;
    return {
      active: Boolean(this.kind),
      kind: this.kind,
      value,
      best: this.kind ? { kind: this.kind, score: value } : null,
      point: this.point,
    };
  }

  sample(hands, now = performance.now()) {
    if (hands.length !== 1) {
      this.kind = null;
      this.enteredAt = 0;
      this.point = null;
      return null;
    }
    const hand = hands.find(points => raisedFingerPattern(points)[1]);
    if (!hand) {
      this.kind = null;
      this.enteredAt = 0;
      this.point = null;
      return null;
    }
    const rawPoint = { x: hand[8].x, y: hand[8].y };
    const point = { x: 1 - rawPoint.x, y: rawPoint.y };
    this.point = point;
    const zone = this.zones.find(item => (
      point.x >= item.x && point.x <= item.x + item.width
      && point.y >= item.y && point.y <= item.y + item.height
    ));
    if (!zone) {
      this.kind = null;
      this.enteredAt = 0;
      return null;
    }
    if (zone.kind !== this.kind) {
      this.kind = zone.kind;
      this.enteredAt = now;
      return null;
    }
    if (now - this.enteredAt < this.dwellMs || now - this.lastActionAt < this.cooldownMs) return null;
    this.lastActionAt = now;
    this.enteredAt = now;
    return { kind: zone.kind, point: rawPoint, confirmCenter: rawPoint };
  }
}

export const FINGER_COUNT_ACTIONS = Object.freeze({
  1: "vortex_fire",
  2: "lightning",
  3: "rain",
  4: "snow",
  5: "summon_dust",
  6: "filter_blur",
  7: "filter_cartoon",
  8: "filter_flip",
  9: "reset",
});

export function totalRaisedFingers(hands = []) {
  return hands.slice(0, 2).reduce(
    (total, hand) => total + raisedFingerPattern(hand).filter(Boolean).length,
    0,
  );
}

export class FingerCountRecognizer {
  constructor({
    holdMs = 850,
    cooldownMs = 1400,
    releaseMs = 220,
    actions = FINGER_COUNT_ACTIONS,
  } = {}) {
    this.holdMs = holdMs;
    this.cooldownMs = cooldownMs;
    this.releaseMs = releaseMs;
    this.actions = actions;
    this.lastActionAt = -Infinity;
    this.reset();
  }

  reset() {
    this.count = 0;
    this.kind = null;
    this.startedAt = 0;
    this.value = 0;
    this.latchedCount = 0;
    this.neutralAt = 0;
    this.armed = true;
  }

  progress() {
    return { active: Boolean(this.kind), count: this.count, kind: this.kind, value: this.value };
  }

  sample(hands, now = performance.now()) {
    const count = totalRaisedFingers(hands);
    const kind = this.actions[count] || null;
    if (!kind) {
      this.count = 0;
      this.kind = null;
      this.startedAt = 0;
      this.value = 0;
      if (!this.neutralAt) this.neutralAt = now;
      if (now - this.neutralAt >= this.releaseMs) {
        this.latchedCount = 0;
        this.armed = true;
      }
      return null;
    }
    this.neutralAt = 0;
    if (count === this.latchedCount) return null;
    // Một phép đã chốt phải đi qua trạng thái thả tay trước khi chọn phép khác.
    // Ngoại lệ duy nhất là nghi thức gốc: 5 ngón gieo bụi → 1 ngón hút bụi.
    const summonToVortex = this.latchedCount === 5 && count === 1;
    if (!this.armed && !summonToVortex) {
      this.count = 0;
      this.kind = null;
      this.startedAt = 0;
      this.value = 0;
      return null;
    }
    if (count !== this.count) {
      this.count = count;
      this.kind = kind;
      this.startedAt = now;
      this.value = 0;
      return null;
    }
    this.value = Math.min(1, (now - this.startedAt) / this.holdMs);
    if (this.value < 1 || now - this.lastActionAt < this.cooldownMs) return null;
    this.lastActionAt = now;
    this.latchedCount = count;
    this.armed = false;
    return { kind, count, point: hands[0]?.[8] || { x: .5, y: .5 } };
  }
}

export function fixedZoneAction(lm) {
  if (!hasFingerPattern(lm, [false, true, false, false, false])) return null;
  const tip = { x: 1 - lm[8].x, y: lm[8].y };
  if (tip.x < .25 && tip.y < .3) return "filter_blur";
  if (tip.x > .75 && tip.y < .3) return "filter_sharpen";
  if (tip.x < .25 && tip.y > .7) return "filter_flip";
  if (tip.x > .75 && tip.y > .7) return "clear";
  return null;
}

export function orbGripMetrics(lm) {
  const pattern = raisedFingerPattern(lm);
  const folded = pattern.slice(1).filter(value => !value).length;
  const center = palmCenter(lm);
  const palmSize = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || .001;
  const averageTipDistance = [8, 12, 16, 20]
    .reduce((sum, id) => sum + Math.hypot(lm[id].x - center.x, lm[id].y - center.y), 0) / 4 / palmSize;
  const active = pattern[0] && folded >= 3 && averageTipDistance > .58 && averageTipDistance < 1.55;
  return {
    active,
    anchor: { x: center.x, y: center.y - palmSize * .42 },
    grip: Math.max(.76, Math.min(1.18, .72 + averageTipDistance * .34)),
  };
}

export function normalizedFingerDistance(lm, first = 4, second = 8) {
  const palmSize = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || .001;
  return Math.hypot(lm[first].x - lm[second].x, lm[first].y - lm[second].y) / palmSize;
}

export function randomFarTarget(origin = { x: .5, y: .5 }) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = { x: .2 + Math.random() * .6, y: .2 + Math.random() * .6 };
    if (Math.hypot(candidate.x - origin.x, candidate.y - origin.y) >= .35) return candidate;
  }
  return { x: origin.x < .5 ? .78 : .22, y: origin.y < .5 ? .76 : .24 };
}

export function isPinchSeal(lm) {
  return normalizedFingerDistance(lm, 4, 8) < .42;
}

export function normalizeIncantation(text = "") {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchIncantation(text = "") {
  const spoken = normalizeIncantation(text);
  const phrases = {
    lightning: ["loi giang", "sam chop"],
    clear: ["giai chu", "troi trong"],
    swords: ["van kiem quy tong"],
    lotus: ["phat no hoa lien", "hoa lien boc pha", "hoa lien", "bung no", "hoa vu", "hoa roi"],
  };
  return Object.entries(phrases).find(([, choices]) => choices.some(choice => spoken.includes(choice)))?.[0] || null;
}

export class HandSealRecognizer {
  constructor() { this.latchedKind = null; this.reset(); this.lastActionAt = -Infinity; this.handsSeen = 0; }
  reset() {
    this.kind = null;
    this.startedAt = 0;
    this.startCenters = null;
    this.progressValue = 0;
    this.phase = "aim";
  }
  progress() { return { kind: this.kind, value: this.progressValue }; }
  feedback() {
    const labels = {
      orb: "NẮM HỜ BÀN TAY · GIỮ MỘT KHE SÁNG",
      lotus: "HAI LÒNG BÀN TAY SONG SONG",
      swords: "NGÓN TRỎ + NGÓN GIỮA",
      mist: "NGÓN CÁI + NGÓN ÚT",
      lightning: "NGÓN CÁI + NGÓN TRỎ",
      filter_blur: "ĐẦU NGÓN · GÓC MỜ",
      filter_sharpen: "ĐẦU NGÓN · GÓC NÉT",
      filter_flip: "ĐẦU NGÓN · GÓC LẬT",
      clear: "ĐẦU NGÓN · GÓC XÓA",
    };
    const releases = {
      orb: "Đã khóa ấn — lõi năng lượng đang tụ lại",
      lotus: "Đã khóa ấn — Hỏa Liên đang nở",
      swords: "Đã khóa ấn — hỏa cầu đã tụ giữa hai đầu ngón",
      mist: "Đã khóa ấn — sương đang phun từ hai đầu ngón",
      lightning: "Đã khóa ấn — lôi quang giáng xuống",
      clear: "Đã khóa ấn — mọi hiệu ứng tan đi",
      filter_blur: "Đã chọn — camera chuyển sang làm mờ",
      filter_sharpen: "Đã chọn — camera chuyển sang làm nét",
      filter_flip: "Đã chọn — camera được lật trái–phải",
    };
    if (!this.kind) return {
      phase: "aim", title: this.handsSeen >= 2 ? "CHỌN THỦ ẤN" : `CAMERA THẤY ${this.handsSeen}/2 TAY`,
      instruction: this.handsSeen ? "Giữ nguyên tư thế để camera kiểm tra ngón nào đang giơ." : "Đưa tay vào vùng giữa camera.",
    };
    return {
      phase: this.phase,
      title: `${this.phase === "release" ? "XUẤT CHIÊU" : "ĐANG NHẬN ẤN"} · ${labels[this.kind]}`,
      instruction: this.phase === "release" ? releases[this.kind] : "Giữ đúng tư thế, đừng đổi ngón tay.",
    };
  }
  sample(hands, now = performance.now()) {
    hands = [...hands].sort((a, b) => palmCenter(a).x - palmCenter(b).x);
    this.handsSeen = hands.length;
    const cooldown = now - this.lastActionAt < 1200;
    const lotusPair = lotusPairMetrics(hands);
    const centers = hands.map(palmCenter);
    const candidate = lotusPair.active ? "lotus" : null;

    if (!candidate) {
      this.latchedKind = null;
      this.reset();
      return null;
    }
    if (candidate === this.latchedKind) return null;
    if (candidate !== this.kind) {
      this.kind = candidate;
      this.startedAt = now;
      this.startCenters = centers.map(point => ({ ...point }));
      this.progressValue = 0;
      this.phase = "charge";
      return null;
    }

    const elapsed = now - this.startedAt;
    const holdMs = 780;
    this.progressValue = Math.min(1, elapsed / holdMs);
    if (cooldown || elapsed < holdMs) return null;
    this.progressValue = 1;
    this.phase = "release";

    this.lastActionAt = now;
    const action = candidate;
    this.latchedKind = candidate;
    this.reset();
    return action;
  }
}

function drawMatrix(canvas, matrix) {
  const ctx = canvas.getContext("2d");
  canvas.width = matrix[0].length;
  canvas.height = matrix.length;
  matrix.forEach((row, y) => row.forEach((rgb, x) => {
    ctx.fillStyle = `rgb(${rgb.join(",")})`;
    ctx.fillRect(x, y, 1, 1);
  }));
}

function makeMatrixEditor(host, canvas, matrix, status) {
  const selected = { row: 2, col: 3 };
  const controls = [...document.querySelectorAll("[data-channel]")];
  const paint = () => {
    host.innerHTML = "";
    matrix.forEach((row, rowIndex) => row.forEach((rgb, colIndex) => {
      const button = document.createElement("button");
      button.className = "pixel-cell";
      button.style.background = `rgb(${rgb.join(",")})`;
      button.textContent = rgb.join(", ");
      button.setAttribute("aria-label", `Hàng ${rowIndex + 1}, cột ${colIndex + 1}: ${rgb.join(", ")}`);
      if (rowIndex === selected.row && colIndex === selected.col) button.classList.add("selected");
      button.addEventListener("click", () => {
        selected.row = rowIndex;
        selected.col = colIndex;
        controls.forEach((input, channel) => { input.value = rgb[channel]; });
        paint();
        status.textContent = `Đang sửa hàng ${rowIndex + 1}, cột ${colIndex + 1}`;
      });
      host.appendChild(button);
    }));
    drawMatrix(canvas, matrix);
  };
  controls.forEach((input, channel) => input.addEventListener("input", () => {
    matrix[selected.row][selected.col][channel] = clampChannel(input.value);
    paint();
    status.textContent = `Pixel = [${matrix[selected.row][selected.col].join(", ")}]`;
  }));
  controls.forEach((input, channel) => { input.value = matrix[selected.row][selected.col][channel]; });
  paint();
}

class WeatherFxEngine {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.mode = "clear";
    this.targetMix = 0;
    this.mix = 0;
    this.last = performance.now();
    this.origin = { x: .5, y: .55 };
    this.hand = { x: .5, y: .55 };
    this.startedAt = this.last;
    this.swords = [];
    this.petals = [];
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setMode(mode, origin = this.origin) {
    this.mode = mode;
    this.origin = { x: 1 - origin.x, y: origin.y };
    this.targetMix = mode === "clear" ? 0 : 1;
    this.startedAt = performance.now();
    if (mode === "swords") {
      this.swords = Array.from({ length: 42 }, (_, index) => ({
        column: index % 14,
        row: Math.floor(index / 14),
        delay: (index % 7) * 38,
        depth: .62 + (index % 5) * .09,
        sway: Math.random() * Math.PI * 2,
      }));
    }
    if (mode === "petals") {
      this.petals = Array.from({ length: 90 }, () => this.makePetal(true));
    }
  }

  setHand(point, charge = 0) {
    this.hand = { x: 1 - point.x, y: point.y, charge };
  }

  makePetal(scattered = false) {
    return {
      x: Math.random(),
      y: scattered ? Math.random() : -.08 - Math.random() * .35,
      depth: .35 + Math.random() * .95,
      drift: (Math.random() - .5) * .12,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - .5) * 3.4,
      tint: Math.random(),
    };
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  loop(now) {
    const dt = Math.min(.034, (now - this.last) / 1000 || .016);
    this.last = now;
    const { width, height } = this.resize();
    this.mix += (this.targetMix - this.mix) * Math.min(1, dt * 4.5);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    if (this.mix > .01) this.drawEffect(ctx, width, height, now, dt);
    requestAnimationFrame(this.loop);
  }

  drawFrame(ctx, image, columns, rows, frame, x, y, size, alpha = 1) {
    if (!image?.complete || !image.naturalWidth) return;
    const cellWidth = image.naturalWidth / columns;
    const cellHeight = image.naturalHeight / rows;
    const index = frame % (columns * rows);
    const sourceX = (index % columns) * cellWidth;
    const sourceY = Math.floor(index / columns) * cellHeight;
    ctx.globalAlpha = alpha * this.mix;
    ctx.drawImage(image, sourceX, sourceY, cellWidth, cellHeight, x - size / 2, y - size / 2, size, size);
  }

  drawEffect(ctx, width, height, now, dt) {
    const age = now - this.startedAt;
    const fastFrame = Math.floor(age / 42);
    const slowFrame = Math.floor(age / 72);
    const x = this.origin.x * width;
    const y = this.origin.y * height;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (this.mode === "lightning") {
      this.drawLightning(ctx, width, height, age, fastFrame);
    } else if (this.mode === "lotus") {
      const phase = Math.min(1, age / 1150);
      const bloom = .32 + phase * .34 + Math.sin(age / 170) * .018;
      const base = Math.min(width, height);
      this.drawFrame(ctx, this.assets.charge, 7, 6, fastFrame % 42, x, y, base * .44, .35);
      this.drawFrame(ctx, this.assets.fireRing, 6, 5, fastFrame % 30, x, y, base * bloom * .8, .68);
      this.drawFrame(ctx, this.assets.fire, 8, 8, slowFrame % 64, x, y + base * .035, base * .34, .4);
      this.drawFireLotus(ctx, x, y, base, phase, age);
      ctx.fillStyle = `rgba(255,92,20,${Math.max(0, .13 - age / 12000) * this.mix})`;
      ctx.fillRect(0, 0, width, height);
    } else if (this.mode === "swords") {
      const portal = ctx.createRadialGradient(x, y, 0, x, y, Math.min(width, height) * .18);
      portal.addColorStop(0, "rgba(220,250,255,.42)");
      portal.addColorStop(.38, "rgba(70,180,255,.18)");
      portal.addColorStop(1, "rgba(40,95,255,0)");
      ctx.fillStyle = portal;
      ctx.beginPath();
      ctx.arc(x, y, Math.min(width, height) * .18, 0, Math.PI * 2);
      ctx.fill();
      this.drawSwords(ctx, width, height, age);
    } else if (this.mode === "petals") {
      this.drawPetals(ctx, width, height, dt, now);
    }
    ctx.restore();
  }

  drawSwords(ctx, width, height, age) {
    const cycle = age % 3400;
    const form = Math.min(1, cycle / 900);
    const targetX = this.hand.x * width;
    const targetY = this.hand.y * height;
    for (const [index, sword] of this.swords.entries()) {
      const formationX = width * (.08 + sword.column / 13 * .84);
      const formationY = height * (.13 + sword.row * .105 + Math.sin(age / 350 + sword.sway) * .008);
      const enter = 1 - Math.pow(1 - form, 3);
      let x = formationX;
      let y = height * (1.12 + sword.row * .08) + (formationY - height * (1.12 + sword.row * .08)) * enter;
      const release = Math.max(0, Math.min(1, (cycle - 1550 - sword.delay) / 720));
      const eased = release * release * (3 - 2 * release);
      x += (targetX - formationX) * eased;
      y += (targetY - formationY) * eased;
      const angle = Math.atan2(targetY - formationY, targetX - formationX) + Math.PI / 2;
      const length = (54 + sword.depth * 62) * Math.min(1, form * 1.7);
      this.drawEnergyTrace(ctx, x, y, angle, length, sword.depth, 1 - Math.max(0, release - .84) * 6);
      if (release > .62 && release < .95 && index % 5 === 0) {
        ctx.globalAlpha = (1 - release) * 1.8 * this.mix;
        ctx.drawImage(this.assets.slashWide, targetX - length * .65, targetY - length * .65, length * 1.3, length * 1.3);
      }
    }
    if (cycle > 1450 && cycle < 2350) {
      const pulse = 1 - Math.abs(cycle - 1900) / 450;
      ctx.globalAlpha = Math.max(0, pulse) * .8 * this.mix;
      const size = Math.min(width, height) * (.14 + pulse * .16);
      ctx.drawImage(this.assets.flare, targetX - size / 2, targetY - size / 2, size, size);
    }
  }

  drawEnergyTrace(ctx, x, y, angle, length, depth, alpha) {
    if (!this.assets.trace?.complete) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = Math.max(0, alpha) * this.mix * (.42 + depth * .48);
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#64d8ff";
    ctx.drawImage(this.assets.trace, -length * .075, -length * .72, length * .15, length);
    ctx.globalAlpha *= .36;
    ctx.drawImage(this.assets.traceSoft, -length * .14, -length * .8, length * .28, length * 1.15);
    ctx.restore();
  }

  drawLightning(ctx, width, height, age, frame) {
    const base = Math.min(width, height);
    const handX = this.hand.x * width;
    const handY = this.hand.y * height;
    const skyCharge = Math.min(1, age / 650);
    const strike = Math.max(0, Math.min(1, (age - 480) / 360));
    const gather = Math.max(0, Math.min(1, (age - 760) / 520));
    const release = Math.max(0, Math.min(1, (age - 1250) / 520));
    ctx.fillStyle = `rgba(8,13,35,${.28 * skyCharge * this.mix})`;
    ctx.fillRect(0, 0, width, height);
    this.drawFrame(ctx, this.assets.vortex, 6, 5, frame % 30, width * .5, height * .03, base * 1.25, .34 * skyCharge);
    if (strike > 0 && strike < 1) {
      const beamHeight = Math.max(8, handY * strike);
      ctx.globalAlpha = Math.sin(strike * Math.PI) * .95 * this.mix;
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#bcecff";
      ctx.drawImage(this.assets.traceSoft, handX - base * .045, 0, base * .09, beamHeight);
    }
    this.drawFrame(ctx, this.assets.electricRing, 6, 5, frame % 30, handX, handY, base * (.22 + gather * .24), .88 * gather);
    if (release > 0) {
      const dx = handX - this.origin.x * width;
      const dy = handY - this.origin.y * height;
      const magnitude = Math.hypot(dx, dy);
      const ux = magnitude > base * .04 ? dx / magnitude : .92;
      const uy = magnitude > base * .04 ? dy / magnitude : -.38;
      const length = base * 1.5 * release;
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
      ctx.globalAlpha = (1 - Math.max(0, release - .78) * 4.5) * this.mix;
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#8fdfff";
      ctx.drawImage(this.assets.trace, -base * .055, -length, base * .11, length);
      ctx.restore();
    }
  }

  drawFireLotus(ctx, x, y, base, phase, age) {
    const open = .2 + phase * .8;
    const rings = [
      { count: 8, radius: base * .09 * open, length: base * .16, width: base * .075, offset: 0, alpha: .92 },
      { count: 12, radius: base * .145 * open, length: base * .12, width: base * .06, offset: Math.PI / 12, alpha: .72 },
    ];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(age / 1600) * .08);
    for (const ring of rings) {
      for (let index = 0; index < ring.count; index += 1) {
        const angle = index / ring.count * Math.PI * 2 + ring.offset;
        ctx.save();
        ctx.rotate(angle);
        ctx.translate(0, -ring.radius);
        const gradient = ctx.createLinearGradient(0, ring.length * .5, 0, -ring.length);
        gradient.addColorStop(0, "rgba(255,50,10,.12)");
        gradient.addColorStop(.35, "#ff4b12");
        gradient.addColorStop(.72, "#ffb21c");
        gradient.addColorStop(1, "#fff2a4");
        ctx.fillStyle = gradient;
        ctx.globalAlpha = this.mix * ring.alpha;
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#ff5315";
        ctx.beginPath();
        ctx.moveTo(0, -ring.length);
        ctx.bezierCurveTo(ring.width, -ring.length * .55, ring.width * .72, ring.length * .28, 0, ring.length * .55);
        ctx.bezierCurveTo(-ring.width * .72, ring.length * .28, -ring.width, -ring.length * .55, 0, -ring.length);
        ctx.fill();
        ctx.restore();
      }
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, base * .09);
    core.addColorStop(0, "#fff");
    core.addColorStop(.18, "#fff39a");
    core.addColorStop(.5, "#ff6b16");
    core.addColorStop(1, "rgba(255,42,0,0)");
    ctx.fillStyle = core;
    ctx.globalAlpha = this.mix;
    ctx.beginPath();
    ctx.arc(0, 0, base * .09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPetals(ctx, width, height, dt, now) {
    const wind = (this.hand.x - .5) * .24;
    for (let index = 0; index < this.petals.length; index += 1) {
      let petal = this.petals[index];
      petal.y += dt * (.08 + petal.depth * .13);
      petal.x += dt * (petal.drift + wind + Math.sin(now / 700 + index) * .025);
      petal.spin += petal.spinSpeed * dt;
      if (petal.y > 1.12 || petal.x < -.15 || petal.x > 1.15) {
        petal = this.makePetal(false);
        this.petals[index] = petal;
      }
      const size = 4 + petal.depth * 10;
      ctx.save();
      ctx.translate(petal.x * width, petal.y * height);
      ctx.rotate(petal.spin);
      ctx.globalAlpha = this.mix * (.35 + petal.depth * .5);
      ctx.shadowBlur = 7 * petal.depth;
      ctx.shadowColor = "#ff8fbf";
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      gradient.addColorStop(0, petal.tint > .45 ? "#fff7fb" : "#ffd5e8");
      gradient.addColorStop(.58, petal.tint > .45 ? "#ff86b6" : "#d88cff");
      gradient.addColorStop(1, "rgba(255,80,154,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * .48, size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

class StageRecorder {
  constructor(video, fxCanvases, stage) {
    this.video = video;
    this.fxCanvases = fxCanvases;
    this.stage = stage;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.chunks = [];
    this.loop = this.loop.bind(this);
  }

  drawVideo(width, height) {
    const ctx = this.ctx;
    const videoRatio = this.video.videoWidth / this.video.videoHeight || width / height;
    const stageRatio = width / height;
    let sourceWidth = this.video.videoWidth || width;
    let sourceHeight = this.video.videoHeight || height;
    let sourceX = 0;
    let sourceY = 0;
    if (videoRatio > stageRatio) {
      sourceWidth = sourceHeight * stageRatio;
      sourceX = ((this.video.videoWidth || width) - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / stageRatio;
      sourceY = ((this.video.videoHeight || height) - sourceHeight) / 2;
    }
    const filter = this.stage.dataset.filter;
    ctx.filter = filter === "blur" ? "blur(7px)" : filter === "sharpen" ? "contrast(1.28) saturate(1.18)" : "none";
    ctx.save();
    if (filter !== "flip") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    if (filter === "rotate") {
      const angle = Number.parseFloat(getComputedStyle(this.stage).getPropertyValue("--hand-angle")) || 0;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(angle * Math.PI / 180);
      ctx.scale(1.25, 1.25);
      ctx.translate(-width / 2, -height / 2);
    }
    ctx.drawImage(this.video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    ctx.restore();
    ctx.filter = "none";
  }

  drawFxCanvas(fxCanvas, width, height) {
    const draw = () => this.ctx.drawImage(fxCanvas, 0, 0, fxCanvas.width, fxCanvas.height, 0, 0, width, height);
    if (!fxCanvas.classList.contains("magic-3d-layer")) {
      draw();
      return;
    }
    const spell = fxCanvas.dataset.spell;
    this.ctx.save();
    if (spell === "lightning") {
      this.ctx.globalCompositeOperation = "lighter";
      this.ctx.globalAlpha = .38;
      this.ctx.filter = "blur(9px)";
      draw();
      this.ctx.globalAlpha = .62;
      this.ctx.filter = "blur(2px)";
      draw();
    } else if (spell === "swords") {
      this.ctx.globalCompositeOperation = "lighter";
      this.ctx.globalAlpha = .22;
      this.ctx.filter = "blur(5px)";
      draw();
    } else if (spell === "lotus") {
      this.ctx.globalAlpha = .34;
      this.ctx.shadowColor = "rgba(0,7,30,.72)";
      this.ctx.shadowBlur = 18;
      this.ctx.shadowOffsetY = 13;
      draw();
    }
    this.ctx.restore();
    draw();
  }

  loop() {
    if (!this.recording) return;
    this.renderComposite();
    this.recordTrack?.requestFrame?.();
    requestAnimationFrame(this.loop);
  }

  renderComposite() {
    const width = Math.max(2, Math.round(this.stage.clientWidth));
    const height = Math.max(2, Math.round(this.stage.clientHeight));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.ctx.fillStyle = "#071321";
    this.ctx.fillRect(0, 0, width, height);
    if (this.video.readyState >= 2) this.drawVideo(width, height);
    for (const fxCanvas of this.fxCanvases) {
      this.drawFxCanvas(fxCanvas, width, height);
    }
    return { width, height };
  }

  snapshot() {
    this.renderComposite();
    const link = document.createElement("a");
    link.href = this.canvas.toDataURL("image/png");
    link.download = `magic-studio-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    link.click();
    return link.href;
  }

  start() {
    if (!window.MediaRecorder || !this.canvas.captureStream) throw new Error("unsupported");
    this.recording = true;
    this.chunks = [];
    const stream = this.canvas.captureStream(0);
    this.recordTrack = stream.getVideoTracks()[0];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    this.mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 7_000_000 });
    this.mediaRecorder.ondataavailable = event => { if (event.data.size) this.chunks.push(event.data); };
    this.mediaRecorder.start(250);
    this.loop();
  }

  stop() {
    return new Promise(resolve => {
      this.mediaRecorder.onstop = () => {
        this.recording = false;
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `magic-vfx-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
}

export function startWeatherLab({ demo = false } = {}) {
  const matrix = DEFAULT_MATRIX.map(row => row.map(rgb => [...rgb]));
  const matrixStatus = document.querySelector("#matrix-status");
  makeMatrixEditor(document.querySelector("#matrix-grid"), document.querySelector("#pixel-preview"), matrix, matrixStatus);

  const stage = document.querySelector("#camera-stage");
  const video = document.querySelector("#camera");
  const cameraFilterCanvas = document.querySelector("#camera-filter-layer");
  const weather = document.querySelector("#weather");
  const status = document.querySelector("#camera-status");
  const environmentCanvas = document.querySelector("#environment-layer");
  const environmentForegroundCanvas = document.querySelector("#environment-foreground-layer");
  const particles = document.querySelector("#particle-layer");
  const environmentFx = new EnvironmentVfxEngine(environmentCanvas, { foregroundCanvas: environmentForegroundCanvas });
  const weatherFx = new CinematicVfxEngine(particles, {
    assetRoot: "../assets/camera-effects/brackeys-runtime/",
    quality: "auto",
  });
  const magic3d = new Magic3DEngine(stage);
  const webglFx = new WebglParticleVfx(stage);
  const recorder = new StageRecorder(video, [cameraFilterCanvas, environmentCanvas, particles, magic3d.canvas, webglFx.canvas, environmentForegroundCanvas], stage);
  const recognizer = new HandSealRecognizer();
  const fingerTrailRecognizer = new FingerCountRecognizer();
  let filter = "normal";
  let heartHeldAt = 0;
  let heartCapturePending = false;
  let lastHeartPhotoAt = -Infinity;
  const photoCountdown = document.querySelector("#photo-countdown");
  const photoCountdownValue = photoCountdown?.querySelector("b");
  let lastAngle = 0;
  let handPoint = { x: .5, y: .55 };
  let aimPoint = { x: .12, y: .3 };
  let lotusPoint = { x: .5, y: .55 };
  let weatherTimer = 0;
  let spellEndsAt = 0;
  let spellStartedAt = 0;
  let lotusReleased = false;
  let voiceRecognition = null;
  let previewFocusActive = false;
  const WEATHER_DURATION = Object.fromEntries(Object.entries(CINEMATIC_SCENES).map(([key, scene]) => [key, scene.duration]));
  const spellHud = document.createElement("div");
  spellHud.className = "spell-hud";
  spellHud.innerHTML = '<b id="spell-name">SẴN SÀNG NIỆM CHÚ</b><span id="spell-countdown">—</span><small id="gesture-coach">Chọn một thủ ấn để bắt đầu.</small><i><em></em></i>';
  stage.appendChild(spellHud);
  const spellName = spellHud.querySelector("#spell-name");
  const spellCountdown = spellHud.querySelector("#spell-countdown");
  const gestureCoach = spellHud.querySelector("#gesture-coach");
  const spellBar = spellHud.querySelector("em");
  const environmentHud = document.createElement("div");
  environmentHud.className = "environment-hud";
  environmentHud.innerHTML = "<b>THỜI TIẾT</b><span>TRỜI QUANG</span><i><em></em></i>";
  stage.appendChild(environmentHud);
  const environmentLabel = environmentHud.querySelector("span");
  const environmentBar = environmentHud.querySelector("em");
  const sealCoach = document.createElement("div");
  sealCoach.className = "seal-coach";
  sealCoach.innerHTML = '<small>TRỢ LÝ THỦ ẤN</small><b>CAMERA THẤY 0/2 TAY</b><span>Đưa tay vào vùng giữa camera.</span>';
  stage.appendChild(sealCoach);
  const coachTitle = sealCoach.querySelector("b");
  const coachInstruction = sealCoach.querySelector("span");
  const handLink = document.createElement("i");
  handLink.className = "hand-link";
  stage.appendChild(handLink);
  const handRunes = [0, 1].map(index => {
    const rune = document.createElement("i");
    rune.className = "tracked-hand";
    rune.dataset.hand = String(index + 1);
    stage.appendChild(rune);
    return rune;
  });
  const runeMatchPanel = document.querySelector("#rune-match-panel");
  const runeMatchName = document.querySelector("#rune-match-name");
  const runeMatchHint = document.querySelector("#rune-match-hint");
  const runeMatchScore = document.querySelector("#rune-match-score");
  const runeMatchBar = document.querySelector("#rune-match-bar");
  const runeMatchSymbol = document.querySelector("#rune-match-symbol");
  const runeUi = {
    mist: { name: "Neon Nebulus", symbol: "○", hint: "Giữ ngón trỏ trong vùng SƯƠNG khoảng một giây.", output: "Sương + Darken + Blur" },
    snow: { name: "Snowfall", symbol: "❄", hint: "Giữ ngón trỏ trong vùng SNOW.", output: "Tuyết rơi 36 giây" },
    rain: { name: "Cinematic Rain", symbol: "☂", hint: "Giữ ngón trỏ trong vùng RAIN.", output: "Mây và mưa 26 giây" },
    lightning: { name: "Thunder Gate", symbol: "ϟ", hint: "Giữ ngón trỏ trong vùng BOLT.", output: "Sét nhiều phase từ bầu trời" },
    flowers_sakura: { name: "Sakura Rain", symbol: "❀", hint: "Giữ ngón trỏ trong vùng SAKURA.", output: "Hoa hồng rơi" },
    flowers_blue: { name: "Moon Petals", symbol: "✿", hint: "Giữ ngón trỏ trong vùng MOON.", output: "Hoa lam rơi" },
    flowers_gold: { name: "Golden Leaves", symbol: "❋", hint: "Giữ ngón trỏ trong vùng GOLD.", output: "Cánh vàng rơi" },
    pixie_dust: { name: "Pixie Dust", symbol: "✦", hint: "Giữ ngón trỏ trong vùng PIXIE.", output: "Bụi phép bay 60 giây" },
    vortex_fire: { name: "Fire Vortex", symbol: "◉", hint: "Giữ ngón trỏ trong vùng VORTEX.", output: "Gom lửa, xoáy và bùng sáng" },
    filter_blur: { name: "Soft Focus", symbol: "◌", hint: "Giữ ngón trỏ trong vùng BLUR.", output: "Làm mờ camera" },
    filter_sharpen: { name: "Sharpen", symbol: "◇", hint: "Giữ ngón trỏ trong vùng SHARP.", output: "Tăng độ rõ chi tiết" },
    filter_pixel: { name: "Pixel Art", symbol: "▦", hint: "Giữ ngón trỏ trong vùng PIXEL.", output: "Phóng to các ô màu" },
    filter_cartoon: { name: "Cartoon Ink", symbol: "✎", hint: "Giữ ngón trỏ trong vùng TOON.", output: "Mảng màu phẳng + viền mực" },
    filter_flip: { name: "Mirror", symbol: "⇄", hint: "Giữ ngón trỏ trong vùng FLIP.", output: "Lật ngang camera" },
    reset: { name: "Reset Stage", symbol: "×", hint: "Giữ ngón trỏ trong vùng RESET.", output: "Camera trở về ban đầu" },
    lotus: { name: "Thanh Liên", symbol: "✺", hint: "Giơ tổng cộng chín ngón tay.", output: "Triệu hồi Thanh Liên" },
    photo: { name: "Magic Photo", symbol: "♡", hint: "Giơ đủ mười ngón tay.", output: "Chụp ảnh sân khấu" },
    summon_dust: { name: "Summon Dust", symbol: "✦", hint: "Xòe đủ năm ngón tay.", output: "Phát bụi phép từ lòng bàn tay" },
  };
  const updateRuneMatch = (progress, castKind = null) => {
    if (!runeMatchPanel) return;
    const match = castKind ? { kind: castKind, score: 1 } : progress?.best;
    const drawing = Boolean(progress?.active);
    const awaitingConfirm = Boolean(progress?.awaitingConfirm);
    runeMatchPanel.dataset.state = castKind ? "cast" : awaitingConfirm ? "confirm" : drawing ? "drawing" : "waiting";
    document.querySelectorAll("[data-rune-card]").forEach(card => {
      card.classList.toggle("matching", drawing && card.dataset.runeCard === match?.kind);
      card.classList.toggle("active", card.dataset.runeCard === (match?.kind || fingerTrailRecognizer.kind));
    });
    if (!match || !runeUi[match.kind]) {
      runeMatchName.textContent = "Chưa chọn atmosphere";
      runeMatchHint.textContent = "Giơ đúng số ngón tay và giữ đến khi thanh thời gian đầy.";
      runeMatchScore.textContent = "0%";
      runeMatchBar.style.width = "0%";
      runeMatchSymbol.textContent = "✦";
      return;
    }
    const ui = runeUi[match.kind];
    const score = Math.round(match.score * 100);
    runeMatchName.textContent = castKind ? `${ui.name} · ĐÃ NHẬN` : ui.name;
    runeMatchHint.textContent = castKind ? "Đã giữ đủ thời gian. Atmosphere đang được kích hoạt." : ui.hint;
    runeMatchScore.textContent = `${score}%`;
    runeMatchBar.style.width = `${score}%`;
    runeMatchSymbol.textContent = ui.symbol;
    const inspectorSpell = document.querySelector("#inspector-spell");
    const inspectorSymbol = document.querySelector("#inspector-symbol");
    const inspectorHint = document.querySelector("#inspector-hint");
    const inspectorOutput = document.querySelector("#inspector-output");
    if (inspectorSpell) inspectorSpell.textContent = ui.name;
    if (inspectorSymbol) inspectorSymbol.textContent = ui.symbol;
    if (inspectorHint) inspectorHint.textContent = ui.hint;
    if (inspectorOutput) inspectorOutput.textContent = ui.output;
  };
  const dwellZoneElements = [...document.querySelectorAll("[data-dwell-zone]")];
  const updateDwellZones = progress => {
    dwellZoneElements.forEach(zone => {
      const active = zone.dataset.dwellZone === progress?.kind;
      zone.classList.toggle("holding", active);
      zone.style.setProperty("--hold", `${active ? Math.round(progress.value * 100) : 0}%`);
    });
  };

  const thunder = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audio = new AudioCtx();
    const length = Math.round(audio.sampleRate * 1.25);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let value = 0;
    for (let i = 0; i < length; i += 1) {
      value = value * .94 + (Math.random() * 2 - 1) * .18;
      data[i] = value * Math.exp(-i / (audio.sampleRate * .42));
    }
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    const filterNode = audio.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.value = 420;
    gain.gain.value = .42;
    source.buffer = buffer;
    source.connect(filterNode).connect(gain).connect(audio.destination);
    source.start();
    source.onended = () => audio.close();
  };

  const stopVoiceRecognition = () => {
    if (!voiceRecognition) return;
    const recognition = voiceRecognition;
    voiceRecognition = null;
    recognition.onend = null;
    try { recognition.stop(); } catch {}
  };

  const showEnvironment = (kind, options = {}) => {
    if (kind === "clear") {
      environmentFx.clear();
      environmentLabel.textContent = "TRỜI ĐANG QUANG DẦN";
      status.textContent = "Gió đang đẩy mây, mưa và sương ra khỏi sân khấu.";
      return true;
    }
    const labels = { fog: "SƯƠNG SÁT ĐẤT", cloud: "MÂY ĐANG TỤ", rain: "MƯA ĐIỆN ẢNH", snow: "TUYẾT ĐANG RƠI" };
    const success = environmentFx.summon(kind, options);
    if (!success) return false;
    environmentLabel.textContent = labels[kind];
    environmentHud.classList.add("visible");
    stage.dataset.environment = kind;
    status.textContent = kind === "fog"
      ? "SƯƠNG: quét tay thấp sang ngang để đổi hướng gió."
      : kind === "cloud"
        ? "MÂY: hai tay đã gom hơi nước ở vùng cao."
        : kind === "snow"
          ? "TUYẾT: các lớp bông tuyết đang rơi với tốc độ và độ sâu khác nhau."
          : "MƯA: kéo hai tay từ mây xuống để tăng cường độ.";
    return true;
  };

  const showMagicFocus = (active = true) => {
    previewFocusActive = !!active;
    environmentFx.setMagicFocus(previewFocusActive
      ? { center: { x: .5, y: .52 }, radius: .27, angle: -.08 }
      : null);
    document.querySelector("#magic-focus-preview")?.classList.toggle("active", previewFocusActive);
    status.textContent = previewFocusActive
      ? "FOCUS CIRCLE: dùng hai tay cái + trỏ để điều khiển vị trí, kích thước và góc."
      : "Focus Circle đã khép lại.";
  };

  const releaseLotus = (source = "voice") => {
    if (weather.dataset.weather !== "lotus" || lotusReleased) return false;
    lotusReleased = true;
    stopVoiceRecognition();
    weatherFx.release();
    magic3d.release();
    setTimeout(() => {
      if (weather.dataset.weather !== "lotus" || !lotusReleased) return;
      environmentFx.disturb(lotusPoint, 1, "78,198,255");
      stage.classList.remove("lotus-impact");
      void stage.offsetWidth;
      stage.classList.add("lotus-impact");
    }, 270);
    stage.dataset.phase = "release";
    stage.dataset.fxPhase = "action";
    clearTimeout(weatherTimer);
    spellEndsAt = performance.now() + 8000;
    weatherTimer = setTimeout(() => clearWeather(), 8000);
    setTimeout(() => {
      if (weather.dataset.weather === "lotus" && lotusReleased) stage.dataset.fxPhase = "idle";
    }, 900);
    const voiceButton = document.querySelector("#lotus-release");
    if (voiceButton) voiceButton.disabled = true;
    spellName.textContent = "✺ HỎA LIÊN · BỘC PHÁ";
    status.textContent = source === "voice"
      ? "GIỌNG NÓI ĐÃ KÍCH NỔ · Hỏa liên bùng sáng và hóa thành hoa vũ!"
      : "HỎA LIÊN BỘC PHÁ · Hoa vũ đã được giải phóng!";
    return true;
  };

  const triggerIncantation = text => {
    const spell = matchIncantation(text);
    if (spell === "lotus" && weather.dataset.weather === "lotus") return releaseLotus("voice");
    return false;
  };

  const listenForLotusRelease = () => {
    stopVoiceRecognition();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .flatMap(result => Array.from(result, alternative => alternative.transcript))
        .join(" ");
      triggerIncantation(transcript);
    };
    recognition.onend = () => {
      if (voiceRecognition === recognition && weather.dataset.weather === "lotus" && !lotusReleased) {
        setTimeout(() => {
          if (voiceRecognition === recognition) {
            try { recognition.start(); } catch {}
          }
        }, 160);
      }
    };
    recognition.onerror = event => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) stopVoiceRecognition();
    };
    voiceRecognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      stopVoiceRecognition();
      return false;
    }
  };

  const showWeather = (action, origin = handPoint, directedAim = null) => {
    if (action === "clear") { clearWeather(); return; }
    if (action === "petals") action = "lotus";
    const sameSpellIsRunning = weather.dataset.weather === action
      && (action === "lotus" ? !lotusReleased : performance.now() < spellEndsAt);
    if (sameSpellIsRunning) return false;
    clearTimeout(weatherTimer);
    stopVoiceRecognition();
    lotusReleased = false;
    weather.dataset.weather = action;
    stage.dataset.spell = action;
    stage.dataset.phase = "charge";
    stage.dataset.fxPhase = "windup";
    spellStartedAt = performance.now();
    const target = action === "swords" ? (directedAim || randomFarTarget(origin)) : aimPoint;
    weatherFx.cast(action, {
      anchor: action === "lotus" ? lotusPoint : origin,
      aim: target,
      duration: WEATHER_DURATION[action],
      manualVolley: action === "swords" && Boolean(directedAim),
    });
    if (action === "swords" || action === "lightning") magic3d.clear();
    else magic3d.cast(action, { target, manualVolley: false });
    environmentFx.setHeroSpell(action === "lightning" ? "clear" : action);
    const voiceButton = document.querySelector("#lotus-release");
    if (voiceButton) voiceButton.disabled = true;
    if (action === "lightning") {
      environmentFx.summon("cloud", { intensity: .76, wind: environmentFx.getState().wind });
      thunder();
      stage.classList.remove("thunder-flash");
      setTimeout(() => {
        if (weather.dataset.weather !== "lightning") return;
        void stage.offsetWidth;
        stage.classList.add("thunder-flash");
      }, 590);
      status.textContent = "SẤM CHỚP! Tia chính đang đánh vào trung điểm giữa ngón cái và ngón trỏ.";
    } else if (action === "swords") {
      swordVolleyRecognizer.reset();
      if (!directedAim) {
        setTimeout(() => {
          if (weather.dataset.weather !== "swords") return;
          environmentFx.disturb(target, .72, "86,205,255");
          stage.classList.remove("sword-impact");
          void stage.offsetWidth;
          stage.classList.add("sword-impact");
        }, 6150);
      }
      status.textContent = directedAim
        ? "ARCANE DETONATION: giữ hai ngón để khóa mục tiêu, rồi đổi hướng thật nhanh để kích nổ!"
        : "ARCANE DETONATION: điểm nổ đang được khóa!";
    } else {
      status.textContent = action === "orb"
        ? "ARCANE ORB: các hạt năng lượng đang xoáy vào lõi giữa bàn tay."
        : "HỎA LIÊN · HOA VŨ: hoa lửa sẽ nở rồi hóa thành cánh hoa!";
    }
    spellEndsAt = action === "lotus"
      ? 0
      : performance.now() + (action === "swords" && directedAim ? 18000 : WEATHER_DURATION[action]);
    spellName.textContent = action === "swords" ? "✦ ARCANE DETONATION" : action === "lotus" ? "✺ HỎA LIÊN · HOA VŨ" : action === "orb" ? "◉ ARCANE ENERGY ORB" : "ϟ THIÊN LÔI";
    gestureCoach.textContent = action === "swords"
      ? "Giơ trỏ + giữa để khóa điểm nổ. Giữ yên, rồi đổi hướng hai ngón thật nhanh để kích hoạt vụ nổ."
      : action === "lightning"
        ? "Giơ cái + trỏ; dùng đầu ngón trỏ để chọn hướng phóng."
        : action === "lotus"
          ? "Mở hai lòng bàn tay đối diện nhau; thay đổi khoảng cách để giữ hoa."
          : "Cụm bàn tay quanh lõi sáng; di chuyển cả bàn tay để dẫn orb.";
    spellHud.classList.add("casting");
    const actionDelay = action === "lotus" ? 5200 : action === "swords" ? 1150 : 350;
    setTimeout(() => {
      if (weather.dataset.weather !== action) return;
      stage.dataset.phase = action === "lotus" ? "idle" : "sustain";
      stage.dataset.fxPhase = action === "lotus" ? "idle" : "action";
      if (action === "lotus" && !lotusReleased) {
        if (voiceButton) voiceButton.disabled = false;
        const listening = listenForLotusRelease();
        status.textContent = listening
          ? "HỎA LIÊN ĐÃ CHÍN · Hãy nói “BÙNG NỔ” hoặc bấm KÍCH NỔ."
          : "HỎA LIÊN ĐÃ CHÍN · Bấm KÍCH NỔ để giải phóng hoa vũ.";
      }
    }, actionDelay);
    weatherTimer = action === "lotus"
      ? setTimeout(() => releaseLotus("timeout"), 12000)
      : setTimeout(() => clearWeather(), action === "swords" && directedAim ? 18000 : WEATHER_DURATION[action]);
    if (action !== "lotus") {
      const idleDelay = action === "swords" ? 7600 : 7000;
      setTimeout(() => {
        if (weather.dataset.weather === action) stage.dataset.fxPhase = "idle";
      }, idleDelay);
    }
    return true;
  };

  const clearWeather = () => {
    clearTimeout(weatherTimer);
    weatherTimer = 0;
    stopVoiceRecognition();
    lotusReleased = false;
    weather.dataset.weather = "clear";
    stage.dataset.spell = "clear";
    stage.dataset.phase = "dissipate";
    stage.dataset.fxPhase = "idle";
    weatherFx.clear();
    magic3d.clear();
    webglFx.clear();
    environmentFx.clear();
    environmentFx.setHeroSpell("clear");
    spellEndsAt = 0;
    spellStartedAt = 0;
    const voiceButton = document.querySelector("#lotus-release");
    if (voiceButton) voiceButton.disabled = true;
    spellName.textContent = "SẴN SÀNG NIỆM CHÚ";
    gestureCoach.textContent = "Chọn một thủ ấn để bắt đầu.";
    spellCountdown.textContent = "—";
    spellBar.style.width = "0%";
    spellHud.classList.remove("casting");
    setTimeout(() => { if (weather.dataset.weather === "clear") stage.dataset.phase = "idle"; }, 1500);
    status.textContent = "Bầu trời đã trong. Hãy thử một chuyển động mới.";
  };

  const setSpellTracking = ({ anchor = lotusPoint, aim = aimPoint, grip = 1, span } = {}) => {
    lotusPoint = anchor;
    aimPoint = aim;
    weatherFx.setTracking({
      anchor: weather.dataset.weather === "lotus" ? lotusPoint : handPoint,
      aim: aimPoint,
      span,
    });
    magic3d.setTracking({ anchor: lotusPoint, aim: aimPoint, grip });
    environmentFx.setHeroTarget(aimPoint);
  };

  const applyFilter = (nextFilter, label = nextFilter) => {
    filter = nextFilter;
    stage.dataset.filter = filter;
    document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("active", item.dataset.filter === filter));
    status.textContent = `Hiệu ứng camera: ${label}`;
  };

  const activateDwellAtmosphere = action => {
    if (!action) return false;
    const kind = action.kind;
    const ui = runeUi[kind];
    if (kind === "reset") {
      clearWeather();
      environmentFx.clear();
      applyFilter("normal", "Bình thường");
      stage.dataset.atmosphere = "clear";
      environmentHud.classList.remove("visible");
      status.textContent = "RESET hoàn tất: camera và toàn bộ atmosphere đã trở về trạng thái ban đầu.";
      return true;
    }
    if (kind === "mist") {
      clearTimeout(weatherTimer);
      weatherFx.clear();
      applyFilter("blur", "Neon Nebulus");
      stage.dataset.atmosphere = "neon-mist";
      const center = action.point || { x: .5, y: .52 };
      const emitters = Array.from({ length: 18 }, (_, index) => {
        const angle = index / 18 * Math.PI * 2;
        return {
          x: center.x + Math.cos(angle) * (.045 + (index % 3) * .018),
          y: center.y + Math.sin(angle) * (.035 + (index % 4) * .012),
        };
      });
      environmentFx.castFingerMist(emitters, { duration: 60000 });
      environmentFx.summon("fog", { intensity: .48, duration: 60000, wind: .025 });
      environmentHud.classList.add("visible");
      environmentLabel.textContent = "NEON NEBULUS · 60 GIÂY";
      environmentBar.style.width = "100%";
      spellName.textContent = "○ NEON NEBULUS";
      status.textContent = "Sương neon đang lan mềm qua stock fog; camera được darken và blur nhẹ.";
      return true;
    }
    if (kind.startsWith("flowers_")) {
      clearTimeout(weatherTimer);
      environmentFx.clear();
      stage.dataset.atmosphere = kind;
      weather.dataset.weather = kind;
      weatherFx.cast(kind, { anchor: action.point, duration: 60000 });
      spellName.textContent = `${ui.symbol} ${ui.name.toUpperCase()}`;
      spellCountdown.textContent = "60";
      spellBar.style.width = "100%";
      stage.dataset.phase = "sustain";
      weatherTimer = setTimeout(() => clearWeather(), 60000);
      status.textContent = `${ui.name}: hoa rơi liên tục, không có phase nổ.`;
      return true;
    }
    if (kind === "snow" || kind === "rain") {
      stage.dataset.atmosphere = kind;
      webglFx.cast(kind, {
        anchor: action.point || { x: .5, y: .5 },
        duration: kind === "snow" ? 36000 : 26000,
      });
      showEnvironment(kind, {
        intensity: kind === "snow" ? 1 : .98,
        duration: kind === "snow" ? 36000 : 26000,
        wind: kind === "snow" ? .025 : .075,
      });
      spellName.textContent = `${ui.symbol} ${ui.name.toUpperCase()}`;
      spellCountdown.textContent = kind === "snow" ? "36" : "26";
      environmentBar.style.width = "100%";
      status.textContent = `${ui.name} đã bật. Có thể chọn thêm Blur, Cartoon hoặc Flip mà thời tiết vẫn tiếp tục.`;
      return true;
    }
    if (kind === "lightning") {
      clearTimeout(weatherTimer);
      stage.dataset.atmosphere = "lightning";
      weather.dataset.weather = "lightning";
      weatherFx.cast("lightning", { anchor: action.point, aim: action.point, duration: 9000 });
      webglFx.cast("lightning", { anchor: action.point || { x: .5, y: .55 }, duration: 12000 });
      environmentFx.summon("cloud", { intensity: .72, duration: 12000, wind: .08 });
      thunder();
      stage.classList.remove("thunder-flash");
      void stage.offsetWidth;
      stage.classList.add("thunder-flash");
      spellName.textContent = "ϟ THUNDER GATE";
      spellCountdown.textContent = "9";
      spellBar.style.width = "100%";
      weatherTimer = setTimeout(() => clearWeather(), 12000);
      status.textContent = "Thunder Gate: tia chính và tia phụ đang đánh từ nhiều hướng. Filter hiện tại vẫn được giữ.";
      return true;
    }
    if (kind === "pixie_dust" || kind === "vortex_fire") {
      clearTimeout(weatherTimer);
      stage.dataset.atmosphere = kind;
      weather.dataset.weather = kind;
      if (kind === "pixie_dust") {
        weatherFx.cast(kind, {
          anchor: action.point || { x: .5, y: .55 },
          aim: action.point || { x: .5, y: .55 },
          duration: CINEMATIC_SCENES[kind].duration,
        });
      } else {
        weatherFx.clear();
        webglFx.cast(kind, {
          anchor: action.point || { x: .5, y: .55 },
          duration: CINEMATIC_SCENES[kind].duration,
        });
      }
      spellName.textContent = `${ui.symbol} ${ui.name.toUpperCase()}`;
      spellCountdown.textContent = String(Math.round(CINEMATIC_SCENES[kind].duration / 1000));
      spellBar.style.width = "100%";
      stage.dataset.phase = kind === "vortex_fire" ? "charge" : "sustain";
      weatherTimer = setTimeout(() => clearWeather(), CINEMATIC_SCENES[kind].duration);
      status.textContent = kind === "pixie_dust"
        ? "Pixie Dust đang trôi khắp sân khấu trong 60 giây."
        : "Fire Vortex: lửa đang gom vào tâm, mở vòng xoáy rồi bùng sáng.";
      return true;
    }
    if (kind === "summon_dust") {
      stage.dataset.atmosphere = "summon-dust";
      spellName.textContent = "✦ SUMMON DUST";
      spellCountdown.textContent = "5";
      spellBar.style.width = "100%";
      status.textContent = "Giữ bàn tay xòe: bụi phép tiếp tục sinh từ lòng bàn tay. Hạ còn một ngón để hút toàn bộ bụi vào Fire Vortex.";
      return true;
    }
    if (kind.startsWith("filter_")) {
      const nextFilter = kind.slice("filter_".length);
      const labels = {
        blur: "Blur",
        sharpen: "Sharpen",
        pixel: "Pixel",
        cartoon: "Cartoon · mảng màu + viền mực",
        flip: "Flip",
      };
      applyFilter(nextFilter, labels[nextFilter]);
      updateRuneMatch(null, kind);
      status.textContent = `${labels[nextFilter]} đã bật. Weather và particle hiện có vẫn tiếp tục chạy.`;
      return true;
    }
    return false;
  };

  const renderCameraFilter = () => {
    if (cameraFilterCanvas && video.readyState >= 2 && (filter === "pixel" || filter === "cartoon")) {
      const pixelMode = filter === "pixel";
      const width = pixelMode ? 96 : 240;
      const height = Math.max(1, Math.round(width * stage.clientHeight / Math.max(1, stage.clientWidth)));
      if (cameraFilterCanvas.width !== width || cameraFilterCanvas.height !== height) {
        cameraFilterCanvas.width = width;
        cameraFilterCanvas.height = height;
      }
      const ctx = cameraFilterCanvas.getContext("2d", { willReadFrequently: !pixelMode });
      const videoRatio = video.videoWidth / Math.max(1, video.videoHeight);
      const canvasRatio = width / height;
      let sourceX = 0, sourceY = 0, sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
      if (videoRatio > canvasRatio) {
        sourceWidth = video.videoHeight * canvasRatio;
        sourceX = (video.videoWidth - sourceWidth) / 2;
      } else {
        sourceHeight = video.videoWidth / canvasRatio;
        sourceY = (video.videoHeight - sourceHeight) / 2;
      }
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.filter = pixelMode ? "contrast(1.08) saturate(1.08)" : "blur(.7px) contrast(1.14) saturate(1.35)";
      ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
      ctx.restore();
      if (!pixelMode) {
        const frame = ctx.getImageData(0, 0, width, height);
        const source = new Uint8ClampedArray(frame.data);
        const quantizeStep = 42;
        const edgeThreshold = 34;
        const luminanceAt = pixelIndex =>
          source[pixelIndex] * .299 + source[pixelIndex + 1] * .587 + source[pixelIndex + 2] * .114;
        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const index = (y * width + x) * 4;
            const left = luminanceAt(index - 4);
            const right = luminanceAt(index + 4);
            const top = luminanceAt(index - width * 4);
            const bottom = luminanceAt(index + width * 4);
            const edgeStrength = Math.abs(right - left) + Math.abs(bottom - top);
            if (edgeStrength > edgeThreshold) {
              frame.data[index] = 17;
              frame.data[index + 1] = 25;
              frame.data[index + 2] = 35;
            } else {
              frame.data[index] = Math.min(255, Math.round(source[index] / quantizeStep) * quantizeStep);
              frame.data[index + 1] = Math.min(255, Math.round(source[index + 1] / quantizeStep) * quantizeStep);
              frame.data[index + 2] = Math.min(255, Math.round(source[index + 2] / quantizeStep) * quantizeStep);
            }
          }
        }
        ctx.putImageData(frame, 0, 0);
      }
    }
    requestAnimationFrame(renderCameraFilter);
  };
  requestAnimationFrame(renderCameraFilter);

  const updateHeartCapture = (hands, now) => {
    const heart = heartGestureMetrics(hands);
    if (!heart.active) {
      if (!heartCapturePending) heartHeldAt = 0;
      return false;
    }
    if (!heartHeldAt) heartHeldAt = now;
    if (heartCapturePending || now - heartHeldAt < 700 || now - lastHeartPhotoAt < 6500) return true;
    heartCapturePending = true;
    lastHeartPhotoAt = now;
    photoCountdown?.classList.add("visible");
    status.textContent = "Đã nhận hình trái tim. Giữ tạo dáng — studio sẽ chụp sau 3 giây.";
    [3, 2, 1].forEach((value, index) => window.setTimeout(() => {
      if (photoCountdownValue) photoCountdownValue.textContent = String(value);
    }, index * 760));
    window.setTimeout(() => {
      try {
        recorder.snapshot();
        photoCountdown?.classList.add("flash");
        status.textContent = "Đã chụp ảnh Magic Studio gồm camera và toàn bộ VFX.";
      } catch {
        status.textContent = "Chưa chụp được ảnh. Hãy mở camera rồi thử lại hình trái tim.";
      }
      window.setTimeout(() => {
        photoCountdown?.classList.remove("visible", "flash");
        heartCapturePending = false;
        heartHeldAt = 0;
      }, 520);
    }, 2380);
    return true;
  };

  const camera = new CameraEngine(video, {
    watchdogActive: () => true,
    onFrame: result => {
      {
      const hands = result.multiHandLandmarks || [];
      const hand = pickClosestHand(hands);
      const now = performance.now();
      const heartActive = updateHeartCapture(hands, now);
      const fingerCount = totalRaisedFingers(hands);
      webglFx.setDustSummon(!heartActive && fingerCount === 5, hand?.[9] || hand?.[0]);
      const trailAction = fingerTrailRecognizer.sample(heartActive ? [] : hands, now);
      const trailProgress = fingerTrailRecognizer.progress();
      updateRuneMatch(trailProgress, trailAction?.kind);
      stage.classList.toggle("ritual-drawing", false);

      if (trailAction) activateDwellAtmosphere(trailAction);

      if (!hand) {
        recognizer.sample([], now);
        handRunes.forEach(rune => rune.classList.remove("visible"));
        handLink.classList.remove("visible");
        const feedback = recognizer.feedback();
        coachTitle.textContent = feedback.title;
        coachInstruction.textContent = feedback.instruction;
        sealCoach.dataset.phase = feedback.phase;
        stage.classList.remove("seal-locked");
        if (environmentFx.getState(now).mist.remaining <= 0) {
          status.textContent = "Giơ từ 1 đến 9 ngón tay và giữ khoảng một giây để chọn hiệu ứng.";
        }
        return;
      }

      const lotusPair = lotusPairMetrics(hands);
      const centers = hands.map(palmCenter);
      if (lotusPair.active) lotusPoint = lotusPair.anchor;
      aimPoint = { x: hand[8].x, y: hand[8].y };
      const screenCenters = (lotusPair.active ? centers : [hand[8]]).map(point => ({ x: 1 - point.x, y: point.y }));
      handRunes.forEach((rune, index) => {
        const point = screenCenters[index];
        rune.classList.toggle("visible", !!point);
        if (point) {
          rune.style.setProperty("--x", `${point.x * 100}%`);
          rune.style.setProperty("--y", `${point.y * 100}%`);
        }
      });
      if (lotusPair.active && screenCenters.length >= 2) {
        const [a, b] = screenCenters;
        const dx = (b.x - a.x) * stage.clientWidth;
        const dy = (b.y - a.y) * stage.clientHeight;
        handLink.style.setProperty("--x", `${a.x * 100}%`);
        handLink.style.setProperty("--y", `${a.y * 100}%`);
        handLink.style.setProperty("--length", `${Math.hypot(dx, dy)}px`);
        handLink.style.setProperty("--angle", `${Math.atan2(dy, dx)}rad`);
        handLink.classList.add("visible");
      } else {
        handLink.classList.remove("visible");
      }

      weatherFx.setTracking({ anchor: lotusPoint, aim: lotusPoint });
      magic3d.setTracking({ anchor: lotusPoint, aim: lotusPoint, grip: lotusPair.active ? lotusPair.grip : 1 });
      stage.style.setProperty("--hand-x", `${(1 - aimPoint.x) * 100}%`);
      stage.style.setProperty("--hand-y", `${aimPoint.y * 100}%`);
      document.querySelector("#hand-dot").style.cssText = `--x:${(1 - aimPoint.x) * 100}%;--y:${aimPoint.y * 100}%;`;

      const action = null;
      const charge = recognizer.progress();
      const feedback = trailProgress.active
        ? {
            phase: "charge",
            title: `${trailProgress.count} NGÓN · ${runeUi[trailProgress.kind]?.name || "ATMOSPHERE"}`,
            instruction: `Giữ nguyên số ngón tay · ${Math.round(trailProgress.value * 100)}%`,
          }
        : recognizer.feedback();
      coachTitle.textContent = feedback.title;
      coachInstruction.textContent = feedback.instruction;
      sealCoach.dataset.phase = feedback.phase;
      stage.classList.toggle("seal-locked", feedback.phase === "charge" || feedback.phase === "release");

      if (action === "lotus") showWeather("lotus", lotusPoint);
      if (trailProgress.active) {
        spellName.textContent = `${trailProgress.count} NGÓN · ${runeUi[trailProgress.kind]?.name.toUpperCase()}`;
        spellCountdown.textContent = `${Math.round(trailProgress.value * 100)}%`;
        spellBar.style.width = `${trailProgress.value * 100}%`;
      } else if (charge.kind === "lotus") {
        spellName.textContent = "NẠP PHÉP · HAI LÒNG BÀN TAY";
        spellCountdown.textContent = `${Math.round(charge.value * 100)}%`;
        spellBar.style.width = `${charge.value * 100}%`;
      }

      const environmentState = environmentFx.getState(now);
      if (!trailProgress.active && !action && environmentState.mist.remaining > 0) {
        environmentHud.classList.add("visible");
        environmentLabel.textContent = `NEBULUS · ${Math.ceil(environmentState.mist.remaining / 1000)} GIÂY`;
        environmentBar.style.width = `${environmentState.mist.remaining / 600}%`;
      }
      return;
      }

      const centers = hands.map(palmCenter);
      const center = centers.reduce((sum, point) => ({ x: sum.x + point.x / centers.length, y: sum.y + point.y / centers.length }), { x: 0, y: 0 });
      const swordHand = hands.find(isSwordSeal);
      const mistHand = hands.find(isMistSeal);
      const lightningHand = hands.find(isLightningSeal);
      const swordAnchor = swordHand ? swordMidpoint(swordHand) : null;
      const swordAim = swordHand ? swordDirectionTarget(swordHand) : null;
      const swordSpan = swordHand ? [swordHand[8], swordHand[12]] : null;
      const mistSpan = mistHand ? mistFingerSpan(mistHand) : null;
      if (mistSpan) environmentFx.setMistEmitters(mistSpan);
      const lightningAnchor = lightningHand ? lightningMidpoint(lightningHand) : null;
      const lightningSpan = lightningHand ? [lightningHand[4], lightningHand[8]] : null;
      const lotusPair = lotusPairMetrics(hands);
      const orbGrip = hands.map(orbGripMetrics).find(metrics => metrics.active) || { active: false };
      const magicFocus = magicCircleMetrics(hands);
      environmentFx.setMagicFocus(
        magicFocus.active
          ? magicFocus
          : previewFocusActive
            ? { center: { x: .5, y: .52 }, radius: .2, angle: -.08 }
            : null,
      );
      const runeAnchors = lotusPair.active ? centers : hands.map(points => points[8]);
      const screenCenters = runeAnchors.map(point => ({ x: 1 - point.x, y: point.y }));
      handRunes.forEach((rune, index) => {
        const point = screenCenters[index];
        rune.classList.toggle("visible", !!point);
        if (point) {
          rune.style.setProperty("--x", `${point.x * 100}%`);
          rune.style.setProperty("--y", `${point.y * 100}%`);
        }
      });
      if (screenCenters.length >= 2) {
        const [a, b] = screenCenters;
        const dx = (b.x - a.x) * stage.clientWidth, dy = (b.y - a.y) * stage.clientHeight;
        handLink.style.setProperty("--x", `${a.x * 100}%`);
        handLink.style.setProperty("--y", `${a.y * 100}%`);
        handLink.style.setProperty("--length", `${Math.hypot(dx, dy)}px`);
        handLink.style.setProperty("--angle", `${Math.atan2(dy, dx)}rad`);
        handLink.classList.add("visible");
      } else handLink.classList.remove("visible");
      handPoint = swordAnchor || lightningAnchor || orbGrip.anchor || center;
      aimPoint = lightningAnchor || { x: hand[8].x, y: hand[8].y };
      if (lotusPair.active) lotusPoint = lotusPair.anchor;
      const now = performance.now();
      const swordVolley = weather.dataset.weather === "swords"
        ? swordVolleyRecognizer.sample(swordHand, now)
        : null;
      const environmentState = environmentFx.getState(now);
      const weatherAction = weatherRecognizer.sample(hands, now, { cloudLevel: environmentState.levels.cloud });
      const weatherProgress = weatherRecognizer.progress();
      const action = weatherProgress.engaged || magicFocus.active
        ? (recognizer.sample([], now), null)
        : recognizer.sample(hands, now);
      const charge = recognizer.progress();
      const feedback = magicFocus.active
        ? {
            phase: "charge",
            title: "FOCUS CIRCLE · HAI TAY CÁI + TRỎ",
            instruction: "Mở rộng hai tay để tăng vòng; nghiêng đường nối hai tay để xoay mặt phẳng.",
          }
        : weatherProgress.engaged
        ? {
            phase: "charge",
            title: weatherProgress.mode === "fog" ? "ĐANG ĐỌC LUỒNG SƯƠNG" : "ĐANG ĐỌC CHUYỂN ĐỘNG BẦU TRỜI",
            instruction: weatherProgress.mode === "fog"
              ? "Quét bàn tay mở sang ngang ở vùng thấp."
              : environmentState.levels.cloud > .15
                ? "Kéo hai tay xuống để gọi mưa, hoặc kéo vào nhau để gom thêm mây."
                : "Kéo hai bàn tay mở lại gần nhau để gom mây.",
          }
        : recognizer.feedback();
      coachTitle.textContent = feedback.title;
      coachInstruction.textContent = feedback.instruction;
      sealCoach.dataset.phase = feedback.phase;
      stage.classList.toggle("seal-locked", feedback.phase === "charge" || feedback.phase === "release");
      stage.classList.toggle("weather-gesture", weatherProgress.engaged);
      stage.classList.toggle("focus-circle", magicFocus.active);
      const activeAnchor = weather.dataset.weather === "lotus"
        ? lotusPoint
        : weather.dataset.weather === "orb"
          ? (orbGrip.anchor || center)
        : weather.dataset.weather === "lightning"
          ? (lightningAnchor || aimPoint)
          : (swordAnchor || center);
      const activeAim = weather.dataset.weather === "swords" && swordAim ? swordAim : aimPoint;
      weatherFx.setTracking({
        anchor: activeAnchor,
        aim: activeAim,
        span: weather.dataset.weather === "swords" ? swordSpan : weather.dataset.weather === "lightning" ? lightningSpan : null,
      });
      magic3d.setTracking({
        anchor: weather.dataset.weather === "lotus" ? lotusPoint : activeAnchor,
        aim: activeAim,
        grip: lotusPair.active ? lotusPair.grip : 1,
        span: weather.dataset.weather === "swords" ? swordSpan : null,
      });
      if (swordVolley && weatherFx.signalSwordVolley(swordVolley.target)) {
        aimPoint = swordVolley.target;
        weatherFx.setTracking({ anchor: swordAnchor, aim: swordVolley.target });
        stage.dataset.phase = "release";
        stage.dataset.fxPhase = "action";
        spellName.textContent = "✦ DETONATION";
        gestureCoach.textContent = "Điểm mục tiêu đã khóa. Vụ nổ đang giải phóng tại vị trí chỉ định!";
        status.textContent = "ARCANE DETONATION · Mục tiêu đã kích nổ!";
        clearTimeout(weatherTimer);
        spellEndsAt = performance.now() + 4200;
        weatherTimer = setTimeout(() => clearWeather(), 4200);
        setTimeout(() => {
          if (weather.dataset.weather !== "swords") return;
          environmentFx.disturb(swordVolley.target, .72, "86,205,255");
          stage.classList.remove("sword-impact");
          void stage.offsetWidth;
          stage.classList.add("sword-impact");
        }, 1850);
      }
      stage.classList.toggle("orb-grip", weather.dataset.weather === "orb" && orbGrip.active);
      lastAngle += (handAngleDegrees(hand) - lastAngle) * .18;
      stage.style.setProperty("--hand-angle", `${lastAngle}deg`);
      stage.style.setProperty("--hand-x", `${(1 - aimPoint.x) * 100}%`);
      stage.style.setProperty("--hand-y", `${aimPoint.y * 100}%`);
      document.querySelector("#hand-dot").style.cssText = `--x:${(1 - aimPoint.x) * 100}%;--y:${aimPoint.y * 100}%;`;
      if (weatherAction) showEnvironment(weatherAction.kind, weatherAction);
      else if (action?.startsWith("filter_")) applyFilter(action.slice(7), action === "filter_blur" ? "Làm mờ" : action === "filter_sharpen" ? "Làm nét" : "Lật ảnh");
      else if (action === "mist") {
        environmentFx.castFingerMist(mistSpan || [hand[4], hand[20]]);
        environmentHud.classList.add("visible");
        environmentLabel.textContent = "NEBULUS Â· SÆ¯Æ NG NGÃ“N TAY Â· 60 GIÃ‚Y";
        environmentBar.style.width = "100%";
        status.textContent = "NEBULUS: sÆ°Æ¡ng Ä‘ang phun tá»« Ä‘áº§u ngÃ³n cÃ¡i vÃ  ngÃ³n Ãºt, rá»“i trÃ´i trong khung hÃ¬nh 60 giÃ¢y.";
      } else if (action) {
        const origin = action === "lotus" ? lotusPoint : action === "orb" ? (orbGrip.anchor || center) : action === "lightning" ? (lightningAnchor || aimPoint) : (swordAnchor || center);
        showWeather(action, origin, action === "swords" ? swordAim : null);
      }
      else {
        if (environmentState.mist.remaining > 0) {
          environmentHud.classList.add("visible");
          environmentLabel.textContent = `NEBULUS · ${Math.ceil(environmentState.mist.remaining / 1000)} GIÂY`;
          environmentBar.style.width = `${environmentState.mist.remaining / 600}%`;
        } else if (magicFocus.active) {
          environmentHud.classList.add("visible");
          environmentLabel.textContent = "FOCUS CIRCLE";
          environmentBar.style.width = `${Math.round(Math.min(1, magicFocus.radius / .28) * 100)}%`;
        } else if (weatherProgress.engaged) {
          environmentHud.classList.add("visible");
          environmentLabel.textContent = weatherProgress.mode === "fog" ? "QUÉT TAY ĐỂ GỌI SƯƠNG" : "GOM MÂY / KÉO MƯA";
          environmentBar.style.width = `${Math.round(weatherProgress.value * 100)}%`;
        } else if (charge.kind) {
          const label = charge.kind === "swords" ? "TRỎ + GIỮA" : charge.kind === "mist" ? "CÁI + ÚT" : charge.kind === "lotus" ? "HAI LÒNG BÀN TAY" : charge.kind === "lightning" ? "CÁI + TRỎ" : charge.kind === "clear" ? "ĐẦU NGÓN · GÓC XÓA" : "ĐẦU NGÓN · VÙNG CHỨC NĂNG";
          spellName.textContent = `NẠP PHÉP · ${label}`;
          if (charge.kind === "swords") gestureCoach.textContent = "Giữ trỏ + giữa thẳng; khép cái, áp út và út.";
          spellCountdown.textContent = `${Math.round(charge.value * 100)}%`;
          spellBar.style.width = `${charge.value * 100}%`;
          stage.dataset.phase = "charge";
        }
        status.textContent = magicFocus.active
          ? "FOCUS CIRCLE đang bám theo khoảng cách và góc của hai tay."
          : weatherProgress.engaged
            ? "Chuyển động môi trường đang được nhận. Hãy hoàn tất đường quét."
            : "Giữ nguyên các ngón đang giơ đến khi thanh nạp đầy. Chương trình sẽ tự xuất chiêu.";
      }
    },
  });

  document.querySelector("#start-camera").addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    if (demo && !document.fullscreenElement) {
      document.querySelector(".camera-card")?.requestFullscreen?.().catch(() => {});
    }
    status.textContent = "Đang xin quyền mở camera…";
    try {
      await camera.ensure();
      stage.classList.add("camera-on");
      status.textContent = "Camera đã sẵn sàng. Mở SÁCH THỦ ẤN rồi chọn một đại chiêu.";
    } catch {
      status.textContent = "Chưa mở được camera. Bạn vẫn có thể dùng các nút mô phỏng.";
      event.currentTarget.disabled = false;
    }
  });

  document.querySelectorAll("[data-weather]").forEach(button => button.addEventListener("click", () => {
    const action = button.dataset.weather;
    if (action === "clear") clearWeather();
    else showWeather(action);
  }));
  document.querySelectorAll("[data-environment]").forEach(button => button.addEventListener("click", () => {
    showEnvironment(button.dataset.environment);
  }));
  document.querySelector("#mist-preview")?.addEventListener("click", () => {
    let value = 0;
    const hold = () => {
      value = Math.min(1, value + .055);
      const progress = { active: true, kind: "mist", value, best: { kind: "mist", score: value } };
      updateDwellZones(progress);
      updateRuneMatch(progress);
      if (value < 1) return requestAnimationFrame(hold);
      updateRuneMatch(progress, "mist");
      updateDwellZones({ active: false, value: 0 });
      activateDwellAtmosphere({ kind: "mist", point: { x: .5, y: .52 } });
    };
    requestAnimationFrame(hold);
  });
  document.querySelectorAll("[data-mist-palette]").forEach(button => button.addEventListener("click", () => {
    environmentFx.setMistPalette(button.dataset.mistPalette);
    document.querySelectorAll("[data-mist-palette]").forEach(item => item.classList.toggle("active", item === button));
    const colorName = document.querySelector("#mist-color-name");
    if (colorName) colorName.textContent = button.dataset.mistPalette === "pink" ? "Hồng pha lê" : button.dataset.mistPalette === "blue" ? "Xanh tinh vân" : "Tự chuyển sắc";
  }));
  document.querySelector("#mist-color")?.addEventListener("input", event => {
    environmentFx.setMistColor(event.currentTarget.value);
    document.querySelectorAll("[data-mist-palette]").forEach(item => item.classList.remove("active"));
    const colorName = document.querySelector("#mist-color-name");
    if (colorName) colorName.textContent = event.currentTarget.value.toUpperCase();
    status.textContent = `Màu lõi Nebulus đã đổi thành ${event.currentTarget.value.toUpperCase()}.`;
  });
  document.querySelector("#magic-focus-preview")?.addEventListener("click", () => showMagicFocus(!previewFocusActive));
  document.querySelector("#lotus-release")?.addEventListener("click", () => releaseLotus("button"));
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    applyFilter(button.dataset.filter, button.textContent.trim());
  }));
  const performanceButton = document.querySelector("#performance-mode");
  performanceButton?.addEventListener("click", event => {
    const target = document.querySelector(".camera-card");
    if (!document.fullscreenElement) target.requestFullscreen?.();
    else document.exitFullscreen?.();
    if (event.detail > 0) event.currentTarget.blur();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!performanceButton) return;
    const presenting = !!document.fullscreenElement;
    performanceButton.textContent = presenting ? "Thu nhỏ sân khấu" : "Toàn màn hình";
    performanceButton.setAttribute("aria-pressed", String(presenting));
  });
  document.querySelector("#record-performance")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    if (!recorder.recording) {
      try {
        recorder.start();
        button.classList.add("recording");
        button.textContent = "■ Dừng và tải video";
        status.textContent = "ĐANG QUAY · Hãy giơ tổ hợp ngón và biểu diễn đại chiêu.";
      } catch {
        status.textContent = "Trình duyệt này chưa hỗ trợ quay canvas. Hãy dùng Chrome hoặc Edge mới.";
      }
    } else {
      button.disabled = true;
      await recorder.stop();
      button.disabled = false;
      button.classList.remove("recording");
      button.textContent = "● Quay màn phép";
      status.textContent = "Video WebM đã được tải xuống máy.";
    }
  });
  mountSealGuide({ showWeather, showEnvironment, showMagicFocus, demo });
  addEventListener("keydown", event => {
    if (event.repeat || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
    const key = event.key.toLowerCase();
    if (key === "v") showWeather("swords");
    if (key === "f") showWeather("lotus");
    if (key === "l") showWeather("lightning");
    if (key === "e") showWeather("orb");
    if (key === "b") releaseLotus("keyboard");
    if (key === "7") showEnvironment("fog");
    if (key === "8") showEnvironment("cloud");
    if (key === "9") showEnvironment("rain");
    if (key === "0" || key === "escape") clearWeather();
  });

  if (!demo) mountExercises({ showWeather, stage });
  window.weatherLab = {
    showWeather,
    clearWeather,
    activateDwellAtmosphere,
    triggerIncantation,
    releaseLotus,
    showEnvironment,
    castFingerMist: (points, options) => environmentFx.castFingerMist(points, options),
    clearEnvironment: () => showEnvironment("clear"),
    showMagicFocus,
    setTracking: setSpellTracking,
    recognizer,
    fingerTrailRecognizer,
    environmentFx,
    cinematicFx: weatherFx,
    webglFx,
    magic3d,
    recorder,
    snapshot: () => recorder.snapshot(),
    get filter() { return filter; },
  };
  const preview = new URLSearchParams(location.search).get("preview");
  if (preview === "lotus") showWeather(preview);
  const updateCountdown = () => {
    if (spellEndsAt) {
      const remaining = Math.max(0, spellEndsAt - performance.now());
      const action = weather.dataset.weather;
      const total = WEATHER_DURATION[action] || 1;
      spellCountdown.textContent = `${(remaining / 1000).toFixed(1)}s`;
      spellBar.style.width = `${remaining / total * 100}%`;
    } else if (weather.dataset.weather === "lotus" && !lotusReleased) {
      const ripen = Math.min(1, Math.max(0, (performance.now() - spellStartedAt) / 6800));
      spellCountdown.textContent = ripen < 1 ? `${Math.round(ripen * 100)}%` : "VOICE";
      spellBar.style.width = `${ripen * 100}%`;
    }
    const environmentState = environmentFx.getState();
    const activeEnvironment = ["rain", "cloud", "fog"].filter(kind => environmentState.levels[kind] > .035);
    if (activeEnvironment.length) {
      const labels = { fog: "SƯƠNG", cloud: "MÂY", rain: "MƯA" };
      const primary = activeEnvironment[0];
      const remaining = Math.max(...activeEnvironment.map(kind => environmentState.remaining[kind]));
      environmentHud.classList.add("visible");
      environmentLabel.textContent = activeEnvironment.map(kind => labels[kind]).join(" + ");
      environmentBar.style.width = `${Math.min(100, remaining / 360)}%`;
    } else if (!fingerTrailRecognizer.progress().active) {
      environmentHud.classList.remove("visible");
      environmentBar.style.width = "0%";
      stage.removeAttribute("data-environment");
    }
    requestAnimationFrame(updateCountdown);
  };
  requestAnimationFrame(updateCountdown);
}

function mountSealGuide({ showWeather, showEnvironment, showMagicFocus, demo }) {
  const dialog = document.createElement("dialog");
  dialog.className = "seal-grimoire";
  dialog.innerHTML = `
    <div class="grimoire-head">
      <div><small>SÁCH NGHI THỨC · VFX LAB</small><h2>Chọn ấn. Giữ vững. Xuất chiêu.</h2></div>
      <button class="grimoire-close" aria-label="Đóng hướng dẫn">×</button>
    </div>
    <p class="grimoire-lead">Đứng cách camera khoảng một sải tay. Để các ngón tách rõ. Camera kiểm tra chính xác ngón nào đang giơ; một ngón trỏ còn có thể chọn vùng chức năng trên màn hình.</p>
    <div class="ritual-grid">
      <article class="ritual-card lightning">
        <div class="seal-motion"><b>👌</b></div>
        <small>01 · SẤM CHỚP</small><h3>Ngón cái + ngón trỏ</h3>
        <ol><li>Giơ ngón cái và ngón trỏ.</li><li>Gập ba ngón còn lại.</li><li>Giữ khoảng 0,5 giây.</li><li>Sét đánh vào trung điểm giữa hai đầu ngón.</li></ol>
        <strong>Code kiểm tra: thumb + index</strong><button data-preview-spell="lightning">Xem Thiên Lôi</button>
      </article>
      <article class="ritual-card swords">
        <div class="seal-motion"><b>✌️</b></div>
        <small>02 · KIẾM TRẬN</small><h3>Ngón trỏ + ngón giữa</h3>
        <ol><li>Giơ ngón trỏ và ngón giữa; gập ba ngón còn lại.</li><li>Giữ khoảng 0,6 giây để khóa vị trí hai ngón đang chỉ.</li><li>Giữ tay ổn định để điểm nổ bám đúng mục tiêu.</li><li>Đổi hướng hai ngón thật nhanh: chương trình kích hoạt vụ nổ tại vị trí đã khóa.</li></ol>
        <strong>Code kiểm tra: index + middle</strong><button data-preview-spell="swords">Xem Arcane Detonation</button>
      </article>
      <article class="ritual-card lotus">
        <div class="seal-motion"><b>👐</b></div>
        <small>03 · HỎA LIÊN · HOA VŨ</small><h3>Hai lòng bàn tay song song</h3>
        <ol><li>Mở hai bàn tay và đặt cạnh nhau.</li><li>Giữ hai cổ tay cùng hướng.</li><li>Giữ khoảng 0,8 giây để triệu hồi hoa ở chính giữa.</li><li>Chờ hoa đổi đỏ–tím rồi nói “BÙNG NỔ”.</li></ol>
        <strong>Code kiểm tra: two_open_parallel_palms</strong><button data-preview-spell="lotus">Xem Hỏa Liên · Hoa Vũ</button>
      </article>
      <article class="ritual-card lightning">
        <div class="seal-motion"><b>✊</b></div>
        <small>04 · ARCANE ENERGY ORB</small><h3>Nắm hờ một bàn tay</h3>
        <ol><li>Co bốn ngón vào như đang giữ một quả cầu nhỏ.</li><li>Giữ ngón cái mở để camera phân biệt với một nắm tay kín.</li><li>Chừa khoảng trống trong lòng bàn tay.</li><li>Giữ khoảng 0,7 giây; lõi sáng sẽ bám theo lòng bàn tay.</li></ol>
        <strong>Code kiểm tra: curled_fingers + open_thumb</strong><button data-preview-spell="orb">Xem Energy Orb</button>
      </article>
      <article class="ritual-card lightning">
        <div class="seal-motion"><b>◎</b></div>
        <small>05 · FOCUS CIRCLE</small><h3>Cái + trỏ ở cả hai tay</h3>
        <ol><li>Mỗi tay chỉ giơ ngón cái và ngón trỏ.</li><li>Đặt hai tay đối diện nhau.</li><li>Khoảng cách hai tay đổi kích thước vòng.</li><li>Nghiêng đường nối hai tay để xoay mặt phẳng vòng.</li></ol>
        <strong>Code kiểm tra: two_thumb_index_hands</strong><button id="guide-focus-preview">Xem Focus Circle</button>
      </article>
      <article class="ritual-card clear">
        <div class="seal-motion"><b>☁</b></div>
        <small>06 · ĐIỀU KHIỂN THỜI TIẾT</small><h3>Chuyển động tay + vùng màn hình</h3>
        <ol><li>Quét một tay mở ở vùng thấp để gọi sương.</li><li>Gom hai tay mở ở vùng cao để gọi mây.</li><li>Khi đã có mây, kéo hai tay xuống để gọi mưa.</li></ol>
        <strong>Code kiểm tra: hand_path + screen_zone</strong><button id="guide-weather-preview">Xem Mây · Mưa · Sương</button>
      </article>
      <article class="ritual-card clear">
        <div class="seal-motion"><b>☝</b></div>
        <small>07 · VÙNG CHỨC NĂNG</small><h3>Một ngón trỏ + một góc</h3>
        <ol><li>Chỉ giơ ngón trỏ.</li><li>Đưa đầu ngón vào MỜ, NÉT, LẬT hoặc XÓA.</li><li>Giữ khoảng nửa giây.</li></ol>
        <strong>Code kiểm tra: index + tip_zone</strong><button data-preview-spell="clear">Xóa hiệu ứng</button>
      </article>
    </div>
    <p class="grimoire-foot">Không nhận được tay? Giáo viên dùng các nút mô phỏng hoặc phím V · F · H · L. Camera chỉ xử lý ngay trong trình duyệt.</p>`;
  dialog.innerHTML = `
    <div class="grimoire-head">
      <div><small>SÁCH NGHI THỨC · VFX LAB</small><h2>Vẽ bùa. Nhận phép. Biểu diễn.</h2></div>
      <button class="grimoire-close" aria-label="Đóng hướng dẫn">×</button>
    </div>
    <p class="grimoire-lead">Đứng cách camera khoảng một sải tay. Hệ thống chỉ dùng hai loại INPUT: một đầu ngón trỏ để vẽ bùa, hoặc hai lòng bàn tay mở để triệu hồi Thanh Liên.</p>
    <div class="ritual-grid">
      <article class="ritual-card clear">
        <div class="seal-motion"><b>☝</b></div>
        <small>01 · BẮT ĐẦU VẼ</small><h3>Chỉ giơ ngón trỏ</h3>
        <ol><li>Đặt đầu ngón trong vùng CHẠM ĐỂ VẼ.</li><li>Kéo một nét liền, không nhảy khỏi khung hình.</li><li>Khép ngón hoặc hạ tay để xác nhận.</li><li>Đường bùa sẽ đổi thành OUTPUT tương ứng.</li></ol>
        <strong>Code kiểm tra: index_tip + path</strong>
      </article>
      <article class="ritual-card lotus">
        <div class="seal-motion"><b>○</b></div>
        <small>02 · NEBULUS</small><h3>Vẽ vòng khép kín</h3>
        <ol><li>Đi một vòng rồi quay về gần điểm đầu.</li><li>Lõi sáng, smoke và magic dust bám theo nét.</li><li>Khép ngón để hoàn tất.</li><li>Sương dâng và lưu lại khoảng 60 giây.</li></ol>
        <strong>Rune: closed_loop</strong><button id="guide-mist-preview">Xem Nebulus</button>
      </article>
      <article class="ritual-card clear">
        <div class="seal-motion"><b>— V │ 〽</b></div>
        <small>03 · PHÉP XỬ LÝ ẢNH</small><h3>Bốn nét, bốn OUTPUT</h3>
        <ol><li>Nét ngang → Blur.</li><li>Chữ V → Sharpen.</li><li>Nét dọc → Pixel.</li><li>Zigzag trái–phải → Cartoon.</li></ol>
        <strong>Code kiểm tra: classify(path_points)</strong>
      </article>
      <article class="ritual-card lotus">
        <div class="seal-motion"><b>👐</b></div>
        <small>04 · THANH LIÊN · HOA VŨ</small><h3>Hai lòng bàn tay mở</h3>
        <ol><li>Mở hai bàn tay và đặt cạnh nhau.</li><li>Giữ khoảng 0,8 giây.</li><li>Hoa xuất hiện tại trung điểm hai tay.</li><li>Nói “BÙNG NỔ” hoặc bấm KÍCH NỔ để cánh hoa rơi toàn màn hình.</li></ol>
        <strong>Code kiểm tra: two_open_parallel_palms</strong><button data-preview-spell="lotus">Xem Thanh Liên</button>
      </article>
    </div>
    <p class="grimoire-foot">Camera và đường landmark chỉ được xử lý ngay trong trình duyệt. Nút mô phỏng giúp giáo viên dạy khi lớp chưa cấp quyền camera.</p>`;
  document.body.appendChild(dialog);
  const close = () => { dialog.close(); sessionStorage.setItem("magicweather.guideSeen", "1"); };
  dialog.querySelector(".grimoire-close").addEventListener("click", close);
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  dialog.querySelectorAll("[data-preview-spell]").forEach(button => button.addEventListener("click", () => {
    const spell = button.dataset.previewSpell;
    if (spell === "clear") window.weatherLab?.clearWeather?.();
    else showWeather(spell);
    close();
  }));
  dialog.querySelector("#guide-mist-preview")?.addEventListener("click", () => {
    document.querySelector("#mist-preview")?.click();
    close();
  });
  dialog.querySelector("#guide-focus-preview")?.addEventListener("click", () => {
    showMagicFocus(true);
    close();
  });
  dialog.querySelector("#guide-weather-preview")?.addEventListener("click", () => {
    showEnvironment("fog", { intensity: .82, wind: .08 });
    showEnvironment("cloud", { intensity: .9 });
    showEnvironment("rain", { intensity: .74 });
    close();
  });
  document.querySelector("#seal-guide-button")?.addEventListener("click", () => dialog.showModal());
  if (demo && !new URLSearchParams(location.search).has("preview") && !sessionStorage.getItem("magicweather.guideSeen")) setTimeout(() => dialog.showModal(), 250);
}

function mountExercises({ showWeather, stage }) {
  const levelButtons = [...document.querySelectorAll("[data-level]")];
  const panels = [...document.querySelectorAll("[data-level-panel]")];
  const choose = level => {
    levelButtons.forEach(button => button.classList.toggle("active", button.dataset.level === level));
    panels.forEach(panel => panel.hidden = panel.dataset.levelPanel !== level);
  };
  levelButtons.forEach(button => button.addEventListener("click", () => choose(button.dataset.level)));
  choose("junior");

  document.querySelector("#check-junior").addEventListener("click", () => {
    const red = clampChannel(document.querySelector("#blank-red").value);
    const fireBlue = clampChannel(document.querySelector("#blank-blue").value);
    const action = document.querySelector("#blank-action").value;
    const ok = red === 255 && fireBlue === 20 && action === "lotus";
    const result = document.querySelector("#junior-result");
    result.textContent = ok
      ? "Chính xác! Bạn đã tạo màu lửa [255, 80, 20] và gọi đúng hiệu ứng lotus."
      : "Chưa khớp. Gợi ý: màu lửa là [255, 80, 20]; Hỏa Liên Ấn gọi lotus.";
    result.dataset.ok = String(ok);
    if (ok) showWeather("lotus");
  });

  document.querySelector("#check-senior").addEventListener("click", () => {
    const pathClosed = document.querySelector("#blank-index").value;
    const pathLongEnough = document.querySelector("#blank-little").value;
    const effect = document.querySelector("#blank-effect").value;
    const ok = pathClosed === "true" && pathLongEnough === "true" && effect === "mist";
    const result = document.querySelector("#senior-result");
    result.textContent = ok
      ? "Hợp lý! Nét đủ dài và quay về gần điểm đầu sẽ gọi mist."
      : "Kiểm tra lại: pathClosed = true, pathLongEnough = true, spellOutput = mist.";
    result.dataset.ok = String(ok);
    if (ok) {
      document.querySelector("#mist-preview")?.click();
    }
  });
}
