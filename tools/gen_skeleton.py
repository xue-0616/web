#!/usr/bin/env python3
"""Generate Cargo workspace skeleton from _recovery/*.txt data.

Input:  backend-bin/<proj>/_recovery/
Output: backend-bin/<proj>/_scaffold/  (or external target dir)

Strategy:
- Each line in crate-<name>.txt is a symbol path: crate::mod1::mod2::...::item
- item is either:
  - lowercase -> function (create fn with todo!() body)
  - CamelCase + method (::new, ::default, ::foo) -> impl block with method
  - CamelCase alone -> struct declaration
- Build directory tree: src/<mod1>/<mod2>.rs
- For each dir, generate mod.rs or lib.rs with `pub mod <child>;`
"""
import os, re, sys, json
from collections import defaultdict
from pathlib import Path

# Known real crates.io crates (filter OUT of internal-crates)
EXTERNAL = set("""
std core alloc proc_macro compiler_builtins panic_unwind spin
tokio hyper reqwest h2 http http_body httparse mime bytes
futures futures_core futures_util futures_sink futures_task futures_channel futures_executor futures_macro futures_io futures_intrusive
serde serde_json serde_yaml serde_derive serde_with serde_urlencoded
tracing tracing_subscriber tracing_core tracing_log tracing_futures tracing_appender tracing_actix_web
sqlx sqlx_core sqlformat mysql_common mysql_async
redis deadpool deadpool_redis
actix actix_web actix_http actix_rt actix_router actix_server actix_service actix_codec actix_utils actix_macros actix_cors
axum tower tower_http tonic prost prost_derive prost_types
anyhow thiserror error_chain backtrace log slog env_logger log4rs
regex regex_syntax regex_automata aho_corasick
num num_traits num_integer num_bigint num_bigint_dig num_complex num_rational num_derive num_bigfloat num_cpus num_threads
rand rand_core rand_chacha rand_xoshiro getrandom
base64 base64ct hex uuid time chrono chrono_tz
url percent_encoding form_urlencoded idna
libc memchr hashbrown hashlink lazy_static once_cell parking_lot parking_lot_core
crossbeam crossbeam_channel crossbeam_queue crossbeam_utils crossbeam_epoch
smallvec itoa ryu dashmap scopeguard slab pin pin_project pin_project_lite pin_utils
tiny_keccak keccak sha1 sha2 sha3 md5 hmac digest generic_array typenum block cipher subtle
ring rustls webpki sct openssl openssl_sys openssl_probe native_tls tokio_rustls tokio_native_tls
rsa ed25519 secp256k1 k256 p256 curve25519 elliptic_curve ecdsa sec1 pkcs1 pkcs8 spki der asn1 simple_asn1 pem pem_rfc7468 rfc6979 const_oid
aes ctr gcm aead universal crypto_common crypto_bigint
ethers ethers_providers ethers_core ethers_signers ethers_contract ethers_middleware ethers_solc
ethereum ethereum_types evm web3 ethabi rlp rustc_hex impl_serde primitive_types tiny_keccak rust_decimal
rusoto aws_lc aws_types aws_smithy aws_sigv4 aws_credential aws_sdk aws_runtime
clap clap_derive structopt dotenv dotenvy envy
addr2line gimli object miniz_oxide rustc_demangle
adler arrayvec brotli_decompressor combine crc crc32fast flate2 zstd zstd_safe inflate
unicode unicode_bidi unicode_categories unicode_ident unicode_normalization unicode_segmentation unicode_width
indexmap tinyvec ahash ahasher siphasher twox_hash xxhash fxhash wyhash
bincode bcs borsh rmp rmp_serde postcard ron toml
tungstenite websocket tokio_tungstenite
ipnet ipnetwork socket2 io_uring mio nix addr
signal_hook_registry
jsonwebtoken matchit reqwest_middleware reqwest_retry reqwest_tracing retry_policies
openssl_probe panic_unwind sharded_slab thread_local task_local_extensions
want sct untrusted
tracing_opentelemetry opentelemetry opentelemetry_http opentelemetry_semantic
bitflags cfg_if fastrand heck ident io_lifetimes cap camino
prometheus prometheus_http_parser metrics metrics_util quanta
http_range http_tiny encoding_rs utf8 unicode_ident
cookie cookies_store http_client hostname local_ip_address
derive_builder strum_macros strum ident_case darling syn quote
std_detect std-detect time_core time-core itertools
curv kzen_paillier kzen-paillier lindell multi_party_ecdsa multi-party-ecdsa zk_paillier zk-paillier
ark_poly_commit ark-poly-commit plonk email_parser email-parser email_rs email-rs
ckb_gen_types ckb-gen-types ckb_sdk ckb-sdk
""".split())

SRC_ROOT = "/home/kai/桌面/55182/链上自动化交易源码/backend-bin"


HASH_SUFFIX = re.compile(r'::h[0-9a-f]{16}$')

def load_module_paths(recovery_dir: str, crate: str) -> set:
    """Return set of full paths for this crate (with rust mangling hash stripped)."""
    f = os.path.join(recovery_dir, f"crate-{crate}.txt")
    if not os.path.isfile(f):
        return set()
    out = set()
    with open(f) as fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            # Strip rust mangling hash suffix
            line = HASH_SUFFIX.sub('', line)
            # Strip generic angle brackets to simplify
            line = re.sub(r'<[^>]*>', '', line)
            # Strip trailing {closure}, {impl} etc
            line = re.sub(r'::\{[^}]+\}$', '', line)
            # Strip numeric trailing (monomorphic variants)
            line = re.sub(r'::\d+$', '', line)
            out.add(line)
    return out


def build_tree(paths: set, crate: str):
    """Parse paths into a module tree structure.

    A path like `crate::mod1::mod2::Type::method` is split into:
    - module parts (snake_case): `mod1`, `mod2`
    - remaining: `Type::method` stored as item under module

    Returns: dict where keys are module names, values are either dict (submodules) or list of items.
    """
    tree = {'_items': []}
    for p in paths:
        if not p.startswith(f"{crate}::"):
            continue
        parts = p.split("::")[1:]  # strip crate name
        if not parts:
            continue
        # Split into module_parts (snake_case) and item_parts (Type::method...)
        module_parts = []
        item_parts = []
        for i, part in enumerate(parts):
            if re.match(r'^[A-Z]', part):
                # Type name starts here — everything from here is an item
                item_parts = parts[i:]
                break
            # Check if this is the last part AND it's snake_case — it's an item (function)
            if i == len(parts) - 1:
                item_parts = [part]
                break
            module_parts.append(part)
        if not item_parts:
            # All were modules (shouldn't happen but handle)
            continue

        # Navigate tree
        node = tree
        for m in module_parts:
            node = node.setdefault(m, {'_items': []})
        node['_items'].append(item_parts)
    return tree


def classify_item(item_parts: list) -> tuple:
    """Classify last path segments. Returns (kind, name, method_or_none)."""
    if len(item_parts) == 1:
        name = item_parts[0]
        if re.match(r'^[A-Z]', name):
            return ("type", name, None)
        else:
            return ("fn", name, None)
    elif len(item_parts) == 2:
        type_name, method = item_parts
        if re.match(r'^[A-Z]', type_name):
            return ("method", type_name, method)
    # Fallback: function
    return ("fn", "_".join(item_parts), None)


def gen_module_source(node: dict, module_name: str, crate: str) -> str:
    """Generate Rust source for a module."""
    lines = []
    lines.append(f"//! {crate}::{module_name} - auto-generated skeleton")
    lines.append("//! Recovered from binary symbols. All function bodies are stubs.")
    lines.append("")

    # Submodules
    submods = [k for k in node if k != '_items' and re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', k) and k != '_']
    for sm in sorted(submods):
        lines.append(f"pub mod {sm};")
    if submods:
        lines.append("")

    # Classify items
    items = node.get('_items', [])
    types = defaultdict(list)  # type_name -> [methods]
    free_fns = []
    bare_types = set()
    for parts in items:
        kind, name, method = classify_item(parts)
        if kind == "fn":
            free_fns.append(name)
        elif kind == "type":
            bare_types.add(name)
        elif kind == "method":
            types[name].append(method)
            bare_types.add(name)

    # Filter valid identifier
    ident_re = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
    bare_types = {t for t in bare_types if ident_re.match(t) and t != "_"}
    types = {t: ms for t, ms in types.items() if ident_re.match(t) and t != "_"}

    # Structs
    for t in sorted(bare_types):
        lines.append(f"/// Recovered type (stub).")
        lines.append(f"pub struct {t} {{")
        lines.append(f"    // TODO: fields unknown from symbols")
        lines.append(f"}}")
        lines.append("")

    # Impls
    for t, methods in sorted(types.items()):
        unique_methods = [m for m in sorted(set(methods)) if m and ident_re.match(m) and m != "_"]
        if not unique_methods:
            continue
        lines.append(f"impl {t} {{")
        for m in unique_methods:
            # Heuristic: methods named new/build/default/from_* are constructors
            if m in ('new', 'default', 'build') or m.startswith('from_'):
                lines.append(f"    /// TODO: Recovered constructor from binary.")
                lines.append(f"    pub fn {m}() -> Self {{")
                lines.append(f"        todo!(\"recovered from binary\")")
                lines.append(f"    }}")
            else:
                lines.append(f"    /// TODO: Recovered method from binary.")
                lines.append(f"    pub fn {m}(&self) {{")
                lines.append(f"        todo!(\"recovered from binary\")")
                lines.append(f"    }}")
            lines.append("")
        lines.append("}")
        lines.append("")

    # Free functions
    for f in sorted(set(free_fns)):
        # Skip invalid Rust identifiers
        if not f or f == "_" or not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', f):
            continue
        # Skip Rust reserved words
        if f in {'type', 'impl', 'trait', 'fn', 'let', 'mut', 'pub', 'use', 'mod', 'as', 'async', 'await', 'box', 'break', 'const', 'continue', 'crate', 'do', 'dyn', 'else', 'enum', 'extern', 'false', 'final', 'for', 'if', 'in', 'loop', 'match', 'move', 'override', 'priv', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super', 'true', 'try', 'typeof', 'unsafe', 'unsized', 'virtual', 'where', 'while', 'yield', 'union'}:
            continue
        lines.append(f"/// TODO: Recovered function from binary.")
        lines.append(f"pub fn {f}() {{")
        lines.append(f"    todo!(\"recovered from binary\")")
        lines.append(f"}}")
        lines.append("")

    return "\n".join(lines)


def walk_tree(tree: dict, crate: str, out_dir: str, path_so_far: list):
    """Recursively write mod.rs / <name>.rs files."""
    submods = [k for k in tree if k != '_items']
    if not path_so_far:
        # Root: lib.rs
        target = os.path.join(out_dir, "src", "lib.rs")
    else:
        # Submodule: if has submods -> mod.rs; else -> <name>.rs
        if submods:
            mod_path = os.path.join(out_dir, "src", *path_so_far)
            os.makedirs(mod_path, exist_ok=True)
            target = os.path.join(mod_path, "mod.rs")
        else:
            mod_path = os.path.join(out_dir, "src", *path_so_far[:-1])
            os.makedirs(mod_path, exist_ok=True)
            target = os.path.join(mod_path, f"{path_so_far[-1]}.rs")

    os.makedirs(os.path.dirname(target), exist_ok=True)
    src = gen_module_source(tree, "::".join(path_so_far) or "lib", crate)
    with open(target, 'w') as f:
        f.write(src)

    # Recurse
    for sm in submods:
        walk_tree(tree[sm], crate, out_dir, path_so_far + [sm])


def gen_cargo_toml(crate: str, external_deps: set, out_dir: str):
    """Generate Cargo.toml for a crate. external_deps passed in."""
    all_external = external_deps

    # Common external deps with reasonable versions
    dep_versions = {
        "tokio": '"1", features = ["full"]',
        "serde": '"1", features = ["derive"]',
        "serde_json": '"1"',
        "anyhow": '"1"',
        "thiserror": '"1"',
        "tracing": '"0.1"',
        "async_trait": '"0.1"',
        "reqwest": '"0.11", default-features = false, features = ["json", "rustls-tls"]',
        "sqlx": '"0.7", features = ["runtime-tokio-rustls", "mysql", "postgres"]',
        "actix_web": '"4"',
        "jsonwebtoken": '"9"',
        "redis": '"0.25"',
        "ethers": '"2"',
        "chrono": '"0.4"',
        "uuid": '"1"',
        "bigdecimal": '"0.4"',
        "url": '"2"',
        "base64": '"0.22"',
        "hex": '"0.4"',
        "openssl": '"0.10"',
        "rsa": '"0.9"',
        "secp256k1": '"0.28"',
    }

    lines = [
        f'[package]',
        f'name = "{crate.replace("_", "-")}"',
        'version = "0.1.0"',
        'edition = "2021"',
        '',
        '[dependencies]',
    ]
    # Pick top 10 most relevant external deps from all_external
    # Prefer ones in dep_versions
    # Real crate names on crates.io - use exactly these
    real_name_map = {
        "async_trait": "async-trait",
        "actix_web": "actix-web",
        "tokio_util": "tokio-util",
        "tokio_stream": "tokio-stream",
        "futures_util": "futures-util",
        "tower_http": "tower-http",
        "clap_derive": "clap_derive",
        "serde_json": "serde_json",
        "serde": "serde",
        "tokio": "tokio",
        "redis": "redis",
        "ethers": "ethers",
        "chrono": "chrono",
        "uuid": "uuid",
        "bigdecimal": "bigdecimal",
        "url": "url",
        "base64": "base64",
        "hex": "hex",
        "openssl": "openssl",
        "rsa": "rsa",
        "secp256k1": "secp256k1",
        "anyhow": "anyhow",
        "thiserror": "thiserror",
        "tracing": "tracing",
        "reqwest": "reqwest",
        "sqlx": "sqlx",
        "jsonwebtoken": "jsonwebtoken",
    }
    used = set()
    for c in sorted(all_external):
        name = c.replace("-", "_")
        if name in dep_versions and name not in used:
            real_name = real_name_map.get(name, name.replace("_", "-"))
            lines.append(f'{real_name} = {{ version = {dep_versions[name]} }}')
            used.add(name)

    with open(os.path.join(out_dir, "Cargo.toml"), 'w') as f:
        f.write("\n".join(lines) + "\n")


def gen_workspace_toml(proj_root: str, crates: list):
    """Generate root Cargo.toml workspace."""
    lines = [
        '[workspace]',
        'resolver = "2"',
        'members = [',
    ]
    for c in sorted(crates):
        lines.append(f'    "crates/{c.replace("_", "-")}",')
    lines.append(']')
    lines.append('')
    lines.append('[workspace.package]')
    lines.append('version = "0.1.0"')
    lines.append('edition = "2021"')

    with open(os.path.join(proj_root, "Cargo.toml"), 'w') as f:
        f.write("\n".join(lines) + "\n")


_TOP_CRATES_CACHE = None
def load_top_crates():
    global _TOP_CRATES_CACHE
    if _TOP_CRATES_CACHE is not None:
        return _TOP_CRATES_CACHE
    p = "/home/kai/.cache/crates-io-top10k.txt"
    if os.path.isfile(p):
        with open(p) as f:
            _TOP_CRATES_CACHE = set(line.strip() for line in f if line.strip())
    else:
        _TOP_CRATES_CACHE = set()
    return _TOP_CRATES_CACHE

def filter_internal_crates(recovery_dir: str) -> list:
    """Internal = crates appearing in symbols but NOT in crates.io DWARF paths, not in top10k, not in hardcoded list."""
    with open(os.path.join(recovery_dir, "all-crates.txt")) as f:
        all_crates = set(line.strip() for line in f if line.strip())

    deps_file = os.path.join(recovery_dir, "crates_io_deps.txt")
    real_deps = set()
    if os.path.isfile(deps_file):
        with open(deps_file) as f:
            real_deps = set(line.strip() for line in f if line.strip())
        real_deps |= {c.replace("-", "_") for c in real_deps}
        real_deps |= {c.replace("_", "-") for c in real_deps}

    top_crates = load_top_crates()
    internal = all_crates - real_deps - EXTERNAL - top_crates
    internal = {c for c in internal if len(c) >= 3 and not c.startswith("_")}
    return sorted(internal)


def process_project(proj: str):
    proj_dir = os.path.join(SRC_ROOT, proj)
    recovery_dir = os.path.join(proj_dir, "_recovery")
    scaffold_dir = os.path.join(proj_dir, "_scaffold")
    if not os.path.isdir(recovery_dir):
        print(f"skip {proj}: no _recovery")
        return
    os.makedirs(scaffold_dir, exist_ok=True)

    internal = filter_internal_crates(recovery_dir)
    print(f"\n=== {proj} ({len(internal)} internal crates) ===")

    # Load all external deps for this project
    ext_file = os.path.join(recovery_dir, "external-crates.txt")
    external = set()
    if os.path.isfile(ext_file):
        with open(ext_file) as f:
            external = set(line.strip() for line in f if line.strip())

    for crate in internal:
        paths = load_module_paths(recovery_dir, crate)
        if not paths:
            continue
        crate_dir = os.path.join(scaffold_dir, "crates", crate.replace("_", "-"))
        os.makedirs(os.path.join(crate_dir, "src"), exist_ok=True)

        tree = build_tree(paths, crate)
        walk_tree(tree, crate, crate_dir, [])
        gen_cargo_toml(crate, external, crate_dir)
        print(f"  {crate}: {len(paths)} paths")

    gen_workspace_toml(scaffold_dir, internal)
    print(f"  -> workspace at {scaffold_dir}/Cargo.toml")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        process_project(sys.argv[1])
    else:
        for d in os.listdir(SRC_ROOT):
            if os.path.isdir(os.path.join(SRC_ROOT, d, "_recovery")):
                process_project(d)
