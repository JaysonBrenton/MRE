# @fileoverview Parse LiveRC embedded JavaScript object literals (racerLaps blocks)
#
# @description Converts JS object literal syntax to JSON-safe form for json.loads.
# Supports live single-quoted form, fixture unquoted-key form, and JS escapes (\' ).

import json
import re
from typing import Any, Optional

# Trailing commas before } or ] (allowed in JS, invalid in JSON)
_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")

# Bare identifier keys: { lapNum: "1" } or , driverName: "X"
_UNQUOTED_KEY_RE = re.compile(
    r"(?<=[{\[,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:",
)


def _strip_trailing_commas(text: str) -> str:
    prev = None
    while prev != text:
        prev = text
        text = _TRAILING_COMMA_RE.sub(r"\1", text)
    return text


def _quote_unquoted_js_keys(text: str) -> str:
    return _UNQUOTED_KEY_RE.sub(r' "\1":', text)


def _js_single_quoted_strings_to_json(text: str) -> str:
    """Replace JS single-quoted strings with JSON double-quoted strings."""
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c != "'":
            out.append(c)
            i += 1
            continue
        i += 1
        chars: list[str] = []
        while i < n:
            ch = text[i]
            if ch == "\\" and i + 1 < n:
                nxt = text[i + 1]
                if nxt == "'":
                    chars.append("'")
                elif nxt == "\\":
                    chars.append("\\")
                elif nxt == "n":
                    chars.append("\n")
                elif nxt == "t":
                    chars.append("\t")
                elif nxt == "r":
                    chars.append("\r")
                elif nxt == "u" and i + 5 < n and text[i + 2 : i + 6].isalnum():
                    # \uXXXX — keep as escaped for json.dumps
                    chars.append(text[i : i + 6])
                    i += 6
                    continue
                else:
                    chars.append(nxt)
                i += 2
                continue
            if ch == "'":
                i += 1
                break
            chars.append(ch)
            i += 1
        out.append(json.dumps("".join(chars)))
    return "".join(out)


def parse_liverc_js_object(js_block: str) -> Optional[dict[str, Any]]:
    """
    Parse a LiveRC racerLaps {...} object literal into a dict.

    Handles:
    - Live single-quoted keys/values with JS escapes (e.g. O\\'LOUGHLIN)
    - Fixture-style unquoted keys and double-quoted strings
    - Trailing commas after object/array elements
    """
    block = js_block.strip()
    if not block.startswith("{"):
        return None
    block = _strip_trailing_commas(block)
    block = _quote_unquoted_js_keys(block)
    block = _js_single_quoted_strings_to_json(block)
    try:
        data = json.loads(block)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None
