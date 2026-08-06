"""Skin Lab: learn with small calculations, then process images with NumPy and SciPy.

Complete five functions in the order the notebook teaches them:

    skin_evidence  ->  convolve_layer  ->  detect_skin
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


# === TASK: skin_evidence ===
def skin_evidence(red, green, blue):
    """Apply one RGB rule to a pixel or to three complete NumPy channels."""
    red = np.asarray(red, dtype=np.int16)
    green = np.asarray(green, dtype=np.int16)
    blue = np.asarray(blue, dtype=np.int16)

    # TASK 1 - fill the three ___ blanks, top to bottom.
    # Blank 1: warmth is the red value minus the blue value.
    # Blank 2: red_green_gap is the red value minus the green value.
    # Blank 3: np.where asks looks_like_skin at every pixel.
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


# === TASK: convolve_layer ===
def convolve_layer(layer, kernel, divisor):
    """Apply a SciPy kernel and return a new NumPy array."""
    # TASK 2 - fill the three ___ blanks, top to bottom.
    # values and weights are already prepared as float32 arrays.
    # Blanks 1 and 2: hand ndimage.convolve the values, then the weights.
    # Blank 3: return the filtered array divided by divisor.
    values = np.asarray(layer, dtype=np.float32)
    weights = np.asarray(kernel, dtype=np.float32)
    filtered = ndimage.convolve(___, ___, mode="nearest")
    return ___ / divisor


# === TASK: detect_skin ===
def detect_skin(img):
    """Create a skin-region mask by counting decisions in each 3x3 area."""
    # TASK 3 - fill the two ___ blanks.
    # pixels, raw_mask, and binary are already written above the blanks.
    # Blank 1: count the 0/1 decisions in binary with convolve_layer.
    # Blank 2: compare neighbour_count with SKIN_NEIGHBOURS_NEEDED.
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
    # TASK 4 - fill the two ___ blanks.
    # Blank 1: uniform_filter needs the redness grid to average over 5x5.
    # Blank 2: maximum_filter expands the True/False candidate grid.
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
    # TASK 5 - fill the two ___ blanks.
    # skin_mask, pimple_mask, and the (3, 3, 1) kernel are prepared above.
    # Blank 1: ndimage.convolve smooths the full pixels array in one call.
    # Blank 2: np.where uses the smooth colour only where pimple_mask is MASK_ON.
    source = img.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    skin_mask = detect_skin(source)
    pimple_mask = detect_pimples(source, skin_mask)

    weights = np.asarray(SOFTEN_KERNEL, dtype=np.float32)[:, :, None]
    softened = ndimage.convolve(___, weights, mode="nearest") / weights.sum()
    combined = np.where(___[:, :, None] == MASK_ON, softened, pixels)
    output = np.clip(np.rint(combined), 0, 255).astype(np.uint8)
    return Image.fromarray(output, "RGB")
