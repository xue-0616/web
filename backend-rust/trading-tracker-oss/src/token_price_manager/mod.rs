//! `token_price_manager` — consumes the substreams stream, runs per-DEX
//! parsers, maintains a live price cache, and broadcasts updates.
//!
//! Ghidra-confirmed public surface in the closed-source binary:
//! * `SubstreamsEndpoint::new`
//! * `SubstreamsStream::new`, plus `<SubstreamsStream as futures::Stream>::poll_next`
//! * `TokenPriceRunner::deal_msg`, `TokenPriceRunner::deal_substream`
//! * `<PoolPrice as Serialize>::serialize`
//!
//! Layer responsibilities are sketched out here. Actual protobuf-driven
//! logic lands in Session 2 (stream) and the DEX parsers in Session 3.

pub mod runner;
pub mod substreams;
pub mod substreams_stream;
