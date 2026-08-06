# Skin Lab

Skin Lab is a browser-based image-processing lesson served at `/skin-lab/`.
Students complete five functions with NumPy, SciPy, and Pillow. In the capstone,
they capture or select one still image, then Face Mesh and the image pipeline run
once on that image. There is no live video-processing activity.

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
node test-skin-browser.mjs
```

Autosave stores code, progress, mechanism state, and the current cell in this
browser. A captured or uploaded image is not written to `localStorage`.
Students can download the notebook to move their code to another device.
