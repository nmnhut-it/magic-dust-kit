# Skin Lab

Skin Lab is a browser-based image-processing lesson served at `/skin-lab/`.
Students complete ten functions with NumPy, SciPy, and Pillow, wire them into
a pipeline of their own, and finish by writing — with no blanks — the program
that clears and smooths a real acne photograph. In the capstone,
they capture or select one still image, then Face Mesh and the image pipeline run
once on that image. There is no live video-processing activity.

Lesson structure (one continuous trail for young learners):

- Six numbered **Mechanism** sections (RGB pixel → RGB rule → neighbour vote →
  local redness → weighted smoothing → face gate), each with an interactive
  predict-before-code panel whose title carries the same number.
- Ten **Coding task N of 10** cells between them, in teaching order
  `skin_evidence → convolve_layer → detect_skin → detect_pimples →
  remove_pimples → average_skin_color → calm_redness → heal_spots →
  choose_smooth_area → smooth_skin`; the markdown
  note and the `# TASK N` starter comment use the same number, and every blanks
  note lists its `___` blanks one by one.
- **The authorship arc: scaffolded functions, then an unscaffolded program.**
  All ten task cells are fill-in-the-blank so nobody stalls on a blank page, but
  the two *driver* cells are where the real authorship lives, and the last one
  has no blanks at all. `skin-smooth-run` gives a plan in comments and the
  student writes `polish()`, `report()`, and the comparison loop themselves —
  four of their own functions held in mind at once. That is the point of the
  lesson's ending: not any single line, but assembling their own code.
- **Every task cell is a runnable scaffold — no blank pages.** All ten tasks
  are fill-in-the-blank over a skeleton that already contains the loops, the
  `.copy()`, the clamping and the explanatory comments; the `___` blanks are the
  ideas, never the plumbing. Blank counts: 3, 3, 2, 2, 2, 3, 3, 5, 3, 4. Tasks 7–8 used
  to be blank-body `raise NotImplementedError` cells written from a plan; they
  were converted to scaffolds so a student who stalls at task 7 still reaches the
  capstone. Task 7 hands them the red channel already written and asks for green
  and blue by analogy; task 8's five blanks are exactly the three ideas
  (wide comparison, soft `share`, brightness-scaled target), one per blank.
  `skin-build-pipeline` (a `student-work` cell after `skin_demo`) then has them
  assemble `my_pipeline` from the finished stages — four blanks to start, and an
  explicit invitation to reorder the stages, drop the smoothing, or pass the
  wrong mask and explain the damage. `skin-heal-run` is the capstone driver they
  write and tune. `test_skin_notebook` enforces the no-blank-page rule: every
  task cell must contain `___`, a `return`, and no `NotImplementedError`.
- **Colour, not only blur.** `skin-color-gap` states the limit the earlier
  pipeline hits — averaging inside a red blotch produces more red — and the two
  new tasks answer it: `average_skin_color` reduces the skin region to one target
  colour, `calm_redness` mixes the marked pixels toward it with
  `original × (1 - strength) + target × strength`. The student's own
  `skin-see-calm` cell and `preview_my_pipeline` report what changed before and
  after, so the effect is a number, not an impression.
- **These two functions loop on purpose.** Every earlier filter is vectorized
  because the capstone runs it on 320 × 240 pixels in the browser; the two colour
  tasks run only on the small teaching images, so they use a plain
  `for y / for x` loop with `getpixel`/`putpixel` — the code a student can read
  and trace. `test_teaching_helpers` enforces the split: the five whole-image
  filters must stay vectorized, the colour tasks may loop.
- **The student writes the seeing, not just the rule.** Every `preview_*` helper
  that ran a student function and displayed the result has been deleted from
  `magic_mirror.py`. Seven `skin-see-*` `student-work` cells replace them, and
  the only thing the library still supplies is `show_images(pictures, labels,
  columns)` — it lays labelled pictures on a grid, never reads a pixel and never
  runs a rule. Looking at your own output is half of image processing, so it is
  not something a helper should do behind the student's back.
  The seven cells are deliberately DRY: `skin-see-mask` has them write
  `mask_picture` and `skin-see-cleanup` has them write `difference_picture`,
  and `skin-see-pimples`, `skin-see-target` and `skin-see-calm` then reuse
  those, which is the point their notes make out loud. `skin-see-evidence`
  carries the idea the old black box hid — a mask value *is* a grey level, so
  `255` draws white and `0` draws black.
  `skin-see-calm` samples the reddest pixel **the mask selected**: the middle of
  a blotch is the reddest pixel overall and a 5 × 5 rule never selects it, so
  sampling that would print "no change" for a correct answer.
- A survival kit up front: cell-type legend, error first-aid table, and a
  glossary cell (`skin-glossary`).
- Four bundled photos (`assets/photos/`): the default index `0` is a real acne
  cheek (CC BY 4.0, credited) so the pipeline visibly has work to do; the lesson
  explains why the student's 5 × 5 rule may find nothing on real photographs,
  and the capstone answers it (adaptive threshold, `wide` 5 × 5 kernel default,
  red areas pulled toward the surrounding skin colour, red skin excluded from
  edge protection).
- **Which picture a cell shows is a decision, not an accident**, and
  `test_teaching_helpers` asserts it per function. Cells judged by eye use
  `demo_face_photo()` (the bundled portrait, `DEMO_PHOTO`): the filter and
  kernel galleries, `preview_numpy_filter`, `show_face_mesh_map`, `show_face_mask_pipeline`,
  and the `skin-see-convolution` / `skin-see-mask` cells — a blur
  or an edge kernel reads as nothing on flat cartoon colour. Cells where the
  student's own detector must be seen firing keep `skin_sample_image()`:
  `show_skin_sample`, `show_skin_pipeline_overview`, `skin_demo`, and the
  `skin-see-pimples` / `skin-see-cleanup` / `skin-see-target` / `skin-see-calm` cells. That is not timidity — the taught 5 × 5 rule
  selects **0** red pixels on the real acne photo at demo sizes, because the
  window sits inside the blotch, so a real photo there would read as "my correct
  code is broken" long before the lesson explains the limit.
- **The capstone is the student's own code, not a settings cell.** The old
  `kernel_choice` / `skin_smooth_strength` knob cell and `preview_pro_skin_pipeline`
  are gone. Task 8 `heal_spots` is the function that actually clears the bundled
  acne photo, and it is the student's own code — five blanks over a given loop,
  one blank per idea, not a settings knob. Three ideas make it work where the
  taught 5 x 5 rule cannot:
  1. a **comparison area wider than the blotch** (`ndimage.uniform_filter` with
     `radius`, the only library call the cell hands them) — inside a 5 x 5 window
     a wide blotch looks exactly like its own neighbours;
  2. a **soft 0..1 amount** (`share = excess / span`) instead of a yes/no mask, so
     there is no visible patch edge;
  3. a **target that keeps the local light**: the average skin colour scaled by the
     surrounding brightness, so shading survives and the bump's own shadow
     flattens with its colour.
  Measured on the bundled photo at 160 x 120: locally-red pixels 1811 -> 1193 after
  one pass, ~0.45 s per pass; two passes clear it visually while hair, lips and
  pores survive.
- **Colour and texture are two different jobs, and the lab now teaches both.**
  `heal_spots` changes *what colour* a pixel is and removes redness; it cannot
  touch roughness, because a bump the same colour as its neighbours is invisible
  to it. `smooth_skin` changes *how much neighbouring pixels differ* and removes
  roughness, using the student's own `convolve_layer` — which until now never ran
  on a real photograph at all. `skin-smooth-gap` states that split before the two
  tasks arrive. Measured on the bundled photo at 160 × 120 with two heal passes:
  locally-red pixels 2029 → 1041, roughness 5.11 → 2.96 at strength `0.7`, whole
  chain ≈ 0.6 s.
- **Face Mesh is taught before it is used, and is now student code.** The mesh
  cells moved above the last two tasks, and `FACE_MESH` documents the four
  landmark rings the lab actually uses (`oval`, `lips`, `leftEye`, `rightEye`,
  in `notebook.js` `FACE_RINGS`). The teaching point is that the face oval
  *contains* the lips and eyes, so "inside the face" ≠ "safe to smooth" —
  task 9 `choose_smooth_area` is the one line of mask algebra
  `skin & face & ~feature` that fixes it, and forgetting the `~` smooths only
  the lips and eyes. `notebook.js` builds a lips+eyes `featureMask` alongside
  the face mask via one shared `ringMaskBytes` helper (previously `Cam` and
  `Snapshot` each open-coded the polygon fill), and `_skin_snapshot` passes both
  to Python. Both mesh masks are optional: `None` means "allow everything" /
  "protect nothing", which is what the bundled photograph uses since it carries
  no landmarks.
- **The grader appears twice, and never fails a task nobody has reached.**
  `skin-check` sits mid-page (after task 7) and `skin-check-all` after task 10;
  `check_skin_code` skips any function not yet defined in `__main__`, prints it as
  `still to come further down the page`, and scores only what exists — `7/7` at the
  mid-page cell, `10/10` at the end. Adding a task below the mid-page grader is
  therefore safe.
- `skin-heal-run` is the student's driver: their own `for` loop over `passes`,
  their own `average_redness` measurement printed after each pass, and only one
  helper (`magic_mirror.show_before_after`) which draws pictures and does no
  filtering.
- After the one-photo capture, two button rows re-run **their** `heal_spots` on the
  same captured image (`Snapshot.renderPipeline` + `magic_mirror._set_snapshot_radius`
  / `_set_snapshot_passes`): comparison width `7/13/25` and passes `1/2/3` — the two
  variables the lesson asks them to defend. `_run_student_healer` repeats their
  function, keeps changes inside the Face Mesh boundary, and measures; it contains
  no filtering of its own. Both rows are built by `Snapshot.rerunRow` and run through
  `Snapshot.rerunWith`, so no row can forget to lock its buttons mid-run or to
  highlight the active choice.

Source files:

- `build_notebooks.py`: notebook content and cell order.
- `skin_filters.py`: student starter code.
- `skin_filters_solution.py`: worked code.
- `assets/magic_mirror.py`: numerical and visual explanations, image data, and grader.
- `assets/photos/`: three locally bundled CC0 images and their source notes.
- `assets/notebook.js`: notebook UI and `localStorage` autosave.
- `docs/redness-subtraction-node.md`: a standalone knowledge node explaining why
  averaging cannot remove redness and what tasks 7-8 do instead. Concepts and
  arithmetic only, no solution code, so it can be shown before the student writes
  either function. Written as a NotebookLM source document — feed it in whole to
  generate slides or a video overview; its closing section is the outline to
  follow. It reuses the notebook's own figures (161, 68, 91.5), so update it
  whenever `magic_mirror.show_red_gap_math` or `show_soften_math` change.

After changing a source file, regenerate the notebooks and run the checks:

```powershell
python build_notebooks.py
python -m unittest test_skin_project.py test_skin_notebook.py test_teaching_helpers.py
node --check assets/notebook.js
node test-skin-mechanisms.mjs
node test-skin-browser.mjs
```

Autosave stores code, progress, mechanism state, and the current cell in this
browser. Only cells holding student work restore from the save — the ten
`task:*` cells, the eleven `student-work` cells (transfer answers, the assembled
pipeline, the healing run, and the write-it-yourself smoothing program), and student-added `user-*` cells. Markdown and observation code
always load fresh from the deployed notebook: a save written by an older
release once restored a different `numpy-array` cell under the same id and
crashed the newer change-one-number demo. A captured or uploaded image is not
written to `localStorage`. Students can download the notebook to move their
code to another device.

Unfilled `___` blanks are translated for learners in both error paths: a cell
run appends "Replace every ___ with your answer …" (`notebook.js
shortenError`), and the grader prints "the function still contains ___ blanks …"
(`magic_mirror._try_skin`).
