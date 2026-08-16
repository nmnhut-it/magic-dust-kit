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
MIN_SHARE = 0.001
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


# === TASK: average_skin_color ===
def average_skin_color(img, skin_mask):
    """Add up the colours of the selected skin pixels, then divide by how many there were.

    INPUT : one PIL image and its skin_mask (MASK_ON where the pixel is skin).
    OUTPUT: one (r, g, b) tuple of whole numbers - the "normal" colour of this
            person's skin in this light, used as the target for red spots.
    """
    picture = img.convert("RGB")
    # Three running totals plus a counter: the ordinary average, done by hand.
    total_red, total_green, total_blue, counted = 0, 0, 0, 0

    for y in range(picture.height):
        for x in range(picture.width):
            # The mask decides membership; only selected pixels join the average.
            if skin_mask[y][x] != MASK_ON:
                continue
            red, green, blue = picture.getpixel((x, y))
            # Each channel is averaged on its own - red never mixes with blue.
            total_red = total_red + red
            total_green = total_green + green
            total_blue = total_blue + blue
            counted = counted + 1

    # No skin found: return black rather than dividing by zero.
    if counted == 0:
        return (0, 0, 0)
    # Thousands of ordinary skin pixels outvote the few spot pixels, so the
    # average describes the skin even though the spots were counted too.
    return (round(total_red / counted), round(total_green / counted),
            round(total_blue / counted))


# === TASK: calm_redness ===
def calm_redness(img, spot_mask, skin_color, strength):
    """Move the marked red pixels toward skin_color; keep every other pixel.

    Blurring cannot remove redness, because the average of a red area is red.
    This function replaces the colour instead: every marked pixel slides along
    the line between its own colour and skin_color, and strength says how far.

    INPUT : img, spot_mask (MASK_ON where a red spot was found), skin_color from
            average_skin_color, strength 0.0 (no change) to 1.0 (target colour).
    OUTPUT: a new PIL image; img itself is never touched.
    """
    # .copy() is what protects the input: every write below lands on result.
    result = img.convert("RGB").copy()
    # The two shares always add to 1, so the mix stays inside 0..255 by itself.
    keep = 1 - strength

    for y in range(result.height):
        for x in range(result.width):
            # Outside the mask nothing is written, so those pixels stay original.
            if spot_mask[y][x] != MASK_ON:
                continue
            red, green, blue = result.getpixel((x, y))
            # Same mixing formula per channel: old * keep + target * strength.
            result.putpixel((x, y), (
                round(red * keep + skin_color[0] * strength),
                round(green * keep + skin_color[1] * strength),
                round(blue * keep + skin_color[2] * strength),
            ))
    return result


# === TASK: heal_spots ===
def heal_spots(img, radius, span):
    """Reduce every red area on the skin, not just the single-pixel ones.

    Three upgrades over calm_redness: a wide comparison area (a whole blotch
    stands out, not only its rim), a soft 0..1 amount instead of a yes/no mask
    (no visible patch edge), and a target that keeps the local brightness (the
    cheek stays shaded and the bump's own shadow flattens with its colour).
    """
    picture = img.convert("RGB")
    pixels = np.asarray(picture, dtype=np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    redness = red - (green + blue) / 2
    brightness = (red + green + blue) / 3

    # The same tool detect_pimples used, only much wider than 5.
    wide_redness = ndimage.uniform_filter(redness, size=radius, mode="nearest")
    wide_brightness = ndimage.uniform_filter(brightness, size=radius, mode="nearest")

    skin_mask = detect_skin(picture)
    skin_color = average_skin_color(picture, skin_mask)
    skin_brightness = sum(skin_color) / 3

    result = picture.copy()
    height, width = pixels.shape[:2]
    for y in range(height):
        for x in range(width):
            if skin_mask[y][x] != MASK_ON:
                continue
            # How much redder is this pixel than the wide area around it?
            excess = redness[y][x] - wide_redness[y][x]
            share = min(1.0, max(0.0, excess / span))
            if share == 0:
                continue
            # The light here, measured on the surrounding skin, not on the spot.
            scale = wide_brightness[y][x] / skin_brightness
            healed = []
            for channel in range(3):
                target = skin_color[channel] * scale
                value = pixels[y][x][channel] * (1 - share) + target * share
                healed.append(int(min(255, max(0, round(value)))))
            result.putpixel((x, y), tuple(healed))
    return result


# === TASK: choose_smooth_area ===
def choose_smooth_area(skin_mask, face_mask, feature_mask):
    """Decide where smoothing is allowed: on the skin, inside the face, off the features.

    Pure mask algebra. The ~ is the important part: smoothing lips and eyes is
    exactly what makes an edited photo look plastic.
    """
    is_skin = np.asarray(skin_mask) == MASK_ON
    # A missing Face Mesh mask must not block everything: no face_mask means the
    # whole picture is allowed, no feature_mask means nothing needs protecting.
    inside_face = (np.ones_like(is_skin) if face_mask is None
                   else np.asarray(face_mask) == MASK_ON)
    is_feature = (np.zeros_like(is_skin) if feature_mask is None
                  else np.asarray(feature_mask) == MASK_ON)

    allowed = is_skin & inside_face & ~is_feature
    return np.where(allowed, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: smooth_skin ===
def smooth_skin(img, area_mask, strength, radius):
    """Even out the skin inside area_mask: average the COLOUR wide, keep the LIGHT.

    A 3x3 blur only softens grain; blotches are twenty pixels across, so the
    colour has to be averaged over a wide area to even out. Averaging the light
    as well would flatten the nose and jaw, so the brightness is kept from a
    small blur - the same "keep the local light" idea heal_spots uses.
    """
    picture = img.convert("RGB")
    pixels = np.asarray(picture, dtype=np.float32)
    allowed = (np.asarray(area_mask) == MASK_ON).astype(np.float32)

    def wide_average(layer):
        """Average counting ONLY allowed pixels, so background and lips never bleed in."""
        total = ndimage.uniform_filter(layer * allowed, size=radius, mode="nearest")
        count = ndimage.uniform_filter(allowed, size=radius, mode="nearest")
        return np.where(count > MIN_SHARE, total / np.maximum(count, MIN_SHARE), layer)

    soft = np.stack([wide_average(pixels[:, :, channel]) for channel in range(3)], axis=2)
    # The light comes from the student's own convolve_layer: a small blur keeps
    # shading and structure while the colour underneath is evened out.
    light = convolve_layer(pixels.mean(axis=2), SOFTEN_KERNEL, sum(sum(row) for row in SOFTEN_KERNEL))
    soft_light = soft.mean(axis=2)
    scale = np.where(soft_light > MIN_SHARE, light / np.maximum(soft_light, MIN_SHARE), 1.0)

    toned = soft * scale[:, :, None]
    mixed = pixels * (1 - strength) + toned * strength
    output = np.where(allowed[:, :, None] > 0, mixed, pixels)
    return Image.fromarray(np.clip(np.rint(output), 0, 255).astype(np.uint8), "RGB")
