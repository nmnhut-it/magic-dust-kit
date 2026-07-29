// engine/ritual-theme.js — pure ritual theme resolution (RITUAL-VARIANTS-
// PLAN.md section A). Per-node visual variants (palette/circle geometry/
// glyphs/glow/scale/motion) layered onto ritual-vortex.js's particle engine.
// Content ships either a preset name (a RITUAL_THEMES key, one per motion
// style) or a partial config object; resolveTheme always returns the FULL
// shape below so the renderer never has to check for undefined keys. No
// theme (absent/undefined) resolves to DEFAULT_THEME — pixel-identical to
// the pre-theme-system look (hard backward-compat requirement). Pure/no-DOM
// so it's importable both by ritual-vortex.js (dynamic import — that file
// stays a classic script, not a module) and by test-ritual-theme.mjs.
export const MOTIONS = ['orbit', 'spiral-in', 'rain', 'pulse', 'comet'];
export const POLYS = ['triangle', 'square', 'penta', 'none'];
export const PALETTE_KEYS = ['core', 'dust', 'rune'];
export const CIRCLE_KEYS = ['rings', 'poly', 'spin'];
export const THEME_KEYS = ['palette', 'circle', 'glyphs', 'glow', 'scale', 'motion'];

export const DEFAULT_THEME = {
  palette: null,                                   // null → derive from the host's --c CSS var, as before
  circle: { rings: 3, poly: 'triangle', spin: 1 }, // today's hexagram + 3 secondary rings
  glyphs: '',                                       // '' → random runes (today's behaviour)
  glow: 1,
  scale: 1,
  motion: 'orbit',
};

// One preset per motion style — content may name one (`theme:'pulse'`) or
// ship a custom object (which may itself set `motion` to seed from one of
// these before its own keys win, see resolveTheme).
export const RITUAL_THEMES = {
  orbit: { motion: 'orbit' },
  'spiral-in': { motion: 'spiral-in', circle: { rings: 4, poly: 'square', spin: 1.2 }, glow: 1.1 },
  pulse: { motion: 'pulse', circle: { rings: 2, poly: 'square', spin: .8 }, glow: 1.15 },
  rain: { motion: 'rain', circle: { rings: 3, poly: 'none', spin: .6 }, glow: .95 },
  comet: { motion: 'comet', circle: { rings: 1, poly: 'penta', spin: 1.4 }, glow: 1.2, scale: 1.05 },
};

const mergeCircle = (base, over) => (over ? { ...base, ...over } : { ...base });

// resolveTheme(input) — input: undefined | preset-name string | partial
// object. Always returns the full DEFAULT_THEME shape (deep-cloned circle).
export function resolveTheme(input) {
  if (input == null) return { ...DEFAULT_THEME, circle: mergeCircle(DEFAULT_THEME.circle) };
  if (typeof input === 'string') {
    const preset = RITUAL_THEMES[input];
    if (!preset) return { ...DEFAULT_THEME, circle: mergeCircle(DEFAULT_THEME.circle) }; // unknown name: validator's job to catch; fail safe at runtime
    return { ...DEFAULT_THEME, ...preset, circle: mergeCircle(DEFAULT_THEME.circle, preset.circle), palette: preset.palette ?? DEFAULT_THEME.palette };
  }
  const seed = input.motion && RITUAL_THEMES[input.motion] ? RITUAL_THEMES[input.motion] : {};
  const merged = { ...DEFAULT_THEME, ...seed, ...input };
  merged.circle = mergeCircle(mergeCircle(DEFAULT_THEME.circle, seed.circle), input.circle);
  merged.palette = input.palette ?? seed.palette ?? DEFAULT_THEME.palette;
  return merged;
}

// themeIssues(input) — validator hook: returns an array of plain-English
// problem strings (empty = valid). Kept format-agnostic (strings, not
// {level,path,msg}) so the caller (validate-content.mjs) can wrap them in
// its own issue shape without this module knowing about it.
export function themeIssues(input) {
  const out = [];
  if (input == null) return out;
  if (typeof input === 'string') { if (!RITUAL_THEMES[input]) out.push(`unknown ritual theme preset "${input}" — allowed: ${Object.keys(RITUAL_THEMES).join(', ')}`); return out; }
  if (typeof input !== 'object' || Array.isArray(input)) { out.push('ritual.theme must be a preset name string or a config object'); return out; }
  for (const k of Object.keys(input)) if (!THEME_KEYS.includes(k)) out.push(`unknown ritual.theme key "${k}" — allowed: ${THEME_KEYS.join(', ')}`);
  if (input.motion !== undefined && !MOTIONS.includes(input.motion)) out.push(`unknown ritual.theme.motion "${input.motion}" — allowed: ${MOTIONS.join(', ')}`);
  if (input.palette !== undefined) {
    if (typeof input.palette !== 'object' || Array.isArray(input.palette)) out.push('ritual.theme.palette must be an object {core,dust,rune}');
    else for (const k of Object.keys(input.palette)) if (!PALETTE_KEYS.includes(k)) out.push(`unknown ritual.theme.palette key "${k}" — allowed: ${PALETTE_KEYS.join(', ')}`);
  }
  if (input.circle !== undefined) {
    if (typeof input.circle !== 'object' || Array.isArray(input.circle)) out.push('ritual.theme.circle must be an object {rings,poly,spin}');
    else {
      for (const k of Object.keys(input.circle)) if (!CIRCLE_KEYS.includes(k)) out.push(`unknown ritual.theme.circle key "${k}" — allowed: ${CIRCLE_KEYS.join(', ')}`);
      if (input.circle.poly !== undefined && !POLYS.includes(input.circle.poly)) out.push(`unknown ritual.theme.circle.poly "${input.circle.poly}" — allowed: ${POLYS.join(', ')}`);
    }
  }
  return out;
}
