//! Compiles the vendored `sf.substreams.*` protobuf definitions into Rust
//! bindings that live under `crate::pb::sf::substreams::{v1, rpc::v2}` and
//! `crate::pb::sf::firehose::v2`.
//!
//! The closed-source binary we are replacing has these bindings generated
//! into the same namespaces (`pb::sf::substreams::rpc::v2::*`, etc.), so we
//! keep the module path identical for readability of the reconstruction.
use std::{io, path::PathBuf};

fn main() -> io::Result<()> {
    let proto_root = PathBuf::from("proto");

    let protos = [
        proto_root.join("sf/substreams/v1/modules.proto"),
        proto_root.join("sf/substreams/v1/clock.proto"),
        proto_root.join("sf/substreams/v1/package.proto"),
        proto_root.join("sf/substreams/rpc/v2/service.proto"),
        proto_root.join("sf/firehose/v2/firehose.proto"),
        // TopLedger's `solana-dex-trades-extended` substreams output
        // (MapModuleOutput.value is one of these `Output` messages).
        proto_root.join("sf/solana/dex/trades/v1/output.proto"),
    ];

    for p in &protos {
        println!("cargo:rerun-if-changed={}", p.display());
    }

    // Use the vendored protoc so users don't need to install one system-wide.
    let protoc = protoc_bin_vendored::protoc_bin_path()
        .expect("protoc-bin-vendored should ship a protoc for this target");
    std::env::set_var("PROTOC", protoc);

    tonic_build::configure()
        .build_server(false)
        .build_client(true)
        .compile(&protos, &[proto_root])?;

    Ok(())
}
