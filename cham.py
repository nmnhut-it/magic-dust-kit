#!/usr/bin/env python3
"""Chấm bài trong `student/` ngay trên máy — không cần trình duyệt, không cần camera.

    python cham.py

`serve.py` gọi file này mỗi lần khởi động, nên vừa bật máy chủ là bạn thấy ngay
mình còn thiếu hàm nào. Trong trang web thì bấm phím T cho cùng kết quả.

Nó dựng một `magic_stage` giả (ghi lại lệnh thay vì vẽ lên màn hình) rồi gọi
thẳng vào hai file của bạn, nên chấm được cả phần `if / elif` lẫn phần ảnh.
"""
import sys
import types
import pathlib
import asyncio

ROOT = pathlib.Path(__file__).parent
STUDENT_DIR = ROOT / "student"
GRADER_FILE = ROOT / "pygrade" / "grader.py"
FINGER_TASKS = ((1, "dragon"), (2, "phoenix"), (3, "sakura"))
# (số ngón tay, lời niệm, phép phải hiện) — phải đúng CẢ HAI vế
VOICE_TASKS = ((1, "rồng", "dragon"), (2, "phượng", "phoenix"), (3, "hoa", "sakura"),
               (1, "dragon", "dragon"), (3, "sakura", "sakura"))
# sai một vế thì tuyệt đối không được ra phép
VOICE_TRAPS = ((2, "rồng"), (1, "hoa"), (0, "dragon"))

fingers_held = [0]          # số ngón tay giả cho fingers_now()
word_now = [""]             # từ nghe được giả cho heard_word()

calls = []          # nhật ký lệnh mà mã của học sinh đã gọi ra


def _record_effect(name):
    calls.append(("fx", str(name)))


def _record_cast(name):
    calls.append(("cast", str(name)))


def _record_say(text):
    calls.append(("say", str(text)))


def _fingers_now():
    """Số ngón tay đang giơ — lúc chấm thì do bộ chấm đặt trước mỗi lượt."""
    return fingers_held[0]


def _record_button(label, effect):
    # effect co the la ten hieu ung (chuoi) hoac mot ham Python cua hoc sinh —
    # bo cham chi dem nut, khong can chay thu ham do.
    shown = "(ham rieng)" if callable(effect) else str(effect)
    calls.append(("button", str(label), shown))


def _record_stage_pick(role):
    def pick(name):
        calls.append(("stage", role, str(name)))
    return pick


def _heard_word():
    """Từ vừa nghe được — lúc chấm thì bộ chấm đặt trước mỗi lượt, đọc xong tự xoá."""
    w = word_now[0]
    word_now[0] = ""
    return w


def _run_loop(coro_func):
    # cham.py không chạy nền — _check_loop_behavior() tự gọi main_loop() trực
    # tiếp có kiểm soát thời gian, nên run_loop() ở đây chỉ là no-op.
    return True


def _new_image(width, height):
    """Tấm ảnh trống cho học sinh chứa kết quả tạm ở bài scene."""
    image = []
    for _ in range(height):
        row = []
        for _ in range(width):
            row.append([0, 0, 0])
        image.append(row)
    return image


def _load():
    """Chạy bộ chấm + hai file của học sinh trong CÙNG một namespace.

    Trình duyệt nạp ba file đó chồng lên nhau y hệt cách này, nên chấm ở đây và
    chấm trong trang không thể lệch nhau.
    """
    fake_stage = types.ModuleType("magic_stage")
    fake_stage.play_effect = _record_effect
    fake_stage.cast = _record_cast
    fake_stage.say = _record_say
    fake_stage.add_button = _record_button
    fake_stage.new_image = _new_image
    fake_stage.fingers_now = _fingers_now
    fake_stage.set_background = _record_stage_pick("background")
    fake_stage.set_behind = _record_stage_pick("behind")
    fake_stage.set_front = _record_stage_pick("front")
    fake_stage.heard_word = _heard_word
    fake_stage.run_loop = _run_loop
    sys.modules["magic_stage"] = fake_stage

    namespace = {"__name__": "student"}
    for path in (GRADER_FILE, STUDENT_DIR / "spells.py", STUDENT_DIR / "image_spells.py"):
        exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace)
    return namespace


def _check_spells(namespace):
    """Gọi on_fingers / on_voice với từng đề bài, xem có ra đúng hiệu ứng không."""
    results = []
    for count, wanted in FINGER_TASKS:
        del calls[:]
        namespace["on_fingers"](count)
        results.append((("fx", wanted) in calls, f"{count} ngón tay ra {wanted}"))
    del calls[:]
    namespace["on_fingers"](9)
    results.append((bool(calls), "số chưa gán phép thì phải nói ra chứ không im lặng"))
    for fingers, word, wanted in VOICE_TASKS:
        fingers_held[0] = fingers
        del calls[:]
        namespace["on_voice"](word)
        results.append((("fx", wanted) in calls,
                        f'{fingers} ngón + nói "{word}" ra {wanted}'))
    for fingers, word in VOICE_TRAPS:
        fingers_held[0] = fingers
        del calls[:]
        fired = [entry for entry in calls if entry[0] == "fx"]
        namespace["on_voice"](word)
        fired = [entry for entry in calls if entry[0] == "fx"]
        results.append((not fired,
                        f'{fingers} ngón + nói "{word}" thì KHÔNG được ra phép'))
    fingers_held[0] = 0

    setup = namespace.get("setup")
    if setup is not None:
        del calls[:]
        setup()
        buttons = [entry for entry in calls if entry[0] == "button"]
        results.append((len(buttons) >= 3,
                        f"setup() gắn được {len(buttons)} nút (đề bài cần ít nhất 3)"))

    # stage() không có đáp án đúng — chỉ đòi ít nhất một nền và một nút,
    # y hệt runStageCell() bên trang làm bài.
    stage = namespace.get("stage")
    if stage is not None:
        del calls[:]
        stage()
        picks = {entry[1]: entry[2] for entry in calls if entry[0] == "stage"}
        buttons = [entry for entry in calls if entry[0] == "button"]
        results.append(("background" in picks, "stage() đã set_background() chưa"))
        results.append((len(buttons) >= 1, "stage() đã add_button() ít nhất một nút chưa"))

    # main_loop() BẮT BUỘC có while thật + await asyncio.sleep(...) — soi thẳng
    # mã nguồn trước, y hệt checkLoopSyntax() bên trang làm bài.
    loop_fn = namespace.get("main_loop")
    if loop_fn is not None:
        spells_source = (STUDENT_DIR / "spells.py").read_text(encoding="utf-8")
        if "while" not in spells_source:
            results.append((False, "main_loop: chưa thấy vòng lặp `while` thật nào trong mã của bạn."))
        elif "await asyncio.sleep(" not in spells_source:
            results.append((False,
                "main_loop: chưa thấy `await asyncio.sleep(...)` — thiếu dòng này thì vòng lặp sẽ treo cứng trình duyệt."))
        else:
            results.append(_check_loop_behavior(loop_fn))
    return results


async def _run_main_loop_once(loop_fn):
    try:
        await asyncio.wait_for(loop_fn(), timeout=1.2)
    except asyncio.TimeoutError:
        pass    # vòng lặp vô hạn không tự dừng — hết giờ là kết quả MONG ĐỢI


def _check_loop_behavior(loop_fn):
    """Đặt 1 ngón + nghe "dragon" giả, chạy main_loop() có giới hạn thời gian,
    xem vòng lặp có thật sự đọc fingers_now()/heard_word() rồi phản ứng không."""
    fingers_held[0] = 1
    word_now[0] = "dragon"
    del calls[:]
    try:
        asyncio.run(_run_main_loop_once(loop_fn))
    except Exception as err:
        return False, f"main_loop văng lỗi: {type(err).__name__}: {err}"
    finally:
        fingers_held[0] = 0
        word_now[0] = ""
    fired = any(entry[0] == "fx" for entry in calls)
    if not fired:
        return False, 'main_loop: đặt 1 ngón + nghe "dragon" mà vòng lặp không gọi play_effect nào cả'
    return True, "main_loop: vòng lặp đọc cảm biến và phản ứng đúng"


def _check_images(namespace):
    """Chạy đúng người-chấm-bài mà học sinh bấm phím T trong trang."""
    results = []
    for line in namespace["check_all"](namespace).split("\n"):
        if line.startswith("—"):                      # dòng tiêu đề "bài thêm"
            continue
        results.append((not line.startswith("✖"), line[1:].strip()))
    return results


def check():
    """Trả về (danh sách dòng đã định dạng, số chỗ còn sai)."""
    try:
        namespace = _load()
    except Exception as err:
        return [f"  ✖ không nạp được student/: {type(err).__name__}: {err}"], 1

    results = []
    try:
        results += _check_images(namespace)
    except Exception as err:
        results.append((False, f"phần ảnh văng lỗi: {type(err).__name__}: {err}"))
    try:
        results += _check_spells(namespace)
    except Exception as err:
        results.append((False, f"phần thần chú văng lỗi: {type(err).__name__}: {err}"))

    lines = []
    wrong = 0
    for passed, text in results:
        if passed:
            lines.append("  ✓ " + text)
        else:
            lines.append("  ✖ " + text)
            wrong += 1
    return lines, wrong


def main():
    # Console Windows mặc định là bảng mã cũ: in dấu ✓/✖ ra là văng
    # UnicodeEncodeError, chấm xong mà không đọc được kết quả.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    lines, wrong = check()
    print("\n".join(lines))
    if wrong:
        print(f"Con {wrong} cho chua xong.")
        return 1
    print("XONG HET BAI.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
