#!/usr/bin/env python3
"""
Reconstruct a Rust project skeleton from a non-stripped ELF.

For each target binary, we:
  1. Dump all symbols with `nm` and demangle via `rustfilt`.
  2. Filter symbols that belong to the proprietary crates (user-supplied list).
  3. Parse each demangled name into (crate, mod_path, item_name, generic_args).
  4. Group items by (crate, mod_path).
  5. Extract embedded dependency list by scanning for
     `.cargo/registry/src/index.crates.io-*/<name>-<version>/`.
  6. Emit:
        upstream/_reconstructed/<bin>/Cargo.toml         (workspace)
        upstream/_reconstructed/<bin>/<crate>/Cargo.toml
        upstream/_reconstructed/<bin>/<crate>/src/<mod>.rs
     Every extracted item becomes a commented stub:
        // RE: <full demangled symbol>
        pub fn <item>() { todo!() }

The skeleton compiles with `cargo check` once obvious type-parameter issues
are cleaned up — see `RECONSTRUCTION.md` for caveats.
"""

from __future__ import annotations
import argparse
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

# -----------------------------------------------------------------------------
# Binary targets and their proprietary top-level crate names
# -----------------------------------------------------------------------------
TARGETS = {
    "denver-airdrop-rs": {
        "path": "backend-bin/denver-airdrop-rs/denver-airdrop-rs",
        "crates": ["denver_airdrop_rs", "denver_monitor", "airdrop"],
        "primary": "denver_airdrop_rs",
    },
    "huehub-rgbpp-indexer": {
        "path": "backend-bin/huehub-rgbpp-indexer/rgbpp",
        "crates": [
            "rgbpp_indexer", "rgbpp_daos", "rgbpp_impls", "rgbpp_balances",
            "rgbpp_holders", "rgbpp_tokens", "rgbpp_transferable",
            "indexer_watcher", "ckb_indexer",
        ],
        "primary": "rgbpp_indexer",
    },
    "trading-tracker": {
        "path": "backend-bin/trading-tracker/trading-tracker",
        "crates": ["trading_tracker", "transaction_tracker"],
        "primary": "trading_tracker",
    },
}

# Known "internal" Rust compiler / std crate prefixes — filter out even if they
# happen to show up at column 0 in grep.
STD_PREFIXES = {
    "alloc", "core", "std", "proc_macro", "test",
    "compiler_builtins", "rustc_demangle",
}

# -----------------------------------------------------------------------------
# Symbol extraction
# -----------------------------------------------------------------------------
NM_CMD = ["nm", "--demangle=none"]


def dump_demangled(elf: Path) -> list[str]:
    """Return demangled symbol lines: `<addr> <type> <demangled_name>`."""
    raw = subprocess.run(
        NM_CMD + [str(elf)], capture_output=True, text=True, check=False
    ).stdout
    dem = subprocess.run(
        ["rustfilt"], input=raw, capture_output=True, text=True, check=True
    ).stdout
    return [ln for ln in dem.splitlines() if ln.strip()]


# A conservative regex for a Rust path item.
# Captures e.g. `my_crate::module::Type::method`, also with generic
# instantiations we strip.
PATH_RE = re.compile(
    r"""
    (?P<crate>[a-z_][a-zA-Z0-9_]*)      # top-level crate
    (?:::(?P<rest>[A-Za-z0-9_:<>,\ &'*\[\];]+))?
    """,
    re.VERBOSE,
)

GENERIC_RE = re.compile(r"<[^<>]*>")


def strip_generics(s: str) -> str:
    """Remove <...> instantiations, repeatedly (handles nested)."""
    prev = None
    while prev != s:
        prev = s
        s = GENERIC_RE.sub("", s)
    return s


@dataclass(frozen=True)
class Item:
    crate: str
    mod_path: tuple[str, ...]   # e.g. ("indexer", "chain")
    kind: str                   # "fn" | "method" | "type" (best guess)
    name: str                   # terminal ident
    raw: str                    # full demangled symbol


CRATE_PATH_RE = re.compile(
    r"\b(?P<crate>[a-z_][a-zA-Z0-9_]*)"
    r"(?:::[A-Za-z_][A-Za-z0-9_]*)+"
)

NOISE_TAIL = {
    "CALLSITE", "META", "closure", "__closure__", "vtable", "drop_in_place",
    "const", "static", "impl",
}

STD_METHOD_NOISE = {
    # Trait-required methods the compiler auto-generates from derives.
    "fmt", "clone", "drop", "eq", "ne", "cmp", "partial_cmp", "hash",
    "type_id", "clone_from",
    # Serde derives.
    "deserialize", "serialize", "expecting",
    "visit_str", "visit_bytes", "visit_map", "visit_seq", "visit_i64",
    "visit_u64", "visit_f64", "visit_bool", "visit_unit", "visit_none",
    "visit_some", "visit_newtype_struct", "visit_enum",
    # Futures / async.
    "poll", "poll_next", "poll_ready",
    # Smart-pointer-ish traits.
    "deref", "deref_mut", "index", "index_mut",
    "as_ref", "as_mut", "borrow", "borrow_mut",
    # From/Into.
    "from", "into", "try_from", "try_into",
    # `Default::default` — keep user-written `new`/`build` since they carry
    # real API signal.
    "default",
}


def parse_symbols(lines: list[str], own_crates: set[str]) -> list[Item]:
    out: list[Item] = []
    seen: set[tuple[str, tuple[str, ...], str]] = set()
    for ln in lines:
        parts = ln.split(maxsplit=2)
        if len(parts) < 3:
            continue
        name = parts[2]

        # Skip compiler-generated drop/vtable helpers — they only mention our
        # types via generic parameters and produce noisy `pub struct X` /
        # `pub mod X` collisions.
        if "drop_in_place" in name or name.startswith("core::ptr::"):
            continue

        # Strip noise suffixes the Rust compiler appends.
        name = re.sub(r"::h[0-9a-f]{16,}$", "", name)
        name = re.sub(r"\{\{[^{}]+\}\}", "__closure__", name)
        name = re.sub(r"#\d+", "", name)

        # Strip generics (nested-safe) for the main path we emit, but also
        # scan the ORIGINAL name so types inside `<impl Trait for Ty>`
        # brackets still contribute as candidates.
        cleaned = strip_generics(name)

        candidates: list[str] = []
        for haystack in (cleaned, name):
            for m in CRATE_PATH_RE.finditer(haystack):
                path = m.group(0)
                top = path.split("::", 1)[0]
                if top in own_crates:
                    candidates.append(path)
        if not candidates:
            continue

        # De-dupe while preserving the appearance order.
        seen_c: set[str] = set()
        uniq: list[str] = []
        for c in candidates:
            if c not in seen_c:
                seen_c.add(c)
                uniq.append(c)
        candidates = uniq

        # We emit ONE item per binary symbol. For trait-impl symbols like
        # `<impl Trait for MyType>::method` we want the struct item AND the
        # method item, so add both when we can distinguish them.
        multi_items: list[str] = []
        if "<impl " in name and " for " in name:
            # Pick all candidates whose last segment is a TYPE (CamelCase) ——
            # those are the impl targets.
            for c in candidates:
                last = c.split("::")[-1]
                if last and last[0].isupper():
                    multi_items.append(c)
        # Always also include the longest candidate (the method / fn path).
        longest = max(candidates, key=len)
        if longest not in multi_items:
            multi_items.append(longest)

        for raw_path in multi_items:
            # Defensive: drop everything after " as " — this only applies
            # inside impl brackets that we already flattened, but keep the
            # guard for safety.
            path = raw_path.split(" as ")[0]
            segs = [s for s in path.split("::") if s]
            # Strip trailing noise segments (CALLSITE, META, closures).
            while segs and (segs[-1] in NOISE_TAIL
                            or segs[-1].startswith("_")):
                segs.pop()
            if len(segs) < 2:
                continue
            crate = segs[0]
            tail = segs[-1]

            kind = "type" if tail and tail[0].isupper() else "fn"
            ident = re.sub(r"[^A-Za-z0-9_]", "_", tail).strip("_")
            if not ident or ident in NOISE_TAIL:
                continue
            if kind == "fn" and ident in STD_METHOD_NOISE:
                continue

            mod_parts: list[str] = []
            for s in segs[1:-1]:
                s = re.sub(r"[^A-Za-z0-9_]", "_", s).strip("_")
                if not s or s in NOISE_TAIL:
                    continue
                mod_parts.append(s)
            mod_path = tuple(mod_parts)

            key = (crate, mod_path, ident)
            if key in seen:
                continue
            seen.add(key)
            out.append(Item(crate=crate, mod_path=mod_path, kind=kind,
                            name=ident, raw=name))
    return out


# -----------------------------------------------------------------------------
# Dependency extraction from embedded .cargo paths
# -----------------------------------------------------------------------------
DEP_RE = re.compile(
    r"cargo/(?:registry/src/(?:index\.crates\.io|github\.com)-[a-f0-9]+|git/checkouts)/"
    r"([A-Za-z0-9_.+-]+?)-(\d+\.\d+\.\d+(?:[A-Za-z0-9.-]+)?)/"
)


def extract_deps(elf: Path) -> dict[str, str]:
    """Return {crate_name: highest_version} mapping."""
    proc = subprocess.run(
        ["strings", "-n", "8", str(elf)],
        capture_output=True, text=True, check=False, errors="replace"
    )
    deps: dict[str, str] = {}
    for m in DEP_RE.finditer(proc.stdout):
        name, version = m.group(1), m.group(2)
        # keep highest version we see (string compare is good enough)
        if name not in deps or version > deps[name]:
            deps[name] = version
    return deps


# -----------------------------------------------------------------------------
# Emit Cargo skeleton
# -----------------------------------------------------------------------------
HEADER = """// Auto-generated skeleton reconstructed from ELF symbols.
// This is **NOT** the original source — it is a structural approximation.
// Every `todo!()` body hides the original logic. Use this to:
//   * understand module layout and public API surface,
//   * seed a greenfield re-implementation,
//   * drive binary-diffing with the deployed ELF.
//
// Source: {src}
// Tool:   upstream/_reconstruct.py
#![allow(unused, non_snake_case, non_camel_case_types, dead_code)]

"""


def emit_crate(out_dir: Path, crate: str, items: list[Item], src_binary: Path,
               deps: dict[str, str], is_bin: bool) -> int:
    """Return count of emitted items."""
    crate_dir = out_dir / crate.replace("_", "-")
    (crate_dir / "src").mkdir(parents=True, exist_ok=True)

    # Group by mod_path
    by_mod: dict[tuple[str, ...], list[Item]] = defaultdict(list)
    for it in items:
        by_mod[it.mod_path].append(it)

    # Root file  (lib.rs or main.rs)
    root = "main.rs" if is_bin else "lib.rs"
    root_mods: set[str] = set()
    for mp in by_mod:
        if mp:
            root_mods.add(mp[0])

    root_lines = [HEADER.format(src=src_binary)]
    for m in sorted(root_mods):
        root_lines.append(f"pub mod {_mod_name(m)};")
    root_lines.append("")
    # Root-level items (mod_path == ())
    root_items = by_mod.get((), [])
    for it in sorted(set(root_items), key=lambda x: x.name):
        root_lines.append(_stub(it))
    if is_bin and not any(it.name == "main" for it in root_items):
        root_lines.append("fn main() { todo!(\"original `main` not exported\") }")
    (crate_dir / "src" / root).write_text("\n".join(root_lines) + "\n")

    # Submodule files — we use flat `src/<m>.rs` then nested `src/<m>/<sub>.rs`
    # For simplicity we collapse everything into <first>.rs with inline
    # `pub mod <sub>` blocks.
    for first in sorted(root_mods):
        path = crate_dir / "src" / f"{_mod_name(first)}.rs"
        lines = [HEADER.format(src=src_binary)]
        # Depth-first tree for paths starting with `first`
        tree: dict[tuple[str, ...], list[Item]] = {
            mp: its for mp, its in by_mod.items() if mp and mp[0] == first
        }
        # Build nested structure
        _emit_tree(lines, tree, prefix=(first,), indent=0)
        path.write_text("\n".join(lines) + "\n")

    # Cargo.toml
    manifest = [
        "[package]",
        f'name = "{crate.replace("_", "-")}"',
        'version = "0.0.0"',
        'edition = "2021"',
        'publish = false',
        "",
    ]
    if is_bin:
        manifest += [
            "[[bin]]",
            f'name = "{crate.replace("_", "-")}"',
            'path = "src/main.rs"',
            "",
        ]
    else:
        manifest += [
            "[lib]",
            'path = "src/lib.rs"',
            "",
        ]
    manifest.append("[dependencies]")
    # Emit only the deps we *might* need. For skeletons we deliberately leave
    # them commented out; enabling them requires the user to match versions.
    for d in sorted(deps):
        manifest.append(f'# {d} = "{deps[d]}"')
    manifest.append("")
    (crate_dir / "Cargo.toml").write_text("\n".join(manifest))
    return sum(len(v) for v in by_mod.values())


def _mod_name(seg: str) -> str:
    """Return a safe module name. CamelCase implies an impl-block path, which
    collides with sibling `pub struct <Name>`; rename to `impl_<name>`."""
    if seg and seg[0].isupper():
        return "impl_" + seg.lower()
    return seg


def _emit_tree(lines: list[str], tree: dict[tuple[str, ...], list[Item]],
               prefix: tuple[str, ...], indent: int) -> None:
    pad = "    " * indent
    # Items directly in this module.
    direct = tree.get(prefix, [])
    for it in sorted(set(direct), key=lambda x: (x.kind, x.name)):
        for ln in _stub(it).splitlines():
            lines.append(pad + ln)
    # Child modules at next level.
    children: set[str] = set()
    for mp in tree:
        if len(mp) > len(prefix) and mp[: len(prefix)] == prefix:
            children.add(mp[len(prefix)])
    for child in sorted(children):
        lines.append(f"{pad}pub mod {_mod_name(child)} {{")
        _emit_tree(lines, tree, prefix + (child,), indent + 1)
        lines.append(f"{pad}}}")


def _stub(it: Item) -> str:
    if it.kind == "type":
        return (
            f"/// RE: {it.raw}\n"
            f"pub struct {it.name};"
        )
    else:
        return (
            f"/// RE: {it.raw}\n"
            f"pub fn {it.name}() {{ todo!() }}"
        )


# -----------------------------------------------------------------------------
# Main entry
# -----------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", help="one of: " + ", ".join(TARGETS),
                    default=None)
    ap.add_argument("--out", default="upstream/_reconstructed")
    args = ap.parse_args()

    targets = [args.target] if args.target else list(TARGETS)
    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)

    stats: list[str] = []
    for name in targets:
        cfg = TARGETS[name]
        elf = Path(cfg["path"])
        if not elf.exists():
            print(f"[skip] {name}: {elf} not found", file=sys.stderr)
            continue
        print(f"[run] {name} ({elf})", file=sys.stderr)
        lines = dump_demangled(elf)
        items = parse_symbols(lines, set(cfg["crates"]))
        deps = extract_deps(elf)

        bin_out = out_root / name
        if bin_out.exists():
            subprocess.run(["rm", "-rf", str(bin_out)], check=True)
        bin_out.mkdir(parents=True)

        # Split items by crate
        by_crate: dict[str, list[Item]] = defaultdict(list)
        for it in items:
            by_crate[it.crate].append(it)

        total_items = 0
        for crate, its in by_crate.items():
            is_bin = crate == cfg["primary"]
            n = emit_crate(bin_out, crate, its, elf, deps, is_bin=is_bin)
            total_items += n

        # Top-level workspace Cargo.toml
        members = sorted(c.replace("_", "-") for c in by_crate)
        (bin_out / "Cargo.toml").write_text(
            "[workspace]\n"
            f'members = {members!r}\n'
            'resolver = "2"\n'
        )

        stats.append(
            f"  {name:26} {len(items):6d} symbols, "
            f"{len(by_crate):2d} crates, "
            f"{sum(len({i.mod_path for i in its}) for its in by_crate.values()):4d} modules, "
            f"{len(deps):4d} deps"
        )

    print("\n=== Reconstruction stats ===")
    for s in stats:
        print(s)


if __name__ == "__main__":
    main()
