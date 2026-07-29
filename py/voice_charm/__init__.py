"""voice_charm — the listening charm of Gương Vô Cực.

The mirror hears a spoken spell and hands your program the word it caught:

    listen(words)        -> waits, returns whichever word in `words` was
                            heard, or "" when it caught nothing
    listen(words, 10)    -> same, but give the speaker up to 10 seconds

`words` is the list of spells the mirror is willing to recognise, e.g.
["koto", "boss", "flip"]. Anything outside that list comes back as "",
so an if/elif/else chain always needs its else branch.

Speaking is real INPUT, exactly like read() from the keyboard — the value
is not decided by your code, so your rules must handle every case. If the
microphone is unavailable or blocked, the mirror shows the spell words as
buttons instead and returns whichever one is chosen, so a lesson never
dead-ends on a missing mic.

Related: lessons/engine/interactive-studio.js (the `voice_listen` action)
and lessons/engine/voice-gate.js (the Web Speech session it wraps).
Runs inside the lesson worker; `bridge` is the page's I/O channel (worker.js).
"""
import json

from js import bridge

MAX_WORDS = 8
MIN_SECONDS = 2
MAX_SECONDS = 30


def listen(words, seconds=8):
    """Wait for one of `words` to be spoken; return it, or "" if none was."""
    vocabulary = [str(word) for word in list(words)[:MAX_WORDS] if str(word).strip()]
    wait = max(MIN_SECONDS, min(MAX_SECONDS, int(seconds)))
    payload = json.dumps(
        {"action": "voice_listen", "words": vocabulary, "seconds": wait},
        ensure_ascii=False,
    )
    heard = bridge.ask("studio_start", payload)
    return heard if heard in vocabulary else ""
