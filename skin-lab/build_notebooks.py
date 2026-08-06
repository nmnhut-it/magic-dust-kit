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
COURSE_VERSION = "2026.08.07.1"
PRACTICE_FILE = "Skin_Lab.ipynb"
SOLUTION_FILE = "Skin_Lab_Answers.ipynb"
TASK_ORDER = (
    "shared",
    "convolve_layer",
    "skin_evidence",
    "detect_skin",
    "detect_pimples",
    "remove_pimples",
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

You will build an image-processing pipeline from five small functions. Start with a **7 × 7 pixel image**, where every
pixel is just three numbers. Then use **NumPy**, **SciPy**, and **Pillow** to run the same calculations across a full image.
At the end, **MediaPipe Face Mesh** adds a face boundary so the program changes pixels only where it is allowed.

### Your goal

By the end of the lab, you will be able to:

- explain how RGB numbers make a colour;
- turn a colour rule into a black-and-white mask;
- use a 3 × 3 kernel to count or blend neighbouring pixels;
- find a red spot by comparing it with its local area;
- combine masks to smooth texture, soften red areas, and adjust brightness on one photograph.

### How you will know the pipeline works

Every observation cell gives you **numbers, an image or overlay, and a short explanation**. The numbers show the calculation.
The image shows which pixels were selected. The explanation connects those two pieces of evidence.

### Five checkpoints — stop after any one of them

1. **RGB:** I can point to one matrix position and read its R, G, and B values.
2. **Masks:** I can explain why a rule writes `0` or `255` at that position.
3. **Convolution:** I can trace a 3 × 3 window through multiply → add → divide → one output value.
4. **Selective change:** I can explain why a mask changes some pixels and keeps others.
5. **Portrait pipeline:** I can use a difference panel and pixel count to defend one setting.

The page saves after every edit. You are not expected to finish all five checkpoints in one sitting.

This is a lesson about image-processing algorithms. It is **not a diagnostic tool and it does not rate anyone's skin**.
Lighting, cameras, backgrounds, and different skin tones can all make a hand-written colour rule fail.

Your code, checked steps, and current place are saved automatically in this browser. A captured or uploaded image is never
stored in `localStorage`. Use **Download notebook** if you want to move your work to another computer.
"""

SETUP = """## Start here

Run the next two cells. The first loads the visual tools. The second loads NumPy, SciPy, Pillow, and the constants used by
the five functions. Do not edit these two cells yet.

You do not need a personal photo for most of the lab. The 7 × 7 image, a drawn face, and three public-domain photographs
are already included. The camera is used only once, in the final optional test.

### The four kinds of cells on this page

1. **Watch cells** — press ▶ and read the numbers and pictures that appear. You never edit these.
2. **Interactive panels** — click buttons and sliders, then answer the panel's new-case question. A correct answer unlocks
   the matching Python code.
3. **Coding tasks** — code with `___` blanks. Replace every `___`, then press ▶. A task cell only teaches Python your
   function — it prints nothing itself. The proof appears when you run the check cell below it.
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

TASK_EVIDENCE = """### Coding task 1 of 5 — complete `skin_evidence`

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

TASK_CONVOLVE = """### Coding task 2 of 5 — complete `convolve_layer`

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

TASK_SKIN = """### Coding task 3 of 5 — complete `detect_skin`

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

TASK_PIMPLE = """### Coding task 4 of 5 — complete `detect_pimples`

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

TASK_REMOVE = """### Coding task 5 of 5 — complete `remove_pimples`

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

CHECK = """## Check all five functions

Run the grader. Each line names a function and explains any failing result. The final line must read:

```text
Result: 5/5 parts correct.
```

The page saves your code, grader progress, and every interactive panel, so you can continue later on this computer.
"""

DEMO = """## Connect the five functions into one visible pipeline

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

PUBLIC_IMAGES = """## Test your five functions on real photographs

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
"""

PRO_PIPELINE = """## Capstone — build a visible, adjustable portrait pipeline

Your five functions are the foundation. The final program repeats ideas you already used:

1. Face Mesh draws a face boundary. Pixels outside it are kept.
2. Colour rules make a skin-region mask. They use RGB plus a second way of separating lightness from colour.
3. An edge filter finds strong changes around eyes, lips, hair, and the face outline. Those details are protected —
   but locally red skin does not count as protected detail, otherwise the pipeline would protect the very blotches
   it should soften.
4. The kernel you choose smooths the selected region. Locally red areas are additionally pulled toward the
   surrounding skin colour with a stronger blend.
5. A small brightness value is added only where both the face and skin masks allow it.

Under the hood, the second colour system is called Y/Cb/Cr, and the SciPy edge operation is called `sobel`. You do not need
to memorise those names. You do need to trace the same pattern: **numbers → mask or filtered values → selected output**.

Follow two pixels through those five steps:

- A pixel on the **cheek**: inside the face, passes the skin rules, far from any edge — its colour moves toward the kernel
  result and gains a little brightness.
- A pixel on the **edge of the lips**: inside the face, but the edge filter marks it as protected detail — it keeps its
  original colour, which is why the mouth stays sharp.

### How far does a kernel reach?

One pass of a 3 × 3 kernel mixes each pixel only with neighbours **one step away**. A 5 × 5 kernel reaches two steps, and
a 9 × 9 kernel reaches four. Run any of them `n` times and information travels about `n` × that reach. A red blotch on a
real photograph can be ten steps wide, so:

- more `skin_kernel_passes`, or a wider kernel (`wide` 5 × 5, `widest` 9 × 9), increase how far the smoothing reaches;
- reach costs arithmetic: a 9 × 9 window averages 81 pixels for every output value instead of 9, so the same cell does
  about nine times the multiplying and adding a 3 × 3 does;
- reach is not the whole story. With `skin_smooth_strength` at `0.55` and detail protection switched on, the measured
  difference between 5 × 5 and 9 × 9 on one 320 × 240 photograph is small. Raise the strength and the pass count if you
  want that difference to become obvious, and judge it by the changed-pixel count rather than by first impression;
- reach alone still cannot fix colour — averaging inside a red blotch only produces more red. That is why the red
  region is also pulled toward the surrounding skin colour, not merely blurred.

For one channel, suppose the original value is `200`, the kernel result is `188`, and `skin_smooth_strength = 0.55`:

```text
mixed = 200 × (1 - 0.55) + 188 × 0.55
      = 200 × 0.45 + 188 × 0.55
      = 193.4 → 193
bright = 193 + 10 = 203
```

The kernel decides the candidate smooth colour. `skin_smooth_strength` decides how much of that colour to use.
`skin_brightness` adds a controlled offset after blending.

### Capstone task — choose and defend your settings

- **Given:** five kernels — `gentle`, `balanced`, `strong` (3 × 3), `wide` (5 × 5) and `widest` (9 × 9) — and safe ranges
  for all settings.
- **INPUT:** the next cell uses the bundled acne photograph, where the effect is easy to see; the final cell accepts one
  captured or uploaded photograph.
- **PROCESS:** change `kernel_choice`, then test one or more strengths, brightness, pass count, or the weights inside the
  chosen kernel.
- **OUTPUT:** the report must name the kernel, weight total, strengths, and changed-pixel count. The five-panel figure must
  show input, skin region, red region, magnified difference, and final output.

Change one setting at a time. Use the difference panel and changed-pixel count—not just “it looks better”—to explain the
effect of your change.
"""

PIPELINE_SETTINGS_CODE = """# Choose "gentle", "balanced", "strong", "wide", or "widest".
# "wide" reaches two steps per pass, so its smoothing is clearly visible.
# "widest" reaches four steps and averages 81 pixels per output value.
kernel_choice = "wide"

# You may also edit the weights of any kernel.
kernel_options = {
    "gentle": (
        (1, 2, 1),
        (2, 4, 2),
        (1, 2, 1),
    ),
    "balanced": (
        (1, 1, 1),
        (1, 1, 1),
        (1, 1, 1),
    ),
    "strong": (
        (1, 1, 1),
        (1, 0, 1),
        (1, 1, 1),
    ),
    "wide": (
        (1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1),
    ),
    "widest": (
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
        (1, 1, 1, 1, 1, 1, 1, 1, 1),
    ),
}

SOFTEN_KERNEL = kernel_options[kernel_choice]
skin_smooth_strength = 0.55   # 0.00 keeps the input; 1.00 uses the full smooth colour
spot_smooth_strength = 0.90   # red areas receive a stronger blend
skin_brightness = 5           # add -25 to 25 inside the selected skin region
skin_kernel_passes = 2        # run the kernel 1 to 4 times
redness_sensitivity = 1.6     # lower selects more red areas; higher selects fewer

magic_mirror.describe_skin_pipeline_settings()
"""

PHOTO = """## Run the pipeline once on a photograph

- **Given:** your five functions, your current capstone settings, and MediaPipe's face-boundary landmark list.
- **INPUT:** exactly one captured photograph. If the camera is unavailable, select a JPG, PNG, or WebP file from this device.
- **PROCESS:** run the cell, frame one face, and press **Capture one photo**. The camera stops immediately. Face Mesh runs
  once; NumPy and SciPy then run the pipeline once on that still image.
- **OUTPUT:** five panels show the input, allowed skin region, stronger red region, magnified colour difference, and final
  result. The report states how many pixels were selected, protected, and changed, plus your kernel and settings.
- **Hands-on comparison:** after the result appears, press the kernel buttons under it — `gentle 3×3`, `balanced 3×3`,
  `strong 3×3`, `wide 5×5`, `widest 9×9`. Each press re-runs the whole pipeline on the **same** photograph, so the only
  thing that changed is the kernel. Compare the reports and the difference panels, and write down the changed-pixel
  count for each: how much farther does a 5 × 5 reach than a 3 × 3, and does `widest 9×9` change that number as much as
  its 81 weights suggest it should?

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
        code_cell("skin-preview-evidence", "magic_mirror.preview_skin_evidence()"),
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
        code_cell("skin-preview-convolution", "magic_mirror.preview_library_convolution()"),
        markdown_cell("skin-task-detect-note", TASK_SKIN),
        code_cell("task-detect-skin", blocks["detect_skin"],
                  ("autoload", "task:detect_skin")),
        code_cell("skin-preview-mask", "magic_mirror.preview_skin_mask()"),
        markdown_cell("skin-red-gap", RED_GAP),
        code_cell("skin-mechanism-red-spot", 'magic_mirror.show_mechanism("red_spot")',
                  ("concept:red_spot",)),
        markdown_cell("skin-task-pimple-note", TASK_PIMPLE),
        code_cell("task-detect-pimples", blocks["detect_pimples"],
                  ("autoload", "task:detect_pimples")),
        code_cell("skin-preview-pimples", "magic_mirror.preview_pimple_mask()"),
        markdown_cell("skin-soften", SOFTEN),
        code_cell("skin-mechanism-soften", 'magic_mirror.show_mechanism("soften")',
                  ("concept:soften",)),
        markdown_cell("skin-task-remove-note", TASK_REMOVE),
        code_cell("task-remove-pimples", blocks["remove_pimples"],
                  ("autoload", "task:remove_pimples")),
        code_cell("skin-preview-cleanup", "magic_mirror.preview_cleanup()"),
        markdown_cell("skin-check-note", CHECK),
        code_cell("skin-check", "magic_mirror.check_skin_code()"),
        markdown_cell("skin-demo-note", DEMO),
        code_cell("skin-demo", "magic_mirror.skin_demo()"),
        markdown_cell("numpy-filters-note", NUMPY_FILTERS),
        code_cell("numpy-filter-gallery", "magic_mirror.numpy_filter_gallery()"),
        code_cell("numpy-kernel-gallery", "magic_mirror.numpy_kernel_gallery()"),
        markdown_cell("numpy-create-note", NUMPY_CREATE),
        code_cell("numpy-create", NUMPY_CREATE_CODE),
        markdown_cell("skin-public-images-note", PUBLIC_IMAGES),
        code_cell("skin-public-gallery", "magic_mirror.show_public_photo_gallery()"),
        code_cell("skin-public-test", "magic_mirror.try_public_photo(0)"),
        markdown_cell("skin-face-gate-note", FACE_GATE),
        code_cell("skin-mechanism-face", 'magic_mirror.show_mechanism("face_gate")',
                  ("concept:face_gate",)),
        markdown_cell("skin-face-mesh-note", FACE_MESH),
        code_cell("skin-face-mesh-map", "magic_mirror.show_face_mesh_map()"),
        code_cell("skin-face-mask-pipeline", "magic_mirror.show_face_mask_pipeline()"),
        markdown_cell("skin-pro-pipeline-note", PRO_PIPELINE),
        code_cell("skin-pipeline-settings", PIPELINE_SETTINGS_CODE, ("autoload", "student-work")),
        code_cell("skin-pro-pipeline-preview", "magic_mirror.preview_pro_skin_pipeline()"),
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
