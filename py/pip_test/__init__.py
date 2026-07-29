"""pip_test — Pip checks your output, so the cell shows YOUR code and not his.

Every exercise on this island needs a check: did the flip really move
something, did the blend overflow, did the paint land where you said. Written
out longhand that is another twenty lines of loops in the cell, and the learner
has to read past Pip's bookkeeping to find their own two lines.

So the bookkeeping lives here. Each function prints a verdict the lesson can
grade, in plain words the learner can read:

    check_flip(before, after)    IMAGE CHANGED SIDES / TWO FLIPS RESTORE THE SOURCE
    check_blend(base, result)    ALL CHANNELS WITHIN 255 / NOTHING GOT DARKER /
                                 EFFECT AREA GOT BRIGHTER
    check_burn(base, layer, result)  OVERBRIGHT CELLS BURNED WHITE /
                                 CALM CELLS KEPT THEIR COLOUR
    check_over(base, result)     ONE FRAME DONE  (result is brighter somewhere)
    check_dim(before, after, n)   EVERY CELL LOST <n> LIGHT / NOTHING WENT BELOW 0
    count_color(grid, color)     how many cells are exactly that colour

Nothing here is magic: it is the same counting loops the learner already wrote
in earlier cells, moved out of the way now that they are understood.
"""


def _size(grid):
    return len(grid), len(grid[0]) if grid else 0


def check_flip(before, after):
    """A flip must CHANGE the picture, and flipping twice must restore it."""
    rows, cols = _size(before)
    changed = 0
    broken = 0
    for row in range(rows):
        last = cols - 1
        for col in range(cols):
            if after[row][col] != before[row][col]:
                changed = changed + 1
            if after[row][last - col] != before[row][col]:
                broken = broken + 1
    if changed > 0:
        print("IMAGE CHANGED SIDES")
    else:
        print("nothing moved — the picture is still the same")
    if broken == 0:
        print("TWO FLIPS RESTORE THE SOURCE")
    else:
        print("flipping twice did not give the original back")
    return changed > 0 and broken == 0


def check_blend(base, result):
    """Adding light may never overflow 255 and may never darken the base."""
    rows, cols = _size(base)
    too_big = 0
    darker = 0
    brighter = 0
    for row in range(rows):
        for col in range(cols):
            for channel in range(3):
                value = result[row][col][channel]
                if value > 255:
                    too_big = too_big + 1
                if value < base[row][col][channel]:
                    darker = darker + 1
                if value > base[row][col][channel]:
                    brighter = brighter + 1
    if too_big == 0:
        print("ALL CHANNELS WITHIN 255")
    else:
        print("some channel went past 255 — did you forget min(255, ...)?")
    if darker == 0:
        print("NOTHING GOT DARKER")
    else:
        print("somewhere got darker — adding light should never subtract")
    if brighter > 0:
        print("EFFECT AREA GOT BRIGHTER")
    else:
        print("nothing got brighter — is the layer being added at all?")
    return too_big == 0 and darker == 0 and brighter > 0


def check_burn(base, layer, result):
    """A cell whose raw sum passes 255 must go white, not lose one channel.

    check_blend only asks whether a channel stayed inside 0..255, so it cannot
    tell a per-channel min(255, ...) apart from the burn rule — three channels
    clipped by three different amounts are all still "within 255" while the
    colour of the cell has drifted. This walks the same sums the learner walked
    and grades the choice they made about the overbright ones.
    """
    rows, cols = _size(base)
    burned = 0
    left_drifting = 0
    disturbed = 0
    for row in range(rows):
        for col in range(cols):
            a = base[row][col]
            b = layer[row][col]
            sums = [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
            got = result[row][col]
            if max(sums[0], sums[1], sums[2]) > 255:
                if got[0] == 255 and got[1] == 255 and got[2] == 255:
                    burned = burned + 1
                else:
                    left_drifting = left_drifting + 1
            else:
                if got[0] != sums[0] or got[1] != sums[1] or got[2] != sums[2]:
                    disturbed = disturbed + 1
    if burned > 0 and left_drifting == 0:
        print("OVERBRIGHT CELLS BURNED WHITE")
    elif left_drifting > 0:
        print("some overbright cell kept a channel below 255 — its colour drifted")
    else:
        print("no cell went past 255 — this base is too dark to show the crack")
    if disturbed == 0:
        print("CALM CELLS KEPT THEIR COLOUR")
    else:
        print("a cell that never passed 255 was changed anyway")
    return burned > 0 and left_drifting == 0 and disturbed == 0


def check_over(base, result, message="ONE FRAME DONE"):
    """The result must be brighter than the base somewhere."""
    rows, cols = _size(base)
    lit = 0
    for row in range(rows):
        for col in range(cols):
            if result[row][col][0] > base[row][col][0]:
                lit = lit + 1
    if lit > 0:
        print(message)
    else:
        print("nothing lit up — the layer is not reaching the result")
    return lit > 0


def check_dim(before, after, amount):
    """Every channel must drop by `amount`, stopping at 0 instead of going negative."""
    rows, cols = _size(before)
    wrong = 0
    negative = 0
    for row in range(rows):
        for col in range(cols):
            for channel in range(3):
                want = before[row][col][channel] - amount
                if want < 0:
                    want = 0
                value = after[row][col][channel]
                if value != want:
                    wrong = wrong + 1
                if value < 0:
                    negative = negative + 1
    if wrong == 0:
        print("EVERY CELL LOST " + str(amount) + " LIGHT")
    else:
        print("some cell did not drop by " + str(amount) + " — check every channel")
    if negative == 0:
        print("NOTHING WENT BELOW 0")
    else:
        print("a channel went below 0 — did you forget max(0, ...)?")
    return wrong == 0 and negative == 0


def count_color(grid, color):
    """How many cells are exactly this colour."""
    rows, cols = _size(grid)
    found = 0
    for row in range(rows):
        for col in range(cols):
            if grid[row][col] == color:
                found = found + 1
    return found
