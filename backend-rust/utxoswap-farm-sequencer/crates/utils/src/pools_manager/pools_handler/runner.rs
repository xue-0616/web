//! Legacy orphan module.
//!
//! Both `process_farm_batch` and `run` used to live here as
//! never-called stubs.  The active processing loop is
//! `pools_manager::manager::start` → `process_all_farms` →
//! `handler::process_farm_intents_with_builder`.  This file is
//! kept as a module declaration so future per-pool-runner
//! concerns (per-pool concurrency caps, per-pool feature
//! flags, etc.) have a natural home.
