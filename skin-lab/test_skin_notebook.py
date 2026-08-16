import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TASKS = (
    "convolve_layer",
    "skin_evidence",
    "detect_skin",
    "detect_pimples",
    "remove_pimples",
    "average_skin_color",
    "calm_redness",
    "heal_spots",
    "choose_smooth_area",
    "smooth_skin",
)


def source(cell):
    value = cell.get("source", "")
    return "".join(value) if isinstance(value, list) else value


def code_blanks(text):
    """Count ___ blanks the student actually fills, ignoring the comments that describe them."""
    return sum(line.count("___") for line in text.splitlines()
               if not line.lstrip().startswith("#"))


class TestSkinNotebook(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.practice = json.loads((ROOT / "Skin_Lab.ipynb").read_text(encoding="utf-8"))
        cls.answers = json.loads((ROOT / "Skin_Lab_Answers.ipynb").read_text(encoding="utf-8"))

    def test_skin_routes_are_relative_and_keep_the_main_route_available(self):
        practice_page = (ROOT / "index.html").read_text(encoding="utf-8")
        answer_page = (ROOT / "dap-an.html").read_text(encoding="utf-8")
        self.assertIn('notebook: "Skin_Lab.ipynb"', practice_page)
        self.assertIn("assets/notebook.js?v=2026.08.07.2", practice_page)
        self.assertIn("assets/skin-mechanisms.js?v=2026.08.07.2", practice_page)
        self.assertIn('href="dap-an.html"', practice_page)
        self.assertIn('href="../index.html"', practice_page)
        self.assertIn('notebook: "Skin_Lab_Answers.ipynb"', answer_page)
        self.assertIn("assets/notebook.js?v=2026.08.07.2", answer_page)
        self.assertIn('href="./"', answer_page)
        self.assertIn('href="../index.html"', answer_page)

    def test_each_task_is_a_stable_autoload_cell_with_the_matching_function(self):
        for notebook, code_path in (
            (self.practice, ROOT / "skin_filters.py"),
            (self.answers, ROOT / "skin_filters_solution.py"),
        ):
            module_source = code_path.read_text(encoding="utf-8")
            cells_by_tag = {
                tag.removeprefix("task:"): cell
                for cell in notebook["cells"]
                for tag in cell.get("metadata", {}).get("tags", [])
                if tag.startswith("task:")
            }
            self.assertEqual(set(cells_by_tag), set(TASKS))
            for task in TASKS:
                cell = cells_by_tag[task]
                self.assertIn("autoload", cell["metadata"]["tags"])
                self.assertEqual(cell["id"], "task-" + task.replace("_", "-"))
                self.assertRegex(source(cell), rf"def\s+{task}\s*\(")
                self.assertIn(f"def {task}(", module_source)

    def test_lesson_shows_the_exact_number_substitutions(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        for phrase in (
            "8 × 10 + 1 × 90 = 170",
            "170 / 9 = 18.89",
            "brightness = (183 + 127 + 103) // 3 = 413 // 3 = 137",
            "1 + 1 + 1 + 1 + 0 + 1 + 1 + 1 + 1 = 8",
            "8 >= 5",
            "89.28",
            "(194, 111, 94)",
        ):
            self.assertIn(phrase, lesson)

    def test_numpy_scipy_and_pillow_are_the_main_implementation_path(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        for phrase in (
            "np.asarray", ".shape", "np.where", "np.clip", "Image.fromarray",
            "ndimage.convolve", "ndimage.uniform_filter", "ndimage.maximum_filter",
            "You do not need a Python loop for every row and column",
        ):
            self.assertIn(phrase, lesson)
        self.assertNotIn("not part of the five required functions", lesson)

    def test_students_see_a_literal_rgb_matrix_before_image_filters(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        matrix_cell = next(cell for cell in self.practice["cells"] if cell["id"] == "numpy-array")
        matrix_source = source(matrix_cell)
        self.assertIn("np.array([", matrix_source)
        self.assertIn("[background, skin,       red_spot,   skin,       background]", matrix_source)
        self.assertIn('print("R matrix:', matrix_source)
        self.assertIn('print("G matrix:', matrix_source)
        self.assertIn('print("B matrix:', matrix_source)
        self.assertIn("NumPy starts counting both at **0**", lesson)
        self.assertIn("`pixels[2, 2]`", lesson)
        self.assertNotIn("`pixels[3, 3]`", lesson)
        self.assertLess(lesson.index("5 × 5 colour matrix"), lesson.index("turn RGB evidence into 0 or 255"))

    def test_every_stage_has_numbers_images_and_explanatory_preview(self):
        ids = {cell["id"] for cell in self.practice["cells"]}
        for cell_id in (
            "skin-pixel-channels", "numpy-channels", "skin-convolution-math",
            "numpy-change-one-number", "skin-mechanism-kernel-filter",
            "skin-rgb-convolution", "skin-mechanism-convolution-scan",
            "skin-convolution-transfer",
            "skin-preview-convolution", "skin-preview-evidence", "skin-preview-mask",
            "skin-preview-pimples", "skin-preview-cleanup", "skin-demo",
            "skin-mechanism-rgb", "skin-mechanism-rule", "skin-mechanism-neighbours",
            "skin-mechanism-red-spot", "skin-mechanism-soften", "skin-mechanism-face",
        ):
            self.assertIn(cell_id, ids)
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        self.assertIn("numbers show the calculation", lesson)
        self.assertIn("exact selected locations", lesson)

    def test_six_mechanisms_have_stable_concept_tags(self):
        concepts = {
            tag.removeprefix("concept:"): cell
            for cell in self.practice["cells"]
            for tag in cell.get("metadata", {}).get("tags", [])
            if tag.startswith("concept:")
        }
        self.assertEqual(set(concepts), {
            "rgb_pixel", "rgb_rule", "neighbours", "kernel_filter", "convolution_scan",
            "red_spot", "soften", "face_gate",
        })
        for concept, cell in concepts.items():
            self.assertIn(f'show_mechanism("{concept}")', source(cell))

    def test_learner_prose_defines_terms_and_avoids_translated_shorthand(self):
        markdown = "\n".join(
            source(cell) for cell in self.practice["cells"] if cell["cell_type"] == "markdown"
        )
        self.assertIn("`skin_mask`: white (`255`)", markdown)
        self.assertIn("black (`0`) means", markdown)
        self.assertIn("NumPy array", markdown)
        self.assertIn("up to 478 landmark points", markdown)
        for phrase in (
            "hình màu/overlay", "cho phiếu", "ba đèn R, G, B",
            "không tin một pixel", "API thư viện", "NumPy array mới shape",
        ):
            self.assertNotIn(phrase.lower(), markdown.lower())

    def test_student_facing_lesson_and_route_are_english(self):
        notebook_text = "\n".join(source(cell) for cell in self.practice["cells"])
        route_text = "\n".join((
            (ROOT / "index.html").read_text(encoding="utf-8"),
            (ROOT / "dap-an.html").read_text(encoding="utf-8"),
            (ROOT / "assets" / "skin-mechanisms.js").read_text(encoding="utf-8"),
        ))
        for old_phrase in (
            "Em cần viết", "Dữ liệu đã cho sẵn", "Chụp một tấm", "Vùng da",
            "Kết quả:", "Cơ chế", "Bài giải", "Chạy tất cả", "Chọn ảnh từ máy",
        ):
            self.assertNotIn(old_phrase, notebook_text)
            self.assertNotIn(old_phrase, route_text)

    def test_tasks_name_given_input_process_and_output(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        for task in TASKS:
            task_text = next(
                source(cell)
                for cell in self.practice["cells"]
                if cell["id"] == "skin-task-" + {
                    "convolve_layer": "convolve-note",
                    "skin_evidence": "evidence-note",
                    "detect_skin": "detect-note",
                    "detect_pimples": "pimple-note",
                    "remove_pimples": "remove-note",
                    "average_skin_color": "average-note",
                    "calm_redness": "calm-note",
                    "heal_spots": "heal-note",
                    "choose_smooth_area": "area-note",
                    "smooth_skin": "smooth-note",
                }[task]
            )
            self.assertIn("**Given:**", task_text)
            self.assertIn("INPUT", task_text)
            self.assertIn("PROCESS", task_text)
            self.assertIn("OUTPUT", task_text)
        self.assertIn("A captured or uploaded image is never", lesson)

    def test_task_notes_and_starter_comments_agree_on_one_numbering(self):
        note_ids = {
            "skin_evidence": "skin-task-evidence-note",
            "convolve_layer": "skin-task-convolve-note",
            "detect_skin": "skin-task-detect-note",
            "detect_pimples": "skin-task-pimple-note",
            "remove_pimples": "skin-task-remove-note",
            "average_skin_color": "skin-task-average-note",
            "calm_redness": "skin-task-calm-note",
            "heal_spots": "skin-task-heal-note",
            "choose_smooth_area": "skin-task-area-note",
            "smooth_skin": "skin-task-smooth-note",
        }
        blank_counts = {
            "skin_evidence": "three", "convolve_layer": "three",
            "detect_skin": "two", "detect_pimples": "two", "remove_pimples": "two",
            "average_skin_color": "three", "calm_redness": "three",
            "heal_spots": "five", "choose_smooth_area": "three",
            "smooth_skin": "three",
        }
        teaching_order = (
            "skin_evidence", "convolve_layer", "detect_skin",
            "detect_pimples", "remove_pimples", "average_skin_color",
            "calm_redness", "heal_spots", "choose_smooth_area", "smooth_skin",
        )
        cells = {cell["id"]: cell for cell in self.practice["cells"]}
        for number, task in enumerate(teaching_order, start=1):
            note = source(cells[note_ids[task]])
            code = source(cells["task-" + task.replace("_", "-")])
            self.assertIn(f"Coding task {number} of 10 — complete `{task}`", note)
            self.assertIn(f"fill the {blank_counts[task]} `___` blanks", note)
            self.assertIn(f"# TASK {number} - fill the {blank_counts[task]} ___ blanks", code)

    def test_the_colour_task_is_a_scaffold_with_one_channel_worked(self):
        """Task 7 hands over a runnable skeleton; only the ideas are blank."""
        cells = {cell["id"]: cell for cell in self.practice["cells"]}
        note = source(cells["skin-task-calm-note"])
        code = source(cells["task-calm-redness"])
        self.assertIn("Coding task 7 of 10 — complete `calm_redness`", note)
        self.assertNotIn("raise NotImplementedError", code)
        # The loop, the copy and the red channel are given, not written by the student.
        self.assertIn('result = img.convert("RGB").copy()', code)
        self.assertIn("keep = 1 - strength", code)
        self.assertIn("round(red * keep + skin_color[0] * strength)", code)
        self.assertEqual(code_blanks(code), 3)
        answer = source({cell["id"]: cell for cell in self.answers["cells"]}["task-calm-redness"])
        self.assertNotIn("___", answer)

    def test_a_task_below_the_grader_is_never_reported_as_a_failure(self):
        """The mid-page grader runs before task 8 exists; that must not read as FIX."""
        cells = [cell["id"] for cell in self.practice["cells"]]
        self.assertLess(cells.index("skin-check"), cells.index("task-heal-spots"))
        self.assertLess(cells.index("task-heal-spots"), cells.index("skin-check-all"))
        helpers = (ROOT / "assets" / "magic_mirror.py").read_text(encoding="utf-8")
        self.assertIn("still to come further down the page", helpers)
        self.assertIn("if not callable(getattr(__main__, task_id, None)):", helpers)
        note = source({c["id"]: c for c in self.practice["cells"]}["skin-check-note"])
        self.assertIn("Result: 7/7 parts correct.", note)
        self.assertIn("Result: 10/10 parts correct.", note)
        final = {c["id"]: c for c in self.practice["cells"]}["skin-check-all"]
        self.assertEqual(source(final), "magic_mirror.check_skin_code()")

    def test_the_capstone_task_is_also_a_scaffold(self):
        """Task 8's five blanks are the three ideas; the loop is given."""
        cells = {cell["id"]: cell for cell in self.practice["cells"]}
        note = source(cells["skin-task-heal-note"])
        code = source(cells["task-heal-spots"])
        self.assertIn("Coding task 8 of 10 — complete `heal_spots`", note)
        self.assertIn("it is code, not settings", note)
        self.assertNotIn("raise NotImplementedError", code)
        self.assertIn("uniform_filter", code)          # the one given library call
        self.assertIn("result.putpixel((x, y), tuple(healed))", code)
        self.assertEqual(code_blanks(code), 5)
        answers = {cell["id"]: cell for cell in self.answers["cells"]}
        worked = source(answers["task-heal-spots"])
        self.assertNotIn("___", worked)
        self.assertIn("result.putpixel", worked)

    def test_no_task_cell_ever_hands_the_student_a_blank_page(self):
        """The whole point of the rewrite: eight scaffolds, zero empty bodies."""
        cells = {cell["id"]: cell for cell in self.practice["cells"]}
        for task in TASKS:
            code = source(cells["task-" + task.replace("_", "-")])
            self.assertNotIn("raise NotImplementedError", code)
            self.assertGreater(code_blanks(code), 0, f"{task} has no blanks to fill")
            self.assertIn("return", code)

    def test_students_assemble_their_own_pipeline_after_the_demo(self):
        practice = source({c["id"]: c for c in self.practice["cells"]}["skin-build-pipeline"])
        answer = source({c["id"]: c for c in self.answers["cells"]}["skin-build-pipeline"])
        self.assertIn("calm_strength = ___", practice)
        self.assertEqual(practice.count("___"), 4)
        self.assertIn("calm_strength = 0.75", answer)
        self.assertIn("calm_redness(picture, spot_mask, target_color, calm_strength)", answer)
        self.assertIn("picture = remove_pimples(picture)", answer)
        self.assertNotIn("___", answer)

    def test_the_slice_notation_is_explained_before_it_is_used(self):
        """`pixels[:, :, 0]` appears in almost every task, so `:` must be taught, not assumed."""
        cells = {cell["id"]: cell for cell in self.practice["cells"]}
        intro = source(cells["numpy-intro"])
        self.assertIn("What the `:` means", intro)
        self.assertIn('read `:` out loud as "every"', intro)
        self.assertIn("`[row, column, channel]`", intro)
        for row in ("| `pixels[2, 2]` |", "| `pixels[2, 2, 0]` |",
                    "| `pixels[2, :, 0]` |", "| `pixels[:, :, 0]` |"):
            self.assertIn(row, intro)
        self.assertIn("has shape `(5, 5)`", intro)
        lesson_order = [cell["id"] for cell in self.practice["cells"]]
        first_task = min(lesson_order.index("task-" + task.replace("_", "-")) for task in TASKS)
        self.assertLess(lesson_order.index("numpy-intro"), first_task)
        glossary = source(cells["skin-glossary"])
        self.assertIn("| `:` |", glossary)

    def test_learner_survival_kit_covers_cells_errors_and_vocabulary(self):
        cells = {cell["id"]: cell for cell in self.practice["cells"]}
        setup = source(cells["skin-setup-note"])
        self.assertIn("The four kinds of cells on this page", setup)
        self.assertIn("If red error text appears", setup)
        self.assertIn("`name '___' is not defined`", setup)
        self.assertIn("An error never deletes your work.", setup)
        glossary = source(cells["skin-glossary"])
        for word in ("pixel", "channel", "mask", "threshold", "kernel",
                     "convolution", "divisor", "overlay"):
            self.assertIn(f"| {word} |", glossary)

    def test_mechanism_trail_is_numbered_one_to_six_without_gaps(self):
        markdown = "\n".join(
            source(cell) for cell in self.practice["cells"] if cell["cell_type"] == "markdown"
        )
        for number in range(1, 7):
            self.assertIn(f"## Mechanism {number} — ", markdown)
        self.assertNotIn("Investigation", markdown)
        panels = (ROOT / "assets" / "skin-mechanisms.js").read_text(encoding="utf-8")
        for number in range(1, 7):
            self.assertIn(f"Mechanism {number} —", panels)

    def test_runtime_translates_blanks_and_refreshes_teaching_text(self):
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        self.assertIn("Replace every ___ with your answer", runtime)
        self.assertIn('tag.startsWith("task:") || tag === "student-work"', runtime)
        self.assertIn('if (cell.type !== "code" || !holdsStudentWork) return;', runtime)
        helpers = (ROOT / "assets" / "magic_mirror.py").read_text(encoding="utf-8")
        self.assertIn("still contains ___ blanks", helpers)

    def test_student_work_cells_are_the_only_restored_code_cells(self):
        tagged = {
            cell["id"]
            for cell in self.practice["cells"]
            if "student-work" in cell.get("metadata", {}).get("tags", [])
        }
        self.assertEqual(tagged, {"skin-convolution-transfer", "skin-build-pipeline",
                                  "skin-heal-run", "skin-smooth-run"})

    def test_route_has_no_training_dependency_or_diagnostic_claim(self):
        code = (ROOT / "skin_filters_solution.py").read_text(encoding="utf-8").lower()
        for dependency in ("tensorflow", "torch", "sklearn", "keras", "model.fit"):
            self.assertNotIn(dependency, code)
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        self.assertIn("not a diagnostic tool", lesson)
        self.assertIn("drawn face", lesson)

    def test_notebooks_have_matching_stable_ids_and_clean_outputs(self):
        practice_ids = [cell["id"] for cell in self.practice["cells"]]
        answer_ids = [cell["id"] for cell in self.answers["cells"]]
        self.assertEqual(practice_ids, answer_ids)
        self.assertEqual(len(practice_ids), len(set(practice_ids)))
        self.assertEqual(len(practice_ids), 90)
        for notebook in (self.practice, self.answers):
            self.assertEqual(notebook["nbformat"], 4)
            self.assertEqual(notebook["nbformat_minor"], 5)
            self.assertEqual(notebook["metadata"]["course"]["id"], "skin-lab")
            self.assertRegex(notebook["metadata"]["course"]["version"], r"^2026\.08\.07\.")
            for cell in notebook["cells"]:
                self.assertEqual(cell["metadata"]["stable_id"], cell["id"])
                if cell["cell_type"] == "code":
                    self.assertEqual(cell["outputs"], [])
                    self.assertIsNone(cell["execution_count"])

    def test_runtime_saves_by_stable_id_and_never_persists_captured_images(self):
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        self.assertIn("magic-dust-kit:skin-lab:", runtime)
        self.assertIn("cells: {}, passed: [], widgets: {}, concepts: []", runtime)
        self.assertIn("Object.fromEntries(Nb.cells.map", runtime)
        self.assertIn('user: cell.id.startsWith("user-")', runtime)
        self.assertIn("Ô do học sinh tự thêm", runtime)
        self.assertIn('tags.includes("autoload")', runtime)
        self.assertIn("Continue where you stopped", runtime)
        self.assertIn("window.confirm", runtime)
        self.assertIn("storageSchema: 3", runtime)
        self.assertIn("moduleSource}?v=${encodeURIComponent(PAGE.courseVersion)}", runtime)
        self.assertIn("Nb.file}?v=${encodeURIComponent(PAGE.courseVersion)}", runtime)
        self.assertIn("showMechanism(id, kind)", runtime)
        self.assertIn("recordConcept(id)", runtime)
        self.assertIn("saveWidget(id, state)", runtime)
        practice_page = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertLess(practice_page.index("assets/skin-mechanisms.js"), practice_page.index("assets/notebook.js"))
        persistence = re.search(r"persist\(\) \{(.+?)\n  \},", runtime, re.DOTALL)
        self.assertIsNotNone(persistence)
        for forbidden in ("Cam.stream", "toDataURL", "canvas", "imageData"):
            self.assertNotIn(forbidden, persistence.group(1))

    def test_public_photos_are_local_free_licence_assets(self):
        sources = (ROOT / "assets" / "photos" / "SOURCES.md").read_text(encoding="utf-8")
        files = sorted((ROOT / "assets" / "photos").glob("*.jpg"))
        self.assertEqual(len(files), 4)
        self.assertGreaterEqual(sources.count("CC0 1.0"), 3)
        self.assertIn("CC BY 4.0", sources)
        self.assertIn("Gandikota Raghurama Rao", sources)
        for photo in files:
            self.assertLess(photo.stat().st_size, 130_000)
            self.assertIn(photo.name, sources)
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        self.assertIn("Dr. Gandikota Raghurama Rao", lesson)
        self.assertIn("your `detect_pimples` may select nothing", lesson)
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        self.assertIn('"face-acne-cheek.jpg"', runtime)
        self.assertIn("assets/photos/${file}", runtime)
        self.assertIn("FS.writeFile(`${CFG.pyodide.photosDir}/${file}`", runtime)

    def test_face_mesh_is_the_one_photo_capstone(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        for phrase in ("MediaPipe Face Mesh", "face_mask", "skin_mask", "allowed", "up to 478 landmark points"):
            self.assertIn(phrase, lesson)
        self.assertIn("@mediapipe/face_mesh", runtime)
        self.assertIn("Capture one photo", lesson)
        self.assertIn("two button rows appear under the result", lesson)
        self.assertIn("Capture one photo", runtime)
        self.assertIn("Choose an image file", runtime)
        self.assertIn("Try another comparison width on the same photo:", runtime)
        self.assertIn('"_set_snapshot_radius", "The comparison width could not be changed: "', runtime)
        self.assertIn("Kernel.callBridge(bridge, [value]);", runtime)
        self.assertIn("Snapshot.renderPipeline()", runtime)
        self.assertIn("Snapshot.stopStream();", runtime)
        self.assertIn("faceMaskBytes(landmarks", runtime)
        self.assertIn('Kernel.callBridge("_skin_snapshot"', runtime)
        self.assertIn("Snapshot.differenceCanvas", runtime)
        photo_cell = next(cell for cell in self.practice["cells"] if cell["id"] == "skin-photo")
        self.assertEqual(source(photo_cell), "magic_mirror.capture_skin_photo()")
        self.assertNotIn("magic_mirror.run()", lesson)

    def test_capstone_runs_the_students_own_heal_spots(self):
        """The final photo cell must run their function, not a library pipeline."""
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        helpers = (ROOT / "assets" / "magic_mirror.py").read_text(encoding="utf-8")
        for gone in ("preview_pro_skin_pipeline", "describe_skin_pipeline_settings",
                     "_adaptive_skin_pipeline", "skin_smooth_strength", "kernel_choice"):
            self.assertNotIn(gone, helpers)
            self.assertNotIn(gone, lesson)
        self.assertIn('_student_function("heal_spots")', helpers)
        self.assertIn("your own `heal_spots`", lesson)
        cells = {cell["id"]: cell for cell in self.practice["cells"]}
        for gone_id in ("skin-pipeline-settings", "skin-pro-pipeline-preview",
                        "skin-pro-pipeline-note"):
            self.assertNotIn(gone_id, cells)

    def test_photo_buttons_change_the_width_and_the_pass_count(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        helpers = (ROOT / "assets" / "magic_mirror.py").read_text(encoding="utf-8")
        self.assertIn("Try another comparison width on the same photo:", runtime)
        self.assertIn('"_set_snapshot_radius"', runtime)
        self.assertIn("Run your healer more times on the same photo:", runtime)
        self.assertIn('"_set_snapshot_passes"', runtime)
        self.assertIn("SNAPSHOT_RADIUS_CHOICES = (7, 13, 25)", helpers)
        self.assertIn("SNAPSHOT_PASS_CHOICES = (1, 2, 3)", helpers)
        for phrase in (
            "*Comparison width* — `7`, `13`, `25`",
            "*Passes* — `1`, `2`, `3`",
            "runs on its own output",
        ):
            self.assertIn(phrase, lesson)

    def test_convolution_transfer_check_is_unsolved_only_in_practice(self):
        practice = next(cell for cell in self.practice["cells"] if cell["id"] == "skin-convolution-transfer")
        answers = next(cell for cell in self.answers["cells"] if cell["id"] == "skin-convolution-transfer")
        self.assertIn("flat_edge_sum = ___", source(practice))
        self.assertIn("large_patch_count = ___", source(practice))
        self.assertIn("blurred_rgb = (___, ___, ___)", source(practice))
        self.assertIn("flat_edge_sum = 0", source(answers))
        self.assertIn("isolated_patch_count = 1", source(answers))
        self.assertIn("large_patch_count = 9", source(answers))
        self.assertIn("blurred_rgb = (188, 120, 99)", source(answers))

    def test_one_photo_uses_high_quality_smooth_display(self):
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        styles = (ROOT / "assets" / "notebook.css").read_text(encoding="utf-8")
        self.assertIn("const level = CFG.quality[2]", runtime)
        self.assertIn(".snapshot-results canvas", styles)
        self.assertIn("image-rendering:auto", styles)
        self.assertIn("Processing uses 320 × 240 pixels and displays at 480 × 360", "\n".join(
            source(cell) for cell in self.practice["cells"]
        ))


if __name__ == "__main__":
    unittest.main(verbosity=2)
