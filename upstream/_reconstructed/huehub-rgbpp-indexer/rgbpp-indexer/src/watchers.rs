// Auto-generated skeleton reconstructed from ELF symbols.
// This is **NOT** the original source — it is a structural approximation.
// Every `todo!()` body hides the original logic. Use this to:
//   * understand module layout and public API surface,
//   * seed a greenfield re-implementation,
//   * drive binary-diffing with the deployed ELF.
//
// Source: backend-bin/huehub-rgbpp-indexer/rgbpp
// Tool:   upstream/_reconstruct.py
#![allow(unused, non_snake_case, non_camel_case_types, dead_code)]


pub mod btc_watcher {
    /// RE: <core::result::Result<T,bitcoincore_rpc::error::Error> as rgbpp_indexer::watchers::btc_watcher::BitcoinCoreRpcResultExt<T>>::into_option
    // enriched: ---
    // calls:
    //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
    // enriched: ---
    /* ghidra: 0x003b1d80  sig=undefined2 * __rustcall _<core::result::Result<T,bitcoincore_rpc::error::Error>as_rgbpp_indexer::watchers::btc_watcher::BitcoinCoreRpcResultExt<T>>::into_option(undefined2 *param_1,ulong *param_2);
       
       /* _<core::result::Result<T,bitcoincore_rpc::error::Error> as
          rgbpp_indexer::watchers::btc_watcher::BitcoinCoreRpcResultExt<T>>::into_option */
       
       undefined2 * __rustcall
       _<core::result::Result<T,bitcoincore_rpc::error::Error>as_rgbpp_indexer::watchers::btc_watcher::BitcoinCoreRpcResultExt<T>>
       ::into_option(undefined2 *param_1,ulong *param_2)
       
       {
         ulong uVar1;
         ulong uVar2;
         ulong uVar3;
         undefined8 uVar4;
         void *__ptr;
         undefined4 local_48;
         undefined4 uStack_44;
         undefined4 uStack_40;
         undefined4 uStack_3c;
         undefined4 local_38;
         undefined4 uStack_34;
         undefined4 uStack_30;
         undefined4 uStack_2c;
         undefined4 local_28;
         undefined4 uStack_24;
         undefined4 uStack_20;
         undefined4 uStack_1c;
         
         uVar1 = *param_2;
         if (uVar1 == 0x8000000000000012) {
           uVar1 = param_2[1];
           uVar2 = param_2[2];
           uVar3 = param_2[4];
           *(ulong *)(param_1 + 9) = param_2[3];
           *(ulong *)(param_1 + 0xd) = uVar3;
           *(ulong *)(param_1 + 1) = uVar1;
           *(ulong *)(param_1 + 5) = uVar2;
           *param_1 = 0x100;
           return param_1;
         }
         if ((0x8000000000000008 < uVar1) ||
       // ... [truncated]
    */
    pub struct BitcoinCoreRpcResultExt;
    pub mod impl_btcwatcher {
        /// RE: rgbpp_indexer::watchers::btc_watcher::BtcWatcher::fetch_block_with_retries::__closure__::__CALLSITE
        pub fn fetch_block_with_retries() { todo!() }
        /// RE: rgbpp_indexer::watchers::btc_watcher::BtcWatcher::fetch_blocks::__CALLSITE
        pub fn fetch_blocks() { todo!() }
    }
}
pub mod ckb_watcher {
    pub mod impl_ckbwatcher {
        /// RE: rgbpp_indexer::watchers::ckb_watcher::CkbWatcher::fetch_block_with_retries::__closure__::__CALLSITE
        pub fn fetch_block_with_retries() { todo!() }
        /// RE: rgbpp_indexer::watchers::ckb_watcher::CkbWatcher::fetch_blocks::__CALLSITE
        pub fn fetch_blocks() { todo!() }
    }
}
pub mod indexer_watcher {
    /// RE: <rgbpp_indexer::watchers::indexer_watcher::ReorgFor as core::fmt::Debug>::fmt
    // enriched: ---
    // trait-hint: fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result
    // calls:
    //   - _<rgbpp_indexer::watchers::indexer_watcher::ReorgFor_as_core::fmt::Debug>::fmt
    // enriched: ---
    /* ghidra: 0x003782a0  sig=void __rustcall _<rgbpp_indexer::watchers::indexer_watcher::ReorgFor_as_core::fmt::Debug>::fmt(void);
       
       /* _<rgbpp_indexer::watchers::indexer_watcher::ReorgFor as core::fmt::Debug>::fmt */
       
       void __rustcall _<rgbpp_indexer::watchers::indexer_watcher::ReorgFor_as_core::fmt::Debug>::fmt(void)
       
       {
         core::fmt::Formatter::write_str();
         return;
       }
       
    */
    pub struct ReorgFor;
    pub mod impl_indexerupdatestate {
        /// RE: rgbpp_indexer::watchers::indexer_watcher::IndexerUpdateState::add_rgbpp_by_output::__CALLSITE
        pub fn add_rgbpp_by_output() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::IndexerUpdateState::remove_rgbpp_by_input::__CALLSITE
        pub fn remove_rgbpp_by_input() { todo!() }
    }
    pub mod impl_rgbppindexerwatcher {
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::detect_btc_reorg::__CALLSITE
        pub fn detect_btc_reorg() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::detect_ckb_reorg::__CALLSITE
        pub fn detect_ckb_reorg() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::handle_reorg::__CALLSITE
        pub fn handle_reorg() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::inner_watch::__CALLSITE
        pub fn inner_watch() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::new
        // enriched: ---
        // trait-hint: fn new(address: impl Into<ethers::types::Address>, client: Arc<M>) -> Self
        // calls:
        //   - rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::new
        //   - _<ckb_sdk::rpc::ckb::CkbRpcClient_as_core::clone::Clone>::clone
        //   - std::time::Instant::now
        // enriched: ---
        /* ghidra: 0x00376d40  sig=undefined8 * __rustcall rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::new(undefined8 *param_1,long param_2,undefined8 *param_3,long *param_4,undefined1 param_5,undefined8 *param_6,undefined8 *param_7,undefined8 param_8,undefined8 param_9,undefined8 param_10,undefined8 param_11,undefined8 param_12,undefined8 param_13,undefined8 param_14,undefined8 param_15);
           
           /* rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::new */
           
           undefined8 * __rustcall
           rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::new
                     (undefined8 *param_1,long param_2,undefined8 *param_3,long *param_4,undefined1 param_5,
                     undefined8 *param_6,undefined8 *param_7,undefined8 param_8,undefined8 param_9,
                     undefined8 param_10,undefined8 param_11,undefined8 param_12,undefined8 param_13,
                     undefined8 param_14,undefined8 param_15)
           
           {
             undefined1 uVar1;
             undefined1 uVar2;
             long lVar3;
             long lVar4;
             long lVar5;
             long *plVar6;
             void *__src;
             size_t __n;
             code *pcVar7;
             void *__dest;
             long *extraout_RAX;
             undefined1 *extraout_RAX_00;
             undefined8 extraout_RAX_01;
             undefined4 extraout_EDX;
             undefined1 *__dest_00;
             undefined6 uStack_196;
             long *local_188;
             undefined8 uStack_180;
             undefined8 local_178;
             undefined8 uStack_170;
             undefined8 local_168;
             undefined8 uStack_160;
             undefined8 local_158;
             undefined8 uStack_150;
             undefined8 local_148;
             undefined8 uStack_140;
             undefined8 local_138;
             undefined8 uStack_130;
             undefined8 local_128;
           // ... [truncated]
        */
        pub fn new() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::update_btc_block::__CALLSITE
        pub fn update_btc_block() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::update_ckb_block::__CALLSITE
        pub fn update_ckb_block() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::update_ckb_transaction::__CALLSITE
        pub fn update_ckb_transaction() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::update_savepoints::__CALLSITE
        pub fn update_savepoints() { todo!() }
        /// RE: rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::watch::__CALLSITE
        pub fn watch() { todo!() }
    }
}
