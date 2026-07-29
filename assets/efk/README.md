# Your Effekseer effects go here

Magic Dust plays Effekseer particle effects at your fingertip. Out of the box it
uses small official **sample** effects streamed from a CDN (a confetti burst, a
plain ring, a beam, rising orbs) — fine, but not ornate. Drop your own exported
effects here to upgrade to real rune-circle / spell VFX. The app auto-detects
them; no code change needed.

## What the app looks for

`src/effekseer.js` loads these logical effects, trying `assets/efk/<name>.efkefc`
then `assets/efk/<name>.efk`, and only falls back to the CDN sample if neither
is present:

| File (either extension)      | When it plays                         | Good source (MAGICALxSPIRAL) |
|------------------------------|---------------------------------------|------------------------------|
| `charge.efkefc` / `.efk`     | while a spell charges (the rune circle / gather) | `MagicArea`, `Magic2_fire`, `Holy1` |
| `fireball.efkefc` / `.efk`   | Fireball cast burst                   | `Magic1_fire`, `FirePot2`, `Impact` |
| `lightning.efkefc` / `.efk`  | Chain Lightning cast                  | `Magic1_wind`, `Attack5`, `Lance4` |
| `cast.efkefc` / `.efk`       | expanding shockwave on any cast       | `Attack_Impact`, `Breakdown` |

## How to export from the Effekseer desktop editor

The great rune-circle packs (e.g. the free **MAGICALxSPIRAL** pack,
`https://effekseer.github.io/en/contributes/MAGICALxSPIRAL/index.html`) ship as
legacy `.efkproj` files, which the WebGL runtime can't read directly. Convert
once in the editor:

1. Install **Effekseer** (free): https://effekseer.github.io/
2. `File → Open` a `.efkproj` (e.g. `Magic1_fire.efkproj`). The editor upgrades it.
3. `File → Save As` → save into this folder as e.g. `fireball.efkefc`
   *(`.efkefc` is the runtime-loadable project format — this is all you need).*
4. Copy the pack's **`Texture/`** folder (and `Model/` if the effect uses meshes)
   into `assets/efk/` next to the file. Effects reference textures by relative
   path, so the folder layout must be preserved:
   ```
   assets/efk/
     fireball.efkefc
     charge.efkefc
     Texture/   ← the pack's PNGs
     Model/     ← only if the effect uses .efkmodel meshes
   ```
5. Reload the page. The console logs `[efk] using local fireball …` when yours
   is picked up.

## Sizing

Each effect's on-screen size is set by `EFK_SCALE` in `src/main.js`
(`{charge, fireball, lightning, ring}`, world units at the fingertip). Sample
effects are pre-tuned; your exports are authored at a different size, so nudge
those numbers after dropping files in. `window.magicDust.playEfk('fireball',0,0,0,SCALE)`
in the console is handy for finding the right value.

## License

Keep the license/attribution of whatever pack you export from. MAGICALxSPIRAL is
free for commercial and non-commercial use per its contribute page; bundle its
license note if you ship it.
