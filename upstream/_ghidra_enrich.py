#!/usr/bin/env python3
"""
Enrich the skeleton + Ghidra-pseudo-C injected files with higher-level
structured signal extracted from the pseudo-C:

  * CALLS   — external crate functions this stub invokes (de-duplicated,
              filtered to interesting deps).
  * STRINGS — string literals referenced from the stub (best-effort from
              Ghidra's `s_<slug>_<hex>` symbol names).
  * TRAIT   — hinted Rust signature for well-known trait impls
              (`serialize`, `deserialize`, `decode_log`, `fmt`, …).

The enrichment block is placed immediately AFTER the `/// RE: …` line and
BEFORE any existing `/* ghidra: … */` block. It is marked so the pass is
idempotent.

Usage:
    python3 upstream/_ghidra_enrich.py \
        --skeleton upstream/_reconstructed/<bin>/ \
        --ghidra-json /tmp/ghidra_work/out/<bin>.json
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

# Reuse the canonical-match machinery from the injector.
import sys
sys.path.insert(0, str(Path(__file__).parent))
from _ghidra_inject import canonical, build_index  # type: ignore


# -----------------------------------------------------------------------------
# Extraction primitives
# -----------------------------------------------------------------------------
# Ghidra decompiler emits function calls as `<demangled_name>(`. Restrict to
# a single logical line (no whitespace in the token) so we never capture a
# multi-line return-type + name combo as one "call".
CALL_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_:<>,]*::[A-Za-z_][A-Za-z0-9_:<>,]*)\s*\(")

# Symbols worth surfacing — user-crate calls are not in the JSON anyway;
# these are the external deps that carry the *meaning* of the function.
INTERESTING_PREFIXES = (
    "tokio::", "reqwest::", "hyper::", "serde::", "serde_json::", "serde_yaml::",
    "ethers::", "ethers_core::", "ethers_providers::", "ethers_contract::",
    "ethers_signers::", "ethers_middleware::", "ckb_", "rgbpp", "bitcoin::",
    "sqlx::", "sea_orm::", "diesel::", "redis::",
    "tracing::", "log::", "anyhow::", "thiserror::",
    "tonic::", "prost::", "substreams", "solana_", "spl_",
    "k256::", "secp256k1::", "sha2::", "sha3::", "blake2", "hex::",
    "rust_decimal", "bigdecimal", "num_bigint",
    "axum::", "actix_", "warp::", "hyper::", "tower::",
    "futures::", "futures_util::", "tokio_util::", "tokio_stream::",
)

# std::* calls are rarely interesting; skip unless they are channel/sync related.
STD_KEEP = ("std::sync::", "std::env::", "std::process::", "std::fs::",
            "std::net::", "std::thread::", "std::time::")

BORING_PREFIXES = (
    "core::", "alloc::", "std::", "<core::", "<alloc::", "<std::",
    "memcpy", "memset", "__", "FUN_", "thunk_",
)

# Deny-list of "trivial / helper" symbols that occur in every function.
NOISE_CALLS = {
    "drop", "clone", "fmt", "default", "from", "into", "new", "as_ref",
    "deref", "deref_mut", "poll", "next", "unwrap", "unwrap_or_default",
    "unwrap_failed", "expect",
}


def extract_calls(pseudo_c: str) -> list[str]:
    seen: list[str] = []
    picked: set[str] = set()
    for m in CALL_RE.finditer(pseudo_c):
        sym = m.group(1).strip()
        # Filter out C-ish tokens (control flow, typedefs, …) by requiring `::`.
        if "::" not in sym:
            continue
        # Clean up trailing punctuation from the greedy regex.
        sym = sym.strip().rstrip(",").strip()
        if len(sym) > 180:
            continue  # giant mangled types
        # Skip obvious noise.
        if any(sym.startswith(p) for p in BORING_PREFIXES) \
                and not any(sym.startswith(k) for k in STD_KEEP):
            continue
        # Keep if it matches an interesting prefix OR looks like a user-typed path.
        keep = any(sym.startswith(p) for p in INTERESTING_PREFIXES) \
            or any(sym.startswith(k) for k in STD_KEEP) \
            or ("::" in sym and not sym.split("::")[0] in ("core", "alloc", "std"))
        if not keep:
            continue
        # Drop the hash suffix `::h<hex>` if Ghidra leaked one.
        sym = re.sub(r"::h[0-9a-f]{16}$", "", sym)
        # Drop the terminal `::<method>` if it is pure noise.
        tail = sym.rsplit("::", 1)[-1]
        if tail in NOISE_CALLS and len(sym.split("::")) <= 2:
            continue
        if sym in picked:
            continue
        picked.add(sym)
        seen.append(sym)
    return seen


# String literal extraction. Ghidra stores strings as:
#   &PTR_s_<slug>_<hex>
#   &DAT_<hex>      (no slug — not useful here)
# The slug loses original whitespace/punct — we approximate-round-trip it.
STR_RE = re.compile(r"PTR_s_([A-Za-z0-9_\-\.\+\/\:\?\! ]+?)_[0-9a-f]{6,}")


def extract_strings(pseudo_c: str) -> list[str]:
    out: list[str] = []
    picked: set[str] = set()
    for m in STR_RE.finditer(pseudo_c):
        slug = m.group(1)
        # Heuristic: drop slugs that are obviously filenames (src_foo_rs).
        if slug.endswith("_rs") or slug.endswith("_toml"):
            continue
        # Un-mangle the slug slightly — Ghidra swaps non-alnum with `_`.
        text = slug.replace("_", " ").strip()
        if len(text) < 3 or len(text) > 120:
            continue
        if text in picked:
            continue
        picked.add(text)
        out.append(text)
    return out


# -----------------------------------------------------------------------------
# Trait signature hints — what the *real* Rust fn looks like.
# -----------------------------------------------------------------------------
TRAIT_HINTS: dict[str, str] = {
    # serde
    "serialize": "fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>",
    "deserialize": "fn deserialize<'de, D: serde::Deserializer<'de>>(de: D) -> Result<Self, D::Error>",
    "visit_str": "fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E>",
    "visit_map": "fn visit_map<A: serde::de::MapAccess<'de>>(self, map: A) -> Result<Self::Value, A::Error>",
    "visit_seq": "fn visit_seq<A: serde::de::SeqAccess<'de>>(self, seq: A) -> Result<Self::Value, A::Error>",
    "expecting": "fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result",
    # core
    "fmt": "fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result",
    "clone": "fn clone(&self) -> Self",
    "default": "fn default() -> Self",
    "drop": "fn drop(&mut self)",
    "eq": "fn eq(&self, other: &Self) -> bool",
    "hash": "fn hash<H: std::hash::Hasher>(&self, state: &mut H)",
    "cmp": "fn cmp(&self, other: &Self) -> std::cmp::Ordering",
    "partial_cmp": "fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering>",
    "as_ref": "fn as_ref(&self) -> &T",
    "from": "fn from(value: T) -> Self",
    "into": "fn into(self) -> U",
    "try_from": "fn try_from(value: T) -> Result<Self, Self::Error>",
    "deref": "fn deref(&self) -> &Self::Target",
    "deref_mut": "fn deref_mut(&mut self) -> &mut Self::Target",
    "poll": "fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>",
    # ethers-rs
    "decode_log": "fn decode_log(log: &ethers_core::abi::RawLog) -> Result<Self, ethers_core::abi::Error>",
    "encode_log": "fn encode_log(&self) -> Vec<ethers_core::types::H256>",
    "new": "fn new(address: impl Into<ethers::types::Address>, client: Arc<M>) -> Self",
    # ckb
    "build": "fn build(self) -> <Self as Builder>::Output",
}


def trait_hint(raw: str) -> str | None:
    tail = raw.rsplit("::", 1)[-1].strip()
    # Some demangled forms end with `>::method` or `}::method`.
    tail = re.sub(r"[^A-Za-z0-9_]", "", tail)
    return TRAIT_HINTS.get(tail)


# -----------------------------------------------------------------------------
# Rewrite
# -----------------------------------------------------------------------------
RE_LINE = re.compile(r"^(?P<pad>\s*)/// RE: (?P<raw>.+)$")
GHIDRA_BEGIN = re.compile(r"^\s*/\* ghidra: ")
ENRICH_BEGIN = re.compile(r"^\s*//! calls: |^\s*// enriched: ")

MAX_CALLS = 12
MAX_STRINGS = 8


def _safe(tok: str, max_len: int = 160) -> str:
    """Strip newlines and cap length — comment lines must stay single-line."""
    tok = tok.replace("\n", " ").replace("\r", " ")
    tok = re.sub(r"\s+", " ", tok).strip()
    if len(tok) > max_len:
        tok = tok[:max_len - 3] + "..."
    return tok


def build_block(pad: str, raw: str, rec: dict | None) -> list[str]:
    lines: list[str] = []
    hint = trait_hint(raw)
    if hint:
        lines.append(pad + "// trait-hint: " + _safe(hint))
    if rec is not None:
        code = rec.get("pseudo_c") or ""
        calls = extract_calls(code)[:MAX_CALLS]
        strings = extract_strings(code)[:MAX_STRINGS]
        if calls:
            lines.append(pad + "// calls:")
            for c in calls:
                lines.append(pad + "//   - " + _safe(c))
        if strings:
            lines.append(pad + "// strings:")
            for s in strings:
                lines.append(pad + "//   - " + _safe(repr(s)))
    if lines:
        lines.insert(0, pad + "// enriched: ---")
        lines.append(pad + "// enriched: ---")
    return lines


def enrich(skeleton_dir: Path, index: dict[str, list[dict]]) -> tuple[int, int]:
    changed_files = 0
    enriched_stubs = 0
    for rs in sorted(skeleton_dir.rglob("*.rs")):
        text = rs.read_text()
        lines = text.splitlines()
        out: list[str] = []
        i = 0
        file_changed = False
        while i < len(lines):
            ln = lines[i]
            m = RE_LINE.match(ln)
            if not m:
                out.append(ln)
                i += 1
                continue
            pad = m.group("pad")
            raw = m.group("raw").strip()
            out.append(ln)
            # Check if next non-blank line is already our enrichment marker.
            if i + 1 < len(lines) and ENRICH_BEGIN.match(lines[i + 1]):
                # Already enriched — skip past the block (bounded by second marker).
                i += 1
                continue
            # Pull the Ghidra record, if any.
            cands = index.get(canonical(raw), [])
            rec = cands[0] if cands else None
            block = build_block(pad, raw, rec)
            if block:
                out.extend(block)
                enriched_stubs += 1
                file_changed = True
            i += 1
        if file_changed:
            rs.write_text("\n".join(out) + "\n")
            changed_files += 1
    return enriched_stubs, changed_files


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skeleton", required=True)
    ap.add_argument("--ghidra-json", required=True)
    args = ap.parse_args()

    raw_index = json.loads(Path(args.ghidra_json).read_text())
    index = build_index(raw_index)
    print(f"[enrich] loaded {len(raw_index)} decompiled functions"
          f" ({len(index)} canonical keys)")

    enriched, changed = enrich(Path(args.skeleton), index)
    print(f"[enrich] enriched {enriched} stubs across {changed} files")


if __name__ == "__main__":
    main()
