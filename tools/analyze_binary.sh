#!/bin/bash
# Deep analyze a single Rust/Go binary and extract all recoverable structure info
set -u
export PATH="$HOME/.cargo/bin:$PATH"

bin="$1"
proj="$2"
out_dir="$3"

mkdir -p "$out_dir"

# Skip if not executable
[ ! -f "$bin" ] && { echo "no binary: $bin"; exit 1; }
file "$bin" | grep -q "executable" || { echo "not executable: $bin"; exit 1; }

# Detect language
lang="?"
strings "$bin" 2>/dev/null | grep -q "^Go build ID:" && lang="Go"
[ "$lang" = "?" ] && strings "$bin" 2>/dev/null | head -100000 | grep -q "rustc version\|RUST_BACKTRACE\|core::panicking" && lang="Rust"

echo "=== $proj ($(basename $bin)) [$lang] ==="

# 1. Symbols (raw + demangled)
nm "$bin" 2>/dev/null | grep " [TWtw] " > "$out_dir/symbols-raw.txt"
if [ "$lang" = "Rust" ]; then
  rustfilt < "$out_dir/symbols-raw.txt" > "$out_dir/symbols-demangled.txt" 2>&1
else
  c++filt < "$out_dir/symbols-raw.txt" > "$out_dir/symbols-demangled.txt" 2>&1
fi

# 2. Module paths
awk '{for(i=3;i<=NF;i++) printf "%s ", $i; print ""}' "$out_dir/symbols-demangled.txt" | \
  grep -oE "^[a-z_][a-z0-9_]*(::[a-zA-Z_][a-zA-Z0-9_<>]*)+" | \
  sort -u > "$out_dir/module-paths.txt"

# 3. Identify internal workspace crates (not on crates.io)
# Heuristic: snake_case + project-prefixed
awk -F'::' '{print $1}' "$out_dir/module-paths.txt" | sort -u > "$out_dir/all-crates.txt"

# Known std/common deps to filter out
STDCRATES="std core alloc proc_macro rustc cxx serde serde_json serde_yaml serde_derive tokio hyper reqwest h2 http mio futures tracing sqlx async_trait num rand regex regex_syntax bytes chrono lazy_static once_cell libc memchr hashbrown anyhow thiserror log backtrace addr2line gimli object miniz_oxide rustc_demangle compiler_builtins unicode base64 hex sha2 sha3 md5 ring rsa ed25519 secp256k1 k256 aes bigdecimal url percent parking_lot crossbeam rayon smallvec itoa ryu dashmap scopeguard slab pin tower tonic prost prometheus opentelemetry rand_core digest generic_array typenum block getrandom pbkdf2 hmac cipher subtle crypto curve25519 signature spki pem pkcs der asn1 rlp ethereum ethereum_types evm web3 rust_decimal indexmap tinyvec time uuid toml bytecheck byteorder ahash sptr socket2 io_uring nix fs erased ahasher erasable cache portable camino strum actix_web actix_http actix_rt actix_router actix_server actix_service actix_codec actix_utils actix_macros actix actix_cors actix_middleware openssl openssl_sys rustls webpki aho_corasick flate2 ethabi redis ethers ethers_providers ethers_core ethers_signers tokio_util tokio_stream mysql_common mysql_async tungstenite websocket ipnet addr axum hyper_util tower_http clap clap_derive structopt tls tokio_rustls hyper_tls bincode bcs borsh rmp_serde ron prost_derive prost_types rmp postcard crypto_common universal rand_chacha rand_xoshiro twox_hash xxhash fxhash siphasher cityhasher seahash wyhash cfg_if fastrand heck ident io_lifetimes cap camino crossterm termcolor owo_colors console nu_ansi_term ansi_term atty atomic_waker event_listener crossbeam_channel crossbeam_queue crossbeam_utils crossbeam_epoch memoffset mach pathdiff regex_automata tinystr tinyset walkdir jobserver http_body http_range http_tiny_http httpdate httparse encoding_rs utf8 unicode_segmentation unicode_ident unicode_width mime mime_guess form_urlencoded rustls_pemfile dotenv dotenvy envy env_logger log4rs slog tracing_subscriber tracing_core tracing_log tracing_futures tracing_actix_web opentelemetry_http opentelemetry_semantic stdout fmt_ansi nu ansi serde_urlencoded serde_qs chrono_tz aws_lc aws_types aws_smithy aws_sigv4 aws_credential aws_sdk aws_runtime snafu displaydoc nom winnow winnow_ lexical metrics metrics_util quanta prometheus_http_parser unwrap_infallible num_traits num_integer num_bigint num_complex num_rational num_derive num_bigfloat num_cpus num_threads glob ignore bitflags bit_vec bit_set enum_dispatch either futures_io futures_core futures_util futures_sink futures_task futures_channel futures_executor futures_macro pin_project pin_utils pin_project_lite tokio_native_tls native_tls tokio_socks socks5 socks4 socks_proxy cookie cookies_store http_client hostname local_ip_address local_ipaddress ipnetwork nameof typename try_from_js type_id intrusive_collections rangemap interval_tree arc_swap tokio_tungstenite websocket_client url_util url_escape http_signature url_encoded_query"

for c in $(cat "$out_dir/all-crates.txt"); do
  skip=0
  for s in $STDCRATES; do
    [ "$c" = "$s" ] && { skip=1; break; }
  done
  [ $skip -eq 0 ] && echo "$c"
done > "$out_dir/internal-crates.txt"

# 4. Extract module tree for each internal crate
for c in $(cat "$out_dir/internal-crates.txt"); do
  grep "^$c::" "$out_dir/module-paths.txt" > "$out_dir/crate-$c.txt" 2>/dev/null || true
done

# 5. Extract SQL schema from strings
strings "$bin" 2>/dev/null | grep -iE "^(CREATE TABLE |CREATE INDEX |CREATE UNIQUE |ALTER TABLE |DROP TABLE)" > "$out_dir/sql-schema.txt" || true

# 6. Extract HTTP routes
strings "$bin" 2>/dev/null | grep -E "^/[a-zA-Z_-]+(/[a-zA-Z_-]+)*(/\{[a-z_]+\})?$" | \
  grep -vE "^/(usr|etc|lib|bin|tmp|proc|sys|dev|run|home|var|root|opt|sbin|boot)" | \
  sort -u > "$out_dir/http-routes.txt" || true

# 7. Extract environment variables
strings "$bin" 2>/dev/null | grep -E "^[A-Z_][A-Z0-9_]{3,}$" | head -200 | sort -u > "$out_dir/env-vars.txt" || true

# 8. Structs/Enums (heuristic: CamelCase names in symbols)
grep -oE "\b[A-Z][a-zA-Z]+(Service|Controller|Handler|Repository|Dao|Dto|Entity|Request|Response|Builder|Config|Error|Client|Manager|Builder|Params|Context|State|Event|Message|Rule|Check|Result|Info)\b" \
  "$out_dir/symbols-demangled.txt" 2>/dev/null | sort -u > "$out_dir/structs.txt" || true

# 9. Dependencies (external crates)
grep -vxf "$out_dir/internal-crates.txt" "$out_dir/all-crates.txt" 2>/dev/null > "$out_dir/external-crates.txt" || cp "$out_dir/all-crates.txt" "$out_dir/external-crates.txt"

# Summary
echo "  internal crates:  $(wc -l < $out_dir/internal-crates.txt)"
echo "  external crates:  $(wc -l < $out_dir/external-crates.txt)"
echo "  module paths:     $(wc -l < $out_dir/module-paths.txt)"
echo "  sql tables:       $(wc -l < $out_dir/sql-schema.txt)"
echo "  http routes:      $(wc -l < $out_dir/http-routes.txt)"
echo "  business structs: $(wc -l < $out_dir/structs.txt)"

# Write a RECOVERY.md per project
cat > "$out_dir/RECOVERY.md" <<EOF
# $proj - Reverse Engineering Recovery

Binary: \`$(basename $bin)\`
Language: $lang
Size: $(du -h $bin | cut -f1)
Symbols: $(wc -l < $out_dir/symbols-demangled.txt)

## Internal Workspace Crates

$(if [ -s "$out_dir/internal-crates.txt" ]; then
  for c in $(cat $out_dir/internal-crates.txt); do
    cnt=$(wc -l < $out_dir/crate-$c.txt 2>/dev/null || echo 0)
    echo "- \`$c\` ($cnt symbols)"
  done
else
  echo "(none detected)"
fi)

## Sample Module Structure

\`\`\`
$(head -30 $out_dir/module-paths.txt | grep -vE "^(std|core|alloc|tokio|serde|actix)")
\`\`\`

## SQL Schema

\`\`\`sql
$(cat $out_dir/sql-schema.txt)
\`\`\`

## HTTP Routes

$(head -30 $out_dir/http-routes.txt | sed 's/^/- /')

## Business Structs (detected)

$(head -30 $out_dir/structs.txt | sed 's/^/- /')

## External Dependencies

$(cat $out_dir/external-crates.txt | head -40 | sed 's/^/- /')

## Recovery Feasibility

- **Skeleton (Cargo workspace layout + module declarations)**: ✅ Automated
- **Function signatures**: 🟡 Available in symbols (no parameter types)
- **Function bodies**: ❌ Requires Ghidra/IDA + manual interpretation
- **SQL queries**: 🟡 Extracted as strings
- **API route handlers**: 🟡 Routes + handler names available, bodies NOT

EOF

echo "  -> $out_dir/RECOVERY.md"
