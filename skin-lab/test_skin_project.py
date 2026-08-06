"""Kiểm tra độc lập cho Skin Lab.

Mặc định chấm bài giải. Để chấm file học sinh:

    $env:MODULE = "skin_filters"
    python -m unittest test_skin_project.py
"""

import importlib
import os
import unittest

import numpy as np
from PIL import Image


skin = importlib.import_module(os.environ.get("MODULE", "skin_filters_solution"))

SKIN = (183, 127, 103)
PIMPLE = (225, 62, 66)
BACKGROUND = (35, 80, 185)


def skin_patch(size=(9, 9)):
    image = Image.new("RGB", size, SKIN)
    image.putpixel((size[0] // 2, size[1] // 2), PIMPLE)
    return image


class TestSkinProject(unittest.TestCase):
    def test_convolution_averages_a_three_by_three_window(self):
        layer = [[0 for _ in range(5)] for _ in range(5)]
        layer[2][2] = 9
        result = skin.convolve_layer(layer, skin.SKIN_VOTE_KERNEL, 9)
        self.assertIsInstance(result, np.ndarray)
        self.assertEqual(result.shape, (5, 5))
        self.assertEqual(result[2, 2], 1)
        self.assertEqual(result[0, 0], 0, "mode nearest phải giữ nền phẳng ở viền")
        self.assertEqual(layer[2][2], 9, "không được ghi đè lên input")

    def test_skin_evidence_handles_two_tones_and_rejects_blue(self):
        self.assertEqual(skin.skin_evidence(*SKIN), skin.MASK_ON)
        self.assertEqual(skin.skin_evidence(92, 61, 49), skin.MASK_ON)
        self.assertEqual(skin.skin_evidence(*BACKGROUND), skin.MASK_OFF)
        channels = np.array([[SKIN, BACKGROUND]], dtype=np.int16)
        votes = skin.skin_evidence(channels[:, :, 0], channels[:, :, 1], channels[:, :, 2])
        self.assertIsInstance(votes, np.ndarray)
        self.assertEqual(votes.dtype, np.uint8)
        self.assertEqual(votes.tolist(), [[skin.MASK_ON, skin.MASK_OFF]])

    def test_neighbour_votes_keep_skin_across_a_red_spot(self):
        mask = skin.detect_skin(skin_patch())
        self.assertIsInstance(mask, np.ndarray)
        self.assertEqual(mask.dtype, np.uint8)
        self.assertEqual(mask[4, 4], skin.MASK_ON)
        blue = Image.new("RGB", (9, 9), BACKGROUND)
        self.assertEqual(skin.detect_skin(blue)[4, 4], skin.MASK_OFF)

    def test_pimple_detector_uses_local_red_contrast(self):
        image = skin_patch()
        mask = skin.detect_pimples(image, skin.detect_skin(image))
        self.assertEqual(mask[4, 4], skin.MASK_ON)
        self.assertEqual(mask[0, 0], skin.MASK_OFF)

    def test_removal_reduces_red_spot_and_keeps_far_pixels(self):
        image = skin_patch()
        before = image.copy()
        result = skin.remove_pimples(image)
        old_center = before.getpixel((4, 4))
        new_center = result.getpixel((4, 4))
        old_excess = old_center[0] - (old_center[1] + old_center[2]) / 2
        new_excess = new_center[0] - (new_center[1] + new_center[2]) / 2
        self.assertLess(new_excess, old_excess)
        self.assertEqual(result.getpixel((0, 0)), SKIN)
        self.assertEqual(image.getpixel((4, 4)), PIMPLE, "không được sửa ảnh input")


if __name__ == "__main__":
    unittest.main(verbosity=2)
