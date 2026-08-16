"""Sinh hai notebook Skin Lab từ nội dung và code nguồn ổn định.

Chỉ sửa file này và hai file skin_filters*.py. Không sửa trực tiếp .ipynb.
"""

import json
import pathlib
import re
import sys


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
COURSE_VERSION = "2026.08.07.2"
PRACTICE_FILE = "Skin_Lab.ipynb"
SOLUTION_FILE = "Skin_Lab_Answers.ipynb"
TASK_ORDER = (
    "shared",
    "convolve_layer",
    "skin_evidence",
    "detect_skin",
    "detect_pimples",
    "remove_pimples",
    "average_skin_color",
    "calm_redness",
    "heal_spots",
)


def _source(text):
    lines = text.strip("\n").split("\n")
    return [line + "\n" for line in lines[:-1]] + [lines[-1]]


def markdown_cell(cell_id, text):
    return {
        "id": cell_id,
        "cell_type": "markdown",
        "metadata": {"stable_id": cell_id},
        "source": _source(text),
    }


def code_cell(cell_id, text, tags=()):
    return {
        "id": cell_id,
        "cell_type": "code",
        "execution_count": None,
        "metadata": {"stable_id": cell_id, "tags": list(tags)},
        "outputs": [],
        "source": _source(text),
    }


def read_task_blocks(file_name):
    """Tách module Python theo marker; module vẫn chạy bình thường khi import."""
    text = (HERE / file_name).read_text(encoding="utf-8")
    marker = re.compile(r"^# === TASK: ([a-z_]+) ===\s*$", re.MULTILINE)
    matches = list(marker.finditer(text))
    blocks = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks[match.group(1)] = text[match.end():end].strip()
    missing = set(TASK_ORDER) - set(blocks)
    if missing:
        raise ValueError("Thiếu block code: %s" % ", ".join(sorted(missing)))
    return blocks


# Learner-facing lesson text. The lesson ships in English; practice and answer
# notebooks are built from the same constants so they always speak in one voice.
TITLE = """# Skin Lab — How does code change a photograph?

You will build an image-processing pipeline from eight small functions, then wire them together yourself. Start with a **7 × 7 pixel image**, where every
pixel is just three numbers. Then use **NumPy**, **SciPy**, and **Pillow** to run the same calculations across a full image.
At the end, **MediaPipe Face Mesh** adds a face boundary so the program changes pixels only where it is allowed.

### Your goal

By the end of the lab, you will be able to:

- explain how RGB numbers make a colour;
- turn a colour rule into a black-and-white mask;
- use a 3 × 3 kernel to count or blend neighbouring pixels;
- find a red spot by comparing it with its local area;
- average a selected region into one colour and blend red spots toward it;
- combine masks to smooth texture, soften red areas, and adjust brightness on one photograph;
- assemble those steps into a pipeline of your own and defend its order;
- write the healer that clears a real photograph, and explain with numbers why it works where the simple rule failed.

### How you will know the pipeline works

Every observation cell gives you **numbers, an image or overlay, and a short explanation**. The numbers show the calculation.
The image shows which pixels were selected. The explanation connects those two pieces of evidence.

### Six checkpoints — stop after any one of them

1. **RGB:** I can point to one matrix position and read its R, G, and B values.
2. **Masks:** I can explain why a rule writes `0` or `255` at that position.
3. **Convolution:** I can trace a 3 × 3 window through multiply → add → divide → one output value.
4. **Selective change:** I can explain why a mask changes some pixels and keeps others.
5. **Colour:** I can explain why averaging a red blotch keeps it red, and what replacing the colour does instead.
6. **Portrait pipeline:** I can use a difference panel and pixel count to defend one setting of my own healer.

The page saves after every edit. You are not expected to finish all six checkpoints in one sitting.

This is a lesson about image-processing algorithms. It is **not a diagnostic tool and it does not rate anyone's skin**.
Lighting, cameras, backgrounds, and different skin tones can all make a hand-written colour rule fail.

Your code, checked steps, and current place are saved automatically in this browser. A captured or uploaded image is never
stored in `localStorage`. Use **Download notebook** if you want to move your work to another computer.
"""

SETUP = """## Start here

Run the next two cells. The first loads the visual tools. The second loads NumPy, SciPy, Pillow, and the constants used by
the first five functions. Do not edit these two cells yet.

You do not need a personal photo for most of the lab. A 7 × 7 image, a drawn face, and four public-licence photographs are
already included. The camera is used only once, in the final optional test.

Two kinds of picture appear, on purpose:

- **Real photographs** wherever you judge a result by eye — the filter and kernel galleries, the Face Mesh boundary, the
  skin region, and the whole final pipeline. A blur or an edge filter means nothing on flat cartoon colour.
- **The drawn face** wherever you must be able to count what happened. Its red spots are single bright pixels, so the
  simple detector you are about to write provably fires on them and you can check the pixel counts by hand. On a real
  photograph that same detector finds nothing — that is a real limit, and the lab shows you exactly where and why later.

### The four kinds of cells on this page

1. **Watch cells** — press ▶ and read the numbers and pictures that appear. You never edit these.
2. **Interactive panels** — click buttons and sliders, then answer the panel's new-case question. A correct answer unlocks
   the matching Python code.
3. **Coding tasks** — code with `___` blanks. Replace every `___`, then press ▶. A task cell only teaches Python your
   function — it prints nothing itself. The proof appears when you run the check cell below it. Every one of the eight
   is a working skeleton: the loops, the comments and the plumbing are already there, and the blanks are the ideas.
4. **Check cells** — they run your function and print OK or FIX with a reason.

For each coding task, read all four lines before editing:

- **Given:** values or tools already supplied;
- **INPUT:** data that enters the function;
- **PROCESS:** the exact code operation to complete;
- **OUTPUT:** the number, shape, type, or image that proves your code works.

### If red error text appears

Read only the last line first — it names the problem:

| The last line says | What it means | What to do |
|---|---|---|
| `name '___' is not defined` | a blank is still in the code | replace every `___`, run the cell again |
| `name 'skin_evidence' is not defined` | an earlier cell was never run | run the cells above, or press **▶ Run all** |
| any other error with `In this code cell, line N` | line `N` of your own code broke | read exactly that line and compare it with the worked example above the task |

An error never deletes your work. Fix the line and run the cell again.
"""

GLOSSARY = """### Words this lab repeats

Whenever a sentence stops making sense, come back to this table.

| Word | Meaning in this lab | Example |
|---|---|---|
| pixel | one dot of the picture, stored as three numbers | `(225, 62, 66)` |
| channel | one of the three number layers: R, G, or B | `pixels[:, :, 0]` is every red value |
| `:` | "every" — it keeps a whole direction instead of picking one | `pixels[2, :, 0]` = every red value in row 2 |
| mask | a map of decisions: `255` = selected, `0` = not selected | `skin_mask` |
| threshold | the line a number must cross to count as a yes | `count >= 5` |
| kernel | a small grid of instructions moved across the image | the 3 × 3 blur grid of nine `1`s |
| convolution | multiply the window by the kernel, add, write one output | `ndimage.convolve` |
| divisor | the number the sum is divided by so brightness stays fair | `/ 9` after nine `1` weights |
| overlay | the original picture with the selected pixels tinted | yellow tint = skin region |
"""

PHENOMENON = """## First observation — what must the program produce?

Run the next cell before writing code. It shows one input image and three outputs:

1. `skin_mask`: white (`255`) means “this pixel may be part of the skin region”; black (`0`) means “do not select it.”
2. `pimple_mask`: white (`255`) marks a locally red area for stronger smoothing; black (`0`) keeps the original colour.
3. final image: only selected pixels receive a calculated replacement colour.

A mask is a location map, not a colour photograph. The numbers `0` and `255` do not describe a person's skin and are not
a score. The function name `detect_pimples` is already part of the project; in this lesson, read it as “find locally red
pixels,” not as a medical judgement. Before you continue, predict this: **why show both the mask and the final image?**
"""

RGB_PIXEL = """## Mechanism 1 — one pixel contains three RGB numbers

Open the interactive panel and select the centre pixel. Its colour is `(225, 62, 66)`, so `R = 225`, `G = 62`, and
`B = 66`. Move one slider at a time. Watch the colour swatch and the three channel swatches.

To keep only the red channel, the program keeps `R = 225` and sets the other two values to zero:

```text
(225, 62, 66) → (225, 0, 0)
```

Green-only and blue-only use the same operation. Complete the panel's prediction with a different set of numbers before
the matching Python code is revealed.
"""

NUMPY_INTRO = """## From one pixel to a whole image with NumPy

Before using a photograph, build a **5 × 5 colour matrix**. Each position stores an RGB triplet. This tiny image has a
blue border, a 3 × 3 skin-coloured region, and one red centre pixel. The simple pattern makes every number traceable.

The panel selected a pixel by row and column. NumPy starts counting both at **0**, so a 5 × 5 matrix has row numbers
`0, 1, 2, 3, 4` and column numbers `0, 1, 2, 3, 4`:

- `pixels[2, 2]` reads the red centre pixel;
- `pixels[:, :, 0]` reads the red value at every row and column;
- `pixels[:, :, 1]` reads every green value;
- `pixels[:, :, 2]` reads every blue value.

### What the `:` means

Inside the brackets the order never changes: `[row, column, channel]`. A number in a slot picks **one**. A colon in a
slot picks **all of them** — read `:` out loud as "every".

| Written | Read it as | What you get back |
|---|---|---|
| `pixels[2, 2]` | row `2`, column `2`, every channel | one pixel: 3 numbers |
| `pixels[2, 2, 0]` | row `2`, column `2`, channel `0` | one number: the red value `225` |
| `pixels[2, :, 0]` | row `2`, **every** column, channel `0` | one row of red values: 5 numbers |
| `pixels[:, :, 0]` | **every** row, **every** column, channel `0` | the whole red matrix: 25 numbers |

That last line is why the lab almost never needs a loop. `pixels[:, :, 0] - 10` subtracts `10` from all 25 red values in
one step, and `pixels[:, :, 0] - (pixels[:, :, 1] + pixels[:, :, 2]) / 2` calculates the redness of all 25 pixels at
once. You write the calculation once and NumPy applies it everywhere.

Two shapes to keep apart, because the error messages mention them:

- `pixels[:, :, 0]` has shape `(5, 5)` — a flat number matrix, one value per position, exactly like a mask;
- `pixels` has shape `(5, 5, 3)` — three of those matrices stacked, one per channel.

For this example, `pixels.shape` is `(5, 5, 3)`: 5 rows, 5 columns, and 3 channels. The last `3` does **not** mean another
row. It means every position stores three channel values. Separating the channels produces three ordinary 5 × 5 number
matrices. At row 2, column 2, they contain `R = 225`, `G = 62`, and `B = 66`; putting those values back in that order
rebuilds the red centre colour `(225, 62, 66)`.

Run the next two cells. First read the complete matrix and select one position. Then inspect six panels: the RGB matrix,
the R/G/B number matrices shown as coloured intensities, the rebuilt RGB matrix, and the difference matrix. A maximum
difference of `0` proves that all 25 colours were rebuilt without losing a channel value.
"""

MATRIX_CHANGE = """### Worked example — change one number, then trace the colour

Use a copy so the original matrix stays unchanged. The example edits `pixels[2, 2, 2]`:

```text
first 2  = row 2
second 2 = column 2
last 2   = B channel
B changes from 66 to 220
(225, 62, 66) → (225, 62, 220)
```

Before running the cell, predict three things: **which square changes, which channel changes, and what RGB triplet appears?**
The output then shows BEFORE, AFTER, and ABSOLUTE DIFFERENCE. Exactly `1/25` pixels and `1/75` channel values should change.

After the worked run, change `channel` to `0` or `1`, or choose another row and column. Make a prediction before each run.
"""

LIBRARIES = """## The library operations used in this project

The interactive panels let you calculate one small example. The project uses library functions to repeat the same
operation at every pixel:

| Image operation | Library call |
|---|---|
| Multiply and add values in a 3 × 3 area | `scipy.ndimage.convolve` |
| Find the mean of a 5 × 5 area | `scipy.ndimage.uniform_filter` |
| Expand one selected pixel into a 3 × 3 area | `scipy.ndimage.maximum_filter` |
| Choose the new or original RGB value at each pixel | `np.where` |
| Keep channel values between 0 and 255 | `np.clip` |
| Turn an array back into a picture | `Image.fromarray` |

You do not need a Python loop for every row and column. Your job is to send the correct arrays into each library function,
then check the result with both numbers and images.
"""

EVIDENCE = """## Mechanism 2 — turn RGB evidence into 0 or 255

Start with the pixel `(183, 127, 103)`. Substitute those values into the three calculations:

```text
brightness = (183 + 127 + 103) // 3 = 413 // 3 = 137
warmth = 183 - 103 = 80
red_green_gap = 183 - 127 = 56
```

All three results satisfy the conditions in the starter code, so this pixel receives `255` and appears white in the mask.

Now test the blue background `(35, 80, 185)`:

```text
warmth = 35 - 185 = -150
-150 >= 8 → False → mask value 0
```

This is a deliberately simple RGB rule for learning the mechanism. It will not identify every skin tone under every kind
of lighting. Later, public photographs will help you find its limits.
"""

TASK_EVIDENCE = """### Coding task 1 of 10 — complete `skin_evidence`

Mechanism 2 showed the rule on one pixel. Now write the same rule as code.

- **Given:** `red`, `green`, and `blue`, either as three numbers or three arrays with the same shape.
- **INPUT:** no outside input yet; later `detect_skin` will pass in the three channels of an image.
- **PROCESS:** fill the three `___` blanks, top to bottom:
  1. `warmth` — the red value minus the blue value: `red - blue`.
  2. `red_green_gap` — the red value minus the green value: `red - green`.
  3. Inside `np.where(___, MASK_ON, MASK_OFF)` — the question asked at every pixel: `looks_like_skin`.
     Remember the order: `np.where(question, value_if_yes, value_if_no)` — the question always comes first.
- **OUTPUT:** run this cell (it prints nothing — it only teaches Python the function), then run the check cell below it.
  `(183, 127, 103)` must return `255`; `(35, 80, 185)` must return `0`. Array input must produce a
  two-dimensional `uint8` array with the same height and width.
"""

VOTES = """## Mechanism 3 — use nearby pixels to repair one uncertain decision

The centre red pixel fails the RGB rule, so its raw mask value is `0`. The eight nearby pixels pass and have value `255`.
Before counting, the program changes `255` to `1` and leaves `0` as `0`:

```text
count = 1 + 1 + 1 + 1 + 0 + 1 + 1 + 1 + 1 = 8
8 >= 5 → True → centre skin_mask value = 255
```

The centre stays inside the selected region because 8 of the 9 nearby decisions pass the rule. The required count `5` is a
**majority**: more than half of the 9 pixels in the square must agree. This is a cause-and-effect choice: lowering the
required count selects more pixels; raising it selects fewer. Change the threshold in the panel and observe the exact
count before moving on.
"""

CONVOLUTION = """## How a 3 × 3 kernel calculates one new value

`convolve_layer` centres a 3 × 3 kernel on the pixel being calculated. It multiplies each image value by the kernel value
in the same position, adds the nine products, and then divides by `divisor`.

Suppose the eight outer values are `10`, the centre is `90`, and all nine kernel values are `1`:

```text
total = 8 × 10 + 1 × 90 = 170
new_value = 170 / 9 = 18.89
```

The centre output is `18.89`, not just an unexplained number: it is the local average. The value `90` became less dominant
because it was blended with eight values of `10`.

`ndimage.convolve` performs this calculation at every pixel. `mode="nearest"` handles an edge by reusing the value of the
nearest border pixel when part of the 3 × 3 area would fall outside the image.
"""

FILTER_LAB = """### Worked filter lab — why one convolution becomes different filters

A **kernel is a small matrix of instructions**. Keep the same image values and change only the kernel:

```text
kernel      = the small instruction matrix
convolution = move it, multiply matching cells, add, and write one output
filter      = the visible effect produced by those repeated outputs
```

| Kernel | Centre calculation for eight `10`s around centre `90` | What the output means |
|---|---|---|
| Identity | `1 × 90 = 90` | keep the centre |
| Blur | `(8 × 10 + 90) / 9 = 18.89` | move the centre toward its neighbours |
| Sharpen | `5 × 90 - 4 × 10 = 410 → clip to 255` | increase the difference from side neighbours |
| Edge | `8 × 90 - 8 × 10 = 640 → clip to 255` | report a strong local change |

For a flat area of nine `10`s, the edge calculation is `8 × 10 - 8 × 10 = 0`. This is the key idea: an edge filter gives
small output on flat areas and large output where nearby values differ.

Open the first panel and select all four kernels. It reveals the input, kernel, nine products, sum, divisor, and clipped
output. Then run the RGB example: the same blur is calculated separately for R, G, and B and rebuilt as `(188, 120, 99)`.

Finally, open the 7 × 7 scanner:

1. **Find a vertical edge:** a `−1, 0, +1` kernel returns `0` on flat columns and a large value where `0` changes to `1`.
2. **Find a large patch:** a kernel of nine `1`s counts nearby selected cells. An isolated `1` scores only `1`, while the
   centre of a 3 × 3 patch scores `9`. The threshold `count >= 5` rejects the dot and keeps the patch.

Use **Next** to reveal the window, kernel, products, and full output map in order. Move the yellow window and predict the
new output before revealing it.
"""

CONVOLUTION_TRANSFER = """### Checkpoint — can you transfer the convolution idea?

Do not copy a number from the table. Use the mechanism to predict four new outputs:

1. A flat 3 × 3 area of `1`s uses the edge kernel with eight `−1`s and centre `8`.
2. A patch counter sees one isolated selected pixel.
3. The same counter sits at the centre of a filled 3 × 3 patch.
4. The RGB blur uses the three channel calculations shown above.

Fill the four blanks, then run the cell. A complete explanation must connect each number to what appears in the output map.
"""

SEE_EVIDENCE = """### See your own rule work — and write the seeing yourself

You just wrote a rule. Now write the code that **shows** it, because looking at your own output is half of
image processing and it should not be something a library does for you behind your back.

The only helper is `magic_mirror.show_images(pictures, labels)`, and it does exactly one thing: put pictures on a
grid with captions under them. It never looks at a pixel and never runs your rule. Deciding *what* to show — and what
to call it — is the whole job, and it is yours.

- **Given:** three sample colours, the empty lists, and the `show_images` call.
- **PROCESS:** fill the four `___` blanks, top to bottom:
  1. `Image.new("RGB", TILE, ___)` — the sample colour itself, so the top row is what went in.
  2. 3. 4. `skin_evidence(___, ___, ___)` — your rule needs the three channels separately, and `colour` is the
     tuple `(red, green, blue)`. `colour[0]` is the red one.
- **OUTPUT:** two rows. The top row is the three input colours. The bottom row is your rule's answer for each.

Watch what the bottom row actually is. Your rule returns `0` or `255`, and a grey tile of `(v, v, v)` is exactly how a
mask *looks*: `255` is white, `0` is black. That is the same white-and-black picture every later mask cell shows —
you are not looking at a diagram of the answer, you are looking at the answer.

Then change something and run it again. Add a colour of your own to `SAMPLES` — a green one, your own skin, a
wall — and predict the answer before you press ▶. A rule you cannot predict is a rule you do not understand yet.
"""

SEE_EVIDENCE_Q = '''TILE = (80, 60)
SAMPLES = (
    ("SKIN (183,127,103)", (183, 127, 103)),
    ("RED SPOT (225,62,66)", (225, 62, 66)),
    ("BLUE BG (35,80,185)", (35, 80, 185)),
)


def show_my_evidence(samples):
    """Top row: the colours. Bottom row: what my skin_evidence says about each."""
    pictures, labels = [], []
    for name, colour in samples:
        pictures.append(Image.new("RGB", TILE, ___))
        labels.append(name)
    for name, colour in samples:
        answer = skin_evidence(___, ___, ___)
        # A mask value IS a grey level: 255 draws white, 0 draws black.
        pictures.append(Image.new("RGB", TILE, (answer, answer, answer)))
        labels.append("MASK = %d" % answer)
    return magic_mirror.show_images(pictures, labels, columns=3)


show_my_evidence(SAMPLES)
'''

SEE_EVIDENCE_A = SEE_EVIDENCE_Q.replace(
    'Image.new("RGB", TILE, ___)', 'Image.new("RGB", TILE, colour)'
).replace(
    "skin_evidence(___, ___, ___)", "skin_evidence(colour[0], colour[1], colour[2])"
)

SEE_CONVOLUTION = """### See your kernel run on a real photograph — your code again

`convolve_layer` handles **one** layer of numbers. A photograph has three. Joining them back into a picture is the
step that turns a maths function into an image filter, and it is worth writing once yourself.

- **Given:** the photo, `SOFTEN_KERNEL`, and the line that turns the finished numbers back into a picture.
- **PROCESS:** fill the three `___` blanks — the kernel and divisor your own function needs, then the axis
  `np.stack` joins on. R, G and B are the **third** axis of an image array, and NumPy counts from `0`.
- **OUTPUT:** the photo before and after, side by side.

The nine weights add up to `16`, which is why the divisor is `16`: divide by the total and the picture keeps its
brightness. Try `1` instead and watch it turn white.
"""

SEE_CONVOLUTION_Q = '''photo = magic_mirror.demo_face_photo((160, 120))


def show_my_convolution(picture, kernel, divisor):
    """Run my convolve_layer on R, G and B, then put the three answers back together."""
    pixels = np.asarray(picture, dtype=np.float32)
    channels = [convolve_layer(pixels[:, :, c], ___, ___) for c in range(3)]
    combined = np.stack(channels, axis=___)
    filtered = Image.fromarray(np.clip(np.rint(combined), 0, 255).astype(np.uint8), "RGB")
    return magic_mirror.show_images((picture, filtered), ("RGB INPUT", "COMBINED OUTPUT"), columns=2)


show_my_convolution(photo, SOFTEN_KERNEL, 16)
'''

SEE_CONVOLUTION_A = SEE_CONVOLUTION_Q.replace(
    "convolve_layer(pixels[:, :, c], ___, ___)", "convolve_layer(pixels[:, :, c], kernel, divisor)"
).replace("np.stack(channels, axis=___)", "np.stack(channels, axis=2)")

SEE_MASK = """### Draw your own mask — and write the drawing tool you will reuse

A mask is a grid of `0` and `255`. To *see* it you must turn those numbers into colours, and that is a function you
write once and then use for every mask in the rest of the lesson.

- **Given:** the photo and the call.
- **PROCESS:** fill the three `___` blanks:
  1. `== ___` — which value counts as selected.
  2. `np.where(selected, ___, 0)` — the colour to paint there. Black stays where the mask is `0`.
  3. `detect_skin(___)` — the picture to run your detector on.
- **OUTPUT:** the photo, then your mask painted in one colour.

`mask[:, :, None]` is the line worth understanding: a mask has one number per pixel and a colour needs three, so
`None` adds the missing third axis and NumPy repeats the decision across R, G and B.
"""

SEE_MASK_Q = '''photo = magic_mirror.demo_face_photo((160, 120))


def mask_picture(mask, colour):
    """Turn a 0/255 mask into a picture: colour where selected, black everywhere else.

    Written once here, reused by every later viewer cell.
    """
    selected = np.asarray(mask)[:, :, None] == ___
    painted = np.where(selected, ___, 0)
    return Image.fromarray(painted.astype(np.uint8), "RGB")


def show_my_mask(picture, mask, colour, title):
    """The photo next to the mask my own detector produced."""
    print(title, "selects", int((np.asarray(mask) > 0).sum()), "of", np.asarray(mask).size, "pixels.")
    return magic_mirror.show_images(
        (picture, mask_picture(mask, colour)), ("RGB INPUT", title), columns=2)


show_my_mask(photo, detect_skin(___), (255, 210, 80), "SKIN MASK")
'''

SEE_MASK_A = SEE_MASK_Q.replace(
    "[:, :, None] == ___", "[:, :, None] == MASK_ON"
).replace(
    "np.where(selected, ___, 0)", "np.where(selected, np.asarray(colour, dtype=np.uint8), 0)"
).replace("detect_skin(___)", "detect_skin(photo)")

SEE_PIMPLES = """### Draw the red-spot mask — now reuse what you already wrote

You do not write a new viewer for this. `mask_picture` and `show_my_mask` already exist, and a second mask is just a
second argument. That is what reusable code buys you.

- **PROCESS:** fill the two `___` blanks — the two things `detect_pimples` needs, in the right order.
- **OUTPUT:** the drawn face next to your red-spot mask.

Use the drawn face here, not the photograph: your 5 × 5 rule finds **nothing** on the real acne photo, for a reason
the lesson reaches much later. Watching your correct code select nothing would read as a bug.
"""

SEE_PIMPLES_Q = '''face = magic_mirror.skin_sample_image()

skin = detect_skin(face)
spots = detect_pimples(___, ___)
show_my_mask(face, spots, (255, 35, 45), "RED MASK")
'''

SEE_PIMPLES_A = SEE_PIMPLES_Q.replace("detect_pimples(___, ___)", "detect_pimples(face, skin)")

SEE_CLEANUP = """### See what changed — and write the second tool you will reuse

"It looks a bit different" is not evidence. A difference picture is: subtract the two images, take the size of the
change, and multiply so small changes become visible.

- **PROCESS:** fill the three `___` blanks:
  1. `np.abs(second - ___)` — subtract the original.
  2. `* ___` — the gain, so a change of 3 is not invisible. Use `gain`.
  3. `remove_pimples(___)` — the picture to clean.
- **OUTPUT:** before, after, and the magnified difference.

Bright means changed, dark means untouched. A correct selective filter gives an almost black picture with a few
bright specks — if yours is bright everywhere, it changed pixels it should have left alone.
"""

SEE_CLEANUP_Q = '''def difference_picture(before, after, gain=4):
    """Where did the picture change, and by how much? Reused by the next viewer too."""
    first = np.asarray(before, dtype=np.int16)
    second = np.asarray(after, dtype=np.int16)
    change = np.abs(second - ___) * ___
    return Image.fromarray(np.clip(change, 0, 255).astype(np.uint8), "RGB")


def show_my_change(before, after, labels=("BEFORE", "AFTER", "DIFFERENCE x4")):
    """Three panels: before, after, and where they differ."""
    changed = int(np.any(np.asarray(before) != np.asarray(after), axis=2).sum())
    print(changed, "pixels changed colour.")
    return magic_mirror.show_images(
        (before, after, difference_picture(before, after)), labels, columns=3)


face = magic_mirror.skin_sample_image()
show_my_change(face, remove_pimples(___))
'''

SEE_CLEANUP_A = SEE_CLEANUP_Q.replace(
    "np.abs(second - ___) * ___", "np.abs(second - first) * gain"
).replace("remove_pimples(___)", "remove_pimples(face)")

SEE_TARGET = """### See the one colour your average produced

`average_skin_color` returns three numbers. Three numbers are hard to judge and a colour is easy, so paint it.

- **PROCESS:** fill the two `___` blanks — the mask your average should count over, and the colour to fill the
  swatch with.
- **OUTPUT:** the face, the region that was averaged, and the single target colour beside it.

Check it by eye: the swatch should look like the skin in the picture. If it comes out grey or greenish, your average
is counting pixels the mask never selected.
"""

SEE_TARGET_Q = '''face = magic_mirror.skin_sample_image()

skin = detect_skin(face)
target = average_skin_color(face, ___)
print("The selected region averages to", target, "- the target the red spots get pulled toward.")
magic_mirror.show_images(
    (face, mask_picture(skin, (255, 210, 80)), Image.new("RGB", (160, 120), ___)),
    ("RGB INPUT", "AVERAGED REGION", "TARGET COLOUR"), columns=3)
'''

SEE_TARGET_A = SEE_TARGET_Q.replace(
    "average_skin_color(face, ___)", "average_skin_color(face, skin)"
).replace('Image.new("RGB", (160, 120), ___)', 'Image.new("RGB", (160, 120), target)')

SEE_CALM = """### See the colour blend work — reusing both of your tools

Nothing new to write here beyond the call itself: `show_my_change` and `difference_picture` are already yours.

- **PROCESS:** fill the two `___` blanks — the mask that says *which* pixels to recolour, and how far to move them.
- **OUTPUT:** before, after, and the difference, plus what one spot pixel became.

Compare this difference panel with the smoothing one above. Smoothing changed a ring of pixels around each spot;
this changes the spot itself, because it replaces the colour instead of averaging the neighbours.
"""

SEE_CALM_Q = '''face = magic_mirror.skin_sample_image()

skin = detect_skin(face)
spots = detect_pimples(face, skin)
target = average_skin_color(face, skin)
calmed = calm_redness(face, ___, target, ___)

# Sample the reddest pixel THE MASK SELECTED. Not the middle (it may be plain
# skin) and not the reddest overall - that is the middle of a blotch, which a
# 5 x 5 rule never selects, so a correct answer would print "no change".
values = np.asarray(face, dtype=np.float32)
redness = values[:, :, 0] - (values[:, :, 1] + values[:, :, 2]) / 2
marked = np.where(np.asarray(spots) == MASK_ON, redness, -1e9)
y, x = np.unravel_index(np.argmax(marked), marked.shape)
print("Marked pixel", face.getpixel((x, y)), "->", calmed.getpixel((x, y)))
show_my_change(face, calmed, ("BEFORE", "AFTER COLOUR BLEND", "DIFFERENCE x4"))
'''

SEE_CALM_A = SEE_CALM_Q.replace(
    "calm_redness(face, ___, target, ___)", "calm_redness(face, spots, target, 0.8)")

TASK_CONVOLVE = """### Coding task 2 of 10 — complete `convolve_layer`

You just traced multiply → add → divide by hand. This function makes SciPy repeat it at every pixel.

- **Given:** `layer` (the number grid), `kernel` (the instruction grid), and `divisor`; NumPy and SciPy are already imported.
- **INPUT:** the grader supplies a 5 × 5 array; there is no camera or file input in this task.
- **PROCESS:** fill the three `___` blanks, top to bottom:
  1. First blank in `ndimage.convolve(___, ___, mode="nearest")` — the prepared image numbers: `values`.
  2. Second blank in the same call — the prepared kernel: `weights`.
  3. `return ___ / divisor` — the array that `convolve` handed back: `filtered`.
- **OUTPUT:** if only the centre input is `9`, all nine weights are `1`, and `divisor = 9`, the centre output must be `1` —
  the nine window values add to `9`, and `9 / 9 = 1`. The original input must still contain its centre value `9`.
"""

TASK_SKIN = """### Coding task 3 of 10 — complete `detect_skin`

This function joins your first two: `skin_evidence` decides pixel by pixel, and `convolve_layer` counts the decisions.

- **Given:** a PIL image `img`, a 3 × 3 kernel of ones, and a required neighbour count of `5`. The first steps are already
  written: `pixels` reads the image, `skin_evidence` builds `raw_mask`, and `binary` turns `255` into `1`.
- **INPUT:** one image; in the final task it can be a captured or uploaded photograph.
- **PROCESS:** fill the two `___` blanks, top to bottom:
  1. Inside `convolve_layer(___, SKIN_VOTE_KERNEL, 1)` — the grid of `0/1` decisions to count: `binary`.
  2. Inside `np.where(___ >= SKIN_NEIGHBOURS_NEEDED, ...)` — the count to compare with the required `5`: `neighbour_count`.
- **OUTPUT:** a two-dimensional `uint8` array containing only `0` and `255`. The red centre of the drawn skin region must
  be `255`, while the centre of a solid blue image must be `0`.
"""

RED_GAP = """## Mechanism 4 — find a pixel that is redder than its local area

A high red channel alone is not enough: an entire photograph might have warm or red lighting. Instead, compare each pixel
with the 5 × 5 area around it.

First, turn “how red is this pixel?” into one number:

```text
redness = R - (G + B) / 2
```

In words: how much brighter the red channel is than the average of the other two. A grey pixel is not red at all:
`128 - (128 + 128) / 2 = 0`.

For the red pixel `(225, 62, 66)`:

```text
redness_spot = 225 - (62 + 66) / 2 = 225 - 64 = 161
```

For a nearby skin-coloured pixel `(183, 127, 103)`:

```text
redness_skin = 183 - (127 + 103) / 2 = 183 - 115 = 68
```

If the 5 × 5 area contains one red pixel and 24 surrounding pixels, then:

```text
local_redness = (161 + 24 × 68) / 25 = 1793 / 25 = 71.72
red_gap = 161 - 71.72 = 89.28
89.28 >= 24 → True → select the centre pixel
```

Finally, `maximum_filter` expands one selected pixel into a 3 × 3 area. That lets the later blend include nearby colour,
instead of changing only one isolated dot.
"""

TASK_PIMPLE = """### Coding task 4 of 10 — complete `detect_pimples`

Mechanism 4 compared one pixel with its 5 × 5 area. This function runs that comparison everywhere.

- **Given:** RGB image `img`, its `skin_mask`, a 5 × 5 local area, and threshold `24`. The `redness` grid is already
  calculated for you with `R - (G + B) / 2`.
- **INPUT:** one RGB image and the matching two-dimensional skin mask.
- **PROCESS:** fill the two `___` blanks, top to bottom:
  1. Inside `uniform_filter(___, size=5)` — the grid whose 5 × 5 mean is needed: `redness`.
  2. Inside `maximum_filter(___, size=3)` — the True/False grid to expand into 3 × 3 areas: `candidate`.
- **OUTPUT:** a `uint8` `pimple_mask`. The centre of the red test area must equal `255`; the image corner must equal `0`.
"""

SOFTEN = """## Mechanism 5 — calculate a replacement colour, then choose where to use it

The smoothing kernel gives the centre pixel weight `4`, its four side neighbours weight `2`, and its four diagonal
neighbours weight `1`. The nine weights add to `16`:

```text
1  2  1
2  4  2      weight total = 16
1  2  1
```

Read the nine weights as votes for the new colour: the centre keeps the largest vote (`4`), each side neighbour votes `2`,
and each corner votes `1`. That is why the calculated colour stays close to the original pixel while moving toward its
neighbours.

The centre is `(225, 62, 66)` and all eight neighbours are `(183, 127, 103)`. Calculate each channel separately:

```text
new_red   = (4 × 225 + 12 × 183) / 16 = 3096 / 16 = 193.5 → 194
new_green = (4 ×  62 + 12 × 127) / 16 = 1772 / 16 = 110.75 → 111
new_blue  = (4 ×  66 + 12 × 103) / 16 = 1500 / 16 = 93.75 → 94
```

The calculated colour is `(194, 111, 94)`. Then `np.where` makes a separate decision at each location:

- `pimple_mask == 255` → use `(194, 111, 94)`;
- `pimple_mask == 0` → keep the original `(225, 62, 66)`.

The program may calculate a smoothed version of the whole image, but the mask controls where that version is visible.
"""

TASK_REMOVE = """### Coding task 5 of 10 — complete `remove_pimples`

The last function ties everything together: calculate a smooth colour everywhere, then use it only where the mask says yes.

- **Given:** image `img`, the smoothing kernel, and the four functions you completed above — the cell already calls
  `detect_skin` and `detect_pimples` for you.
- **INPUT:** one PIL image; the final task can pass in a captured or uploaded photograph.
- **PROCESS:** fill the two `___` blanks, top to bottom:
  1. Inside `ndimage.convolve(___, weights, ...)` — the full colour array to smooth: `pixels`.
  2. Inside `np.where(___[:, :, None] == MASK_ON, ...)` — the mask that decides each location: `pimple_mask`.
     `[:, :, None]` repeats that one decision for the R, G, and B values of the pixel.
- **OUTPUT:** a PIL image with the same size. The red centre must become less different from its neighbours, the corner
  must stay unchanged, and the function must not edit the input image in place.
"""

COLOR_GAP = """## Blur cannot fix colour — so change the colour

Run your `show_my_change` cell again and look at the red spot. It is softer, and it is still red. That is not a mistake in your
code; it is what averaging does. The kernel replaces a pixel with a mix of its neighbours, and when the neighbourhood is
red, the mix stays red. A real blotch is many pixels wide, so most of its window is more blotch.

To take the redness out, the program needs a colour that is **not** in the blotch. The surrounding skin already supplies
one: average every pixel the skin mask selected and you get a single target colour.

```text
average_skin_color = (sum of R over the region, sum of G, sum of B) / number of selected pixels
```

Averaging thousands of skin pixels together with a few dozen spot pixels barely moves the result, which is exactly why
the average is a fair description of "this person's skin colour in this light".

Then mix each marked pixel toward that target. The mixing formula is the one the capstone already used for smoothing —
only the second colour changes:

```text
mixed = original × (1 - strength) + target × strength
```

With the spot at `(225, 62, 66)`, the target at `(183, 127, 103)`, and `strength = 0.5`:

```text
new_red   = 225 × 0.5 + 183 × 0.5 = 204
new_green =  62 × 0.5 + 127 × 0.5 = 94.5 → 94
new_blue  =  66 × 0.5 + 103 × 0.5 = 84.5 → 84
```

Excess redness `R - (G + B) / 2` falls from `161.0` to `115.0`. Raise the strength to `1.00` and the spot becomes the
target colour exactly — flat, obvious, and usually too much. That trade-off is yours to set in the next three cells.
"""

TASK_AVERAGE = """### Coding task 6 of 10 — complete `average_skin_color`

No kernels here — this is the average you already know: add the numbers up, then divide by how many you added.
The loop visits every pixel, `skin_mask[y][x]` says whether to count it, and `picture.getpixel((x, y))` reads its
three numbers.

- **Given:** the loop, the four running totals, and the empty-mask case, already written for you.
- **INPUT:** one RGB image and the matching skin mask.
- **PROCESS:** fill the three `___` blanks, top to bottom:
  1. Inside `if skin_mask[y][x] != ___` — the value a selected pixel has: `MASK_ON`.
  2. `total_green = ___` — add this pixel's green to the total, like the line above it.
  3. Inside `round(___)` — the blue total divided by `counted`.
- **OUTPUT:** a tuple of three whole numbers. On a plain skin patch it must stay close to `(183, 127, 103)`, and an
  empty mask must return `(0, 0, 0)` rather than an error.
"""

TASK_CALM = """### Coding task 7 of 10 — complete `calm_redness`

This is the function that does what smoothing cannot: it replaces the colour instead of averaging it.

- **Given:** the whole skeleton — the `.copy()`, `keep = 1 - strength`, the loop, and the **red channel already
  written**. Read that one line first; the other two channels have exactly the same shape.
- **INPUT:** `img`, `spot_mask` (`0` or `255` per pixel), `skin_color` as `(r, g, b)`, and `strength` from `0.0` to `1.0`.
- **PROCESS:** fill the three `___` blanks, top to bottom:
  1. Inside `if spot_mask[y][x] != ___` — the value a marked pixel has: `MASK_ON`.
  2. `round(green * keep + ___ * strength)` — the target green, the matching entry in `skin_color`.
  3. `round(___ * keep + skin_color[2] * strength)` — the pixel's own blue, the number being moved.
- **OUTPUT:** a new PIL image of the same size. The marked pixel must land on the mixed colour, a pixel outside the mask
  must be identical to the input, and the input image must not change.

The one line to understand is `old * keep + target * strength`. Because `keep` and `strength` add up to `1`, the answer
always lands between the two colours — at `0.0` the pixel stays where it is, at `1.0` it arrives at the target. Working
on `img.convert("RGB").copy()` is what keeps the original safe — the rule the NumPy filter cell taught with
`pixels.copy()`.
"""

BUILD_PIPELINE = """## Build your own pipeline

Everything so far ran in the order the lesson chose. This cell is yours: the stages are finished functions, and you
decide how they are wired.

- **Given:** `detect_skin`, `detect_pimples`, `average_skin_color`, `calm_redness`, and `remove_pimples`.
- **INPUT:** the drawn face, so every change is countable.
- **PROCESS:** fill the four `___` blanks so the function runs colour replacement first and smoothing second. Then
  experiment — this cell is meant to be edited:
  - change `calm_strength` between `0.0` and `1.0`;
  - swap the two stages and see whether smoothing before recolouring gives a different result;
  - delete the smoothing stage and judge whether the recoloured patch looks pasted on;
  - pass `skin_mask` instead of `spot_mask` and explain the damage before you undo it.
- **OUTPUT:** the changed-pixel count and the excess redness at the spot, before and after. Report the setting that gave
  the lowest excess redness **without** an obviously flat patch, and say how the two numbers disagreed.

Order matters because each stage reads the image the stage before it wrote. Recolour first and the smoothing blends your
new colour into its neighbours; smooth first and you are averaging red into a slightly wider area before replacing it.
"""

CHECK_ALL = """### Check all ten, now that the last ones exist

This is the same grader cell as before. Every function is written now, so the final line must read
`Result: 10/10 parts correct.` — and every line that said `still to come` is gone.
"""

CHECK = """## Check the functions you have written so far

Run the grader. Each line names a function and explains any failing result.

Tasks 8, 9 and 10 are further down the page — the healer and the two smoothing functions are the last things you
write. The grader marks them `still to come` and leaves them out of the score, so at this point in the lesson a full
pass reads:

```text
Result: 7/7 parts correct.
```

The same grader cell appears once more after the last task. When every function is written, its final line must read:

```text
Result: 10/10 parts correct.
```

The page saves your code, grader progress, and every interactive panel, so you can continue later on this computer.
"""

DEMO = """## Connect the first five functions into one visible pipeline

Run the next cell. The six labelled images follow the actual data path:

```text
RGB input → skin_mask → skin overlay → pimple_mask → red-area overlay → output image
```

The overlays reveal the exact selected locations. If a location is wrong, inspect the RGB calculations, the 3 × 3 count,
or the local red difference. If the location is correct but the output colour is wrong, inspect the kernel calculation and
the condition passed to `np.where`.

This also answers the first prediction of the lab: the masks show **where** the program decided to act, and the final
image shows **what** it did there. You need both to find a mistake.
"""

NUMPY_FILTERS = """## Explore three more NumPy filters and three kernels

Run the next two cells and compare every labelled image with its input. Record answers to these questions:

1. Which operations use only the RGB values at the current pixel?
2. Which operations require values from neighbouring pixels?
3. In the sharpening kernel, what number multiplies the centre pixel?
4. Why can an edge image contain bright lines even when the input has no white line there?
"""

NUMPY_CREATE = """### Modify a NumPy colour filter

The starter function adds `40` to the blue channel and uses `np.clip` to keep every value in `0..255`.

- **Given:** a sample RGB NumPy array.
- **INPUT:** no outside input in this task.
- **PROCESS:** copy the array, change exactly one channel, clip the values, and return a `uint8` result.
- **OUTPUT:** a before/after figure plus the result's shape and data type. The input array must remain unchanged.

Run it once. Then change the channel index or the added amount and state which visible change your new numbers caused.
"""

PUBLIC_IMAGES = """## Test your functions on real photographs

Four public images are bundled with the lesson, so the page does not hotlink personal data: a cheek with real acne from a
dermatology teaching collection by [Dr. Gandikota Raghurama Rao](https://commons.wikimedia.org/wiki/File:0601_Acne_Vulgaris.jpg)
(CC BY 4.0), portraits by [William Stitt](https://commons.wikimedia.org/wiki/File:Face_portrait_(Unsplash).jpg) and
[Eddie Kopp](https://commons.wikimedia.org/wiki/File:Young_woman%27s_face_(Unsplash).jpg), and a skin close-up by
[Montavius Howard](https://commons.wikimedia.org/wiki/File:Human_skin_close-up.jpg) (those three CC0).

Run `try_public_photo(0)` — the acne cheek, where the pipeline has real work to do — then change the index to `1`, `2`,
or `3`. Each run shows the input, the skin overlay, the red-area overlay, and the output. Use the printed pixel counts
and the overlays as evidence:

- Where did the colour rule miss part of the intended region?
- Where did it select a background or feature by mistake?
- Which change could be caused by lighting rather than the subject?

**Expect a surprise in the red region:** your `detect_pimples` may select nothing — even on the acne cheek. A real
blotch is many pixels wide, so the 5 × 5 window sits *inside* the blotch: the local mean is almost as red as the centre,
and the gap never reaches `24`. The drawn face worked because its spots were single bright pixels. That is not a bug in
your code; it is the honest limit of a small window. The capstone below fixes it with a wider comparison and an adaptive
threshold — watch its red-region count on the same photograph.

The goal is to test the limits of your code, not to make a claim about any person in the photographs. The acne photo is
a teaching image shared by its author; treat it the way a doctor would — skin to understand, not to judge.
"""

FACE_GATE = """## Mechanism 6 — require both masks before changing a pixel

The RGB rule may select an object whose colour is similar to a skin tone. Face Mesh adds a second question: is this pixel
inside the face boundary?

- `face_mask = 1`: the pixel lies inside the face outline;
- `skin_mask = 1`: the pixel passed the colour and neighbour checks.

The program calculates `allowed = face_mask & skin_mask`. Only `1 & 1` produces `1`; the other three combinations keep
the original colour. Use the panel to test all four combinations, then complete its new prediction.
"""

FACE_MESH = """## How MediaPipe creates `face_mask`

MediaPipe Face Mesh receives one image and returns up to 478 landmark points on a detected face. Each point contains a
horizontal and vertical position. The browser selects points around the outer face, including point `10` near the forehead,
`454` on the right, `152` near the chin, and `234` on the left. It joins the boundary points into a closed shape and fills
the inside with `1`; the outside remains `0`.

```text
face_mask = pixel lies inside the face outline
skin_mask = pixel passes the colour and neighbour checks
allowed   = face_mask & skin_mask
output    = np.where(allowed[..., None], cleaned, original)
```

`allowed[..., None]` applies the same allowed/not-allowed decision to all three RGB values. Face Mesh supplies a location
boundary. It does not diagnose skin and it does not find red spots by itself.

### The rings you are about to use

The 478 landmarks are not one shape but many closed rings, and the lab uses four of them. The browser builds each ring
by joining its points in order and filling the inside:

| Ring | Landmarks joined | What it is for |
|---|---|---|
| `oval` | `10, 338, … 234, 127, … 109` (36 points) | the outside of the face — the only place you may edit |
| `lips` | `61, 146, … 40, 185` (20 points) | must be **left alone** |
| `leftEye`, `rightEye` | 16 points each | must be **left alone** |

That last column is the whole idea of the next task. The face oval **contains** the lips and the eyes, so "inside the
face" is not the same as "safe to smooth". Blur someone's lips and eyelashes and they stop looking like a person —
that plastic, wax-model look you have seen in edited photos is very often exactly this mistake.

So the region you actually want is three decisions combined:

```text
smoothable = skin_mask & face_mask & ~feature_mask
```

`~` means NOT. You have already used `&` in `skin_evidence` and `detect_skin`; this is the same mask algebra, and it is
the entire content of task 9.
"""

SMOOTH_GAP = """## The redness is gone. The skin is still rough.

Look at your healed photograph again, and be honest about it. The angry red is gone — your numbers proved that. But the
skin is not *smooth*. Every bump, pore and patch of uneven texture is exactly where it was.

That is not a bug in your code. `heal_spots` only ever changes **colour**: it slides a pixel toward the skin colour
around it. A bump that is the same colour as its neighbours is invisible to it, no matter how many passes you run.

```text
heal_spots  -> changes WHAT COLOUR a pixel is   -> removes redness
smooth_skin -> changes HOW MUCH pixels DIFFER   -> removes roughness
```

Roughness is a different measurement. Take any two pixels side by side and subtract them: on smooth skin that
difference is small everywhere, and on rough skin it is large. Averaging neighbours is precisely the tool that makes
neighbouring pixels more alike — which is why the thing that could not remove redness is the perfect thing for this.

You wrote that tool in task 2 and it has been waiting ever since. `convolve_layer` with the 1-2-1 kernel is the whole
engine of the last task; all that is left is deciding **where** it is allowed to run, and how much of it to use.
"""

TASK_AREA = """### Coding task 9 of 10 — complete `choose_smooth_area`

Three masks in, one mask out. No loops, no kernels — this is mask algebra, and it is four lines long.

- **Given:** the three masks already converted to `True`/`False` above the blanks, including the sensible fallbacks for
  when Face Mesh finds no face (`face_mask` missing means the whole picture is allowed; `feature_mask` missing means
  nothing needs protecting). Those two lines matter, because the bundled photograph has no Face Mesh landmarks at all.
- **INPUT:** `skin_mask` from your `detect_skin`, and `face_mask` + `feature_mask` from Face Mesh.
- **PROCESS:** fill the three `___` blanks in `allowed = ___ & ___ & ___`:
  1. `is_skin` — it has to be skin.
  2. `inside_face` — and inside the face oval.
  3. `~is_feature` — and **not** a lip or an eye. Note the `~`.
- **OUTPUT:** one `0`/`255` mask. Ordinary cheek must be `255`; a lip, an eye, or anything outside the face must be `0`.

If you forget the `~`, you will smooth **only** the lips and eyes — the exact opposite of what you want. Run the check
cell and read which of the four rules failed.
"""

TASK_SMOOTH = """### Coding task 10 of 10 — complete `smooth_skin`

The last function in the lab, and the one that makes the skin actually look even.

- **Given:** `wide_average`, a masked average that counts **only** allowed pixels. Dividing the blurred picture by the
  blurred mask is what stops the dark background and the lips bleeding into the cheek.
- **INPUT:** `img`, your `area_mask`, `strength` `0.0`–`1.0`, and `radius` — how wide the colour is averaged.
- **PROCESS:** fill the four `___` blanks, top to bottom:
  1. `wide_average(___)` — one colour channel at a time: `pixels[:, :, channel]`.
  2. `light = ___` — **your own `convolve_layer`** on the brightness `pixels.mean(axis=2)` with `SOFTEN_KERNEL`
     and divisor `16`. A *small* blur here on purpose.
  3. `___ / np.maximum(soft_light, MIN_SHARE)` — the kept light, going back on top of the evened colour.
  4. `+ toned * ___` — how far the pixel moves. The mixing formula you have used since task 7.
- **OUTPUT:** a new PIL image, visibly even inside the area and **identical** outside it.

Why two different widths? A 3 × 3 blur only softens grain, and a blotch is twenty pixels across — the colour has to be
averaged over a wide area to even out. But averaging the *light* that wide would flatten the nose and jaw into a
mask, so the brightness comes from the small blur instead. Same idea as `heal_spots`: take the colour from far away,
take the light from nearby.
"""

SMOOTH_RUN = """## Write the whole program yourself

Ten functions ago you were filling in one number at a time. This cell has **no blanks**: it gives you a plan in
comments and you write the program under it. That is the real skill — not any single line, but holding four of your own
functions in your head at once and wiring them into something that works.

```text
detect_skin  ->  heal_spots  ->  choose_smooth_area  ->  smooth_skin
   where          colour             where again           texture
```

- **Given:** `roughness`, because a new measurement is not the lesson here, and the two settings you already defended.
- **PROCESS:** write two functions and a loop.
  1. `polish(picture, passes, strength)` — the four stages above, in order, returning the finished image.
  2. `report(label, before, after)` — one printed line: redness before → after, roughness before → after.
  3. Run `polish` once for each value in `STRENGTHS`, report each, and show the one you would publish.
- **OUTPUT:** three reported lines, and before/after/difference panels for your chosen version.

If you get stuck, every piece exists somewhere above: the healing loop is in the last run cell, and each stage is a
function you wrote and the grader already checked. Nothing here is new code — it is *your* code, assembled.

Then judge it with your eyes as well as the numbers, because they disagree on purpose. `1.0` always wins on roughness
and always looks the most fake. Look at the nose and the jawline at each strength before you choose.

**Say this plainly in your write-up.** Smoothing removes evidence. Real skin has pores and texture, and a picture with
those averaged away is not a more accurate picture of a person — it is a less accurate one. You built a filter, not a
cure, and the honest version of this tool is the one that stops early.
"""

HEAL_GAP = """## Why the photograph still has spots — and what is missing

Your pipeline works, and the acne cheek is still covered in red marks. Three things are holding it back, and each one has
a fix you can write.

**1. The comparison area is far too small.** `detect_pimples` asks "is this pixel redder than its 5 × 5 neighbours?" A
real blotch is ten or more pixels across, so the 5 × 5 window sits *inside* it: the neighbours are just as red, the
difference is near zero, and only the thin rim of the blotch is ever selected.

```text
5 × 5 window inside a wide blotch:  centre 96 red, neighbours 94 red  -> difference 2   -> not selected
25 × 25 window on the same pixel:   centre 96 red, neighbours 68 red  -> difference 28  -> selected
```

The fix is one number: make the comparison area **wider than the thing you want to find**.

**2. A mask says only yes or no.** Every pixel is either fully changed or untouched, so the treated area ends at a hard
line you can see. Real work uses an *amount*: how strongly this pixel is a spot, from `0.0` to `1.0`.

```text
share = excess / span, cut into 0.0 .. 1.0
excess  4 with span 12 -> share 0.33   (barely red, barely changed)
excess 12 with span 12 -> share 1.00   (clearly a spot, fully replaced)
```

**3. A spot is not only redder, it is also brighter or darker.** Replacing the colour alone leaves the bump's shading
behind, so you still see it. Take the brightness from the *surrounding* skin instead of from the spot, and the bump
flattens with its colour — while the cheek keeps its own light and shadow, because that brightness is measured locally,
not set to one flat value.

```text
target = average skin colour × (brightness of the surrounding skin / brightness of the average skin colour)
```

Put together, that is one function — the one that finally clears the photograph.
"""

TASK_HEAL = """### Coding task 8 of 10 — complete `heal_spots`

This is the capstone, and it is code, not settings. It is also the shortest thing you will write all lesson: the loop is
the one from task 7, and the five blanks are exactly the three ideas above, one piece at a time.

- **Given:** the whole skeleton, plus `wide_redness` and `wide_brightness` from `ndimage.uniform_filter` (the tool
  `detect_pimples` already used, only wider), `skin_mask` and `skin_color` from your own two functions, and the
  `min`/`max`/`round` clamping already written.
- **INPUT:** `img`, `radius` (how wide the comparison area is) and `span` (how much extra redness counts as a whole spot).
- **PROCESS:** fill the five `___` blanks, top to bottom:
  1. `excess = redness[y][x] - ___` — the **wide** average, not the pixel itself. This is idea 1, and getting it wrong
     is what leaves the middle of a blotch untouched.
  2. `share = min(1.0, max(0.0, ___ / span))` — the extra redness you just measured. Idea 2.
  3. `scale = ___ / skin_brightness` — the brightness of the surrounding skin. Idea 3.
  4. `target = skin_color[channel] * ___` — what turns the average colour into the locally-lit target.
  5. `... + target * ___` — how far this pixel moves: the soft amount, not a yes/no.
- **OUTPUT:** a new PIL image. In the grader's test picture the middle of the wide blotch must lose at least `20` of its
  excess redness while plain skin in the corner stays exactly as it was.

Nothing here is new. The blend in blanks 4 and 5 is `calm_redness` with `share` in place of `strength`, and the loop is
the one from `average_skin_color`.
"""

HEAL_RUN = """## Run your own healer, and prove it worked

No `magic_mirror` pipeline runs in the next cell. It is your `heal_spots`, your loop, your measurement — the only helper
is the one that draws the pictures.

- **Given:** the bundled acne photograph at 160 × 120, small enough that one pass of your Python loop stays under a
  second.
- **PROCESS:** fill the blanks, run it, then **run your healer again on its own output**. Each pass measures the new
  image, so the second pass finds the spots that were only partly reduced by the first.
- **OUTPUT:** your printed redness number after every pass, plus before/after/difference panels.

Things worth trying, one change at a time, with the number as your evidence:

- `radius` `7` (too small — the blotch hides inside its own window again), `13`, `25`;
- `span` `6` (almost everything counts as a spot), `12`, `24` (only the angriest marks);
- `passes` `1`, `2`, `3`. Watch the number stop improving — that is the point where more passes only cost time.

**What this cannot do, and you should say so in your write-up:** the brown marks left behind by old spots are not
red, so a redness rule cannot see them at all. Nothing here judges skin or diagnoses anything; it moves numbers that
happen to be colours.
"""

HEAL_RUN_Q = """photo = magic_mirror.heal_photo()      # the bundled acne cheek, 160 x 120

radius = ___     # width of the comparison area: wider than the blotch you want to find
span = ___       # excess redness that counts as a full spot
passes = ___     # run the healer this many times, each pass on the result of the last


def average_redness(image):
    \"\"\"One number for the whole picture: the average of R - (G + B) / 2.\"\"\"
    pixels = np.asarray(image, dtype=np.float32)
    redness = pixels[:, :, 0] - (pixels[:, :, 1] + pixels[:, :, 2]) / 2
    return round(float(redness.mean()), 1)


picture = photo
print("before:", average_redness(picture))
for step in range(passes):
    picture = heal_spots(picture, radius, span)
    print("after pass", step + 1, ":", average_redness(picture))

magic_mirror.show_before_after(photo, picture)
"""
HEAL_RUN_A = HEAL_RUN_Q.replace(
    "radius = ___ ", "radius = 13"
).replace(
    "span = ___ ", "span = 12"
).replace(
    "passes = ___ ", "passes = 2"
)

SMOOTH_RUN_Q = '''photo = magic_mirror.heal_photo()      # the same acne cheek, 160 x 120

HEAL_RADIUS, HEAL_SPAN = 13, 12        # the settings you defended two cells ago
STRENGTHS = (0.5, 0.85, 1.0)           # the three versions you are going to compare
SMOOTH_RADIUS = 21                     # how wide the colour is averaged


def roughness(image):
    """GIVEN. One number for texture: the average brightness step between side-by-side pixels."""
    grey = np.asarray(image.convert("L"), dtype=np.float32)
    return round(float(np.abs(np.diff(grey, axis=1)).mean()), 2)


# ============================================================================
# YOUR PROGRAM. No ___ blanks here - this is the whole thing, and you write it.
# You have every part already; what is new is putting them together yourself.
#
# 1. def polish(picture, passes, strength):
#       a. heal `passes` times, each pass on the result of the last, with
#          heal_spots(picture, HEAL_RADIUS, HEAL_SPAN)   <- the loop from the last cell
#       b. skin = detect_skin(picture)                   <- your task 3
#       c. face, features = magic_mirror.photo_face_masks()
#          area = choose_smooth_area(skin, None, features)  <- your task 9.
#          None for the oval on purpose: Face Mesh fitted it to this tight crop
#          and it misses the left cheek. Its lip and eye rings are still good,
#          and those are the ones you must NOT smooth.
#       d. return smooth_skin(healed, area, strength, SMOOTH_RADIUS)  <- your task 10
#
# 2. def report(label, before, after):
#       print the label, then redness before -> after, then roughness before -> after.
#       Use average_redness from the last cell and roughness from above.
#
# 3. Run polish on `photo` once for every value in STRENGTHS, report each one,
#    and keep the images so you can look at them.
#
# 4. Decide which strength you would actually publish, and write one comment
#    line saying why. The numbers alone will not answer it - 1.0 always wins on
#    roughness and always looks the most fake.
#
# 5. magic_mirror.show_before_after(photo, the_one_you_chose)
# ============================================================================

'''

SMOOTH_RUN_A = SMOOTH_RUN_Q + '''
def polish(picture, passes, strength):
    """The whole chain, in the order the lesson built it."""
    healed = picture
    for _ in range(passes):
        healed = heal_spots(healed, HEAL_RADIUS, HEAL_SPAN)
    skin = detect_skin(picture)
    face, features = magic_mirror.photo_face_masks()
    area = choose_smooth_area(skin, None, features)
    return smooth_skin(healed, area, strength, SMOOTH_RADIUS)


def report(label, before, after):
    """Print both measurements for one version."""
    print(label,
          "| redness", average_redness(before), "->", average_redness(after),
          "| roughness", roughness(before), "->", roughness(after))


versions = {}
for strength in STRENGTHS:
    versions[strength] = polish(photo, 2, strength)
    report("strength %.2f" % strength, photo, versions[strength])

# 0.5 still shows blotches, 1.0 is plainly plastic around the nose and jaw.
# 0.85 evens the tone and still reads as skin, so that is the one to publish.
magic_mirror.show_before_after(photo, versions[0.85])
'''

PHOTO = """## Run your healer on one photograph of your own

- **Given:** your eight functions and the settings you defended above. MediaPipe supplies a face-boundary landmark list
  so nothing outside the face is touched.
- **INPUT:** exactly one captured photograph. If the camera is unavailable, select a JPG, PNG, or WebP file from this device.
- **PROCESS:** run the cell, frame one face, and press **Capture one photo**. The camera stops immediately. Face Mesh runs
  once, and then **your own `heal_spots`** runs on that still image — the same function the grader checked, not a library
  version of it.
- **OUTPUT:** four panels show the skin region your `detect_skin` selected, the pixels your healer changed, the magnified
  colour difference, and the result. The report states how many pixels changed and the average redness before and after.
- **Hands-on comparison:** two button rows appear under the result, and every press re-runs **your** function on the
  **same** photograph, so exactly one thing changes each time.
  - *Comparison width* — `7`, `13`, `25`: how wide an area each pixel is compared against. Too small and a wide blotch
    hides inside its own window; too wide and ordinary shading starts to count as a spot.
  - *Passes* — `1`, `2`, `3`: how many times your healer runs on its own output.

  Write down the changed-pixel count and the two redness numbers for each press. Which press moved the redness most, and
  did a third pass earn its extra second of work?

The image stays only in this cell's visible output. It is not written to `localStorage`, and it disappears after a reload.
Your code and progress remain. Processing uses 320 × 240 pixels and displays at 480 × 360 for a clear still-image result.
"""

REFLECT = """## Final explanation — claim, evidence, reasoning

Press the **+ Code cell** button under this cell and write four short statements as `#` comment lines, so the notebook
saves them with your work:

1. **Claim:** name one setting that changed the result in a useful, visible way.
2. **Evidence:** give the before/after setting values and the reported changed-pixel count.
3. **Reasoning:** explain how the kernel, mask, or blend caused that change.
4. **Limitation:** identify one missed or wrongly selected area and explain why lighting, colour, or the face boundary may
   have caused it.

Your explanation is complete only when it cites a number and a visible panel from your own run.
"""

NUMPY_ARRAY_CODE = """import numpy as np

background = [35, 80, 185]
skin = [183, 127, 103]
red_spot = [225, 62, 66]

pixels = np.array([
    [background, background, background, background, background],
    [background, skin,       skin,       skin,       background],
    [background, skin,       red_spot,   skin,       background],
    [background, skin,       skin,       skin,       background],
    [background, background, background, background, background],
], dtype=np.int16)

print("pixels shape:", pixels.shape, "= rows, columns, RGB channels")
print("pixel at row 2, column 2:", pixels[2, 2])
print("R matrix:\\n", pixels[:, :, 0])
print("G matrix:\\n", pixels[:, :, 1])
print("B matrix:\\n", pixels[:, :, 2])
"""

MATRIX_CHANGE_CODE = """row = 2
column = 2
channel = 2      # 0 is R, 1 is G, 2 is B
new_value = 220

experiment = pixels.copy()
experiment[row, column, channel] = new_value
magic_mirror.show_rgb_matrix_change(pixels, experiment, row, column)
"""

CONVOLUTION_TRANSFER_Q = """flat_edge_sum = ___
isolated_patch_count = ___
large_patch_count = ___
blurred_rgb = (___, ___, ___)

magic_mirror.check_convolution_intuition(
    flat_edge_sum,
    isolated_patch_count,
    large_patch_count,
    blurred_rgb,
)
"""
CONVOLUTION_TRANSFER_A = CONVOLUTION_TRANSFER_Q.replace(
    "flat_edge_sum = ___", "flat_edge_sum = 0"
).replace(
    "isolated_patch_count = ___", "isolated_patch_count = 1"
).replace(
    "large_patch_count = ___", "large_patch_count = 9"
).replace(
    "blurred_rgb = (___, ___, ___)", "blurred_rgb = (188, 120, 99)"
)

BUILD_PIPELINE_Q = """# Your pipeline. Every stage is a function you wrote. Fill the four blanks,
# run the cell, then change the order or the strength and run it again.
calm_strength = ___          # 0.00 keeps the spot colour, 1.00 uses the target colour

def my_pipeline(image):
    # Step 1 - decide WHERE. Two masks: which pixels are skin, and which of
    # those are a locally red spot. Neither one changes a colour yet.
    picture = image.convert("RGB")
    skin_mask = detect_skin(picture)
    spot_mask = detect_pimples(picture, skin_mask)

    # Step 2 - decide WHAT COLOUR to use. The whole skin region averages to one
    # colour, and that colour is not red, because the spots are outnumbered.
    target_color = average_skin_color(picture, skin_mask)

    # Step 3 - act, one stage at a time. Each stage reads the image the stage
    # before it wrote, which is why the order below changes the result.
    # Stage 1 - replace the colour of the marked spots.
    picture = calm_redness(___, spot_mask, ___, calm_strength)
    # Stage 2 - soften what is left, so the new patch does not look pasted on.
    picture = ___(picture)
    return picture

magic_mirror.preview_my_pipeline()
"""
BUILD_PIPELINE_A = BUILD_PIPELINE_Q.replace(
    "calm_strength = ___ ", "calm_strength = 0.75"
).replace(
    "calm_redness(___, spot_mask, ___, calm_strength)",
    "calm_redness(picture, spot_mask, target_color, calm_strength)"
).replace(
    "picture = ___(picture)", "picture = remove_pimples(picture)"
)

NUMPY_CREATE_CODE = """def my_numpy_filter(pixels):
    result = pixels.copy().astype(np.int16)
    result[:, :, 2] = np.clip(result[:, :, 2] + 40, 0, 255)
    return result.astype(np.uint8)

magic_mirror.preview_numpy_filter(my_numpy_filter)
"""


def build_skin_cells(solution):
    blocks = read_task_blocks("skin_filters_solution.py" if solution else "skin_filters.py")
    title = TITLE.replace("# Skin Lab —", "# Skin Lab (ANSWER KEY) —") if solution else TITLE
    return [
        markdown_cell("skin-title", title),
        markdown_cell("skin-setup-note", SETUP),
        code_cell("skin-setup", "import magic_mirror\nmagic_mirror.skin_intro()", ("autoload",)),
        code_cell("skin-library-setup", blocks["shared"], ("autoload",)),
        markdown_cell("skin-phenomenon", PHENOMENON),
        code_cell("skin-overview", "magic_mirror.show_skin_pipeline_overview()"),
        markdown_cell("skin-glossary", GLOSSARY),
        markdown_cell("skin-rgb-pixel-note", RGB_PIXEL),
        code_cell("skin-mechanism-rgb", 'magic_mirror.show_mechanism("rgb_pixel")',
                  ("concept:rgb_pixel",)),
        code_cell("skin-pixel-channels", "magic_mirror.show_skin_pixel_channels()"),
        markdown_cell("numpy-intro", NUMPY_INTRO),
        code_cell("numpy-array", NUMPY_ARRAY_CODE),
        code_cell("numpy-channels", "magic_mirror.show_numpy_channels()"),
        markdown_cell("numpy-change-one-number-note", MATRIX_CHANGE),
        code_cell("numpy-change-one-number", MATRIX_CHANGE_CODE),
        markdown_cell("skin-library-map", LIBRARIES),
        markdown_cell("skin-evidence", EVIDENCE),
        code_cell("skin-mechanism-rule", 'magic_mirror.show_mechanism("rgb_rule")',
                  ("concept:rgb_rule",)),
        markdown_cell("skin-task-evidence-note", TASK_EVIDENCE),
        code_cell("task-skin-evidence", blocks["skin_evidence"],
                  ("autoload", "task:skin_evidence")),
        markdown_cell("skin-see-evidence-note", SEE_EVIDENCE),
        code_cell("skin-see-evidence",
                  SEE_EVIDENCE_A if solution else SEE_EVIDENCE_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-votes", VOTES),
        code_cell("skin-mechanism-neighbours", 'magic_mirror.show_mechanism("neighbours")',
                  ("concept:neighbours",)),
        markdown_cell("skin-convolution", CONVOLUTION),
        code_cell("skin-convolution-math", "magic_mirror.show_convolution_math()"),
        markdown_cell("skin-kernel-filter-note", FILTER_LAB),
        code_cell("skin-mechanism-kernel-filter", 'magic_mirror.show_mechanism("kernel_filter")',
                  ("concept:kernel_filter",)),
        code_cell("skin-rgb-convolution", "magic_mirror.show_rgb_convolution_math()"),
        code_cell("skin-mechanism-convolution-scan", 'magic_mirror.show_mechanism("convolution_scan")',
                  ("concept:convolution_scan",)),
        markdown_cell("skin-convolution-transfer-note", CONVOLUTION_TRANSFER),
        code_cell("skin-convolution-transfer",
                  CONVOLUTION_TRANSFER_A if solution else CONVOLUTION_TRANSFER_Q,
                  ("student-work",)),
        markdown_cell("skin-task-convolve-note", TASK_CONVOLVE),
        code_cell("task-convolve-layer", blocks["convolve_layer"],
                  ("autoload", "task:convolve_layer")),
        markdown_cell("skin-see-convolution-note", SEE_CONVOLUTION),
        code_cell("skin-see-convolution",
                  SEE_CONVOLUTION_A if solution else SEE_CONVOLUTION_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-task-detect-note", TASK_SKIN),
        code_cell("task-detect-skin", blocks["detect_skin"],
                  ("autoload", "task:detect_skin")),
        markdown_cell("skin-see-mask-note", SEE_MASK),
        code_cell("skin-see-mask", SEE_MASK_A if solution else SEE_MASK_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-red-gap", RED_GAP),
        code_cell("skin-mechanism-red-spot", 'magic_mirror.show_mechanism("red_spot")',
                  ("concept:red_spot",)),
        markdown_cell("skin-task-pimple-note", TASK_PIMPLE),
        code_cell("task-detect-pimples", blocks["detect_pimples"],
                  ("autoload", "task:detect_pimples")),
        markdown_cell("skin-see-pimples-note", SEE_PIMPLES),
        code_cell("skin-see-pimples", SEE_PIMPLES_A if solution else SEE_PIMPLES_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-soften", SOFTEN),
        code_cell("skin-mechanism-soften", 'magic_mirror.show_mechanism("soften")',
                  ("concept:soften",)),
        markdown_cell("skin-task-remove-note", TASK_REMOVE),
        code_cell("task-remove-pimples", blocks["remove_pimples"],
                  ("autoload", "task:remove_pimples")),
        markdown_cell("skin-see-cleanup-note", SEE_CLEANUP),
        code_cell("skin-see-cleanup", SEE_CLEANUP_A if solution else SEE_CLEANUP_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-color-gap", COLOR_GAP),
        markdown_cell("skin-task-average-note", TASK_AVERAGE),
        code_cell("task-average-skin-color", blocks["average_skin_color"],
                  ("autoload", "task:average_skin_color")),
        markdown_cell("skin-see-target-note", SEE_TARGET),
        code_cell("skin-see-target", SEE_TARGET_A if solution else SEE_TARGET_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-task-calm-note", TASK_CALM),
        code_cell("task-calm-redness", blocks["calm_redness"],
                  ("autoload", "task:calm_redness")),
        markdown_cell("skin-see-calm-note", SEE_CALM),
        code_cell("skin-see-calm", SEE_CALM_A if solution else SEE_CALM_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-check-note", CHECK),
        code_cell("skin-check", "magic_mirror.check_skin_code()"),
        markdown_cell("skin-demo-note", DEMO),
        code_cell("skin-demo", "magic_mirror.skin_demo()"),
        markdown_cell("skin-build-pipeline-note", BUILD_PIPELINE),
        code_cell("skin-build-pipeline",
                  BUILD_PIPELINE_A if solution else BUILD_PIPELINE_Q,
                  ("autoload", "student-work")),
        markdown_cell("numpy-filters-note", NUMPY_FILTERS),
        code_cell("numpy-filter-gallery", "magic_mirror.numpy_filter_gallery()"),
        code_cell("numpy-kernel-gallery", "magic_mirror.numpy_kernel_gallery()"),
        markdown_cell("numpy-create-note", NUMPY_CREATE),
        code_cell("numpy-create", NUMPY_CREATE_CODE),
        markdown_cell("skin-public-images-note", PUBLIC_IMAGES),
        code_cell("skin-public-gallery", "magic_mirror.show_public_photo_gallery()"),
        code_cell("skin-public-test", "magic_mirror.try_public_photo(0)"),
        markdown_cell("skin-heal-gap", HEAL_GAP),
        markdown_cell("skin-task-heal-note", TASK_HEAL),
        code_cell("task-heal-spots", blocks["heal_spots"], ("autoload", "task:heal_spots")),
        markdown_cell("skin-heal-run-note", HEAL_RUN),
        code_cell("skin-heal-run", HEAL_RUN_A if solution else HEAL_RUN_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-face-gate-note", FACE_GATE),
        code_cell("skin-mechanism-face", 'magic_mirror.show_mechanism("face_gate")',
                  ("concept:face_gate",)),
        markdown_cell("skin-face-mesh-note", FACE_MESH),
        code_cell("skin-face-mesh-map", "magic_mirror.show_face_mesh_map()"),
        code_cell("skin-face-mask-pipeline", "magic_mirror.show_face_mask_pipeline()"),
        markdown_cell("skin-smooth-gap", SMOOTH_GAP),
        markdown_cell("skin-task-area-note", TASK_AREA),
        code_cell("task-choose-smooth-area", blocks["choose_smooth_area"],
                  ("autoload", "task:choose_smooth_area")),
        markdown_cell("skin-task-smooth-note", TASK_SMOOTH),
        code_cell("task-smooth-skin", blocks["smooth_skin"],
                  ("autoload", "task:smooth_skin")),
        markdown_cell("skin-smooth-run-note", SMOOTH_RUN),
        code_cell("skin-smooth-run", SMOOTH_RUN_A if solution else SMOOTH_RUN_Q,
                  ("autoload", "student-work")),
        markdown_cell("skin-check-all-note", CHECK_ALL),
        code_cell("skin-check-all", "magic_mirror.check_skin_code()"),
        markdown_cell("skin-photo-note", PHOTO),
        code_cell("skin-photo", "magic_mirror.capture_skin_photo()"),
        markdown_cell("skin-reflect", REFLECT),
    ]


def write(file_name, solution):
    notebook = {
        "cells": build_skin_cells(solution),
        "metadata": {
            "course": {"id": "skin-lab", "version": COURSE_VERSION},
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.11"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    path = HERE / file_name
    path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("Wrote %s (%d cells)" % (file_name, len(notebook["cells"])))


if __name__ == "__main__":
    write(PRACTICE_FILE, solution=False)
    write(SOLUTION_FILE, solution=True)
