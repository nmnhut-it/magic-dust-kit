import ast
import importlib.util
import io
import math
import sys
import types
import unittest
from contextlib import ExitStack, redirect_stdout
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

import skin_filters_solution


class _DummyJs(types.ModuleType):
    pass


sys.modules.setdefault("js", _DummyJs("js"))
spec = importlib.util.spec_from_file_location(
    "magic_mirror_helpers",
    Path(__file__).parent / "assets" / "magic_mirror.py",
)
magic_mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(magic_mirror)


class TestTeachingHelpers(unittest.TestCase):
    def test_rectangle_matrix_has_visible_shape_and_rgb_range(self):
        matrix = magic_mirror.rgb_rectangle_image()
        self.assertEqual((len(matrix), len(matrix[0])), (6, 8))
        self.assertEqual(matrix[0][0], (30, 80, 180))
        self.assertEqual(matrix[2][3], (255, 40, 40))
        self.assertTrue(all(0 <= value <= 255 for row in matrix for pixel in row for value in pixel))

    def test_rotate_uses_inverse_mapping_around_centre(self):
        image = Image.new("RGB", (3, 3), (0, 0, 0))
        image.putpixel((1, 0), (255, 0, 0))
        result = magic_mirror.rotate_nearest(image, 90)
        red_positions = [
            (x, y)
            for y in range(3)
            for x in range(3)
            if result.getpixel((x, y)) == (255, 0, 0)
        ]
        self.assertEqual(red_positions, [(2, 1)])

    def test_skin_sample_is_a_camera_free_meaningful_input(self):
        image = magic_mirror.skin_sample_image()
        self.assertEqual(image.size, magic_mirror.DEMO_SIZE)
        colors = {color for _, color in image.getcolors(maxcolors=image.width * image.height)}
        self.assertIn(magic_mirror.SKIN_TONE, colors)
        self.assertIn(magic_mirror.PIMPLE_RED, colors)
        self.assertIn(magic_mirror.SKIN_BACKGROUND, colors)

    def test_skin_mode_reuses_student_functions_for_demo_and_live_pipeline(self):
        names = (
            "convolve_layer",
            "skin_evidence",
            "detect_skin",
            "detect_pimples",
            "remove_pimples",
        )
        with ExitStack() as stack:
            main_module = sys.modules["__main__"]
            for name in names:
                stack.enter_context(patch.object(
                    main_module, name, getattr(skin_filters_solution, name), create=True))
            with redirect_stdout(io.StringIO()):
                board = magic_mirror.skin_demo()
                live = magic_mirror.process_skin(
                    magic_mirror.skin_sample_image(), magic_mirror.DEMO_SIZE)
                previews = (
                    magic_mirror.preview_library_convolution(),
                    magic_mirror.preview_skin_evidence(),
                    magic_mirror.preview_skin_mask(),
                    magic_mirror.preview_pimple_mask(),
                    magic_mirror.preview_cleanup(),
                )

        self.assertEqual(board.size, (496, 292))
        self.assertEqual(live.size, magic_mirror.OUTPUT_SIZE)
        self.assertTrue(all(isinstance(preview, Image.Image) for preview in previews))

    def test_capstone_pipeline_changes_skin_and_keeps_pixels_outside_face(self):
        names = (
            "convolve_layer", "skin_evidence", "detect_skin",
            "detect_pimples", "remove_pimples",
        )
        with ExitStack() as stack:
            main_module = sys.modules["__main__"]
            for name in names:
                stack.enter_context(patch.object(
                    main_module, name, getattr(skin_filters_solution, name), create=True))
            stack.enter_context(patch.object(main_module, "SOFTEN_KERNEL", (
                (1, 1, 1), (1, 1, 1), (1, 1, 1),
            ), create=True))
            stack.enter_context(patch.object(main_module, "skin_smooth_strength", 0.55, create=True))
            stack.enter_context(patch.object(main_module, "spot_smooth_strength", 0.90, create=True))
            stack.enter_context(patch.object(main_module, "skin_brightness", 10, create=True))
            stack.enter_context(patch.object(main_module, "skin_kernel_passes", 2, create=True))
            stack.enter_context(patch.object(main_module, "redness_sensitivity", 1.6, create=True))
            image = magic_mirror.skin_sample_image((80, 60))
            face = [[False] * 80 for _ in range(60)]
            for row in range(8, 53):
                for column in range(18, 63):
                    face[row][column] = True
            data = magic_mirror._adaptive_skin_pipeline(image, face)
            with redirect_stdout(io.StringIO()):
                preview = magic_mirror.preview_pro_skin_pipeline()

        self.assertGreater(int(data["skin"].sum()), 0)
        self.assertGreater(int(data["changed"].sum()), image.width * image.height // 20)
        before = np.asarray(image, dtype=np.float32)
        after = np.asarray(data["result"], dtype=np.float32)
        self.assertGreater(float(after[data["skin"]].mean()), float(before[data["skin"]].mean()) + 2)
        self.assertEqual(data["result"].getpixel((0, 0)), image.getpixel((0, 0)))
        self.assertIsInstance(preview, Image.Image)
        self.assertGreater(preview.width, 600)

    def test_skin_explanation_helpers_return_visible_illustrations(self):
        helpers = (
            magic_mirror.show_skin_pipeline_overview,
            magic_mirror.show_skin_pixel_channels,
            magic_mirror.show_numpy_channels,
            magic_mirror.show_convolution_math,
            magic_mirror.show_rgb_convolution_math,
            magic_mirror.show_skin_evidence_math,
            magic_mirror.show_skin_vote_math,
            magic_mirror.show_red_gap_math,
            magic_mirror.show_soften_math,
            magic_mirror.show_face_mesh_map,
        )
        for helper in helpers:
            with self.subTest(helper=helper.__name__), redirect_stdout(io.StringIO()):
                picture = helper()
            self.assertIsInstance(picture, Image.Image)
            self.assertGreaterEqual(picture.width, 300)
            self.assertGreaterEqual(picture.height, 150)

    def test_three_channel_example_prints_exact_number_matrices_and_colours(self):
        output = io.StringIO()
        with redirect_stdout(output):
            picture = magic_mirror.show_numpy_channels()
        report = output.getvalue()
        self.assertIn("pixels has shape (5, 5, 3)", report)
        self.assertIn("R matrix = [[35, 35, 35, 35, 35]", report)
        self.assertIn("G matrix = [[80, 80, 80, 80, 80]", report)
        self.assertIn("B matrix = [[185, 185, 185, 185, 185]", report)
        self.assertIn("R=225, G=62, B=66 -> RGB (225, 62, 66)", report)
        self.assertIn("maximum difference = 0", report)
        self.assertIsInstance(picture, Image.Image)
        self.assertGreaterEqual(picture.width, 400)

    def test_change_one_channel_example_reports_exact_scope(self):
        before = magic_mirror._rgb_example_pixels().astype(np.int16)
        after = before.copy()
        after[2, 2, 2] = 220
        output = io.StringIO()
        with redirect_stdout(output):
            picture = magic_mirror.show_rgb_matrix_change(before, after, 2, 2)
        report = output.getvalue()
        self.assertIn("Pixel before: (225, 62, 66) | pixel after: (225, 62, 220)", report)
        self.assertIn("row 2, column 2, B: 66 -> 220", report)
        self.assertIn("Changed pixels: 1/25 | changed channel values: 1/75", report)
        self.assertIsInstance(picture, Image.Image)

    def test_rgb_convolution_rebuilds_three_calculated_channels(self):
        output = io.StringIO()
        with redirect_stdout(output):
            picture = magic_mirror.show_rgb_convolution_math()
        report = output.getvalue()
        self.assertIn("R output = (225 + 8 × 183) / 9 = 1689 / 9 = 187.67 -> 188", report)
        self.assertIn("G output = (62 + 8 × 127) / 9 = 1078 / 9 = 119.78 -> 120", report)
        self.assertIn("B output = (66 + 8 × 103) / 9 = 890 / 9 = 98.89 -> 99", report)
        self.assertIn("rebuild centre RGB (188, 120, 99)", report)
        self.assertIsInstance(picture, Image.Image)

    def test_convolution_transfer_check_explains_all_four_outputs(self):
        output = io.StringIO()
        with redirect_stdout(output):
            picture = magic_mirror.check_convolution_intuition(0, 1, 9, (188, 120, 99))
        report = output.getvalue()
        self.assertIn("flat edge: 0 | expected 0 | correct", report)
        self.assertIn("isolated dot: 1 | expected 1 | correct", report)
        self.assertIn("large patch: 9 | expected 9 | correct", report)
        self.assertIn("RGB blur: (188, 120, 99) | expected (188, 120, 99) | correct", report)
        self.assertIn("Intuition check: 4/4 correct", report)
        self.assertIsInstance(picture, Image.Image)

    def test_number_substitutions_match_the_lesson(self):
        blurred = (8 * 10 + 90) / 9
        neighbour_count = 8 * 1 + 0
        spot_redness = 225 - (62 + 66) / 2
        skin_redness = 183 - (127 + 103) / 2
        local_redness = (spot_redness + 24 * skin_redness) / 25
        softened = tuple(round((4 * spot + 12 * skin) / 16) for spot, skin in (
            (225, 183), (62, 127), (66, 103),
        ))

        self.assertAlmostEqual(blurred, 18.89, places=2)
        self.assertEqual(neighbour_count, 8)
        self.assertGreaterEqual(neighbour_count, 5)
        self.assertAlmostEqual(spot_redness - local_redness, 89.28, places=2)
        self.assertEqual(softened, (194, 111, 94))

    def test_numpy_extension_renders_masks_filters_and_kernels(self):
        mask = [[0, 255], [255, 0]]
        with redirect_stdout(io.StringIO()):
            mask_picture = magic_mirror.show_numpy_mask(mask)
            filters = magic_mirror.numpy_filter_gallery()
            kernels = magic_mirror.numpy_kernel_gallery()
            preview = magic_mirror.preview_numpy_filter(lambda pixels: 255 - pixels)

        self.assertEqual(mask_picture.size, magic_mirror.OUTPUT_SIZE)
        for picture in (filters, kernels, preview):
            self.assertIsInstance(picture, Image.Image)
            self.assertEqual(picture.size, (328, 284))

    def test_numpy_preview_rejects_mutating_the_given_input(self):
        def mutate_input(pixels):
            pixels[:, :, 0] = 0
            return pixels

        with self.assertRaises(magic_mirror.MagicMirrorError):
            magic_mirror.preview_numpy_filter(mutate_input)

    def test_face_mask_keeps_every_pixel_outside_the_face_unchanged(self):
        names = (
            "convolve_layer", "skin_evidence", "detect_skin",
            "detect_pimples", "remove_pimples",
        )
        with ExitStack() as stack:
            main_module = sys.modules["__main__"]
            for name in names:
                stack.enter_context(patch.object(
                    main_module, name, getattr(skin_filters_solution, name), create=True))
            original = magic_mirror.skin_sample_image(magic_mirror.OUTPUT_SIZE)
            disabled = [[0] * original.width for _ in range(original.height)]
            result = magic_mirror.process_skin(original, magic_mirror.OUTPUT_SIZE, disabled)
            with redirect_stdout(io.StringIO()):
                pipeline = magic_mirror.show_face_mask_pipeline()

        self.assertEqual(result.tobytes(), original.tobytes())
        self.assertIsInstance(pipeline, Image.Image)
        self.assertEqual(pipeline.size, (488, 412))

    def test_public_gallery_loads_bundled_colour_images(self):
        with redirect_stdout(io.StringIO()):
            gallery = magic_mirror.show_public_photo_gallery()
        self.assertEqual(gallery.size, (616, 352))
        self.assertGreater(len(gallery.getcolors(maxcolors=gallery.width * gallery.height) or []), 100)

    def test_matrix_change_demo_explains_a_stale_or_oversized_matrix(self):
        stale = np.zeros((60, 80, 3), dtype=np.uint8)
        with self.assertRaises(magic_mirror.MagicMirrorError) as caught:
            magic_mirror.show_rgb_matrix_change(stale, stale.copy(), 2, 2)
        self.assertIn("Run that cell first", str(caught.exception))

    def test_matrix_change_demo_accepts_other_small_matrices(self):
        before = np.full((4, 6, 3), 120, dtype=np.uint8)
        after = before.copy()
        after[1, 2, 0] = 200
        output = io.StringIO()
        with redirect_stdout(output):
            picture = magic_mirror.show_rgb_matrix_change(before, after, 1, 2)
        self.assertIn("Changed pixels: 1/24 | changed channel values: 1/72.", output.getvalue())
        self.assertIsInstance(picture, Image.Image)

    def test_demo_photo_is_a_real_bundled_face_at_the_requested_size(self):
        photo = magic_mirror.demo_face_photo((160, 120))
        self.assertEqual(photo.size, (160, 120))
        # Ảnh vẽ tay chỉ có vài màu phẳng; ảnh thật thì hàng nghìn — đây là cách
        # rẻ nhất để test khẳng định "thật", không chỉ "có ảnh nào đó".
        self.assertGreater(len(set(photo.convert("RGB").getdata())), 2000)
        self.assertLess(len(set(magic_mirror.skin_sample_image().getdata())), 40)

    def test_watch_cells_use_a_photograph_and_detector_cells_keep_the_drawn_plate(self):
        """The split is deliberate: a photo where you judge by eye, the drawn plate
        where the student's own 5 x 5 rule must be seen firing (it finds nothing on
        a real blotch, which the lesson teaches later on its own terms)."""
        tree = ast.parse((Path(__file__).parent / "assets" / "magic_mirror.py").read_text(encoding="utf-8"))
        uses = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                called = {inner.func.id for inner in ast.walk(node)
                          if isinstance(inner, ast.Call) and isinstance(inner.func, ast.Name)}
                uses[node.name] = called
        for name in ("show_face_mesh_map", "show_face_mask_pipeline", "numpy_filter_gallery",
                     "numpy_kernel_gallery", "preview_numpy_filter", "preview_library_convolution",
                     "preview_skin_mask"):
            self.assertIn("demo_face_photo", uses[name], name)
            self.assertNotIn("skin_sample_image", uses[name], name)
        for name in ("show_skin_sample", "show_skin_pipeline_overview", "preview_pimple_mask",
                     "preview_cleanup", "skin_demo"):
            self.assertIn("skin_sample_image", uses[name], name)
            self.assertNotIn("demo_face_photo", uses[name], name)

    def test_snapshot_kernel_buttons_switch_the_capstone_kernel(self):
        main_module = sys.modules["__main__"]
        custom_gentle = ((0, 1, 0), (1, 4, 1), (0, 1, 0))
        with ExitStack() as stack:
            stack.enter_context(patch.object(
                main_module, "kernel_options", {"gentle": custom_gentle}, create=True))
            stack.enter_context(patch.object(main_module, "kernel_choice", "wide", create=True))
            stack.enter_context(patch.object(
                main_module, "SOFTEN_KERNEL", magic_mirror.SNAPSHOT_KERNELS["wide"], create=True))
            magic_mirror._set_snapshot_kernel("gentle")
            self.assertEqual(main_module.kernel_choice, "gentle")
            self.assertEqual(main_module.SOFTEN_KERNEL, custom_gentle)
            magic_mirror._set_snapshot_kernel("wide")
            self.assertEqual(np.asarray(main_module.SOFTEN_KERNEL).shape, (5, 5))
            magic_mirror._set_snapshot_kernel("widest")
            self.assertEqual(np.asarray(main_module.SOFTEN_KERNEL).shape, (9, 9))
        with self.assertRaises(magic_mirror.MagicMirrorError):
            magic_mirror._set_snapshot_kernel("mystery")

    def test_every_snapshot_kernel_is_a_supported_odd_square_of_weights(self):
        self.assertEqual(
            tuple(magic_mirror.SNAPSHOT_KERNELS),
            ("gentle", "balanced", "strong", "wide", "widest"))
        for name, kernel in magic_mirror.SNAPSHOT_KERNELS.items():
            weights = np.asarray(kernel, dtype=np.float32)
            self.assertIn(weights.shape, magic_mirror.KERNEL_SHAPES, name)
            self.assertGreater(float(weights.sum()), 0, name)
            self.assertTrue((weights >= 0).all(), name)

    def test_strength_buttons_write_the_notebook_smoothing_variable(self):
        main_module = sys.modules["__main__"]
        with patch.object(main_module, "skin_smooth_strength", 0.55, create=True):
            for percent in magic_mirror.SNAPSHOT_STRENGTHS:
                magic_mirror._set_snapshot_strength(percent)
                self.assertAlmostEqual(main_module.skin_smooth_strength, percent / 100)
                self.assertAlmostEqual(
                    magic_mirror._pipeline_settings()["skin_strength"], percent / 100)
        for wrong in (0, 60, "fast", None):
            with self.assertRaises(magic_mirror.MagicMirrorError):
                magic_mirror._set_snapshot_strength(wrong)

    def test_capstone_settings_accept_a_nine_by_nine_kernel_and_reject_other_shapes(self):
        main_module = sys.modules["__main__"]
        with patch.object(
            main_module, "SOFTEN_KERNEL", magic_mirror.SNAPSHOT_KERNELS["widest"], create=True
        ):
            self.assertEqual(magic_mirror._pipeline_settings()["kernel"].shape, (9, 9))
        with patch.object(main_module, "SOFTEN_KERNEL", np.ones((7, 7)), create=True):
            with self.assertRaises(magic_mirror.MagicMirrorError) as caught:
                magic_mirror._pipeline_settings()
        self.assertIn("3 x 3, 5 x 5, or 9 x 9", str(caught.exception))

    def test_grader_translates_unfilled_blanks_into_plain_instructions(self):
        def unfilled():
            raise NameError("name '___' is not defined")

        output = io.StringIO()
        with redirect_stdout(output):
            passed = magic_mirror._try_skin("convolve_layer  (apply a kernel)", unfilled)
        report = output.getvalue()
        self.assertFalse(passed)
        self.assertIn("still contains ___ blanks", report)
        self.assertNotIn("NameError", report)

    def test_solution_uses_vectorized_image_libraries(self):
        source = (Path(__file__).parent / "skin_filters_solution.py").read_text(encoding="utf-8")
        for call in (
            "ndimage.convolve", "ndimage.uniform_filter", "ndimage.maximum_filter",
            "np.where", "np.asarray",
        ):
            self.assertIn(call, source)
        self.assertNotRegex(source, r"for\s+(row|column|x|y)\s+in")


if __name__ == "__main__":
    unittest.main(verbosity=2)
