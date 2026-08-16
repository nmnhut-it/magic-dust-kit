# Knowledge Node — Subtracting Colour: Why Blurring Cannot Remove Red

**Source document for NotebookLM.** Feed this file in whole and ask for a slide deck or a
video overview. The final section is an outline NotebookLM can follow directly.

**Scope.** This node explains the *idea* behind Tasks 7 and 8 of Skin Lab
(`calm_redness`, `heal_spots`) — the colour half of the lab. It deliberately contains **no
solution code**: the student completes both functions themselves from a commented skeleton.
Everything here is concept, arithmetic, and the reason each design decision exists.

Skin Lab has ten tasks. The two after these (`choose_smooth_area`, `smooth_skin`) handle
*texture* rather than colour, and are a separate topic — this node deliberately stops at the
point where the redness is gone and the skin is still rough, because that is exactly where
the lesson turns. Do not let a generated summary blur the two halves together.

**Audience.** A learner who has finished Tasks 1–5 of Skin Lab and can already find skin
pixels and smooth them.

**Honesty note that must survive into any generated slides or narration:** this is image
processing, not medicine. It changes pixels in a photograph. It does not diagnose skin,
does not treat anything, and its output changes with lighting, camera, and background.

---

## 1. The thesis, in one sentence

Blurring moves colour around; only *replacing* colour can take colour away — so removing
redness is a different operation from smoothing, and needs its own function.

---

## 2. The moment this node answers

A student finishes Task 5, runs the smoothing filter on a real photo of a red spot, and
says: *it got softer, but it is still red.*

That reaction is correct, and it is not a bug. The student has just discovered, by
experiment, the exact limit of every averaging filter. This node explains why the limit
exists and what the next tool has to be.

---

## 3. What "red" is, as a number

The lab never asks "is this pixel red?" as a feeling. It computes a number:

```
redness = R - (G + B) / 2
```

Read it aloud as: *how far the red channel sticks out above the average of the other two.*

Why this shape and not simply `R`? Because a bright pixel has a high `R` and a dark pixel
has a low `R`, so `R` alone measures brightness at least as much as it measures colour. By
subtracting what green and blue are doing, the number reports only the *imbalance* —
the part that is genuinely red rather than merely bright.

Two anchor values used throughout Skin Lab, both from the lab's own worked example:

| Pixel | RGB | redness |
|---|---|---|
| A red spot | (225, 62, 66) | 225 − (62 + 66)/2 = **161** |
| Ordinary skin around it | (183, 127, 103) | 183 − (127 + 103)/2 = **68** |

So "healthy" is not redness 0. Skin is *supposed* to be somewhat red — 68 here. The goal
is never to drive redness to zero; it is to bring 161 down to about 68, the level of the
skin surrounding it. **The target is the neighbourhood, not zero.** This single idea is the
hinge of the whole node, and it is the one most likely to be lost in a summary.

---

## 4. The proof that blurring cannot get there

Take the red spot and apply the lab's 1-2-1 smoothing kernel — the centre pixel gets
weight 4, and the twelve surrounding skin-coloured contributions share the remaining
weight 12 out of 16 total:

```
R: (4 × 225 + 12 × 183) / 16 = 193.5  →  194
G: (4 ×  62 + 12 × 127) / 16 = 110.75 →  111
B: (4 ×  66 + 12 × 103) / 16 =  93.75 →   94
```

New pixel (194, 111, 94). New redness:

```
194 - (111 + 94) / 2 = 91.5
```

Now read the trajectory: **161 → 91.5**, against a target of **68**.

That is real progress, and it is why the smoothing step is worth teaching. But notice what
happened: the number fell because the *neighbours* were dragged into the average. Blurring
is a weighted average, and an average is always a compromise between the values fed into
it. It can never land outside the range of its own inputs.

State the law plainly, because it is the transferable lesson:

> **An average of a red area is still red.**

Push it to the extreme to make it undeniable. Suppose the spot is not one pixel but a
blotch fifty pixels across. Blur the middle of that blotch. Every neighbour inside the
kernel window is *also* red — there is no skin-coloured pixel anywhere near enough to pull
the average down. The middle comes out exactly as red as it went in. Bigger kernel, more
passes, more patience: none of it helps, because the inputs never change character. A
wider kernel makes the blotch *softer at the edges* and leaves the *centre* untouched.

This is why smoothing looks like it works on a tiny single-pixel dot and visibly fails on
a real blotch. The student who noticed "still red" was looking at a blotch.

---

## 5. The idea that does work: slide along a line

If averaging is stuck inside the range of its inputs, then introduce a value from outside.
Do not ask the neighbours what colour this pixel should be. *Decide* what colour it should
be, and move the pixel toward that decision.

Picture the two colours as two points:

```
  spot colour                                    target skin colour
  (225, 62, 66) ●------------------●------------● (183, 127, 103)
   redness 161              (partway)             redness 68
```

Every pixel that needs fixing takes a walk along the straight line between where it is and
where it should be. One number controls how far it walks. The lab calls that number
`strength`, and the mixing rule is one line, applied separately to R, then G, then B:

```
new_value = old_value × (1 - strength) + target_value × strength
```

Two properties worth pausing on, because both are load-bearing:

1. **The two shares always add up to 1.** `(1 - strength)` and `strength` sum to one, which
   means the result is a genuine blend and can never escape the 0–255 range on its own. No
   clamping needed for the blend itself.
2. **`strength` is a dial, not a switch.** At `0.0` the pixel does not move. At `1.0` it
   arrives exactly at the target. At `0.5` it stops halfway — redness
   `161 × 0.5 + 68 × 0.5 = 114.5`.

And now the contrast that justifies the whole node. Same spot, one step:

| Operation | redness after |
|---|---|
| Start | 161 |
| Smoothing, 1-2-1 kernel | 91.5 |
| Colour blend at strength 1.0 | **68** |

The blend lands on the target exactly, in one pass, and it lands there whether the spot is
one pixel or fifty pixels across — because it never consults the neighbours at all.

**Naming, so the vocabulary is not confusing:** "subtracting the colour" is what it looks
like; *replacing* the colour is what it is. Nothing is literally subtracted. The pixel is
overwritten with a mixture.

---

## 6. Where the target colour comes from

The blend needs a target, and the target must be *this face's* skin colour — not a
hard-coded value. A hard-coded skin tone works for one photo and is wrong for the next
person, the next lamp, the next camera.

So the target is measured from the photograph itself: take every pixel the skin mask
selected, add up the red values, the green values, and the blue values separately, and
divide each total by how many pixels were counted. An ordinary average, computed by hand,
with no kernel involved.

One question always comes up here, and it deserves a straight answer:

> *The spots are red, and the spots are on the skin — so aren't the red spots included in
> the average, dragging the target toward red and poisoning it?*

Yes, they are included. And it does not matter, for a reason worth internalising: a face
region holds tens of thousands of ordinary skin pixels and perhaps a few dozen spot
pixels. A few dozen values cannot meaningfully move an average built from tens of
thousands. The ordinary skin outvotes the spots by three or four orders of magnitude.

This is a genuine statistical intuition — *large samples are robust to small
contaminations* — arriving in a form a beginner can feel rather than be told. It is worth
a slide of its own.

---

## 7. From one spot to a whole face

The blend as described fixes pixels that someone has already marked. That was enough for
the toy example. On a real photograph it produces three visible failures, and each failure
motivates exactly one upgrade. This section is the heart of Task 8, and the three upgrades
are best taught as three *repairs*, never as a list of features.

### Failure 1 — the blotch survives, only its rim is treated

The earlier spot detector compared each pixel with the average of a 5×5 window around it.
For a lone red dot that works: the dot towers over its 25-pixel neighbourhood.

For a blotch ten pixels across, the 5×5 window sitting in the middle of the blotch is
*entirely inside the blotch*. The pixel is compared against other red pixels, finds itself
unremarkable, and is never marked. Only the blotch's rim — where the window straddles the
boundary — gets selected. The result is a treated ring around an untreated middle.

**Repair: widen the comparison area.** Use a comparison window substantially wider than the
blotch, so that even a pixel at the blotch's centre is measured against mostly-ordinary
skin and stands out properly. The tool does not change — it is the same local-average
filter used before, with a much larger size. Only the number changes.

The general principle, which transfers far beyond this lab: **a local comparison can only
detect a feature smaller than its own window.** Choose the window to match the size of what
is being looked for.

### Failure 2 — a visible patch with a hard edge

A yes/no mask means a pixel is either fully treated or fully untouched. Two pixels sitting
side by side, one just over the threshold and one just under, receive completely different
treatment. The eye is extremely good at detecting that boundary. The result reads as a
smeared sticker pasted onto the face — often *more* noticeable than the spot was.

**Repair: replace the yes/no mask with a continuous amount.** Instead of asking *is this
pixel red enough?*, ask *how red is it, compared with the wide area around it?* — and treat
it in proportion:

```
excess = this pixel's redness  -  the wide-area redness
share  = excess / span,  clipped into 0.0 .. 1.0
```

`span` is the tuning knob: the amount of excess redness that earns full treatment. A pixel
barely redder than its surroundings gets `share` near 0 and barely changes. A pixel deep
inside a strong blotch gets `share` at 1.0 and changes fully. In between, everything
fades smoothly.

Because `share` varies continuously from pixel to pixel, **there is no edge anywhere** —
the treatment dissolves into the surrounding skin instead of stopping at a line. This
"soft mask instead of hard mask" move is one of the most broadly useful ideas in the
entire lab, and it is worth naming as such.

Note also that `share` slots straight into the blend from Section 5, in place of
`strength`. It is the same one-line mixing rule, with a per-pixel amount instead of a
single global one.

### Failure 3 — the face goes flat

If every treated pixel aims at the *same* average skin colour, then every treated pixel
ends up the same brightness. Faces are not uniformly lit: a cheek is shaded, a nose bridge
catches light, a jawline falls into shadow. Painting one flat colour across those regions
erases the shading that makes the face read as a three-dimensional object. The output looks
like a mask or a plastic doll.

**Repair: scale the target to the local light.** Measure the brightness of the surrounding
skin — a second wide average, computed exactly like the wide redness — and compare it with
the brightness of the overall average skin colour:

```
scale  = brightness of the surrounding skin  /  brightness of the average skin colour
target = average skin colour × scale
```

In a shaded region `scale` is below 1 and the target darkens to match. In a bright region
it rises above 1 and the target brightens. The *colour* comes from the whole face; the
*light* comes from this specific location.

There is a second benefit that is easy to miss and pleasing when noticed. A raised spot
casts its own small shadow. That shadow lies within the treated area, so it is pulled
toward the locally-lit target as well — meaning the bump's shadow flattens out along with
its colour, and the spot stops reading as raised. The colour fix quietly performs a shape
fix.

### The three repairs together

| Failure observed | Cause | Repair |
|---|---|---|
| Only the rim of a blotch changes | Comparison window smaller than the blotch | Widen the comparison area |
| A visible patch with a hard edge | Yes/no mask | Continuous `share` in 0.0–1.0 |
| Face looks flat and plastic | One flat target colour everywhere | Scale the target by local brightness |

Each repair is one idea and answers one visible defect. If a generated slide deck presents
them as an undifferentiated feature list, it has lost the pedagogy — the failures are the
point, and each repair should be shown as the answer to something the student can see going
wrong.

---

## 8. The idea in one paragraph

Redness is a number: how far red sticks out above green and blue. Averaging filters can
only produce compromises between the pixels they are given, so inside a red area they
produce red — smoothing takes the lab's example spot from 161 down to 91.5 and stops, well
above the surrounding skin's 68. To go further, stop averaging and start replacing: measure
the face's own average skin colour, then slide each too-red pixel along the line toward
that colour, which reaches 68 exactly. Scaling that up to a real face needs three repairs
— compare over an area wider than the blotch, treat each pixel by a smooth amount rather
than a yes/no decision, and scale the target to the local brightness so the face keeps its
shading.

---

## 9. Glossary

- **Channel** — one of the three numbers in a pixel: red, green, or blue, each 0–255.
- **Redness** — `R - (G + B) / 2`. How far red exceeds the other two channels.
- **Mask** — a grid holding one decision per pixel: selected, or not selected.
- **Kernel** — the small grid of weights an averaging filter multiplies by.
- **Local average** — the mean of the values inside a window centred on each pixel.
- **Blend / interpolate** — move a value partway from where it is toward a target.
- **`strength`** — how far a pixel moves toward the target: 0.0 none, 1.0 all the way.
- **`share`** — a per-pixel `strength`, computed from how excessive that pixel's redness is.
- **`span`** — how much excess redness earns full treatment. The tuning knob for `share`.

---

## 10. Suggested outline for NotebookLM

Roughly ten beats. For a video overview, aim for 8–12 minutes.

1. **The complaint.** A student smooths a red spot. It gets softer. It is still red. Why?
2. **Redness is a number.** `R - (G+B)/2`. Spot = 161, surrounding skin = 68.
   *The target is 68, not 0.*
3. **Watch smoothing try.** The 1-2-1 arithmetic, 161 → 91.5. Real progress, short of 68.
4. **The law.** An average of a red area is still red. The fifty-pixel blotch: the middle
   has no non-red neighbours, so it cannot move. Extra passes do not help.
5. **The turn.** Stop averaging. Replace. Slide the pixel along a line toward a chosen
   colour: `old × (1 - strength) + target × strength`.
6. **Where the target comes from.** The face's own average skin colour. And why including
   the spots in that average does no harm — tens of thousands outvote a few dozen.
7. **The comparison.** 161 → 91.5 by smoothing, versus 161 → 68 by blending. Same spot.
8. **Three failures on a real face.** Rim-only treatment; the visible patch edge; the flat
   plastic look. Show each failure *before* naming its repair.
9. **Three repairs.** Wider comparison area; smooth `share` instead of a yes/no mask;
   target scaled by local brightness — plus the bonus that the bump's shadow flattens too.
10. **Close.** The transferable ideas: an average cannot leave the range of its inputs; a
    local comparison only sees features smaller than its window; soft amounts beat hard
    masks; large samples shrug off small contaminations.

### Instructions for the generator

- **Do not write or show implementation code.** The learner completes these two functions
  themselves. Formulas and arithmetic are welcome; loops and function bodies are not.
- **Stop at colour.** Removing roughness is the next pair of tasks, not this one. Ending on
  "the red is gone and the skin is still rough" is the correct cliffhanger.
- Keep every number exactly as given: 161, 68, 91.5, 194, 111, 94. They match what the
  notebook prints, and a learner will check.
- Lead with the failure, then the repair. Never present the three upgrades as a feature
  list.
- Do not imply any medical or dermatological capability. This edits a photograph.
  Say so once, plainly, near the end.
- Keep the tone matter-of-fact and curious. No hype about AI or beauty filters.

---

## 11. Provenance

Concepts and arithmetic are drawn from the Skin Lab source, kept deliberately in sync:

- `skin-lab/skin_filters.py` — Task 7 `calm_redness`, Task 8 `heal_spots` briefs.
- `skin-lab/assets/magic_mirror.py` — `show_red_gap_math` and `show_soften_math` supply the
  161 / 68 / 91.5 / (194, 111, 94) figures the notebook prints to the learner.

If the lab's numbers change, update this node and regenerate, or the video and the notebook
will disagree in front of a student.
