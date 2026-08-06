"""Skin Lab answer key: small calculations, then full-image NumPy and SciPy."""

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

    brightness = (red + green + blue) // 3
    warmth = red - blue
    red_green_gap = red - green
    looks_like_skin = (
        (brightness >= 35) & (brightness <= 240)
        & (warmth >= 8)
        & (red_green_gap >= -10) & (red_green_gap <= 90)
    )
    result = np.where(looks_like_skin, MASK_ON, MASK_OFF).astype(np.uint8)
    return int(result) if result.ndim == 0 else result


# === TASK: convolve_layer ===
def convolve_layer(layer, kernel, divisor):
    """Apply a SciPy kernel and return a new NumPy array."""
    values = np.asarray(layer, dtype=np.float32)
    weights = np.asarray(kernel, dtype=np.float32)
    filtered = ndimage.convolve(values, weights, mode="nearest")
    return filtered / divisor


# === TASK: detect_skin ===
def detect_skin(img):
    """Create a skin-region mask by counting decisions in each 3x3 area."""
    pixels = np.asarray(img.convert("RGB"), dtype=np.int16)
    raw_mask = skin_evidence(
        pixels[:, :, 0],
        pixels[:, :, 1],
        pixels[:, :, 2],
    )
    binary = (raw_mask == MASK_ON).astype(np.float32)
    neighbour_count = convolve_layer(binary, SKIN_VOTE_KERNEL, 1)
    return np.where(
        neighbour_count >= SKIN_NEIGHBOURS_NEEDED, MASK_ON, MASK_OFF
    ).astype(np.uint8)


# === TASK: detect_pimples ===
def detect_pimples(img, skin_mask):
    """Find a locally red spot in a 5x5 area, then expand the selection."""
    pixels = np.asarray(img.convert("RGB"), dtype=np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    redness = np.maximum(0, red - (green + blue) / 2)
    local_redness = ndimage.uniform_filter(redness, size=5, mode="nearest")
    candidate = (
        (np.asarray(skin_mask) == MASK_ON)
        & (redness - local_redness >= PIMPLE_RED_GAP)
    )
    expanded = ndimage.maximum_filter(candidate, size=3, mode="nearest")
    return np.where(expanded, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: remove_pimples ===
def remove_pimples(img):
    """Smooth where pimple_mask is 255 and keep every other pixel unchanged."""
    source = img.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    skin_mask = detect_skin(source)
    pimple_mask = detect_pimples(source, skin_mask)

    weights = np.asarray(SOFTEN_KERNEL, dtype=np.float32)[:, :, None]
    softened = ndimage.convolve(pixels, weights, mode="nearest") / weights.sum()
    combined = np.where(pimple_mask[:, :, None] == MASK_ON, softened, pixels)
    output = np.clip(np.rint(combined), 0, 255).astype(np.uint8)
    return Image.fromarray(output, "RGB")
