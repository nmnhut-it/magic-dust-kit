# PixieDust source

- `pixieDust.json` and `particle.png` were copied from the official Pixi
  Particle Emitter Editor preset at
  `https://particle-emitter-editor.pixijs.io/#pixieDust`.
- The editor source is released under the MIT License. The required license
  notice is preserved in `LICENSE.txt`.
- The runtime ports the preset's color, lifetime, frequency, scale and speed
  behavior to the existing Canvas 2D engine; it does not ship the old editor.
- Thanh Lien now renders as a live Three.js model so its petals can open,
  change color and rotate around the real Y axis. The reusable model/material
  source is in `lessons/weather-lab/lotus-3d.js`; the standalone inspection
  scene is `lessons/tools/blue-lotus-turntable.html`.
