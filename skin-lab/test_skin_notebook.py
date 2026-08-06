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
)


def source(cell):
    value = cell.get("source", "")
    return "".join(value) if isinstance(value, list) else value


class TestSkinNotebook(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.practice = json.loads((ROOT / "Skin_Lab.ipynb").read_text(encoding="utf-8"))
        cls.answers = json.loads((ROOT / "Skin_Lab_Answers.ipynb").read_text(encoding="utf-8"))

    def test_skin_routes_are_relative_and_keep_the_main_route_available(self):
        practice_page = (ROOT / "index.html").read_text(encoding="utf-8")
        answer_page = (ROOT / "dap-an.html").read_text(encoding="utf-8")
        self.assertIn('notebook: "Skin_Lab.ipynb"', practice_page)
        self.assertIn('href="dap-an.html"', practice_page)
        self.assertIn('href="../index.html"', practice_page)
        self.assertIn('notebook: "Skin_Lab_Answers.ipynb"', answer_page)
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
            "8 × 10 + 90 = 170",
            "170 / 9 = 18.89",
            "brightness = (183 + 127 + 103) // 3 = 413 // 3 = 137",
            "(8 × 255 + 0) / 9 = 2040 / 9 = 226.67",
            "226.67",
            "141.67",
            "89.28",
            "(194, 111, 94)",
        ):
            self.assertIn(phrase, lesson)

    def test_numpy_scipy_and_pillow_are_the_main_implementation_path(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        for phrase in (
            "np.asarray", ".shape", "np.where", "np.clip", "Image.fromarray",
            "ndimage.convolve", "ndimage.uniform_filter", "ndimage.maximum_filter",
            "không cần tự viết hai vòng `for row` và `for column`",
        ):
            self.assertIn(phrase, lesson)
        self.assertNotIn("không thuộc 5 phần bắt buộc", lesson)

    def test_every_stage_has_numbers_images_and_explanatory_preview(self):
        ids = {cell["id"] for cell in self.practice["cells"]}
        for cell_id in (
            "skin-pixel-channels", "numpy-channels", "skin-convolution-math",
            "skin-preview-convolution", "skin-preview-evidence", "skin-preview-mask",
            "skin-preview-pimples", "skin-preview-cleanup", "skin-demo",
        ):
            self.assertIn(cell_id, ids)
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        self.assertIn("phép tính bằng số", lesson)
        self.assertIn("Ảnh phủ màu vẫn giữ màu gốc", lesson)

    def test_learner_prose_defines_terms_and_avoids_translated_shorthand(self):
        markdown = "\n".join(
            source(cell) for cell in self.practice["cells"] if cell["cell_type"] == "markdown"
        )
        self.assertIn("được gọi là `skin_mask` và `pimple_mask`", markdown)
        self.assertIn("giá trị `255` là vùng được chọn", markdown)
        self.assertIn("giá trị `0` là vùng được giữ nguyên", markdown)
        self.assertIn("bảng số NumPy", markdown)
        self.assertIn("478 điểm mốc", markdown)
        for phrase in (
            "pipeline", "hình màu/overlay", "478 landmark", "cho phiếu",
            "ba đèn R, G, B", "không tin một pixel", "API thư viện",
            "NumPy array mới shape", "array `uint8`",
        ):
            self.assertNotIn(phrase.lower(), markdown.lower())

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
                }[task]
            )
            self.assertRegex(task_text, r"(?i)giá trị cho sẵn|given")
            self.assertIn("INPUT", task_text)
            self.assertIn("PROCESS", task_text)
            self.assertIn("OUTPUT", task_text)
        self.assertIn("Ảnh camera không được lưu", lesson)

    def test_route_has_no_training_dependency_or_diagnostic_claim(self):
        code = (ROOT / "skin_filters_solution.py").read_text(encoding="utf-8").lower()
        for dependency in ("tensorflow", "torch", "sklearn", "keras", "model.fit"):
            self.assertNotIn(dependency, code)
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        self.assertIn("không phải công cụ chẩn đoán hay đánh giá làn da", lesson)
        self.assertIn("ảnh tổng hợp", lesson)

    def test_notebooks_have_matching_stable_ids_and_clean_outputs(self):
        practice_ids = [cell["id"] for cell in self.practice["cells"]]
        answer_ids = [cell["id"] for cell in self.answers["cells"]]
        self.assertEqual(practice_ids, answer_ids)
        self.assertEqual(len(practice_ids), len(set(practice_ids)))
        self.assertEqual(len(practice_ids), 55)
        for notebook in (self.practice, self.answers):
            self.assertEqual(notebook["nbformat"], 4)
            self.assertEqual(notebook["nbformat_minor"], 5)
            self.assertEqual(notebook["metadata"]["course"]["id"], "skin-lab")
            self.assertRegex(notebook["metadata"]["course"]["version"], r"^2026\.08\.06\.")
            for cell in notebook["cells"]:
                self.assertEqual(cell["metadata"]["stable_id"], cell["id"])
                if cell["cell_type"] == "code":
                    self.assertEqual(cell["outputs"], [])
                    self.assertIsNone(cell["execution_count"])

    def test_runtime_saves_by_stable_id_and_never_persists_camera_images(self):
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        self.assertIn("magic-dust-kit:skin-lab:", runtime)
        self.assertIn("cells: {}, passed: [], lastCellId: null", runtime)
        self.assertIn("Object.fromEntries(Nb.cells.map", runtime)
        self.assertIn('user: cell.id.startsWith("user-")', runtime)
        self.assertIn("Ô do học sinh tự thêm", runtime)
        self.assertIn('tags.includes("autoload")', runtime)
        self.assertIn("Tiếp tục từ chỗ đang học", runtime)
        self.assertIn("window.confirm", runtime)
        self.assertIn("storageSchema: 3", runtime)
        persistence = re.search(r"persist\(\) \{(.+?)\n  \},", runtime, re.DOTALL)
        self.assertIsNotNone(persistence)
        for forbidden in ("Cam.stream", "toDataURL", "canvas", "imageData"):
            self.assertNotIn(forbidden, persistence.group(1))

    def test_public_photos_are_local_cc0_assets(self):
        sources = (ROOT / "assets" / "photos" / "SOURCES.md").read_text(encoding="utf-8")
        files = sorted((ROOT / "assets" / "photos").glob("*.jpg"))
        self.assertEqual(len(files), 3)
        self.assertGreaterEqual(sources.count("CC0 1.0"), 3)
        for photo in files:
            self.assertLess(photo.stat().st_size, 130_000)
            self.assertIn(photo.name, sources)
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        self.assertIn("assets/photos/${file}", runtime)
        self.assertIn("FS.writeFile(`${CFG.pyodide.photosDir}/${file}`", runtime)

    def test_face_mesh_is_the_camera_capstone_and_spells_are_not_skin_controls(self):
        lesson = "\n".join(source(cell) for cell in self.practice["cells"])
        runtime = (ROOT / "assets" / "notebook.js").read_text(encoding="utf-8")
        for phrase in ("MediaPipe Face Mesh", "face_mask", "skin_mask", "allowed", "478 điểm mốc"):
            self.assertIn(phrase, lesson)
        self.assertIn("@mediapipe/face_mesh", runtime)
        self.assertIn("if (!SKIN)", runtime)
        self.assertIn('"Hiện đường viền Face Mesh"', runtime)


if __name__ == "__main__":
    unittest.main(verbosity=2)
