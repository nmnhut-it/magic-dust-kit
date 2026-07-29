"""old_computer — the rookie machine from Node 0: it listens and it speaks.

    read(prompt) -> str       blocks until you type something (keyboard input)
    say(value)                prints it on the console (output)
    read_num(prompt) -> int   like read(), but hands back a NUMBER you can do math with
    say_num(value)            like say(), but for a number (int/float) result
    install_standard_io()     routes Python input()/print() through the same lesson terminal

Unlike machines.old_computer_ask (which converts to int for the odd/even
lesson), read() returns the raw string — the ECHO machine repeats anything.
read_num()/say_num() exist so the calculator exercise doesn't need to teach
int()/str() casting inline — the "machine learns a new word" pattern already
used for fire_vortex()/lighten() in camera_charm, applied here for numbers.
Runs inside the lesson worker; `bridge` is the page's I/O channel (worker.js).
"""
import builtins
import sys

from js import bridge


def read(prompt="Say something: "):
    return bridge.ask("keyboard", prompt)


def say(value):
    bridge.tell("terminal", str(value))


def read_num(prompt="Say a number: "):
    return int(bridge.ask("keyboard", prompt))


def say_num(value):
    bridge.tell("terminal", str(value))


class _TerminalOutput:
    """Line-buffered stdout that sends Python print() output to the lesson UI."""

    encoding = "utf-8"

    def __init__(self):
        self._buffer = ""

    def write(self, value):
        text = str(value)
        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            bridge.tell("terminal", line)
        return len(text)

    def flush(self):
        if self._buffer:
            bridge.tell("terminal", self._buffer)
            self._buffer = ""

    def isatty(self):
        return False


def _standard_input(prompt=""):
    return read(prompt)


def install_standard_io():
    """Route Python's standard input()/print() through the lesson terminal."""

    builtins.input = _standard_input
    sys.stdout = _TerminalOutput()


def card(number, output="", goto=99):
    return (int(number), output, int(goto))


def run_cards(*cards, start=10, end=99, limit=50):
    program = {}
    for item in cards:
        if not isinstance(item, tuple) or len(item) != 3:
            raise RuntimeError("run_cards() cần các thẻ tạo bằng card(...)")
        number, output, next_number = item
        program[int(number)] = (output, int(next_number))

    pc = int(start)
    end = int(end)
    steps = 0
    while pc != end:
        if steps >= limit:
            raise RuntimeError("máy đọc thẻ nhảy quá nhiều lần; kiểm tra lại goto")
        if pc not in program:
            raise RuntimeError(f"máy đọc thẻ không có thẻ {pc}")
        value, next_pc = program[pc]
        if value != "":
            say(value)
        pc = int(next_pc)
        steps += 1
    return pc


# Backward-compatible names for older lessons and saved code.
def line(number, value="", goto=99):
    return card(number, value, goto)


def run_lines(*lines, start=10, stop=99, limit=50):
    return run_cards(*lines, start=start, end=stop, limit=limit)
