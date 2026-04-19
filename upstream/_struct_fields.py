#!/usr/bin/env python3
"""
Recover struct *field names* from the ELF rodata and annotate the skeleton
`pub struct` declarations with them.

Rust's derived `#[derive(Serialize)]` stores the field-name list as a
sequence of `&'static str` pointers in rodata; the strings themselves are
packed adjacently (often without NUL separators — they're (ptr, len)
slices). Right after or before a `"struct <Name> with <N> elements"`
literal we usually find the <N> field names concatenated.

We:
  1. Read the full binary as bytes.
  2. Find every `b"struct <Name> with <K> elements"` marker.
  3. Look at a window BEFORE and AFTER the marker for plausible
     snake_case / camelCase identifiers (<= 32 chars) and greedily
     slice them out up to <K> names.
  4. Write the discovered fields as a `// fields:` comment block right
     after the `pub struct <Name>;` declaration in the skeleton.

This is heuristic and will recover 1..K fields per struct (not always
all K, because the rust compiler may share strings across structs).
"""
from __future__ import annotations
import argparse
import re
from pathlib import Path


STRUCT_MARKER = re.compile(rb"struct ([A-Za-z_][A-Za-z0-9_]{0,63}) with (\d+) elements")

# Likely Rust field-name charset. We also exclude common "struct …"/marker
# runs so we don't swallow the next marker.
IDENT = re.compile(rb"[A-Za-z_][A-Za-z0-9_]{1,40}")

BAD_FIELD_PREFIXES = (
    b"struct ", b"event ", b"src/", b"internal ", b"/rustc", b"/usr/",
    b"assertion ", b"called ", b"Result::", b"Option::",
)


def looks_like_field(s: bytes) -> bool:
    if any(s.startswith(p) for p in BAD_FIELD_PREFIXES):
        return False
    if len(s) < 2 or len(s) > 32:
        return False
    # Must contain at least one lowercase character (structs start with
    # uppercase, fields with lowercase or _).
    if not re.search(rb"[a-z]", s):
        return False
    # No spaces, no colons, no slashes.
    if any(c in s for c in b" :/\\.-"):
        return False
    return True


def find_fields(data: bytes, offset: int, count: int, span: int = 256
                ) -> list[str]:
    """Return up to <count> identifier-like tokens from the region
    surrounding <offset>. We try AFTER first (most common), then BEFORE."""
    results: list[str] = []
    seen: set[str] = set()
    for chunk in (data[offset:offset + span + 64], data[max(0, offset - span):offset]):
        for m in IDENT.finditer(chunk):
            tok = m.group(0)
            # Reject anything that starts too early in the chunk boundary —
            # those are usually spillovers from adjacent strings.
            # (The whole `finditer` pass is already bounded.)
            if not looks_like_field(tok):
                continue
            txt = tok.decode("ascii")
            if txt in seen:
                continue
            seen.add(txt)
            results.append(txt)
            if len(results) >= count:
                return results
    return results


def recover_from_elf(elf_path: Path) -> dict[str, list[str]]:
    data = elf_path.read_bytes()
    out: dict[str, list[str]] = {}
    for m in STRUCT_MARKER.finditer(data):
        name = m.group(1).decode("ascii")
        k = int(m.group(2))
        fields = find_fields(data, m.end(), k)
        # Keep the result with the MOST fields — the marker can appear in
        # multiple rodata regions with different field neighbours.
        if name not in out or len(fields) > len(out[name]):
            out[name] = fields
    return out


# -----------------------------------------------------------------------------
# Skeleton rewrite
# -----------------------------------------------------------------------------
STRUCT_LINE = re.compile(r"^(?P<pad>\s*)pub struct (?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*;\s*$")
ALREADY = re.compile(r"^\s*//\s+fields:")


def annotate(skeleton_dir: Path, name2fields: dict[str, list[str]]) -> int:
    annotated = 0
    for rs in sorted(skeleton_dir.rglob("*.rs")):
        text = rs.read_text()
        lines = text.splitlines()
        out: list[str] = []
        i = 0
        changed = False
        while i < len(lines):
            ln = lines[i]
            m = STRUCT_LINE.match(ln)
            if not m:
                out.append(ln)
                i += 1
                continue
            out.append(ln)
            name = m.group("name")
            pad = m.group("pad")
            fields = name2fields.get(name)
            # Skip if already annotated (next non-blank line starts with
            # `// fields:`).
            if fields and (i + 1 >= len(lines) or not ALREADY.match(lines[i + 1])):
                out.append(pad + "// fields: " + ", ".join(fields))
                annotated += 1
                changed = True
            i += 1
        if changed:
            rs.write_text("\n".join(out) + "\n")
    return annotated


# -----------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--elf", required=True, help="path to ELF binary")
    ap.add_argument("--skeleton", required=True,
                    help="path to upstream/_reconstructed/<bin>/")
    args = ap.parse_args()
    elf = Path(args.elf)
    skel = Path(args.skeleton)
    name2fields = recover_from_elf(elf)
    print(f"[struct] {len(name2fields)} structs discovered in rodata")
    n = annotate(skel, name2fields)
    print(f"[struct] annotated {n} skeleton `pub struct` declarations")


if __name__ == "__main__":
    main()
