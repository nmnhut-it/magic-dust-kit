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
browser. Only **code** cells restore from the save; markdown always loads fresh
from the deployed notebook, so teaching-text fixes reach returning students.
A captured or uploaded image is not written to `localStorage`. Students can
download the notebook to move their code to another device.

Unfilled `___` blanks are translated for learners in both error paths: a cell
run appends "Replace every ___ with your answer …" (`notebook.js
shortenError`), and the grader prints "the function still contains ___ blanks …"
(`magic_mirror._try_skin`).
