#!/usr/bin/env python3
"""
Inject Ghidra-decompiled pseudo-C into the reconstructed Rust skeletons.

For each `/// RE: <raw>` comment in the skeleton, look up `<raw>` (or a
heuristic variant) in the exported JSON map. If a match is found, prepend
the pseudo-C as a `/*` block comment placed between the `/// RE:` line and
the stub item line.

The goal is to make the skeleton readable — the Rust body stays `todo!()`;
the Ghidra output lives in a comment above it.
"""

from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path


# -----------------------------------------------------------------------------
# Match strategies, tried in order of specificity.
# -----------------------------------------------------------------------------
def _strip_generics(sym: str) -> str:
    prev = None
    while prev != sym:
        prev = sym
        sym = re.sub(r"<[^<>]*>", "", sym)
    return sym


def _strip_trait_impl(sym: str) -> str:
    """Turn `<impl T for X>::m` into `X::m` (handles both rustfilt
    `<impl T for X>` and Ghidra's `_<impl_T_for_X>` forms)."""
    # Normalize underscores vs. spaces for the regex below.
    s = sym.replace("_<", "<").replace("_for_", " for ").replace("_as_", " as ")
    s = re.sub(r"impl_", "impl ", s)
    m = re.search(r"<\s*impl\s+[^<>]*?\s+for\s+([^<>]+?)>::([A-Za-z_][A-Za-z0-9_]*)", s)
    if m:
        return m.group(1).strip().replace(" ", "") + "::" + m.group(2)
    m = re.search(r"<\s*([^<>]+?)\s+as\s+[^<>]+?>::([A-Za-z_][A-Za-z0-9_]*)", s)
    if m:
        return m.group(1).strip().replace(" ", "") + "::" + m.group(2)
    return sym


def canonical(sym: str) -> str:
    """Aggressive canonical form: strip generics + trait-impl + collapse
    whitespace/underscores. Used as the primary match key."""
    s = _strip_trait_impl(sym)
    s = _strip_generics(s)
    # Drop the `_::` anonymous-impl markers Rust emits between mod and impl.
    s = re.sub(r"::_(::|$)", r"::", s)
    # Collapse all whitespace.
    s = re.sub(r"\s+", "", s)
    # Collapse runs of `_` to a single `_` (Ghidra sometimes inserts them).
    s = re.sub(r"_+", "_", s)
    s = s.strip("_:")
    return s


def match_candidates(raw: str, index_by_canon: dict[str, list[dict]]
                     ) -> list[dict]:
    """Return JSON entries whose canonical key matches `raw`."""
    want = canonical(raw)
    if want in index_by_canon:
        return index_by_canon[want]
    # Suffix fallback: last 2 path segments (e.g. `Type::method`).
    segs = want.split("::")
    if len(segs) >= 2:
        suf = "::".join(segs[-2:])
        # Scan all keys for a suffix match.
        hits = [recs for k, recs in index_by_canon.items() if k.endswith(suf)]
        if len(hits) == 1:
            return hits[0]
    return []


# -----------------------------------------------------------------------------
# Rewrite skeleton files in place.
# -----------------------------------------------------------------------------
RE_LINE = re.compile(r"^(?P<pad>\s*)/// RE: (?P<raw>.+)$")

MAX_LINES = 40  # cap pseudo-C pasted per stub


def build_index(raw_index: dict[str, dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for k, rec in raw_index.items():
        ck = canonical(k)
        out.setdefault(ck, []).append(rec)
    return out


def inject(skeleton_dir: Path, index: dict[str, list[dict]]
           ) -> tuple[int, int]:
    """Return (matched, total) stub counts."""
    matched = 0
    total = 0
    for rs in sorted(skeleton_dir.rglob("*.rs")):
        text = rs.read_text()
        out_lines: list[str] = []
        i = 0
        lines = text.splitlines()
        changed = False
        while i < len(lines):
            ln = lines[i]
            m = RE_LINE.match(ln)
            if not m:
                out_lines.append(ln)
                i += 1
                continue
            total += 1
            raw = m.group("raw").strip()
            pad = m.group("pad")
            # Skip if a previous run already injected below this line.
            already_injected = (
                i + 1 < len(lines)
                and lines[i + 1].lstrip().startswith("/* ghidra:")
            )
            out_lines.append(ln)
            if already_injected:
                i += 1
                continue
            cands = match_candidates(raw, index)
            if not cands:
                i += 1
                continue
            rec = cands[0]
            # Shorten the pseudo-C.
            code = rec.get("pseudo_c") or ""
            code_lines = code.splitlines()
            if len(code_lines) > MAX_LINES:
                code_lines = code_lines[:MAX_LINES] + ["// ... [truncated]"]
            matched += 1
            changed = True
            out_lines.append(pad + "/* ghidra: " + rec.get("addr", "?")
                             + "  sig=" + rec.get("signature", "").strip()
                             + "")
            for cl in code_lines:
                out_lines.append(pad + "   " + cl)
            out_lines.append(pad + "*/")
            i += 1
        if changed:
            rs.write_text("\n".join(out_lines) + "\n")
    return matched, total


# -----------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skeleton", required=True,
                    help="path to upstream/_reconstructed/<bin>/")
    ap.add_argument("--ghidra-json", required=True,
                    help="JSON emitted by _ghidra_export.py")
    args = ap.parse_args()

    raw_index = json.loads(Path(args.ghidra_json).read_text())
    index = build_index(raw_index)
    print(f"[inject] loaded {len(raw_index)} decompiled functions "
          f"({len(index)} canonical keys) from {args.ghidra_json}")

    matched, total = inject(Path(args.skeleton), index)
    pct = (100.0 * matched / total) if total else 0.0
    print(f"[inject] {matched}/{total} stubs annotated ({pct:.1f}%)")


if __name__ == "__main__":
    main()
