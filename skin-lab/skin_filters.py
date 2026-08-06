"""Skin Lab: learn with small calculations, then process images with NumPy and SciPy.

Complete five functions in the order that data moves through the pipeline:

    convolve_layer  ->  skin_evidence  ->  detect_skin
                    ->  detect_pimples ->  remove_pimples

This filter demonstrates how software processes pixels. It does not diagnose skin
or replace medical advice. Results can change with lighting, camera, and background.
"""

# === TASK: shared ===
import numpy as np
from PIL import Image
from scipy import ndimage


SKIN_VOTE_KERNEL = (
    (1, 1, 1),
    (1, 1, 1),
    (1, 1, 1),
)

SOFTEN_KERNEL = (
    (1, 2, 1),
    (2, 4, 2),
    (1, 2, 1),
)

MASK_OFF, MASK_ON = 0, 255
SKIN_NEIGHBOURS_NEEDED = 5
PIMPLE_RED_GAP = 24


# === TASK: convolve_layer ===
def convolve_layer(layer, kernel, divisor):
    """Apply a SciPy kernel and return a new NumPy array."""
    # TASK 1.
    # Given: layer, kernel, and divisor.
    # 1. Convert layer and kernel to NumPy arrays with dtype np.float32.
    # 2. Call ndimage.convolve(values, weights, mode="nearest").
    # 3. Divide the returned array by divisor and return it.
    values = np.asarray(layer, dtype=np.float32)
    weights = np.asarray(kernel, dtype=np.float32)
    filtered = ndimage.convolve(___, ___, mode="nearest")
    return ___ / divisor


# === TASK: skin_evidence ===
def skin_evidence(red, green, blue):
    """Apply one RGB rule to a pixel or to three complete NumPy channels."""
    red = np.asarray(red, dtype=np.int16)
    green = np.asarray(green, dtype=np.int16)
    blue = np.asarray(blue, dtype=np.int16)

    # TASK 2.
    # Calculate brightness, warmth, and red_green_gap.
    # Use &, not and, because each condition applies across an entire array.
    brightness = (red + green + blue) // 3
    warmth = ___
    red_green_gap = ___
    looks_like_skin = (
        (brightness >= 35) & (brightness <= 240)
        & (warmth >= 8)
        & (red_green_gap >= -10) & (red_green_gap <= 90)
    )
    result = np.where(___, MASK_ON, MASK_OFF).astype(np.uint8)
    return int(result) if result.ndim == 0 else result


# === TASK: detect_skin ===
def detect_skin(img):
    """Create a skin-region mask by counting decisions in each 3x3 area."""
    # TASK 3.
    # 1. Convert the PIL image to a pixels array with shape (height, width, 3).
    # 2. Pass the three channels to skin_evidence to create raw_mask.
    # 3. Change 255 to 1, then count passing pixels in each 3x3 area.
    # 4. Use np.where to create a skin_mask containing only 0 and 255.
    pixels = np.asarray(img.convert("RGB"), dtype=np.int16)
    raw_mask = skin_evidence(
        pixels[:, :, 0],
        pixels[:, :, 1],
        pixels[:, :, 2],
    )
    binary = (raw_mask == MASK_ON).astype(np.float32)
    neighbour_count = convolve_layer(___, SKIN_VOTE_KERNEL, 1)
    return np.where(___ >= SKIN_NEIGHBOURS_NEEDED, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: detect_pimples ===
def detect_pimples(img, skin_mask):
    """Find a locally red spot in a 5x5 area, then expand the selection."""
    # TASK 4.
    # uniform_filter calculates the mean of each 5x5 area.
    # maximum_filter expands a selected location to its nearby pixels.
    pixels = np.asarray(img.convert("RGB"), dtype=np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    redness = np.maximum(0, red - (green + blue) / 2)
    local_redness = ndimage.uniform_filter(___, size=5, mode="nearest")
    candidate = (
        (np.asarray(skin_mask) == MASK_ON)
        & (redness - local_redness >= PIMPLE_RED_GAP)
    )
    expanded = ndimage.maximum_filter(___, size=3, mode="nearest")
    return np.where(expanded, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: remove_pimples ===
def remove_pimples(img):
    """Smooth where pimple_mask is 255 and keep every other pixel unchanged."""
    # TASK 5.
    # 1. Create skin_mask and pimple_mask with the previous two functions.
    # 2. Add one dimension so the kernel shape is (3, 3, 1); this keeps R, G, B separate.
    # 3. ndimage.convolve smooths all three channels in one call.
    # 4. np.where uses the smooth colour only where pimple_mask equals 255.
    source = img.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    skin_mask = detect_skin(source)
    pimple_mask = detect_pimples(source, skin_mask)

    weights = np.asarray(SOFTEN_KERNEL, dtype=np.float32)[:, :, None]
    softened = ndimage.convolve(___, weights, mode="nearest") / weights.sum()
    combined = np.where(___[:, :, None] == MASK_ON, softened, pixels)
    output = np.clip(np.rint(combined), 0, 255).astype(np.uint8)
    return Image.fromarray(output, "RGB")
