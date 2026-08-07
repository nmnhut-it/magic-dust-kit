# Skin Lab

Skin Lab is a browser-based image-processing lesson served at `/skin-lab/`.
Students complete five functions with NumPy, SciPy, and Pillow. In the capstone,
they capture or select one still image, then Face Mesh and the image pipeline run
once on that image. There is no live video-processing activity.

Lesson structure (one continuous trail for young learners):

- Six numbered **Mechanism** sections (RGB pixel → RGB rule → neighbour vote →
  local redness → weighted smoothing → face gate), each with an interactive
  predict-before-code panel whose title carries the same number.
- Five **Coding task N of 5** cells between them, in teaching order
  `skin_evidence → convolve_layer → detect_skin → detect_pimples →
  remove_pimples`; the markdown note and the `# TASK N` starter comment use the
  same number, and every note lists its `___` blanks one by one.
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
  kernel galleries, `preview_numpy_filter`, `preview_library_convolution`,
  `preview_skin_mask`, `show_face_mesh_map`, `show_face_mask_pipeline` — a blur
  or an edge kernel reads as nothing on flat cartoon colour. Cells where the
  student's own detector must be seen firing keep `skin_sample_image()`:
  `show_skin_sample`, `show_skin_pipeline_overview`, `preview_pimple_mask`,
  `preview_cleanup`, `skin_demo`. That is not timidity — the taught 5 × 5 rule
  selects **0** red pixels on the real acne photo at demo sizes, because the
  window sits inside the blotch, so a real photo there would read as "my correct
  code is broken" long before the lesson explains the limit.
- After the one-photo capture, kernel buttons under the result re-run the
  pipeline on the same captured image (`Snapshot.renderPipeline` +
  `magic_mirror._set_snapshot_kernel`), so students compare `gentle/balanced/
  strong 3×3` against `wide 5×5` and `widest 9×9` hands-on without reopening the
  camera; a custom `kernel_options` entry typed in the settings cell wins over
  the canonical weights. A second row (`_set_snapshot_strength`, 25/55/85/100%)
  writes `skin_smooth_strength`, so students can separate *which colour is
  calculated* (kernel) from *how much of it is used* (strength) on one
  photograph. Both rows are built by `Snapshot.rerunRow` and run through
  `Snapshot.rerunWith`, so no row can forget to lock its buttons mid-run or to
  highlight the active choice. `magic_mirror.KERNEL_SHAPES` is the single list of
  accepted sizes — `(3, 3)`, `(5, 5)`, `(9, 9)` — read by both the button
  handler and the capstone settings check. One 9 × 9 re-run of the whole
  pipeline takes about 0.5 s in the browser at 320 × 240, so the button stays a
  press-and-look comparison; the lesson states plainly that at
  `skin_smooth_strength = 0.55` the measured gap between 5 × 5 and 9 × 9 is
  small, and asks students to judge it by the changed-pixel count.

Source files:

- `build_notebooks.py`: notebook content and cell order.
- `skin_filters.py`: student starter code.
- `skin_filters_solution.py`: worked code.
- `assets/magic_mirror.py`: numerical and visual explanations, image data, and grader.
- `assets/photos/`: three locally bundled CC0 images and their source notes.
- `assets/notebook.js`: notebook UI and `localStorage` autosave.

After changing a source file, regenerate the notebooks and run the checks:

```powershell
python build_notebooks.py
python -m unittest test_skin_project.py test_skin_notebook.py test_teaching_helpers.py
node --check assets/notebook.js
node test-skin-mechanisms.mjs
node test-skin-browser.mjs
```

Autosave stores code, progress, mechanism state, and the current cell in this
browser. Only cells holding student work restore from the save — the five
`task:*` cells, the two `student-work` cells (transfer answers and capstone
settings), and student-added `user-*` cells. Markdown and observation code
always load fresh from the deployed notebook: a save written by an older
release once restored a different `numpy-array` cell under the same id and
crashed the newer change-one-number demo. A captured or uploaded image is not
written to `localStorage`. Students can download the notebook to move their
code to another device.

Unfilled `___` blanks are translated for learners in both error paths: a cell
run appends "Replace every ___ with your answer …" (`notebook.js
shortenError`), and the grader prints "the function still contains ___ blanks …"
(`magic_mirror._try_skin`).
