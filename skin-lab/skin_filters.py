"""Skin Lab: learn with small calculations, then process images with NumPy and SciPy.

Complete eight functions in the order the notebook teaches them. Every one is a
working skeleton with commented ___ blanks: you supply the ideas, never the
scaffolding.

    skin_evidence  ->  convolve_layer     ->  detect_skin
                   ->  detect_pimples     ->  remove_pimples
                   ->  average_skin_color ->  calm_redness  ->  heal_spots

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
MIN_SHARE = 0.001
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


# === TASK: average_skin_color ===
def average_skin_color(img, skin_mask):
    """Add up the colours of the selected skin pixels, then divide by how many there were.

    WHAT IT DOES: turns a whole skin region into one colour - the target that the
    next function will paint the red spots with.
    HOW IT WORKS: the ordinary average, done by hand. Walk every pixel, count only
    the ones the mask selected, keep one running total per channel, then divide.
    Spot pixels are counted too, but a few dozen of them cannot move an average
    made of thousands of ordinary skin pixels.
    """
    # TASK 6 - fill the three ___ blanks, top to bottom. Plain counting, no kernels.
    # skin_mask[y][x] is one decision: MASK_ON (255) means "this pixel is skin".
    # Blank 1: the value a selected pixel has in the mask.
    # Blank 2: add this pixel's green value to the running total.
    # Blank 3: turn the blue total into an average.
    picture = img.convert("RGB")
    total_red, total_green, total_blue, counted = 0, 0, 0, 0

    for y in range(picture.height):
        for x in range(picture.width):
            if skin_mask[y][x] != ___:
                continue
            red, green, blue = picture.getpixel((x, y))
            total_red = total_red + red
            total_green = ___
            total_blue = total_blue + blue
            counted = counted + 1

    if counted == 0:
        return (0, 0, 0)
    return (round(total_red / counted), round(total_green / counted), round(___))


# === TASK: calm_redness ===
def calm_redness(img, spot_mask, skin_color, strength):
    """Move the marked red pixels toward skin_color; keep every other pixel.

    WHAT IT DOES: takes the redness out of the spots by changing their colour,
    which blurring cannot do - the average of a red area is still red.
    HOW IT WORKS: each marked pixel slides along the line between its own colour
    and skin_color. strength says how far it slides: 0.0 stays, 1.0 arrives.
    """
    # TASK 7 - fill the three ___ blanks, top to bottom.
    # The red line below is done for you. Read it, then copy its shape twice.
    # Blank 1: the value a marked pixel has in the mask.
    # Blank 2: the target number for green - the matching entry in skin_color.
    # Blank 3: the pixel's own blue value, the one being moved.

    # .copy() is what protects the input: every write below lands on result,
    # so img itself is never touched.
    result = img.convert("RGB").copy()
    # keep and strength always add up to 1, so the mix cannot leave 0..255.
    keep = 1 - strength

    for y in range(result.height):
        for x in range(result.width):
            # Nothing is written outside the mask, so those pixels stay original.
            if spot_mask[y][x] != ___:
                continue
            red, green, blue = result.getpixel((x, y))
            # One line per channel, all three the same shape:
            #     old * keep + target * strength
            result.putpixel((x, y), (
                round(red * keep + skin_color[0] * strength),
                round(green * keep + ___ * strength),
                round(___ * keep + skin_color[2] * strength),
            ))
    return result


# === TASK: heal_spots ===
def heal_spots(img, radius, span):
    """Reduce every red area on the skin, not just the single-pixel ones.

    WHAT IT DOES: this is the function that actually clears the acne photo.
    HOW IT WORKS: three upgrades over calm_redness, one blank each.
      1. WIDE comparison. detect_pimples compared a pixel with a 5x5 area, so a
         blotch ten pixels across never looked redder than its own middle. Here
         the comparison area is `radius` wide, so a whole blotch stands out.
      2. A SOFT amount instead of a yes/no mask. share = excess / span, cut to
         0..1: barely-red pixels barely change, very red pixels change fully.
         No hard mask edge means no visible patch.
      3. A TARGET THAT KEEPS THE LIGHT. The target is the average skin colour
         scaled to the brightness of the surrounding skin, so cheeks stay
         shaded, and the bump's own shadow flattens out with its colour.
    """
    picture = img.convert("RGB")
    pixels = np.asarray(picture, dtype=np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    redness = red - (green + blue) / 2
    brightness = (red + green + blue) / 3

    # GIVEN - the two wide averages. uniform_filter is the tool detect_pimples
    # already used; the only change is that `radius` is much bigger than 5.
    wide_redness = ndimage.uniform_filter(redness, size=radius, mode="nearest")
    wide_brightness = ndimage.uniform_filter(brightness, size=radius, mode="nearest")

    # GIVEN - your own two functions supply the region and its average colour.
    skin_mask = detect_skin(picture)
    skin_color = average_skin_color(picture, skin_mask)
    skin_brightness = sum(skin_color) / 3

    # TASK 8 - fill the five ___ blanks, top to bottom. Each one is a piece of an
    # idea you have already met; the loop is the one from calm_redness.
    # Blank 1: compare with the WIDE area, not with the pixel itself.
    # Blank 2: the amount of extra redness you just measured.
    # Blank 3: the brightness of the surrounding skin.
    # Blank 4: what turns the average colour into the locally-lit target.
    # Blank 5: how far this pixel moves - the soft amount, not a yes/no.
    result = picture.copy()
    height, width = pixels.shape[:2]

    for y in range(height):
        for x in range(width):
            if skin_mask[y][x] != MASK_ON:
                continue
            # How much redder is this pixel than the wide area around it?
            excess = redness[y][x] - ___
            # A soft 0..1 amount instead of a yes/no mask, so there is no patch edge.
            share = min(1.0, max(0.0, ___ / span))
            # share == 0 is most of the face: ordinary skin, nothing to do.
            if share == 0:
                continue
            # The light here, measured on the surrounding skin, not on the spot.
            scale = ___ / skin_brightness
            healed = []
            for channel in range(3):
                target = skin_color[channel] * ___
                # The calm_redness blend again, with share in place of strength.
                value = pixels[y][x][channel] * (1 - share) + target * ___
                healed.append(int(min(255, max(0, round(value)))))
            result.putpixel((x, y), tuple(healed))
    return result


# === TASK: choose_smooth_area ===
def choose_smooth_area(skin_mask, face_mask, feature_mask):
    """Decide where smoothing is allowed: on the skin, inside the face, off the features.

    WHAT IT DOES: builds the "you may touch this" region for the last step.
    HOW IT WORKS: pure mask algebra. Face Mesh gives two regions - the face oval
    (where a face is) and the features (lips and both eyes). Your own detect_skin
    gives the third. A pixel is smoothable only when it is skin AND inside the
    face AND NOT part of a feature. Smoothing lips or eyes is what makes a photo
    look plastic, so the NOT is the important one.

    INPUT : three 0/255 masks of the same height and width. face_mask or
            feature_mask may be None when Face Mesh found no face.
    OUTPUT: one 0/255 mask.
    """
    # GIVEN - turn each mask into True/False. A missing Face Mesh mask must not
    # block everything, so "no face_mask" means "the whole picture is allowed"
    # and "no feature_mask" means "nothing needs protecting".
    is_skin = np.asarray(skin_mask) == MASK_ON
    inside_face = (np.ones_like(is_skin) if face_mask is None
                   else np.asarray(face_mask) == MASK_ON)
    is_feature = (np.zeros_like(is_skin) if feature_mask is None
                  else np.asarray(feature_mask) == MASK_ON)

    # TASK 9 - fill the three ___ blanks, top to bottom.
    # Use &, and ~ for "not", the same way detect_skin combined its conditions.
    # Blank 1: the pixel must be skin.
    # Blank 2: it must also be inside the face oval.
    # Blank 3: it must NOT be a lip or an eye - put ~ in front of that mask.
    allowed = ___ & ___ & ___
    return np.where(allowed, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: smooth_skin ===
def smooth_skin(img, area_mask, strength, radius):
    """Even out the skin inside area_mask: average the COLOUR wide, keep the LIGHT.

    WHAT IT DOES: the step that finally makes the skin look even.
    HOW IT WORKS: a 3x3 blur only softens grain, and a blotch is twenty pixels
    across, so the colour is averaged over a WIDE area instead. Averaging the
    light too would flatten the nose and jaw into a mask, so the brightness is
    kept from a small blur - the same "keep the local light" idea as heal_spots.
    """
    picture = img.convert("RGB")
    pixels = np.asarray(picture, dtype=np.float32)
    allowed = (np.asarray(area_mask) == MASK_ON).astype(np.float32)

    # GIVEN - a masked average: it counts ONLY allowed pixels, so the dark
    # background and the lips never bleed into the cheek. Dividing the blurred
    # picture by the blurred mask is what makes that work.
    def wide_average(layer):
        total = ndimage.uniform_filter(layer * allowed, size=radius, mode="nearest")
        count = ndimage.uniform_filter(allowed, size=radius, mode="nearest")
        return np.where(count > MIN_SHARE, total / np.maximum(count, MIN_SHARE), layer)

    # TASK 10 - fill the four ___ blanks, top to bottom.
    # Blank 1: the colour layer to average wide - one channel at a time.
    # Blank 2: the light. Use YOUR convolve_layer on the brightness with the
    #          small SOFTEN_KERNEL, so shading and structure survive.
    # Blank 3: put the kept light back on top of the evened colour.
    # Blank 4: how far the pixel moves - the same mixing formula as always.
    soft = np.stack([wide_average(___) for channel in range(3)], axis=2)
    light = ___
    soft_light = soft.mean(axis=2)
    scale = np.where(soft_light > MIN_SHARE, ___ / np.maximum(soft_light, MIN_SHARE), 1.0)

    toned = soft * scale[:, :, None]
    mixed = pixels * (1 - strength) + toned * ___
    output = np.where(allowed[:, :, None] > 0, mixed, pixels)
    return Image.fromarray(np.clip(np.rint(output), 0, 255).astype(np.uint8), "RGB")
