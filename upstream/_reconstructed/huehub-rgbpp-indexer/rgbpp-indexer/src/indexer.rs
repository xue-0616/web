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


/// RE: <rgbpp::server::routes::token::mint_txs::MintTx as core::convert::From<rgbpp_indexer::indexer::IndexerMintTransaction>>::from
// enriched: ---
// trait-hint: fn from(value: T) -> Self
// calls:
//   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
// enriched: ---
/* ghidra: 0x008916e0  sig=undefined8 * __rustcall _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from(undefined8 *param_1,ulong *param_2);
   
   /* _<bytes::bytes::Bytes as core::convert::From<alloc::vec::Vec<u8>>>::from */
   
   undefined8 * __rustcall
   _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
             (undefined8 *param_1,ulong *param_2)
   
   {
     ulong uVar1;
     ulong uVar2;
     ulong uVar3;
     undefined1 *puVar4;
     ulong *extraout_RAX;
     
     uVar1 = *param_2;
     uVar2 = param_2[1];
     uVar3 = param_2[2];
     if (uVar3 == uVar1) {
       if (uVar1 == 0) {
         param_1[1] = anon_fe8f24a9d83deaf964110b15d26f9891_1_llvm_8276635526272501688;
         param_1[2] = 0;
         param_1[3] = 0;
         puVar4 = anon_fe8f24a9d83deaf964110b15d26f9891_12_llvm_8276635526272501688;
       }
       else if ((uVar2 & 1) == 0) {
         param_1[1] = uVar2;
         param_1[2] = uVar1;
         param_1[3] = uVar2 | 1;
         puVar4 = bytes::bytes::PROMOTABLE_EVEN_VTABLE;
       }
       else {
         param_1[1] = uVar2;
         param_1[2] = uVar1;
         param_1[3] = uVar2;
         puVar4 = bytes::bytes::PROMOTABLE_ODD_VTABLE;
       }
     }
     else {
       std::alloc::__default_lib_allocator::__rust_alloc();
       if (extraout_RAX == (ulong *)0x0) {
   // ... [truncated]
*/
pub struct IndexerMintTransaction;
pub mod impl_rgbppindexer {
    /// RE: rgbpp_indexer::indexer::RgbppIndexer::balances
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexer::balances
    //   - rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
    //   - rgbpp_daos::database::RgbppDatabase::begin_read
    //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect
    //   - _<redb::transactions::ReadTransaction_as_core::ops::drop::Drop>::drop
    //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::balances
    // enriched: ---
    /* ghidra: 0x0036fc70  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexer::balances(undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4);
       
       /* rgbpp_indexer::indexer::RgbppIndexer::balances */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexer::balances
                 (undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4)
       
       {
         long *plVar1;
         void *__ptr;
         long *local_200;
         void *local_1f8;
         undefined4 local_1f0;
         undefined4 uStack_1ec;
         undefined4 uStack_1e8;
         undefined4 uStack_1e4;
         undefined8 local_1e0;
         long *local_1d8;
         void *local_1d0;
         undefined1 local_1c8 [16];
         undefined8 local_1b8;
         undefined8 uStack_1b0;
         undefined8 local_1a8;
         undefined8 uStack_1a0;
         undefined8 local_198;
         undefined8 uStack_190;
         undefined8 local_188;
         undefined8 uStack_180;
         undefined4 local_178;
         undefined4 uStack_174;
         undefined4 uStack_170;
         undefined4 uStack_16c;
         long *local_168;
         void *local_160;
         undefined4 local_158;
         undefined4 uStack_154;
         undefined4 uStack_150;
         undefined4 uStack_14c;
         undefined8 local_148;
         undefined8 uStack_140;
       // ... [truncated]
    */
    pub fn balances() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexer::mint_txs
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexer::mint_txs
    //   - rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
    //   - rgbpp_daos::database::RgbppDatabase::begin_read
    //   - rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::connect
    //   - rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::connect
    //   - rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::connect
    //   - _<alloc::vec::Vec<T>as_alloc::vec::spec_from_iter::SpecFromIter<T,I>>::from_iter
    //   - drop_in_place<alloc::vec::Vec<rgbpp_daos::tables::btc_token_to_mint_transaction::PaymasterToken>>
    //   - _<redb::transactions::ReadTransaction_as_core::ops::drop::Drop>::drop
    // enriched: ---
    /* ghidra: 0x00371080  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexer::mint_txs(undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6,undefined8 param_7,undefined8 param_8,void *param_9,undefined8 param_10,uint param_11);
       
       /* rgbpp_indexer::indexer::RgbppIndexer::mint_txs */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexer::mint_txs
                 (undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5
                 ,undefined8 param_6,undefined8 param_7,undefined8 param_8,void *param_9,
                 undefined8 param_10,uint param_11)
       
       {
         long *plVar1;
         long lVar2;
         long *local_2d8;
         void *local_2d0;
         undefined4 local_2c8;
         undefined4 uStack_2c4;
         undefined4 uStack_2c0;
         undefined4 uStack_2bc;
         undefined8 local_2b8;
         undefined8 uStack_2b0;
         long *local_2a8;
         undefined8 uStack_2a0;
         undefined8 local_298;
         undefined8 uStack_290;
         undefined4 local_288;
         undefined4 uStack_284;
         undefined4 uStack_280;
         undefined4 uStack_27c;
         undefined4 local_278;
         undefined4 uStack_274;
         undefined4 uStack_270;
         undefined4 uStack_26c;
         long *local_268;
         void *local_260;
         undefined4 local_258;
         undefined4 uStack_254;
         undefined4 uStack_250;
         undefined4 uStack_24c;
         undefined8 local_248;
         long *local_240;
       // ... [truncated]
    */
    pub fn mint_txs() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexer::mint_txs_count
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexer::mint_txs_count
    //   - rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
    //   - rgbpp_daos::database::RgbppDatabase::begin_read
    //   - rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::connect
    //   - _<redb::transactions::ReadTransaction_as_core::ops::drop::Drop>::drop
    // enriched: ---
    /* ghidra: 0x003716f0  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexer::mint_txs_count(undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6);
       
       /* rgbpp_indexer::indexer::RgbppIndexer::mint_txs_count */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexer::mint_txs_count
                 (undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5
                 ,undefined8 param_6)
       
       {
         long lVar1;
         long *plVar2;
         long *__ptr;
         undefined8 uVar3;
         long **pplVar4;
         long *plVar5;
         long *local_1b8;
         long *local_1b0;
         undefined8 local_1a8;
         undefined8 uStack_1a0;
         undefined8 local_198;
         undefined8 uStack_190;
         long *local_188;
         undefined8 uStack_180;
         undefined8 local_178;
         undefined8 uStack_170;
         undefined4 local_168;
         undefined4 uStack_164;
         undefined4 uStack_160;
         undefined4 uStack_15c;
         undefined4 local_158;
         undefined4 uStack_154;
         undefined4 uStack_150;
         undefined4 uStack_14c;
         long *local_148;
         long *local_140;
         undefined4 local_138;
         undefined4 uStack_134;
         undefined4 uStack_130;
         undefined4 uStack_12c;
         undefined8 local_128;
       // ... [truncated]
    */
    pub fn mint_txs_count() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexer::token
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexer::token
    //   - rgbpp_daos::database::RgbppDatabase::begin_read
    //   - rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::connect
    //   - rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::get
    //   - _<impl_alloc::vec::spec_from_iter::SpecFromIter<T,I>for_alloc::vec::Vec<T>>::from_iter
    //   - _<redb::transactions::ReadTransaction_as_core::ops::drop::Drop>::drop
    // enriched: ---
    /* ghidra: 0x00370d40  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexer::token(undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4);
       
       /* rgbpp_indexer::indexer::RgbppIndexer::token */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexer::token
                 (undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4)
       
       {
         undefined4 local_188;
         undefined4 uStack_184;
         undefined4 uStack_180;
         undefined4 uStack_17c;
         long local_178;
         undefined8 uStack_170;
         undefined8 local_168;
         undefined8 uStack_160;
         long *local_158;
         undefined8 uStack_150;
         undefined8 local_148;
         undefined8 uStack_140;
         undefined4 local_138;
         undefined4 uStack_134;
         undefined4 uStack_130;
         undefined4 uStack_12c;
         undefined4 local_128;
         undefined4 uStack_124;
         undefined4 uStack_120;
         undefined4 uStack_11c;
         long *local_118 [2];
         long local_108;
         undefined8 uStack_100;
         undefined8 local_f8;
         undefined8 uStack_f0;
         long *local_e8;
         undefined8 uStack_e0;
         undefined8 local_d8;
         undefined8 uStack_d0;
         undefined4 local_b8;
         undefined4 uStack_b4;
         undefined4 uStack_b0;
       // ... [truncated]
    */
    pub fn token() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexer::token_balance
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexer::token_balance
    //   - rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
    //   - rgbpp_daos::database::RgbppDatabase::begin_read
    //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect
    //   - _<redb::transactions::ReadTransaction_as_core::ops::drop::Drop>::drop
    //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::get
    // enriched: ---
    /* ghidra: 0x00370050  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexer::token_balance(undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6);
       
       /* rgbpp_indexer::indexer::RgbppIndexer::token_balance */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexer::token_balance
                 (undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5
                 ,undefined8 param_6)
       
       {
         long *plVar1;
         long *local_1a0;
         void *local_198;
         undefined4 local_190;
         undefined4 uStack_18c;
         undefined4 uStack_188;
         undefined4 uStack_184;
         undefined8 local_180;
         long *local_178;
         void *local_170;
         undefined4 local_168;
         undefined4 uStack_164;
         undefined4 uStack_160;
         undefined4 uStack_15c;
         undefined8 local_158;
         undefined8 uStack_150;
         long *local_148;
         undefined8 uStack_140;
         undefined8 local_138;
         undefined8 uStack_130;
         undefined4 local_128;
         undefined4 uStack_124;
         undefined4 uStack_120;
         undefined4 uStack_11c;
         undefined4 local_118;
         undefined4 uStack_114;
         undefined4 uStack_110;
         undefined4 uStack_10c;
         long *local_108;
         void *local_100;
         undefined1 local_f8 [16];
       // ... [truncated]
    */
    pub fn token_balance() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexer::token_holders
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexer::token_holders
    //   - rgbpp_daos::database::RgbppDatabase::begin_read
    //   - rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::connect
    //   - _<redb::transactions::ReadTransaction_as_core::ops::drop::Drop>::drop
    //   - rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v2
    //   - _<impl_alloc::vec::spec_from_iter::SpecFromIter<T,I>for_alloc::vec::Vec<T>>::from_iter
    //   - rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v1
    // enriched: ---
    /* ghidra: 0x003709a0  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexer::token_holders(undefined8 *param_1,long param_2,int *param_3);
       
       /* rgbpp_indexer::indexer::RgbppIndexer::token_holders */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexer::token_holders(undefined8 *param_1,long param_2,int *param_3)
       
       {
         long *local_1b8;
         long local_1b0;
         long local_1a8;
         undefined8 uStack_1a0;
         undefined8 local_198;
         undefined8 uStack_190;
         long *local_188;
         undefined8 uStack_180;
         undefined4 local_178;
         undefined4 uStack_174;
         undefined4 uStack_170;
         undefined4 uStack_16c;
         undefined8 local_168;
         undefined8 uStack_160;
         undefined4 local_158;
         undefined4 uStack_154;
         undefined4 uStack_150;
         undefined4 uStack_14c;
         long *local_148;
         long local_140;
         long local_138;
         undefined8 uStack_130;
         undefined8 local_128;
         undefined8 uStack_120;
         long *local_118;
         undefined8 uStack_110;
         undefined8 local_f8;
         undefined8 uStack_f0;
         undefined4 local_e8;
         undefined4 uStack_e4;
         undefined4 uStack_e0;
         undefined4 uStack_dc;
         long *local_d8;
       // ... [truncated]
    */
    pub fn token_holders() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexer::token_outpoints
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexer::token_outpoints
    //   - rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
    //   - rgbpp_daos::database::RgbppDatabase::begin_read
    //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::connect
    //   - _<redb::transactions::ReadTransaction_as_core::ops::drop::Drop>::drop
    //   - _<alloc::vec::Vec<T>as_alloc::vec::spec_from_iter::SpecFromIter<T,I>>::from_iter
    //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::get
    // enriched: ---
    /* ghidra: 0x003703f0  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexer::token_outpoints(undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6,long param_7,undefined8 param_8);
       
       /* rgbpp_indexer::indexer::RgbppIndexer::token_outpoints */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexer::token_outpoints
                 (undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5
                 ,undefined8 param_6,long param_7,undefined8 param_8)
       
       {
         long lVar1;
         long *plVar2;
         void *pvVar3;
         byte bVar4;
         long *local_6c0;
         void *local_6b8;
         undefined4 local_6b0;
         undefined4 uStack_6ac;
         undefined4 uStack_6a8;
         undefined4 uStack_6a4;
         undefined8 local_6a0;
         undefined8 local_698;
         undefined8 local_690;
         long *local_688;
         void *local_680;
         undefined1 local_678 [16];
         undefined8 local_668;
         undefined8 uStack_660;
         long *local_658;
         undefined8 uStack_650;
         undefined8 local_648;
         undefined8 uStack_640;
         undefined4 local_628;
         undefined4 uStack_624;
         undefined4 uStack_620;
         undefined4 uStack_61c;
         long local_618;
         undefined8 local_610;
         long *local_608;
         void *local_600;
         undefined8 local_5e8;
       // ... [truncated]
    */
    pub fn token_outpoints() { todo!() }
}
pub mod impl_rgbppindexerbuilder {
    /// RE: rgbpp_indexer::indexer::RgbppIndexerBuilder::build
    // enriched: ---
    // trait-hint: fn build(self) -> <Self as Builder>::Output
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexerBuilder::build
    //   - anyhow::__private::format_err
    //   - anyhow::error::_<impl_core::ops::drop::Drop_for_anyhow::Error>::drop
    //   - _<sysinfo::common::System_as_core::default::Default>::default
    //   - sysinfo::common::System::refresh_memory
    //   - _<hashbrown::raw::RawTable<T,A>as_core::ops::drop::Drop>::drop
    //   - redb::db::Database::builder
    //   - redb::db::Builder::set_repair_callback
    //   - redb::db::Builder::open
    //   - redb::db::Builder::create
    //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
    //   - redb::db::Database::begin_write
    // strings:
    //   - 'index at appears to have been'
    // enriched: ---
    /* ghidra: 0x00371cd0  sig=undefined8 * __rustcall rgbpp_indexer::indexer::RgbppIndexerBuilder::build(undefined8 *param_1,long *param_2);
       
       /* rgbpp_indexer::indexer::RgbppIndexerBuilder::build */
       
       undefined8 * __rustcall
       rgbpp_indexer::indexer::RgbppIndexerBuilder::build(undefined8 *param_1,long *param_2)
       
       {
         char cVar1;
         undefined1 uVar2;
         long lVar3;
         long *******__src;
         long *plVar4;
         long *******__ptr;
         long *******ppppppplVar5;
         void *__ptr_00;
         bool bVar6;
         bool bVar7;
         long ******pppppplVar8;
         long ******pppppplVar9;
         long ******pppppplVar10;
         char cVar11;
         long *******extraout_RAX;
         undefined8 *puVar12;
         long *******ppppppplVar13;
         void *__dest;
         undefined1 *puVar14;
         undefined *puVar15;
         undefined8 uVar16;
         long lVar17;
         undefined8 uVar18;
         undefined *in_R10;
         ulong uVar19;
         long *******ppppppplVar20;
         long *******ppppppplVar21;
         long local_fc0;
         long ******local_fb8;
         long ******pppppplStack_fb0;
         long ******local_fa8;
         long ******local_fa0;
         long local_f98;
       // ... [truncated]
    */
    pub fn build() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexerBuilder::set_btc_rpc_url
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexerBuilder::set_btc_rpc_url
    //   - bitcoincore_rpc::client::Client::new
    //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
    // enriched: ---
    /* ghidra: 0x00374260  sig=undefined1  [16] __rustcall rgbpp_indexer::indexer::RgbppIndexerBuilder::set_btc_rpc_url(long param_1);
       
       /* rgbpp_indexer::indexer::RgbppIndexerBuilder::set_btc_rpc_url */
       
       undefined1  [16] __rustcall
       rgbpp_indexer::indexer::RgbppIndexerBuilder::set_btc_rpc_url(long param_1)
       
       {
         void *__ptr;
         undefined8 *puVar1;
         undefined8 uVar2;
         undefined1 auVar3 [16];
         long local_80;
         undefined4 local_78;
         undefined4 uStack_74;
         undefined4 uStack_70;
         undefined4 uStack_6c;
         undefined8 local_68;
         undefined4 local_60;
         undefined4 uStack_5c;
         undefined4 uStack_58;
         undefined4 uStack_54;
         long local_50;
         undefined4 local_48;
         undefined4 uStack_44;
         undefined4 uStack_40;
         undefined4 uStack_3c;
         undefined8 local_38;
         undefined4 local_30;
         undefined4 uStack_2c;
         undefined4 uStack_28;
         undefined4 uStack_24;
         
         bitcoincore_rpc::client::Client::new(&local_80);
         if (local_80 == -0x7fffffffffffffee) {
           __ptr = *(void **)(param_1 + 0xe0);
           if (__ptr != (void *)0x0) {
             puVar1 = *(undefined8 **)(param_1 + 0xe8);
                           /* try { // try from 003742be to 003742c4 has its CatchHandler @ 0037433f */
             (*(code *)*puVar1)(__ptr);
             if (puVar1[1] != 0) {
       // ... [truncated]
    */
    pub fn set_btc_rpc_url() { todo!() }
    /// RE: rgbpp_indexer::indexer::RgbppIndexerBuilder::set_ckb_rpc_url
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::indexer::RgbppIndexerBuilder::set_ckb_rpc_url
    //   - ckb_sdk::rpc::ckb::CkbRpcClient::new
    // enriched: ---
    /* ghidra: 0x00371ba0  sig=long __rustcall rgbpp_indexer::indexer::RgbppIndexerBuilder::set_ckb_rpc_url(long param_1);
       
       /* rgbpp_indexer::indexer::RgbppIndexerBuilder::set_ckb_rpc_url */
       
       long __rustcall rgbpp_indexer::indexer::RgbppIndexerBuilder::set_ckb_rpc_url(long param_1)
       
       {
         long *plVar1;
         long local_90;
         undefined8 uStack_88;
         undefined8 local_80;
         undefined8 uStack_78;
         undefined8 local_70;
         undefined8 uStack_68;
         undefined8 local_60;
         undefined8 uStack_58;
         undefined8 local_50;
         undefined8 uStack_48;
         undefined8 local_40;
         undefined8 uStack_38;
         undefined8 local_30;
         undefined8 uStack_28;
         undefined8 local_20;
         
         ckb_sdk::rpc::ckb::CkbRpcClient::new(&local_90);
         if (*(long *)(param_1 + 0x68) != -0x8000000000000000) {
           plVar1 = *(long **)(param_1 + 0xc0);
           LOCK();
           *plVar1 = *plVar1 + -1;
           UNLOCK();
           if (*plVar1 == 0) {
                           /* try { // try from 00371be2 to 00371be6 has its CatchHandler @ 00371c5c */
             alloc::sync::Arc<T,A>::drop_slow(param_1 + 0xc0);
           }
           if (*(long *)(param_1 + 0x68) != 0) {
             std::alloc::__default_lib_allocator::__rust_dealloc(*(void **)(param_1 + 0x70));
           }
         }
         *(undefined8 *)(param_1 + 0xd8) = local_20;
         *(undefined8 *)(param_1 + 200) = local_30;
         *(undefined8 *)(param_1 + 0xd0) = uStack_28;
       // ... [truncated]
    */
    pub fn set_ckb_rpc_url() { todo!() }
}
