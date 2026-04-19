# Origin

This is **not** a direct copy of a public upstream — it's an **in-house
reimplementation** of the MPC (2PC-ECDSA) protocol that the closed-source
`backend-bin/unipass-wallet-tss/tss-ecdsa-server` ELF ran.

## Replaces deployed binary

`backend-bin/unipass-wallet-tss/tss-ecdsa-server` — 26 MB Rust ELF.
The local workspace here produces a same-named binary.

## Implementation basis

Built on top of the **ZenGo-X** open-source MPC stack (Apache-2.0):

| Crate | Role |
|---|---|
| [`curv-kzen`](https://crates.io/crates/curv-kzen) (0.9.x) | Elliptic curve arithmetic + commitment schemes |
| [`multi-party-ecdsa`](https://crates.io/crates/multi-party-ecdsa) (0.8.x) | 2-of-2 threshold ECDSA (Lindell 2017, Gennaro-Goldfeder 2018) |

The upstream **protocol algorithm** is therefore fully open — what's
proprietary is the HTTP/actix-web plumbing on top, which this workspace
reconstructs.

## Related upstream (reference only)

- `upstream/UniPass-Tss-Lib/` — UniPass's own WebAssembly bindings (GPL-3.0)
  for a similar TSS protocol, different interface. Not a 1:1 match.

## Build

```bash
cargo build --release --bin tss-ecdsa-server
./target/release/tss-ecdsa-server --help
```

## Protocol summary

Lindell 2017 2PC-ECDSA is a 2-round keygen + 4-round signing protocol
that produces a standard ECDSA signature without any party holding a
full private key.

Used by UniPass so that the user and the UniPass custodian each hold
half a signing key — neither alone can move funds.
