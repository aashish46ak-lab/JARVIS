"""Fix SyntaxError from briefing comment break in main.py"""
from pathlib import Path
import re

p = Path(__file__).resolve().parent / "main.py"
m = p.read_text(encoding="utf-8")
orig = m

m = re.sub(
    r"if not self\._briefing_sent and \(False and get_brief_enabled\(\)\)\s*# HARD_ECHO_NO_BRIEF and self\._awake\s*:",
    "if False and not self._briefing_sent and get_brief_enabled() and self._awake:  # HARD_ECHO_NO_BRIEF",
    m,
)
m = re.sub(
    r"if not self\._briefing_sent and \(False and get_brief_enabled\(\)\)\s+# HARD_ECHO_NO_BRIEF[^\n]*",
    "if False and not self._briefing_sent and get_brief_enabled() and self._awake:  # HARD_ECHO_NO_BRIEF",
    m,
)
m = re.sub(
    r"if not self\._briefing_sent and \(False and get_brief_enabled\(\)\)[^\n]*",
    "if False and not self._briefing_sent and get_brief_enabled() and self._awake:  # HARD_ECHO_NO_BRIEF",
    m,
)

if m == orig:
    bad = "if not self._briefing_sent and (False and get_brief_enabled())  # HARD_ECHO_NO_BRIEF and self._awake:"
    good = "if False and not self._briefing_sent and get_brief_enabled() and self._awake:  # HARD_ECHO_NO_BRIEF"
    if bad in m:
        m = m.replace(bad, good)
        print("fixed exact bad line")
    else:
        for i, line in enumerate(m.splitlines(), 1):
            if "HARD_ECHO" in line or "get_brief_enabled" in line:
                print(f"{i}: {line}")
        print("no change needed or pattern different")
else:
    p.write_text(m, encoding="utf-8")
    print("OK main.py syntax fixed")

import py_compile
try:
    py_compile.compile(str(p), doraise=True)
    print("OK python syntax check passed")
except Exception as e:
    print("STILL BROKEN:", e)
