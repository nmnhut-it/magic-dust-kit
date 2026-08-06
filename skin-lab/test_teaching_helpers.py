import importlib.util
import io
import math
import sys
import types
import unittest
from contextlib import ExitStack, redirect_stdout
from pathlib import Path
from unittest.mock import patch

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

    def test_skin_explanation_helpers_return_visible_illustrations(self):
        helpers = (
            magic_mirror.show_skin_pipeline_overview,
            magic_mirror.show_skin_pixel_channels,
            magic_mirror.show_numpy_channels,
            magic_mirror.show_convolution_math,
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

    def test_number_substitutions_match_the_lesson(self):
        blurred = (8 * 10 + 90) / 9
        votes = (8 * 255 + 0) / 9
        threshold = 255 * 5 / 9
        spot_redness = 225 - (62 + 66) / 2
        skin_redness = 183 - (127 + 103) / 2
        local_redness = (spot_redness + 24 * skin_redness) / 25
        softened = tuple(round((4 * spot + 12 * skin) / 16) for spot, skin in (
            (225, 183), (62, 127), (66, 103),
        ))

        self.assertAlmostEqual(blurred, 18.89, places=2)
        self.assertAlmostEqual(votes, 226.67, places=2)
        self.assertAlmostEqual(threshold, 141.67, places=2)
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

    def test_public_cc0_gallery_loads_bundled_colour_images(self):
        with redirect_stdout(io.StringIO()):
            gallery = magic_mirror.show_public_photo_gallery()
        self.assertEqual(gallery.size, (616, 172))
        self.assertGreater(len(gallery.getcolors(maxcolors=gallery.width * gallery.height) or []), 100)

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
