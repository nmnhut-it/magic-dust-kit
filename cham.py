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

STUDENT_DIR = pathlib.Path(__file__).parent / "student"
FINGER_TASKS = ((1, "dragon"), (2, "phoenix"), (3, "sakura"))
VOICE_TASKS = (("rồng", "dragon"), ("dragon", "dragon"), ("hoa", "sakura"),
               ("sakura", "sakura"), ("mưa", "rain"), ("rain", "rain"))

calls = []          # nhật ký lệnh mà mã của học sinh đã gọi ra


def _record_effect(name):
    calls.append(("fx", str(name)))


def _record_cast(name):
    calls.append(("cast", str(name)))


def _record_say(text):
    calls.append(("say", str(text)))


def _load():
    """Nạp hai file của học sinh với một `magic_stage` giả."""
    sys.path.insert(0, str(STUDENT_DIR))
    fake_stage = types.ModuleType("magic_stage")
    fake_stage.play_effect = _record_effect
    fake_stage.cast = _record_cast
    fake_stage.say = _record_say
    sys.modules["magic_stage"] = fake_stage
    import image_spells
    import spells
    return spells, image_spells


def _check_spells(spells):
    """Gọi on_fingers / on_voice với từng đề bài, xem có ra đúng hiệu ứng không."""
    results = []
    for count, wanted in FINGER_TASKS:
        del calls[:]
        spells.on_fingers(count)
        results.append((("fx", wanted) in calls, f"{count} ngón tay ra {wanted}"))
    del calls[:]
    spells.on_fingers(9)
    results.append((bool(calls), "số chưa gán phép thì phải nói ra chứ không im lặng"))
    for word, wanted in VOICE_TASKS:
        del calls[:]
        spells.on_voice(word)
        results.append((("fx", wanted) in calls, f'nói "{word}" ra {wanted}'))
    del calls[:]
    spells.on_voice("bâng quơ")
    results.append((bool(calls), "từ lạ thì phải đọc lại cho biết máy nghe ra gì"))
    return results


def _check_images(image_spells):
    """Chạy đúng người-chấm-bài mà học sinh bấm phím T trong trang."""
    results = []
    for line in image_spells.check_all().split("\n"):
        if line.startswith("—"):                      # dòng tiêu đề "bài thêm"
            continue
        results.append((not line.startswith("✖"), line[1:].strip()))
    return results


def check():
    """Trả về (danh sách dòng đã định dạng, số chỗ còn sai)."""
    try:
        spells, image_spells = _load()
    except Exception as err:
        return [f"  ✖ không nạp được student/: {type(err).__name__}: {err}"], 1

    results = []
    try:
        results += _check_images(image_spells)
    except Exception as err:
        results.append((False, f"phần ảnh văng lỗi: {type(err).__name__}: {err}"))
    try:
        results += _check_spells(spells)
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
    lines, wrong = check()
    print("\n".join(lines))
    if wrong:
        print(f"Con {wrong} cho chua xong.")
        return 1
    print("XONG HET BAI.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
