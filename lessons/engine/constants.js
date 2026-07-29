// constants.js — tuning values + lookup tables shared across the node engine
// modules. Pure data, no DOM/state. Extracted verbatim from node.js.
export const SAGA_KEY = 'magicdust.saga';
export const STATS_KEY = 'magicdust.stats';
export const NPC_NAME = 'Pip';
export const HOLD_SEC = 2;                 // ritual fallback press-and-hold seconds
export const CAMERA_WAIT_MS = 5000;        // ritual: if the camera hasn't resolved (granted OR denied) by then, offer the hold-button fallback anyway — a permission prompt left un-answered otherwise leaves ensure() pending forever with no fallback ever shown
export const TYPE_MS = 17;                 // NPC bubble typewriter speed
export const OUTPUT_DWELL_MS = 1400;       // let the output land before Pip's next bubble steals attention
// RUN_HANG_MS — py-bridge.js's belt-and-suspenders run() watchdog: a cell
// that neither finishes (done/error) NOR pauses on an ask (fingers/keyboard)
// within this long is presumed a runaway loop wedging the worker thread
// itself (Atomics.wait/postMessage never even get a chance to run) — NOT
// caught by worker.onerror, since the thread hasn't crashed, just never
// yields. Generous: real waits (camera/typed input) reset it via bridge's
// ask-in-flight tracking, so this only fires for code that never asks/tells/
// finishes at all.
export const RUN_HANG_MS = 20000;
export const MONACO_VS = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs';

// ── act gates (splash/bundle/ritual hold-to-progress) ──
export const ACT_HOLD_MS = 900;

// ── quiz / anatomy hold-to-pick gates ──
export const QUIZ_HOLD_MS = 850, QUIZ_SPARKS = 14;

// ── quiz → boss reward: each correct pre-boss quiz answer boosts the boss
// fight's FIRST strike only (capped so a quiz-heavy node can't trivialize
// the fight — mastery of the boss round itself still has to do the rest) ──
export const QUIZ_BOSS_BONUS_PER = 10, QUIZ_BOSS_BONUS_CAP = 50;

// ── gift claim: rhythm-game timing catch (shrinking ring). The ring loops
// continuously (sawtooth 1.6x → 1.0x scale); a high-five ALWAYS claims the
// gift (no fail state — camera timing is inherently noisy), but catching it
// within PERFECT_WINDOW of the ring hitting 1.0x scale gets the flashier
// "PERFECT!" result instead of a plain "GOT IT".
export const GIFT_RING_PERIOD_MS = 1800, GIFT_PERFECT_WINDOW = 0.12;

// ── NPC bubble typewriter pacing ──
export const PAUSE_MS = 460, PAUSE_CH = '.!?…:';

// ── camera / gesture math ──
export const FT_EXT = 0.55, TH_RATIO = 1.05, HOLD_MS = 850;  // TH_RATIO: the HARD guard in thumbUp() (tip-4 vs IP-2 distance to pinky-MCP). It's an AND *before* the spread/angle OR, so if it's too strict the thumb is never counted no matter how wide it splays — loosened 1.12→1.05 (owner: "chưa được vụ ngón cái nữa - loosen thêm"). Doesn't cause false positives on its own (the OR still has to pass); it only stops blocking real thumbs at the guard.
// THUMB_SPREAD_MIN — second guard in camera-engine.js's thumbUp(): the
// thumb tip must also be this many handSize-units away from the index
// MCP(5) to count as extended, on top of the existing pinky-MCP ratio
// check — filters the "curled thumb resting across the palm" false
// positive that misread a real 1-finger hold as 2 (owner: "giơ 1 nó
// không nhận"). Tuned against both the existing extended-thumb fixtures
// (test-dispatcher.mjs's makeHand(4/5), ratio ~1.3) and a realistic
// curled-across-palm "index only" fixture (ratio ~0.74) — see
// test-camera-engine.mjs.
export const THUMB_SPREAD_MIN = 0.75;  // lateral-spread path of thumbUp()'s OR. Was 0.9→0.78; nudged to 0.75 (just above the curled-fixture floor 0.743). This metric alone had a painfully narrow valid band (0.743,1.208) that the owner's real hand kept falling into the dead zone of — so thumbUp() no longer relies on it alone (see THUMB_INDEX_COS_MAX).
// THUMB_INDEX_COS_MAX — second, orientation-invariant path of thumbUp()'s OR
// (see camera-engine.js#thumbAbductCos): the thumb counts as extended if the
// cosine of the angle between the thumb dir (1→4) and index dir (5→8) is AT
// OR BELOW this (i.e. the thumb splays at a WIDE angle from the index).
// Fixture cosines: curled-across-palm ≈ 0.876 (angle ~29°, must FAIL),
// open-palm ≈ 0.721 (angle ~44°, PASSES). Loosened 0.80→0.86 (owner: "loosen
// thêm") — accepts any thumb splayed wider than ~31° from the index, sitting
// just below the curled fixture's 0.876 so that still fails. This is the main
// path a real, orientation-foreshortened thumb now passes through; if it's
// STILL missed on a real webcam the gap to 0.876 is only ~0.016, so the fix
// is to capture a trace (window.__thumbTrace) and set this to the real
// hand's number rather than keep nudging blind.
export const THUMB_INDEX_COS_MAX = 0.86;
// HANDS_MODEL_COMPLEXITY — MediaPipe Hands model tier: 0=lite (fast, the
// default — school laptops were laggy on the tier-1 model), 1=full (more
// accurate landmarks, slower per-frame cost). Flip to 1 if lite ever proves
// too jittery for a gate that needs precision (see camera-engine.js).
export const HANDS_MODEL_COMPLEXITY = 0;
// LM_SMOOTH_ALPHA — EMA smoothing factor for the fingertip landmarks fed to
// BOTH the fingertip-fx dot and the swipe/track hit-test math (gesture-ui.js
// / gesture-dispatcher.js's onHands) — same smoothed value for both, or the
// visible dot and the actual hit-test point would disagree. Higher = snappier
// / less smoothing, lower = smoother/laggier. 1 = alias for old raw behavior.
export const LM_SMOOTH_ALPHA = 0.55;
export const ASK_GRACE_MS = 800;
export const ASK_CANCEL = '\x18';          // keep in sync with worker.js bridge.ask
// FINGER_ASK_FALLBACK_MS — a real player stuck on a fingerAsk() gesture (camera
// opens fine but the pose never registers — lighting/angle/hand quirks) had NO
// escape hatch: the typed #scask fallback only ever appeared when the camera
// failed to OPEN at all (cameraEngine.ensure() rejecting), never when it opened
// but simply never read the held pose. After this long with no successful
// read, reveal the typed fallback alongside the still-live camera gate (first
// one to resolve wins) — same "always give a tap/type way out" rule as
// boss-fight.js's KO mode fix.
export const FINGER_ASK_FALLBACK_MS = 12000;
// FINGER_ASK_STUB_MAX_RETRIES — the typed #scask fallback rejects a typed
// count that doesn't match {expect:…} and just re-prompts forever (no camera
// noise to eventually vary the read, unlike the live gesture gate) — a player
// who keeps mistyping (or a test harness retrying the same wrong guess) got
// stuck with no escape. Same "no dead ends" rule as every other gate in this
// codebase: after this many rejected attempts, stop enforcing `exp` and just
// accept whatever was typed.
export const FINGER_ASK_STUB_MAX_RETRIES = 4;

// ── photo booth ──
export const GESTURE_HOLD_MS = 700;
export const BOOTH_SIGNS = { 5: '✋', 1: '☝', 2: '✌' };

// ── casting ──
export const FX = { fire: { label: '🔥 FIRE', color: '#d69a20', bloom: 2.8 }, freeze: { label: '❄ FREEZE', color: '#78b2a5', bloom: 2.6 } }; // bloom strengths from the root SPELLS table (fireball/frost)
export const BURST_SPARKS = 26;
export const CAST_WIND_MS = 1300;

// ── ritual ──
export const GESTURE_FINGERS = { '✋': 5, '🖐': 5, '✌': 2, '☝': 1 };
export const RITUAL_SEC = 2.2, RITUAL_DECAY = 1.4;

// ── concept-chant ritual gate (RITUAL-VARIANTS-PLAN.md Part B): sign-hold
// + spoken word, same surge model as onboarding's "CODE!" gate (voice-gate.js
// + engine/chant-match.js#matchWord). No dead ends: no mic/SR → hold-only
// reaches 100% over a LONGER hold instead of stalling at the ceiling. ──
export const RITUAL_CHANT_CEILING = .7;    // sign-hold alone charges only to this ceiling while voice is available
export const RITUAL_CHANT_ARM_MIN = .3;    // charge must reach at least this before a chant match is allowed to surge to 100% (mirrors onboarding's ARM_MIN)
export const RITUAL_SEC_NOVOICE = 4;       // camera-hold ramp when no mic/SR (~1.8x RITUAL_SEC, matches onboarding's HOLD_MS/HOLD_NOVOICE_MS ratio)
export const HOLD_SEC_NOVOICE = 3.5;       // press-and-hold fallback (no camera) when ALSO no mic/SR (~1.75x HOLD_SEC)

// ── new gesture verbs (swipe / track): every one is a TWO-PHASE gate —
// ARM (hold ✋ open-palm steady so the student AND the camera have an
// unambiguous "locked on, tracking starts now" moment) then CAPTURE (a
// bounded window to actually perform the motion). This is the fix for the
// earlier failure mode: continuous detection with no arm phase gave no
// signal for whether to hold still or move, or whether the camera even
// saw the hand — see gesture-dispatcher.js#armSwipeGate/#armTrackGate.
// Tuned 2026-07-04 after owner feedback the swipe/track verbs felt laggy and
// unfun ("chưa được nhạy, cảm giác không fun") — every value below is a
// best-guess loosening (shorter arm, wider catch radius, more forgiving swipe
// window, longer capture so it re-arms less mid-attempt). STILL NEEDS a real
// webcam/hand pass to lock in for real — see lessons/traces/ + test-dispatcher.mjs
// to replay a recorded trace against these once the owner records one.
export const GESTURE_ARM_MS = 500;         // steady ✋ hold to lock on, before capture opens (already short — not raised further)
export const GESTURE_CAPTURE_MS = 3200;    // bounded window to perform the gesture; timeout re-arms (soft retry, no penalty) — was 2200, lengthened so it re-arms less often mid-attempt
export const SWIPE_MIN_DIST = 0.16;        // normalized fingertip travel (mirrored screen space) to count as a swipe — was 0.22, lowered for laggy camera latency
export const SWIPE_MAX_MS = 900;           // swipe must complete within this from its start sample — was 700, widened
export const TRACK_CATCH_RADIUS = 0.24;    // how close the tracked point must stay to a moving target (normalized coords) — was 0.12, then 0.18; widened again 2026-07-04 (tuned first-guess) once the hit-test switched to the whole-hand centroid (gesture-math.js#handCentroid) instead of a single jittery fingertip — a wider radius plus a stabler point is what actually fixes "hovering doesn't register"
export const TRACK_HOLD_MS = 750;          // how long it must stay within radius to count as "caught" — was 900, shortened

// ── THỢ RÈN forge gacha (FORGE-PLAN.md + owner add-on: "rèn hụt" retry loop)
// A forge attempt rolls against FORGE_SUCCESS_BASE; a FAIL never spends
// badges (the cost of failing is one extra practice question, not lost
// progress) and each practice CLEARED on retry adds
// FORGE_SUCCESS_BONUS_PER_PRACTICE to the odds (cumulative, capped at
// FORGE_SUCCESS_CAP = 1.0 → guaranteed within a few practices, so
// persistence always wins — no dead end). ──
export const FORGE_SUCCESS_BASE = 0.55;
export const FORGE_SUCCESS_BONUS_PER_PRACTICE = 0.20;
export const FORGE_SUCCESS_CAP = 1.0;
export const FORGE_BOMB_DAMAGE = 150;      // BOM MẬT NGỮ deploy: flat HP chunk knocked off the boss (FORGE-PLAN.md's "bùm chéo")
// FORGE endgame reframe (owner 2026-07-04): "rèn đồ để đánh boss, cuối cùng
// boss tan tành bằng BOM MẬT NGỮ" — the fight isn't necessarily won by any
// one hit anymore: rounds (quiz/code/swipe, unchanged) grind the boss down
// to EXPOSED (hp at or below this fraction of max); from there a bomb
// deploy is a GUARANTEED kill (see boss-fight.js#checkExposed/#deployBomb) —
// the narrative + mechanical finisher — but a normal STRIKE still works too,
// so a kid with zero bombs is never blocked from victory (no-dead-end).
export const BOSS_EXPOSE_HP_FRAC = 0.25;

// ── anatomy widget parts ──
export const ANATOMY = [
  { key: 'in',    art: 'assets/input-devices.webp',  name: 'INPUT',   fact: 'INPUT devices — how a machine LISTENS: keyboard, mouse, camera, microphone.' },
  { key: 'brain', art: 'assets/brain.webp',          name: 'PROCESS', fact: 'The PROCESSOR — the brain. It takes what came in and THINKS: math, decisions, rules.' },
  { key: 'out',   art: 'assets/output-devices.webp', name: 'OUTPUT',  fact: 'OUTPUT devices — how a machine SPEAKS: screen, speakers… or spells.' },
];
