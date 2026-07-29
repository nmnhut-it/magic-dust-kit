"""camera_charm — the magic camera you win in Node 1.

The charm SEES your hand and does what your rules say:

    watch()       -> waits for a steady hand-sign, returns the finger count
    aim_cell(r,c) -> waits for one pointing finger over an AR grid, returns
                     the 1-based cell number: top-left=1, center of 3x3=5
    cell_row(cell, cols) / cell_col(cell, cols)
                  -> convert that cell number back to row/column numbers
    fire_vortex() -> the dust gathers, whirls into a vortex and casts FIRE
    freeze()      -> the dust crystallizes into FROST instead of fire
    lighten()     -> the machine's screen glows bright
    darken()      -> the machine's screen falls dark
    display(v)    -> writes v as floating AR text over the camera view
                     (unlike say(), which only prints to the console)
    pixel_display(grid) -> draws a grid of 0s and 1s as a small block-picture
                     floating over the camera view (1 = filled, 0 = empty)
    present_image_frame(image) -> displays a small 2D RGB/RGBA framebuffer
                     exactly as supplied; learner code creates every pixel
    upload_photo() -> opens a local image picker and places the chosen photo
                     inside the project frame; the image stays in the browser
    choose_image() -> opens a local image picker and returns a small 2D RGB list;
                      cancelling uses the built-in magic-owl sample
    load_sample_image() -> returns that generated sample as a small 2D RGB list
    load_plate(name, size) -> reads a named lesson plate ("dragon", "boss",
                     "scene", "goal") into a 2D RGB list; same numbers each run
    compare_frames(labelled, title, numbers) -> opens the big side-by-side
                     viewer and WAITS until the learner closes it; each entry is
                     (label, grid) to draw cells or (label, plate_name) to show
                     that artwork full size
    show_photos(labelled, title) -> compare_frames for plate artwork only
    show_numbers(image, title) -> one image plus its brightness digits
    play_effect(name) -> fires a full-size moving plate ("dragon", "phoenix",
                     "butterfly", "sakura", "smoke", "lightning") over the live
                     camera, screen-blended — the add-and-clamp at full size
    play_my_effect() -> same, but plays a video file you pick from this device
    human_mask(size) -> the person as a grid of 1/0 you can loop over
    find_human(scene, behind, front) -> THE HUMAN CHARM: finds your outline and
                     stacks backdrop / effect-behind / you / effect-in-front, so
                     a creature can pass BEHIND you while petals fall in FRONT
    blank_grid(rows, cols) -> makes a 2D list filled with one preset value
    start_photo_lights() -> waits for the learner to press the centered start button
    show_photo_lights(colors, mode, step) -> draws a repeated color list
    delay(seconds) -> keeps the current light frame visible before continuing
                     around the photo, either lit, off, or shifted by step
    start_particle_stage() -> opens a camera-free preview for particle lessons
    Particle(...) -> creates one visible particle with position, motion, size,
                     opacity, and lifetime
    draw_particle_frame(particles) -> draws the Particle objects supplied
    set_photo_light(index, color) -> sets one position in the repeated light
                     pattern so a learner loop can build the sequence visibly
    sepia()       -> the screen turns old-photo yellow-brown
    invert()      -> every color on screen flips to its opposite
    grayscale()   -> the screen loses all color, black-and-white only
    flip_mirror() -> un-mirrors the screen back to your TRUE left/right
    blur()        -> softens the live camera image
    sharpen()     -> increases local contrast on the live camera image
    rotate_with_hand() -> rotates the live image with the wrist-to-middle-finger angle
    shake_screen()-> the screen shakes once, like a small earthquake
    photo_booth() -> a magic photo booth: pour dust with an open palm,
                     whirl it with one finger, SNAP with two. It keeps
                     watching until the snap — the loop that makes that
                     work lives in here; you'll write it yourself in a
                     later node.

Two fingers stay out of the rule set on purpose — the ✌ sign belongs to the
booth's SNAP, and one sign must never mean two things.

Runs inside the lesson worker; `bridge` is the page's I/O channel (worker.js).
"""
import json
import math

from js import bridge


def _studio_tell(action, **values):
    values["action"] = action
    bridge.tell("studio", json.dumps(values, ensure_ascii=False))


def watch(prompt="show fingers: "):
    return int(bridge.ask("fingers", prompt))


def aim_cell(rows=3, cols=3):
    rows = int(rows)
    cols = int(cols)
    return int(bridge.ask("grid", str(rows) + "," + str(cols)))


def cell_row(cell, cols=3):
    return (int(cell) - 1) // int(cols) + 1


def cell_col(cell, cols=3):
    return (int(cell) - 1) % int(cols) + 1


def fire_vortex():
    bridge.tell("spell", "fire")


def freeze():
    bridge.tell("spell", "freeze")


def lighten():
    bridge.tell("screen", "lighten")


def darken():
    bridge.tell("screen", "darken")


def display(value):
    bridge.tell("label", str(value))


def pixel_display(grid):
    lines = []
    for row in grid:
        line = ""
        for cell in row:
            line = line + ("#" if cell == 1 else ".")
        lines.append(line)
    bridge.tell("pixels", "\n".join(lines))


def sepia():
    bridge.tell("screen", "sepia")


def invert():
    bridge.tell("screen", "invert")


def grayscale():
    bridge.tell("screen", "grayscale")


def flip_mirror():
    bridge.tell("screen", "mirror")


def blur():
    bridge.tell("screen", "blur")


def sharpen():
    bridge.tell("screen", "sharpen")


def rotate_with_hand():
    bridge.tell("screen", "rotate")


def shake_screen():
    bridge.tell("screen", "shake")


def start_studio(title="My Live Studio"):
    payload = json.dumps({"action": "studio_start", "title": str(title)}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "ready"


def upload_photo():
    payload = json.dumps({"action": "photo_upload"}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "uploaded"


# Up to ~16 cells a side a grid is a teaching object — every cell is a number
# a learner can read. Past that it is the picture itself, which is what the
# transform exercises work on. The ceiling matches IMAGE_GRID_MAX in
# lessons/engine/interactive-studio.js.
GRID_MIN = 8
GRID_MAX = 512

# Marks a compare_frames panel as the learner's own output (see compare_frames).
RESULT = "result"


def _read_image_grid(action, size=16, name=None):
    side = max(GRID_MIN, min(GRID_MAX, int(size)))
    request = {"action": action, "size": side}
    if name is not None:
        request["name"] = str(name)
    payload = json.dumps(request, ensure_ascii=False)
    try:
        image = json.loads(bridge.ask("studio_start", payload))
    except (TypeError, ValueError):
        image = None
    if isinstance(image, list) and image:
        return image
    # No camera (or an unreadable source) used to return [], and the very next
    # line a lesson writes is len(image[0]) — so a blocked webcam showed the
    # learner "IndexError: list index out of range" instead of the reason.
    # A same-sized all-zero grid keeps their loop running and says why.
    print("chưa đọc được ảnh (camera chưa mở?) — lưới trả về toàn 0")
    return [[[0, 0, 0] for _ in range(side)] for _ in range(side)]


def choose_image(size=16):
    return _read_image_grid("image_pick_grid", size)


def load_sample_image(size=16):
    return _read_image_grid("image_sample_grid", size)


def load_plate(name="dragon", size=16):
    """Read a named lesson plate into a 2D RGB grid.

    name: "dragon" or "boss" (glowing effect layers shot on black) or "scene"
    (a night background). Returns image[row][col] == [red, green, blue].
    Same numbers on every run, so a lesson can check exact values.
    size: 8..GRID_MAX cells a side. Use 8-16 while the lesson is still teaching
    what a pixel is (the viewer shows readable digits), and ~96 once the
    learner is transforming the picture for real.
    Related: lessons/engine/interactive-studio.js IMAGE_PLATES.
    """
    return _read_image_grid("image_plate_grid", size, name)


def compare_frames(labelled, title="", numbers=True):
    """Open a large side-by-side viewer and wait until the learner closes it.

    labelled: list of (label, image) pairs, image[row][col] == [r, g, b].
    numbers: show each cell's brightness digit on its own shade. On by
    default whenever the grid is small enough to read; pass False to hide.
    Use it to put a BEFORE frame next to an AFTER frame; the program pauses
    on the viewer, so nothing scrolls away before it has been looked at.
    Naming a plate on a frame the learner BUILT is wrong: the plate is shipped
    artwork and would stay correct next to their broken result. Pass their grid
    with "result" instead — the panel then tells them it is their own output.
    Related: lessons/engine/image-lab.js.
    """
    frames = []
    for entry in labelled:
        # (label, plate_name)        -> that artwork at full size
        # (label, grid)              -> a grid the program is holding
        # (label, grid, plate_name)  -> both, paired: picture beside its pixels
        # (label, grid, "result")    -> a grid the LEARNER's code built; the
        #                              viewer says so, so a panel is never
        #                              mistaken for one the machine handed in
        label, image = entry[0], entry[1]
        plate = entry[2] if len(entry) > 2 else (image if isinstance(image, str) else None)
        frame = {"label": str(label)}
        if plate == RESULT:
            frame["role"] = RESULT
        elif plate is not None:
            frame["plate"] = str(plate)
        if not isinstance(image, str):
            frame["image"] = image
        frames.append(frame)
    payload = json.dumps(
        {"action": "frame_compare", "title": str(title), "numbers": bool(numbers), "frames": frames},
        ensure_ascii=False,
    )
    return bridge.ask("studio_start", payload) == "closed"


def show_photos(labelled, title=""):
    """Open the viewer on plate ARTWORK at full size.

    labelled: list of (label, plate_name) pairs, e.g. [("RONG", "dragon")].
    Plate names: "dragon", "boss", "scene", "goal".
    """
    return compare_frames(labelled, title)


def show_numbers(image, title=""):
    """Open the viewer on one image with its brightness digits shown."""
    return compare_frames([(title or "ANH", image)], title, True)


def show_effect_source(name="dragon"):
    """Play the effect file on its own, with nothing under it and nothing over.

    No camera, no blending — just the video as it sits on disk. Use it to see
    what a "spell" really is: glowing light on a plain black rectangle. Putting
    it onto a camera frame is the add-and-clamp you already wrote by hand.
    """
    payload = json.dumps({"action": "effect_play", "name": str(name), "raw": True}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "played"


def play_effect(name="dragon"):
    """Fire a full-size moving effect over the live camera and wait for it.

    name: "dragon", "rose", "stag", "phoenix", "butterfly", "sakura", "smoke", "lightning".
    The clip is glowing light on black and is screen-blended over the camera —
    the same add-and-clamp you wrote by hand, running at full size.
    Related: lessons/engine/interactive-studio.js EFFECT_CLIPS.
    """
    payload = json.dumps({"action": "effect_play", "name": str(name)}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "played"


def play_my_effect():
    """Pick a video file from this device and blend it over the camera.

    Use it to watch a clip you generated yourself. Any footage of bright light
    on a black background will composite well, because the blend keeps light
    and drops black. The file is read in the browser and never uploaded.
    """
    payload = json.dumps({"action": "effect_play", "own": True}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "played"


def human_mask(size=16):
    """Return the person as PLAIN DATA: grid[row][col] is 1 or 0.

    1 means that cell sits on a person, 0 means it does not. This is exactly
    what find_human() uses internally to decide which cells are you — here you
    get the same answer as a grid, so you can loop over it yourself.
    Needs the camera. Returns [] if nobody is found.
    """
    return _read_image_grid("human_mask", size)


def find_human(scene=None, behind=None, front=None):
    """THE HUMAN CHARM. Find the person, then stack the layers around them.

    scene:  a backdrop that replaces the room  ("forest")
    behind: an effect BETWEEN the backdrop and you ("dragon", "rose", "stag",
            "butterfly", "smoke", "lightning")
    front:  an effect IN FRONT of you, near the lens ("sakura", "flower")

    Everything else in this island lays one picture flat over another. The
    charm finds your outline, so the order finally means something: a creature
    can walk BEHIND you while petals fall in FRONT. Each effect is still light
    on black added to what is underneath — only its place in the stack is new.

    Needs the camera. Related: lessons/engine/human-layers.js.
    """
    request = {"action": "human_layers"}
    if scene is not None:
        request["scene"] = str(scene)
    if behind is not None:
        request["behind"] = str(behind)
    if front is not None:
        request["front"] = str(front)
    payload = json.dumps(request, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "played"


def blank_grid(rows, cols, value=0):
    # The cap has to clear a full-resolution plate (GRID_MAX a side); it used
    # to sit at 48x64, which silently produced a grid too small for the image
    # being transformed and blew up on the first write past the end.
    row_count = max(0, min(GRID_MAX, int(rows)))
    col_count = max(0, min(GRID_MAX, int(cols)))
    return [[value for col in range(col_count)] for row in range(row_count)]


def start_photo_lights():
    payload = json.dumps({"action": "photo_start"}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "started"


def delay(seconds=0.5):
    payload = json.dumps({"action": "delay", "seconds": float(seconds)}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "waited"


def start_particle_stage(title="Xưởng Hạt Ánh Sáng"):
    payload = json.dumps({"action": "particle_stage_start", "title": str(title)}, ensure_ascii=False)
    return bridge.ask("studio_start", payload) == "started"


class Particle:
    """One small visual object whose state changes from frame to frame."""

    def __init__(
        self,
        x=50,
        y=50,
        vx=0,
        vy=0,
        ax=0,
        ay=0,
        life=60,
        size=1.0,
        scale_speed=0.0,
        alpha=255,
        fade_speed=0,
        color="#7ce7ff",
        symbol="•",
    ):
        self.x = float(x)
        self.y = float(y)
        self.vx = float(vx)
        self.vy = float(vy)
        self.ax = float(ax)
        self.ay = float(ay)
        self.life = float(life)
        self.size = float(size)
        self.scale_speed = float(scale_speed)
        self.alpha = float(alpha)
        self.fade_speed = float(fade_speed)
        self.color = color
        self.symbol = str(symbol)

    def update(self, dt=1.0):
        """Advance velocity, position, size, opacity, and lifetime once."""
        step = float(dt)
        self.vx = self.vx + self.ax * step
        self.vy = self.vy + self.ay * step
        self.x = self.x + self.vx * step
        self.y = self.y + self.vy * step
        self.size = max(0.0, self.size + self.scale_speed * step)
        self.alpha = max(0.0, min(255.0, self.alpha + self.fade_speed * step))
        self.life = self.life - step
        return self

    def is_alive(self):
        return self.life > 0 and self.size > 0 and self.alpha > 0

    def reset(
        self,
        x=None,
        y=None,
        vx=None,
        vy=None,
        ax=None,
        ay=None,
        life=None,
        size=None,
        scale_speed=None,
        alpha=None,
        fade_speed=None,
        color=None,
        symbol=None,
    ):
        """Start the same particle again, replacing only supplied values."""
        changes = (
            ("x", x), ("y", y), ("vx", vx), ("vy", vy),
            ("ax", ax), ("ay", ay), ("life", life), ("size", size),
            ("scale_speed", scale_speed), ("alpha", alpha),
            ("fade_speed", fade_speed), ("color", color), ("symbol", symbol),
        )
        for name, value in changes:
            if value is not None:
                setattr(self, name, str(value) if name == "symbol" else value)
        return self


def show_photo_lights(colors, mode="steady", step=0):
    if not isinstance(colors, list):
        colors = []
    payload = json.dumps(
        {
            "action": "photo_lights",
            "colors": [str(color) for color in colors[:12]],
            "mode": str(mode),
            "step": int(step),
        },
        ensure_ascii=False,
    )
    return bridge.ask("studio_start", payload) == "drawn"


def set_photo_light(index, color):
    payload = json.dumps(
        {"action": "photo_light", "index": int(index), "color": str(color)},
        ensure_ascii=False,
    )
    return bridge.ask("studio_start", payload) == "drawn"


def set_particle_style(style=None, color="#7ce7ff", symbols="", motion="orbit", size=1.0, density=1.0, glow=1.0):
    if isinstance(style, dict):
        color = style.get("color", color)
        symbols = style.get("symbols", symbols)
        motion = style.get("motion", motion)
        size = style.get("size", size)
        density = style.get("density", density)
        glow = style.get("glow", glow)
    elif style is not None:
        color = style
    _studio_tell(
        "particle_style",
        color=str(color),
        symbols=str(symbols),
        motion=str(motion),
        size=float(size),
        density=float(density),
        glow=float(glow),
    )


def attach_sticker(sticker, anchor="palm", size=1.0):
    if isinstance(sticker, dict):
        symbol = sticker.get("symbol", "*")
        anchor = sticker.get("anchor", anchor)
        size = sticker.get("size", size)
    else:
        symbol = sticker
    _studio_tell("sticker_attach", symbol=str(symbol), anchor=str(anchor), size=float(size))


def clear_stickers():
    _studio_tell("sticker_clear")


def send_gift(gift_info, gift="Gift", symbol="🎁", message=""):
    if isinstance(gift_info, dict):
        sender = gift_info.get("sender", "Guest")
        gift = gift_info.get("gift", gift)
        symbol = gift_info.get("symbol", symbol)
        message = gift_info.get("message", message)
    else:
        sender = gift_info
    _studio_tell(
        "gift",
        sender=str(sender),
        gift=str(gift),
        symbol=str(symbol),
        message=str(message),
    )


def particle_burst(anchor="palm"):
    _studio_tell("particle_burst", anchor=str(anchor))


def read_hand_position(anchor="palm"):
    payload = json.dumps({"action": "hand_position", "anchor": str(anchor)}, ensure_ascii=False)
    try:
        result = json.loads(bridge.ask("hand_position", payload))
    except (TypeError, ValueError):
        result = {}
    return {
        "visible": bool(result.get("visible", False)),
        "x": int(result.get("x", 50)),
        "y": int(result.get("y", 50)),
    }


def draw_sticker_at(sticker):
    if not isinstance(sticker, dict):
        sticker = {"symbol": str(sticker), "x": 50, "y": 50, "size": 1.0}
    _studio_tell(
        "sticker_at",
        symbol=str(sticker.get("symbol", "*")),
        x=float(sticker.get("x", 50)),
        y=float(sticker.get("y", 50)),
        size=float(sticker.get("size", 1.0)),
    )


def draw_particle_frame(particles):
    if not isinstance(particles, list):
        particles = []
    frame = []
    for particle in particles:
        if isinstance(particle, Particle):
            color = particle.color
            if isinstance(color, (list, tuple)) and len(color) >= 3:
                color = "rgb(" + ",".join(str(max(0, min(255, int(value)))) for value in color[:3]) + ")"
            frame.append({
                "x": particle.x,
                "y": particle.y,
                "symbol": particle.symbol,
                "color": str(color),
                "size": particle.size,
                "alpha": particle.alpha,
            })
        elif isinstance(particle, dict):
            frame.append(particle)
    payload = json.dumps({"action": "particle_frame", "particles": frame}, ensure_ascii=False)
    return bridge.ask("particle_frame", payload) == "drawn"


def present_image_frame(image):
    max_rows = 48
    max_cols = 64
    if not isinstance(image, list) or not image or not isinstance(image[0], list) or not image[0]:
        normalized = []
    else:
        row_count = min(len(image), max_rows)
        col_count = min(len(image[0]), max_cols)
        normalized = []
        for row_index in range(row_count):
            source_row = image[row_index] if isinstance(image[row_index], list) else []
            output_row = []
            for col_index in range(col_count):
                pixel = source_row[col_index] if col_index < len(source_row) else None
                if not isinstance(pixel, (list, tuple)) or len(pixel) not in (3, 4):
                    output_row.append([0, 0, 0, 0])
                    continue
                channels = []
                for value in pixel:
                    if not isinstance(value, (int, float)) or not math.isfinite(value):
                        channels.append(0)
                    else:
                        channels.append(max(0, min(255, int(value))))
                if len(channels) == 3:
                    channels.append(255)
                output_row.append(channels)
            normalized.append(output_row)
    payload = json.dumps({"action": "image_frame", "image": normalized}, ensure_ascii=False)
    return bridge.ask("image_frame", payload) == "drawn"


def clear_studio_frame():
    _studio_tell("studio_frame_clear")


def stop_studio():
    _studio_tell("studio_stop")


def photo_booth():
    while True:
        sign = int(bridge.ask("gesture", "show a sign: "))
        if sign == 5:
            bridge.tell("booth", "conjure")      # open palm: dust pours out
        elif sign == 1:
            bridge.tell("booth", "vortex")       # one finger: the dust whirls
        elif sign == 2:
            bridge.tell("booth", "capture")      # two fingers: SNAP - done
            break
