import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mechanisms = require("./assets/skin-mechanisms.js");

assert.deepEqual(
  mechanisms.calculateRgb({ red: 120, green: 80, blue: 40 }).redOnly,
  [120, 0, 0],
);

const skin = mechanisms.calculateRule({ red: 183, green: 127, blue: 103 });
assert.deepEqual(
  { brightness: skin.brightness, warmth: skin.warmth, redGreenGap: skin.redGreenGap, mask: skin.mask },
  { brightness: 137, warmth: 80, redGreenGap: 56, mask: 255 },
);
assert.equal(mechanisms.calculateRule({ red: 35, green: 80, blue: 185 }).mask, 0);

assert.deepEqual(
  mechanisms.calculateNeighbours({ cells: [1, 1, 1, 1, 0, 1, 0, 0, 1], threshold: 5 }),
  { count: 6, threshold: 5, accepted: true, mask: 255 },
);

const redSpot = mechanisms.calculateRedSpot();
assert.equal(redSpot.localAverage, 71.72);
assert.equal(Number(redSpot.gap.toFixed(2)), 89.28);
assert.equal(redSpot.expandedCount, 9);

const soften = mechanisms.calculateSoften({ mask: 255 });
assert.deepEqual(soften.softened, [194, 111, 94]);
assert.deepEqual(soften.checkpoint, [170, 110, 95]);
assert.deepEqual(mechanisms.calculateSoften({ mask: 0 }).output, [225, 62, 66]);

const blurFilter = mechanisms.calculateKernelFilter({ filter: "blur" });
assert.equal(blurFilter.total, 170);
assert.equal(Number(blurFilter.raw.toFixed(2)), 18.89);
assert.equal(mechanisms.calculateKernelFilter({ filter: "identity" }).clipped, 90);
assert.equal(mechanisms.calculateKernelFilter({ filter: "edge" }).total, 640);

const edgeScan = mechanisms.calculateConvolutionScan({ mode: "edge", row: 3, column: 3 });
assert.equal(edgeScan.sum, 3);
assert.equal(edgeScan.output[3][3], 3);
assert.equal(mechanisms.calculateConvolutionScan({ mode: "edge", row: 3, column: 5 }).sum, 0);
const largePatch = mechanisms.calculateConvolutionScan({ mode: "patch", row: 4, column: 4 });
assert.equal(largePatch.sum, 9);
assert.equal(largePatch.output[4][4], 255);
const isolatedDot = mechanisms.calculateConvolutionScan({ mode: "patch", row: 1, column: 1 });
assert.equal(isolatedDot.sum, 1);
assert.equal(isolatedDot.output[1][1], 0);

assert.deepEqual(mechanisms.calculateFace({ face: 1, skin: 0 }), {
  allowed: false,
  output: "Keep the original colour",
});
assert.equal(mechanisms.calculateFace({ face: 1, skin: 1 }).allowed, true);

console.log("Skin mechanisms OK: eight calculations match the lesson and scanning cases.");
