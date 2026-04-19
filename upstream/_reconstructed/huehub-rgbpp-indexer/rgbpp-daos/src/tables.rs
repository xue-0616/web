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


/// RE: <rgbpp_daos::tables::ReaderTranspose<T> as core::convert::From<&rgbpp_daos::tables::AccessGuardTranspose<T>>>::from
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
pub struct AccessGuardTranspose;
pub mod btc_block_height_to_header {
    pub mod impl_btcblockheighttoheader {
        /// RE: rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables btc block'
        // enriched: ---
        /* ghidra: 0x0040aad0  sig=undefined8 * __rustcall rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::connect
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::latest_height
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::latest_height
        //   - _<redb::table::Table<K,V>as_redb::table::ReadableTable<K,V>>::range
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<redb::table::Range<K,V>as_core::iter::traits::double_ended::DoubleEndedIterator>::next_back
        //   - _<u64_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040ae50  sig=undefined8 * __rustcall rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::latest_height(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::latest_height */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::latest_height
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             ulong uVar5;
             ulong uVar6;
             undefined8 uVar7;
             ulong *puVar8;
             long *__src;
             ulong local_288;
             undefined8 uStack_280;
             undefined8 uStack_278;
             ulong local_270;
             undefined4 local_268;
             undefined4 uStack_264;
             undefined4 uStack_260;
             undefined4 uStack_25c;
             undefined4 local_258;
             undefined4 uStack_254;
             undefined4 uStack_250;
             undefined4 uStack_24c;
             undefined4 local_248;
             undefined4 uStack_244;
             undefined4 uStack_240;
             undefined4 uStack_23c;
             undefined4 local_238;
             undefined4 uStack_234;
             undefined4 uStack_230;
             undefined4 uStack_22c;
             ulong local_228;
             undefined8 uStack_220;
             undefined1 local_218 [24];
           // ... [truncated]
        */
        pub fn latest_height() { todo!() }
        /// RE: rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::write
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::write
        //   - redb::table::Table<K,V>::insert
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x0040abe0  sig=long * __rustcall rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::write(long *param_1,undefined8 param_2,undefined8 param_3,undefined4 *param_4);
           
           /* rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::write */
           
           long * __rustcall
           rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeader::write
                     (long *param_1,undefined8 param_2,undefined8 param_3,undefined4 *param_4)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             long lVar3;
             int local_1c8;
             undefined4 uStack_1c4;
             int iStack_1c0;
             undefined4 uStack_1bc;
             undefined8 uStack_1b8;
             long local_1b0;
             long lStack_1a8;
             long lStack_1a0;
             long lStack_198;
             long lStack_190;
             long local_188;
             long lStack_180;
             long local_178;
             long lStack_170;
             long local_168;
             long lStack_160;
             long local_148;
             long local_140;
             long local_138;
             long lStack_130;
             long local_128;
             long lStack_120;
             long local_118;
             long lStack_110;
             long local_108;
             long lStack_100;
             long local_f8;
             undefined4 local_78;
             undefined4 local_74;
           // ... [truncated]
        */
        pub fn write() { todo!() }
    }
    pub mod impl_btcblockheighttoheaderreadable {
        /// RE: rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x0040a150  sig=long * __rustcall rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::connect
                     (long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::get
        //   - _<redb::tree_store::page_store::base::PageImpl_as_core::clone::Clone>::clone
        //   - redb::tree_store::btree::Btree<K,V>::get_helper
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - bitcoin::consensus::encode::deserialize
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040a280  sig=undefined4 * __rustcall rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::get(undefined4 *param_1,long param_2,ulong param_3);
           
           /* rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::get */
           
           undefined4 * __rustcall
           rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::get
                     (undefined4 *param_1,long param_2,ulong param_3)
           
           {
             undefined8 uVar1;
             undefined4 uVar2;
             undefined8 uVar3;
             ulong uVar4;
             ulong *puVar5;
             ulong *puVar6;
             long local_1f8;
             undefined8 uStack_1f0;
             ulong uStack_1e8;
             ulong local_1e0;
             ulong local_1d8;
             ulong uStack_1d0;
             undefined4 local_1c8;
             undefined4 uStack_1c4;
             undefined4 uStack_1c0;
             undefined4 uStack_1bc;
             undefined4 local_1b8;
             undefined4 uStack_1b4;
             undefined4 uStack_1b0;
             undefined4 uStack_1ac;
             undefined4 local_1a8;
             undefined4 uStack_1a4;
             undefined4 uStack_1a0;
             undefined4 uStack_19c;
             undefined4 local_198;
             undefined4 uStack_194;
             undefined4 uStack_190;
             undefined4 uStack_18c;
             undefined8 local_188;
             undefined8 uStack_180;
             undefined4 local_178;
             undefined4 uStack_174;
           // ... [truncated]
        */
        pub fn get() { todo!() }
        /// RE: rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::latest_height
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::latest_height
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<redb::table::Range<K,V>as_core::iter::traits::double_ended::DoubleEndedIterator>::next_back
        //   - _<u64_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040a620  sig=undefined8 * __rustcall rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::latest_height(undefined8 *param_1,long *param_2);
           
           /* rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::latest_height */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::btc_block_height_to_header::BtcBlockHeightToHeaderReadable::latest_height
                     (undefined8 *param_1,long *param_2)
           
           {
             ulong uVar1;
             undefined8 uVar2;
             ulong *puVar3;
             long *__src;
             undefined8 local_320;
             uint local_318;
             long local_314;
             undefined4 local_30c;
             ulong local_308;
             ulong uStack_300;
             ulong local_2f8;
             ulong local_2e8;
             ulong uStack_2e0;
             ulong local_2d8;
             undefined4 local_2c8;
             undefined4 uStack_2c4;
             undefined4 uStack_2c0;
             undefined4 uStack_2bc;
             ulong local_2b8;
             undefined8 local_2a8;
             undefined8 uStack_2a0;
             ulong local_298;
             ulong local_288;
             undefined8 uStack_280;
             undefined8 uStack_278;
             ulong local_270;
             undefined4 local_268;
             undefined4 uStack_264;
             undefined4 uStack_260;
             undefined4 uStack_25c;
             undefined4 local_258;
             undefined4 uStack_254;
           // ... [truncated]
        */
        pub fn latest_height() { todo!() }
    }
}
pub mod btc_mint_transaction {
    pub mod impl_btcminttransaction {
        /// RE: rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables btc mint t'
        // enriched: ---
        /* ghidra: 0x0040f630  sig=undefined8 * __rustcall rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::connect
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::write
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::write
        //   - bincode::internal::serialize
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - redb::table::Table<K,V>::insert
        // enriched: ---
        /* ghidra: 0x0040f740  sig=int * __rustcall rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::write(int *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4);
           
           /* rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::write */
           
           int * __rustcall
           rgbpp_daos::tables::btc_mint_transaction::BtcMintTransaction::write
                     (int *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4)
           
           {
             long lVar1;
             void *__ptr;
             undefined8 uVar2;
             int local_b8;
             int iStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined8 local_a8;
             int local_98;
             int iStack_94;
             int iStack_90;
             int iStack_8c;
             undefined4 uStack_88;
             undefined4 uStack_84;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 uStack_70;
             undefined8 local_68;
             undefined8 uStack_60;
             undefined8 local_58;
             undefined8 uStack_50;
             undefined8 local_48;
             undefined8 uStack_40;
             undefined8 local_38;
             undefined8 uStack_30;
             
             bincode::internal::serialize(&local_b8,param_4);
             lVar1 = CONCAT44(iStack_b4,local_b8);
             __ptr = (void *)CONCAT44(uStack_ac,uStack_b0);
             if (lVar1 == -0x8000000000000000) {
               uVar2 = anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from(__ptr);
               *(undefined8 *)(param_1 + 2) = uVar2;
           // ... [truncated]
        */
        pub fn write() { todo!() }
    }
    pub mod impl_btcminttransactionreadable {
        /// RE: rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x0040f180  sig=long * __rustcall rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::connect
                     (long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::get
        //   - _<redb::tree_store::page_store::base::PageImpl_as_core::clone::Clone>::clone
        //   - redb::tree_store::btree::Btree<K,V>::get_helper
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - mut_bincode::de::Deserializer<R,O>as_serde::de::Deserializer>::deserialize_struct
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040f2b0  sig=long * __rustcall rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::get(long *param_1,long param_2,long param_3);
           
           /* rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::get */
           
           long * __rustcall
           rgbpp_daos::tables::btc_mint_transaction::BtcMintTransactionReadable::get
                     (long *param_1,long param_2,long param_3)
           
           {
             undefined8 uVar1;
             undefined8 uVar2;
             undefined8 uVar3;
             undefined8 uVar4;
             undefined8 uVar5;
             ulong uVar6;
             ulong uVar7;
             undefined8 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             long lVar11;
             ulong uVar12;
             ulong *puVar13;
             ulong *puVar14;
             long unaff_R14;
             long local_428 [3];
             undefined8 uStack_410;
             ulong local_408;
             long local_3f8 [2];
             undefined8 uStack_3e8;
             ulong local_3e0;
             ulong local_3d8;
             ulong uStack_3d0;
             undefined4 local_3c8;
             undefined4 uStack_3c4;
             undefined4 uStack_3c0;
             undefined4 uStack_3bc;
             undefined4 local_3b8;
             undefined4 uStack_3b4;
             undefined4 uStack_3b0;
             undefined4 uStack_3ac;
             undefined4 local_3a8;
           // ... [truncated]
        */
        pub fn get() { todo!() }
    }
}
pub mod btc_token_to_mint_transaction {
    /// RE: rgbpp_daos::tables::btc_token_to_mint_transaction::_::<impl serde::ser::Serialize for rgbpp_daos::tables::btc_token_to_mint_transaction::PaymasterToken>::serialize
    // enriched: ---
    // trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
    // calls:
    //   - serde::ser::Serializer::collect_str
    // enriched: ---
    /* ghidra: 0x0040c280  sig=long __rustcall rgbpp_daos::tables::btc_token_to_mint_transaction::_::_<impl_serde::ser::Serialize_for_rgbpp_daos::tables::btc_token_to_mint_transaction::PaymasterToken>::serialize(long *param_1,long param_2);
       
       /* rgbpp_daos::tables::btc_token_to_mint_transaction::_::_<impl serde::ser::Serialize for
          rgbpp_daos::tables::btc_token_to_mint_transaction::PaymasterToken>::serialize */
       
       long __rustcall
       rgbpp_daos::tables::btc_token_to_mint_transaction::_::
       _<impl_serde::ser::Serialize_for_rgbpp_daos::tables::btc_token_to_mint_transaction::PaymasterToken>
       ::serialize(long *param_1,long param_2)
       
       {
         long lVar1;
         long *local_10;
         
         if (*param_1 == -0x7ffffffffffffffe) {
           lVar1 = *(long *)(param_2 + 8) + 0x50;
         }
         else {
           *(long *)(param_2 + 8) = *(long *)(param_2 + 8) + 0x34;
           local_10 = param_1;
           lVar1 = serde::ser::Serializer::collect_str(param_2,&local_10);
           if (lVar1 != 0) {
             return lVar1;
           }
           lVar1 = *(long *)(param_2 + 8);
         }
         *(long *)(param_2 + 8) = lVar1 + 8;
         return 0;
       }
       
    */
    pub struct PaymasterToken;
    // fields: struct, BtcMintTransaction, with, elementsstruct
    pub mod impl_btctokentominttransaction {
        /// RE: rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables btc token'
        // enriched: ---
        /* ghidra: 0x0040b730  sig=undefined8 * __rustcall rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::connect
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::insert
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::insert
        //   - bincode::internal::serialize
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - redb::table::Table<K,V>::insert
        // enriched: ---
        /* ghidra: 0x0040b840  sig=long * __rustcall rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::insert(long *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4);
           
           /* rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::insert */
           
           long * __rustcall
           rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransaction::insert
                     (long *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4)
           
           {
             void *__ptr;
             undefined8 uVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             long lVar4;
             long lVar5;
             long local_150;
             void *local_148;
             undefined8 local_140;
             undefined4 local_138;
             undefined4 uStack_134;
             undefined4 uStack_130;
             undefined4 uStack_12c;
             long local_128;
             undefined4 local_118;
             undefined4 uStack_114;
             undefined4 uStack_110;
             undefined4 uStack_10c;
             long local_108;
             long local_f8;
             long lStack_f0;
             long local_e8;
             long lStack_e0;
             long local_d8;
             long lStack_d0;
             long local_c8;
             long lStack_c0;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
           // ... [truncated]
        */
        pub fn insert() { todo!() }
    }
    pub mod impl_btctokentominttransactionreadable {
        /// RE: rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x0040b270  sig=long * __rustcall rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::connect
                     (long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::get_by_blocks
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::get_by_blocks
        //   - bincode::internal::serialize
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        // enriched: ---
        /* ghidra: 0x0040b3a0  sig=undefined8 * __rustcall rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::get_by_blocks(undefined8 *param_1,long *param_2,undefined4 *param_3,ulong param_4,long param_5,ulong param_6);
           
           /* rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::get_by_blocks
               */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::btc_token_to_mint_transaction::BtcTokenToMintTransactionReadable::get_by_blocks
                     (undefined8 *param_1,long *param_2,undefined4 *param_3,ulong param_4,long param_5,
                     ulong param_6)
           
           {
             long lVar1;
             long lVar2;
             void *__ptr;
             void *__ptr_00;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined8 uVar5;
             uint local_3f8;
             long local_3f4;
             undefined4 local_3ec;
             undefined4 local_3e8;
             undefined4 uStack_3e4;
             undefined4 uStack_3e0;
             undefined4 uStack_3dc;
             undefined8 local_3d8;
             undefined4 local_3c8;
             undefined4 uStack_3c4;
             undefined4 uStack_3c0;
             undefined4 uStack_3bc;
             undefined8 local_3b8;
             undefined4 local_3a8;
             undefined4 uStack_3a4;
             undefined4 uStack_3a0;
             undefined4 uStack_39c;
             undefined8 local_398;
             undefined1 local_388 [8];
             undefined8 local_380;
             undefined8 local_370;
             undefined4 local_368;
             undefined4 uStack_364;
           // ... [truncated]
        */
        pub fn get_by_blocks() { todo!() }
    }
}
pub mod ckb_block_height_to_header {
    pub mod impl_ckbblockheighttoheader {
        /// RE: rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables ckb block'
        // enriched: ---
        /* ghidra: 0x004101b0  sig=undefined8 * __rustcall rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::connect
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::write
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::write
        //   - bincode::internal::serialize
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - redb::table::Table<K,V>::insert
        // enriched: ---
        /* ghidra: 0x004102c0  sig=long * __rustcall rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::write(long *param_1,undefined8 param_2,undefined8 param_3,long param_4);
           
           /* rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::write */
           
           long * __rustcall
           rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeader::write
                     (long *param_1,undefined8 param_2,undefined8 param_3,long param_4)
           
           {
             long lVar1;
             long local_158;
             undefined8 uStack_150;
             undefined8 uStack_148;
             long lStack_140;
             long local_138;
             long lStack_130;
             long local_128;
             long lStack_120;
             long local_118;
             long lStack_110;
             long local_108;
             long lStack_100;
             undefined8 local_f8;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             long local_e0;
             void *local_d8;
             undefined8 local_d0;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             long local_b8;
             undefined8 local_b0;
             undefined8 local_a8;
             undefined8 local_a0;
             undefined4 local_98;
             undefined4 uStack_94;
             undefined4 uStack_90;
             undefined4 uStack_8c;
             long local_88;
           // ... [truncated]
        */
        pub fn write() { todo!() }
    }
    pub mod impl_ckbblockheighttoheaderreadable {
        /// RE: rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x0040f880  sig=long * __rustcall rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::connect
                     (long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::get
        //   - _<redb::tree_store::page_store::base::PageImpl_as_core::clone::Clone>::clone
        //   - redb::tree_store::btree::Btree<K,V>::get_helper
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - mut_bincode::de::Deserializer<R,O>as_serde::de::Deserializer>::deserialize_tuple
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040f9b0  sig=undefined8 * __rustcall rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::get(undefined8 *param_1,long param_2,undefined8 param_3);
           
           /* rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::get */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::get
                     (undefined8 *param_1,long param_2,undefined8 param_3)
           
           {
             undefined8 uVar1;
             ulong *puVar2;
             ulong uVar3;
             ulong *puVar4;
             long lVar5;
             undefined8 local_158;
             undefined8 uStack_150;
             ulong local_148;
             undefined4 local_140;
             undefined4 uStack_13c;
             undefined4 uStack_138;
             undefined4 uStack_134;
             long local_128;
             undefined8 uStack_120;
             ulong uStack_118;
             ulong local_110;
             ulong local_108;
             ulong uStack_100;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 local_c8;
             undefined4 uStack_c4;
           // ... [truncated]
        */
        pub fn get() { todo!() }
        /// RE: rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::latest_height
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::latest_height
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<redb::table::Range<K,V>as_core::iter::traits::double_ended::DoubleEndedIterator>::next_back
        //   - _<u64_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040fd00  sig=undefined8 * __rustcall rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::latest_height(undefined8 *param_1,long *param_2);
           
           /* rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::latest_height */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::ckb_block_height_to_header::CkbBlockHeightToHeaderReadable::latest_height
                     (undefined8 *param_1,long *param_2)
           
           {
             ulong uVar1;
             undefined8 uVar2;
             ulong *puVar3;
             long *__src;
             undefined8 local_320;
             uint local_318;
             long local_314;
             undefined4 local_30c;
             ulong local_308;
             ulong uStack_300;
             ulong local_2f8;
             ulong local_2e8;
             ulong uStack_2e0;
             ulong local_2d8;
             undefined4 local_2c8;
             undefined4 uStack_2c4;
             undefined4 uStack_2c0;
             undefined4 uStack_2bc;
             ulong local_2b8;
             undefined8 local_2a8;
             undefined8 uStack_2a0;
             ulong local_298;
             ulong local_288;
             undefined8 uStack_280;
             undefined8 uStack_278;
             ulong local_270;
             undefined4 local_268;
             undefined4 uStack_264;
             undefined4 uStack_260;
             undefined4 uStack_25c;
             undefined4 local_258;
             undefined4 uStack_254;
           // ... [truncated]
        */
        pub fn latest_height() { todo!() }
    }
}
pub mod ckb_tx_hash_to_tx {
    pub mod impl_ckbtxhashtotx {
        /// RE: rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables ckb tx has'
        // enriched: ---
        /* ghidra: 0x00410520  sig=undefined8 * __rustcall rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::connect
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::get
        //   - _<redb::table::Table<K,V>as_redb::table::ReadableTable<K,V>>::get
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00410630  sig=long * __rustcall rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::get(long *param_1,undefined8 param_2,undefined8 *param_3);
           
           /* rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::get */
           
           long * __rustcall
           rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::get
                     (long *param_1,undefined8 param_2,undefined8 *param_3)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             long lVar3;
             int local_158;
             undefined4 uStack_154;
             int iStack_150;
             undefined4 uStack_14c;
             undefined8 uStack_148;
             long local_140;
             long lStack_138;
             long lStack_130;
             long lStack_128;
             long lStack_120;
             long local_118;
             long lStack_110;
             long local_108;
             long lStack_100;
             long local_f8;
             long lStack_f0;
             long local_d8;
             long local_d0;
             long local_c8;
             long lStack_c0;
             long local_b8;
             long lStack_b0;
             long local_a8;
             long lStack_a0;
             long local_98;
             long lStack_90;
             long local_88;
             
             _<redb::table::Table<K,V>as_redb::table::ReadableTable<K,V>>::get
           // ... [truncated]
        */
        pub fn get() { todo!() }
        /// RE: rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::write
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::write
        //   - redb::table::Table<K,V>::insert
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00410830  sig=long * __rustcall rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::write(long *param_1);
           
           /* rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::write */
           
           long * __rustcall rgbpp_daos::tables::ckb_tx_hash_to_tx::CkbTxHashToTx::write(long *param_1)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             long lVar3;
             int local_158;
             undefined4 uStack_154;
             int iStack_150;
             undefined4 uStack_14c;
             undefined8 uStack_148;
             long local_140;
             long lStack_138;
             long lStack_130;
             long lStack_128;
             long lStack_120;
             long local_118;
             long lStack_110;
             long local_108;
             long lStack_100;
             long local_f8;
             long lStack_f0;
             long local_d8;
             long local_d0;
             long local_c8;
             long lStack_c0;
             long local_b8;
             long lStack_b0;
             long local_a8;
             long lStack_a0;
             long local_98;
             long lStack_90;
             long local_88;
             
             redb::table::Table<K,V>::insert(&local_158);
             if (CONCAT44(uStack_154,local_158) != 5) {
               if (local_158 != 4) {
           // ... [truncated]
        */
        pub fn write() { todo!() }
    }
}
pub mod rgbpp_balances {
    /// RE: rgbpp_daos::tables::rgbpp_balances::account_token_key
    // enriched: ---
    // calls:
    //   - rgbpp_daos::tables::rgbpp_balances::account_token_key
    //   - molecule::hex_string
    // enriched: ---
    /* ghidra: 0x00406390  sig=void __rustcall rgbpp_daos::tables::rgbpp_balances::account_token_key(undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4);
       
       /* rgbpp_daos::tables::rgbpp_balances::account_token_key */
       
       void __rustcall
       rgbpp_daos::tables::rgbpp_balances::account_token_key
                 (undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4)
       
       {
         undefined8 local_98;
         long local_90;
         void *local_88;
         undefined1 *local_78;
         code *local_70;
         long *local_68;
         code *local_60;
         undefined8 local_58;
         undefined8 uStack_50;
         undefined8 local_48;
         undefined **local_40;
         undefined8 local_38;
         undefined1 **local_30;
         undefined8 local_28;
         undefined8 local_20;
         
         local_98 = param_2;
         molecule::hex_string(&local_90,param_3,param_4);
         local_70 = _<&T_as_core::fmt::Display>::fmt;
         local_60 = _<alloc::string::String_as_core::fmt::Display>::fmt;
         local_40 = &PTR_anon_88590ff0cffbe0d0edfc8f5ea95bf1ff_4_llvm_10128274468213034051_00bc3568;
         local_38 = 2;
         local_20 = 0;
         local_30 = &local_78;
         local_28 = 2;
         local_78 = (undefined1 *)&local_98;
         local_68 = &local_90;
                           /* try { // try from 0040640b to 0040641a has its CatchHandler @ 00406451 */
         alloc::fmt::format::format_inner();
         if (local_90 != 0) {
           std::alloc::__default_lib_allocator::__rust_dealloc(local_88);
         }
       // ... [truncated]
    */
    pub fn account_token_key() { todo!() }
    pub mod impl_rgbppbalances {
        /// RE: rgbpp_daos::tables::rgbpp_balances::RgbppBalances::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalances::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables rgbpp bala'
        // enriched: ---
        /* ghidra: 0x00406b40  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_balances::RgbppBalances::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_balances::RgbppBalances::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_balances::RgbppBalances::connect(undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
             undefined8 local_58;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_balances::RgbppBalances::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalances::get
        //   - _<redb::table::Table<K,V>as_redb::table::ReadableTable<K,V>>::get
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<u128_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x00406f10  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_balances::RgbppBalances::get(undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5);
           
           /* rgbpp_daos::tables::rgbpp_balances::RgbppBalances::get */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_balances::RgbppBalances::get
                     (undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,
                     undefined8 param_5)
           
           {
             ulong uVar1;
             undefined8 uVar2;
             ulong uVar3;
             ulong *puVar4;
             ulong *puVar5;
             undefined8 unaff_R12;
             undefined1 auVar6 [16];
             long local_120;
             void *local_118;
             undefined8 local_110;
             long local_108;
             undefined8 uStack_100;
             ulong uStack_f8;
             ulong local_f0;
             ulong local_e8;
             ulong uStack_e0;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
           // ... [truncated]
        */
        pub fn get() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_balances::RgbppBalances::insert
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalances::insert
        //   - redb::table::Table<K,V>::insert
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<u128_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x00406c50  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_balances::RgbppBalances::insert(undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6,undefined8 param_7);
           
           /* rgbpp_daos::tables::rgbpp_balances::RgbppBalances::insert */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_balances::RgbppBalances::insert
                     (undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,
                     undefined8 param_5,undefined8 param_6,undefined8 param_7)
           
           {
             ulong uVar1;
             undefined8 uVar2;
             ulong uVar3;
             ulong *puVar4;
             ulong *puVar5;
             undefined1 auVar6 [16];
             long local_120;
             void *local_118;
             undefined8 local_110;
             long local_108;
             undefined8 uStack_100;
             ulong uStack_f8;
             ulong local_f0;
             ulong local_e8;
             ulong uStack_e0;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
           // ... [truncated]
        */
        pub fn insert() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_balances::RgbppBalances::remove
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalances::remove
        //   - redb::table::Table<K,V>::remove
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<u128_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x004071c0  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_balances::RgbppBalances::remove(undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5);
           
           /* rgbpp_daos::tables::rgbpp_balances::RgbppBalances::remove */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_balances::RgbppBalances::remove
                     (undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,
                     undefined8 param_5)
           
           {
             ulong uVar1;
             undefined8 uVar2;
             ulong uVar3;
             ulong *puVar4;
             ulong *puVar5;
             undefined8 unaff_R12;
             undefined1 auVar6 [16];
             long local_120;
             void *local_118;
             undefined8 local_110;
             long local_108;
             undefined8 uStack_100;
             ulong uStack_f8;
             ulong local_f0;
             ulong local_e8;
             ulong uStack_e0;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
           // ... [truncated]
        */
        pub fn remove() { todo!() }
    }
    pub mod impl_rgbppbalancesreadable {
        /// RE: rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::balances
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::balances
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00406880  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::balances(undefined8 *param_1,long *param_2,undefined8 param_3);
           
           /* rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::balances */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::balances
                     (undefined8 *param_1,long *param_2,undefined8 param_3)
           
           {
             undefined8 *puVar1;
             code *__ptr;
             undefined **ppuVar2;
             undefined **ppuVar3;
             undefined8 uVar4;
             undefined8 local_248;
             undefined4 local_240;
             undefined4 uStack_23c;
             undefined8 *local_238;
             undefined1 *local_230;
             code *local_228;
             undefined8 local_220;
             long local_218;
             void *local_210;
             undefined8 local_208;
             undefined8 local_200;
             undefined4 local_1f8;
             undefined4 uStack_1f4;
             undefined4 uStack_1f0;
             undefined4 uStack_1ec;
             undefined **local_1e8;
             undefined8 local_1d8;
             undefined8 uStack_1d0;
             undefined **local_1c8;
             void *local_1b8;
             undefined8 local_1b0;
             code *local_1a8;
             undefined8 local_1a0;
             undefined **local_198;
             undefined8 uStack_190;
             undefined8 uStack_188;
             undefined **local_180;
           // ... [truncated]
        */
        pub fn balances() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00406480  sig=long * __rustcall rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect(long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
             undefined8 uStack_88;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::get
        //   - _<redb::tree_store::page_store::base::PageImpl_as_core::clone::Clone>::clone
        //   - redb::tree_store::btree::Btree<K,V>::get_helper
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<u128_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x004065b0  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::get(undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5);
           
           /* rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::get */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::get
                     (undefined8 *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5
                     )
           
           {
             ulong uVar1;
             undefined8 uVar2;
             ulong uVar3;
             ulong *puVar4;
             ulong *puVar5;
             undefined8 unaff_R12;
             undefined1 auVar6 [16];
             long local_140;
             void *local_138;
             undefined8 local_130;
             long local_128;
             undefined8 uStack_120;
             ulong uStack_118;
             ulong local_110;
             ulong local_108;
             ulong uStack_100;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
           // ... [truncated]
        */
        pub fn get() { todo!() }
    }
}
pub mod rgbpp_holders {
    /// RE: rgbpp_daos::tables::rgbpp_holders::_::<impl serde::ser::Serialize for rgbpp_daos::tables::rgbpp_holders::PaginationTokenV1>::serialize
    // enriched: ---
    // trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
    // calls:
    //   - _<impl_serde::ser::Serialize_for_rgbpp_daos::tables::rgbpp_holders::PaginationTokenV1>::serialize
    // enriched: ---
    /* ghidra: 0x0029f7f0  sig=long __rustcall rgbpp_daos::tables::rgbpp_holders::_::_<impl_serde::ser::Serialize_for_rgbpp_daos::tables::rgbpp_holders::PaginationTokenV1>::serialize(long *param_1,long *param_2);
       
       /* rgbpp_daos::tables::rgbpp_holders::_::_<impl serde::ser::Serialize for
          rgbpp_daos::tables::rgbpp_holders::PaginationTokenV1>::serialize */
       
       long __rustcall
       rgbpp_daos::tables::rgbpp_holders::_::
       _<impl_serde::ser::Serialize_for_rgbpp_daos::tables::rgbpp_holders::PaginationTokenV1>::serialize
                 (long *param_1,long *param_2)
       
       {
         long *plVar1;
         long lVar2;
         long lVar3;
         void *__src;
         ulong __n;
         long lVar4;
         long lVar5;
         
         lVar4 = param_1[10];
         plVar1 = (long *)*param_2;
         lVar5 = plVar1[2];
         if ((ulong)(*plVar1 - lVar5) < 4) {
           alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(plVar1,lVar5,4);
           lVar5 = plVar1[2];
         }
         *(int *)(plVar1[1] + lVar5) = (int)lVar4;
         plVar1[2] = lVar5 + 4;
         lVar5 = serde::ser::impls::_<impl_serde::ser::Serialize_for[T;32]>::serialize(param_1 + 6,param_2)
         ;
         if (lVar5 == 0) {
           if (param_1[3] == -0x8000000000000000) {
             lVar5 = plVar1[2];
             if (*plVar1 == lVar5) {
               alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(plVar1,lVar5,1);
               lVar5 = plVar1[2];
             }
             *(undefined1 *)(plVar1[1] + lVar5) = 0;
             lVar5 = lVar5 + 1;
             plVar1[2] = lVar5;
             lVar4 = *param_1;
       // ... [truncated]
    */
    pub struct PaginationTokenV1;
    // fields: fatal, runtime, error, thread
    /// RE: <rgbpp_daos::tables::rgbpp_holders::PaginationVersion as core::fmt::Debug>::fmt
    // enriched: ---
    // trait-hint: fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result
    // calls:
    //   - _<rgbpp_daos::tables::rgbpp_holders::PaginationVersion_as_core::fmt::Debug>::fmt
    // enriched: ---
    /* ghidra: 0x002dcdf0  sig=void __rustcall _<rgbpp_daos::tables::rgbpp_holders::PaginationVersion_as_core::fmt::Debug>::fmt(void);
       
       /* _<rgbpp_daos::tables::rgbpp_holders::PaginationVersion as core::fmt::Debug>::fmt */
       
       void __rustcall
       _<rgbpp_daos::tables::rgbpp_holders::PaginationVersion_as_core::fmt::Debug>::fmt(void)
       
       {
         core::fmt::Formatter::write_str();
         return;
       }
       
    */
    pub struct PaginationVersion;
    pub mod impl_rgbppholders {
        /// RE: rgbpp_daos::tables::rgbpp_holders::RgbppHolders::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_holders::RgbppHolders::connect
        //   - redb::transactions::WriteTransaction::open_multimap_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables rgbpp hold'
        // enriched: ---
        /* ghidra: 0x00408730  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_holders::RgbppHolders::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_holders::RgbppHolders::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_holders::RgbppHolders::connect(undefined8 *param_1,undefined8 param_2)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined8 uVar11;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
             undefined4 uStack_88;
             undefined4 uStack_84;
             undefined4 local_80;
             undefined4 uStack_7c;
             undefined8 uStack_78;
             undefined8 local_70;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_holders::RgbppHolders::insert
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_holders::RgbppHolders::insert
        //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
        //   - _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder_as_molecule::prelude::Builder>::build
        //   - _<rgbpp_daos::types::script_key::ScriptKey_as_core::fmt::Display>::fmt
        //   - redb::multimap_table::MultimapTable<K,V>::insert
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00408850  sig=undefined1 * __rustcall rgbpp_daos::tables::rgbpp_holders::RgbppHolders::insert(undefined1 *param_1,undefined8 param_2,undefined4 *param_3,long param_4,undefined8 param_5,undefined8 param_6,undefined8 param_7);
           
           /* rgbpp_daos::tables::rgbpp_holders::RgbppHolders::insert */
           
           undefined1 * __rustcall
           rgbpp_daos::tables::rgbpp_holders::RgbppHolders::insert
                     (undefined1 *param_1,undefined8 param_2,undefined4 *param_3,long param_4,
                     undefined8 param_5,undefined8 param_6,undefined8 param_7)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined1 uVar8;
             undefined **ppuVar9;
             undefined1 *__ptr;
             undefined1 *puVar10;
             char cVar11;
             undefined4 *extraout_RAX;
             undefined8 *extraout_RAX_00;
             undefined8 uVar12;
             undefined8 *extraout_RAX_01;
             undefined **local_128;
             undefined4 uStack_120;
             undefined4 uStack_11c;
             undefined4 uStack_118;
             undefined4 uStack_114;
             undefined8 uStack_110;
             undefined ***local_108;
             undefined8 uStack_100;
             undefined8 local_f8;
             undefined8 uStack_f0;
             undefined **local_e8;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 uStack_d8;
             undefined4 uStack_d4;
           // ... [truncated]
        */
        pub fn insert() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_holders::RgbppHolders::remove
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_holders::RgbppHolders::remove
        //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
        //   - _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder_as_molecule::prelude::Builder>::build
        //   - _<rgbpp_daos::types::script_key::ScriptKey_as_core::fmt::Display>::fmt
        //   - redb::multimap_table::MultimapTable<K,V>::remove
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00408e50  sig=undefined1 * __rustcall rgbpp_daos::tables::rgbpp_holders::RgbppHolders::remove(undefined1 *param_1,undefined8 param_2,undefined4 *param_3,long param_4,undefined8 param_5,undefined8 param_6,undefined8 param_7);
           
           /* rgbpp_daos::tables::rgbpp_holders::RgbppHolders::remove */
           
           undefined1 * __rustcall
           rgbpp_daos::tables::rgbpp_holders::RgbppHolders::remove
                     (undefined1 *param_1,undefined8 param_2,undefined4 *param_3,long param_4,
                     undefined8 param_5,undefined8 param_6,undefined8 param_7)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined1 uVar8;
             undefined **ppuVar9;
             undefined1 *__ptr;
             undefined1 *puVar10;
             char cVar11;
             undefined4 *extraout_RAX;
             undefined8 *extraout_RAX_00;
             undefined8 uVar12;
             undefined8 *extraout_RAX_01;
             undefined **local_128;
             undefined4 uStack_120;
             undefined4 uStack_11c;
             undefined4 uStack_118;
             undefined4 uStack_114;
             undefined8 uStack_110;
             undefined ***local_108;
             undefined8 uStack_100;
             undefined8 local_f8;
             undefined8 uStack_f0;
             undefined **local_e8;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 uStack_d8;
             undefined4 uStack_d4;
           // ... [truncated]
        */
        pub fn remove() { todo!() }
    }
    pub mod impl_rgbppholdersreadable {
        /// RE: rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::connect
        //   - redb::transactions::ReadTransaction::open_multimap_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00407470  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::connect
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined8 uVar11;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
             undefined4 uStack_88;
             undefined4 uStack_84;
             undefined4 local_80;
             undefined4 uStack_7c;
             undefined8 uStack_78;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v1
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v1
        //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
        //   - _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder_as_molecule::prelude::Builder>::build
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00407590  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v1(undefined8 *param_1,long *param_2,long *param_3,undefined1 param_4);
           
           /* rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v1 */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v1
                     (undefined8 *param_1,long *param_2,long *param_3,undefined1 param_4)
           
           {
             long lVar1;
             long lVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             long lVar5;
             undefined **ppuVar6;
             undefined **ppuVar7;
             undefined8 *puVar8;
             long *extraout_RAX;
             long *extraout_RAX_00;
             long *extraout_RAX_01;
             undefined4 *extraout_RAX_02;
             undefined8 uVar9;
             long lVar10;
             long lVar11;
             undefined1 local_699;
             undefined **local_698;
             undefined **ppuStack_690;
             undefined8 local_688;
             undefined4 uStack_680;
             undefined4 uStack_67c;
             undefined **local_678;
             undefined **ppuStack_670;
             undefined **local_668;
             undefined8 uStack_660;
             undefined **local_658;
             undefined **ppuStack_650;
             undefined8 local_648;
             undefined8 uStack_640;
             undefined **local_638;
             undefined **ppuStack_630;
             undefined8 local_628;
           // ... [truncated]
        */
        pub fn get_by_token_v1() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v2
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v2
        //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
        //   - _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder_as_molecule::prelude::Builder>::build
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00407ef0  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v2(undefined8 *param_1,long *param_2,undefined8 *param_3,undefined1 param_4);
           
           /* rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v2 */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_holders::RgbppHoldersReadable::get_by_token_v2
                     (undefined8 *param_1,long *param_2,undefined8 *param_3,undefined1 param_4)
           
           {
             undefined8 uVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined **ppuVar5;
             undefined **ppuVar6;
             int iVar7;
             undefined8 *extraout_RAX;
             undefined8 *extraout_RAX_00;
             undefined4 *extraout_RAX_01;
             undefined8 uVar8;
             undefined1 local_649;
             undefined **local_648;
             undefined **ppuStack_640;
             undefined **local_638;
             undefined4 uStack_630;
             undefined4 uStack_62c;
             undefined **local_628;
             undefined **ppuStack_620;
             undefined **local_618;
             undefined8 uStack_610;
             undefined **local_608;
             undefined **ppuStack_600;
             undefined **local_5f8;
             undefined8 auStack_5f0 [2];
             undefined8 local_5e0;
             long local_5d8;
             undefined **local_5d0;
             undefined8 local_5c8;
             undefined1 local_5c0 [8];
             long local_5b8;
             undefined8 local_5b0;
           // ... [truncated]
        */
        pub fn get_by_token_v2() { todo!() }
    }
}
pub mod rgbpp_tokens {
    pub mod impl_rgbpptokens {
        /// RE: rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables rgbpp toke'
        // enriched: ---
        /* ghidra: 0x00410fc0  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::connect(undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
             undefined8 local_58;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::get
        //   - _<redb::table::Table<K,V>as_redb::table::ReadableTable<K,V>>::get
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x004112c0  sig=long * __rustcall rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::get(long *param_1);
           
           /* rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::get */
           
           long * __rustcall rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::get(long *param_1)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             long lVar3;
             int local_138;
             undefined4 uStack_134;
             int iStack_130;
             undefined4 uStack_12c;
             undefined8 uStack_128;
             long local_120;
             long lStack_118;
             long lStack_110;
             long lStack_108;
             long lStack_100;
             long local_f8;
             long lStack_f0;
             long local_e8;
             long lStack_e0;
             long local_d8;
             long lStack_d0;
             long local_c8;
             long lStack_c0;
             long local_b8;
             long local_b0;
             long local_a8;
             long lStack_a0;
             long local_98;
             long lStack_90;
             long local_88;
             long lStack_80;
             long local_78;
             long lStack_70;
             long local_68;
             
             _<redb::table::Table<K,V>as_redb::table::ReadableTable<K,V>>::get(&local_138);
           // ... [truncated]
        */
        pub fn get() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::insert
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::insert
        //   - redb::table::Table<K,V>::insert
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x004110d0  sig=long * __rustcall rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::insert(long *param_1);
           
           /* rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::insert */
           
           long * __rustcall rgbpp_daos::tables::rgbpp_tokens::RgbppTokens::insert(long *param_1)
           
           {
             undefined4 uVar1;
             undefined4 uVar2;
             long lVar3;
             int local_138;
             undefined4 uStack_134;
             int iStack_130;
             undefined4 uStack_12c;
             undefined8 uStack_128;
             long local_120;
             long lStack_118;
             long lStack_110;
             long lStack_108;
             long lStack_100;
             long local_f8;
             long lStack_f0;
             long local_e8;
             long lStack_e0;
             long local_d8;
             long lStack_d0;
             long local_c8;
             long lStack_c0;
             long local_b8;
             long local_b0;
             long local_a8;
             long lStack_a0;
             long local_98;
             long lStack_90;
             long local_88;
             long lStack_80;
             long local_78;
             long lStack_70;
             long local_68;
             
             redb::table::Table<K,V>::insert(&local_138);
           // ... [truncated]
        */
        pub fn insert() { todo!() }
    }
    pub mod impl_rgbpptokensreadable {
        /// RE: rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00410a30  sig=long * __rustcall rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::connect(long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
             undefined8 uStack_88;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::get
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<alloc::vec::Vec<T>as_alloc::vec::spec_from_iter::SpecFromIter<T,I>>::from_iter
        //   - _<alloc::vec::Vec<T,A>as_core::ops::drop::Drop>::drop
        //   - _<redb::tree_store::page_store::base::PageImpl_as_core::clone::Clone>::clone
        //   - redb::tree_store::btree::Btree<K,V>::get_helper
        // enriched: ---
        /* ghidra: 0x00410b60  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::get(undefined8 *param_1,long *param_2,long param_3,undefined8 param_4);
           
           /* rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::get */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_tokens::RgbppTokensReadable::get
                     (undefined8 *param_1,long *param_2,long param_3,undefined8 param_4)
           
           {
             long lVar1;
             void *pvVar2;
             void *pvVar3;
             void *pvVar4;
             void *pvVar5;
             void *pvVar6;
             void *pvVar7;
             void *pvVar8;
             void *pvVar9;
             void *pvVar10;
             void *pvVar11;
             void *pvVar12;
             undefined8 uVar13;
             undefined8 local_288;
             void *pvStack_280;
             void *local_278;
             undefined8 local_270;
             undefined8 uStack_268;
             undefined8 local_260;
             uint local_258;
             undefined4 uStack_254;
             uint uStack_250;
             undefined4 uStack_24c;
             undefined8 uStack_248;
             void *local_240;
             void *pvStack_238;
             void *pvStack_230;
             void *pvStack_228;
             void *pvStack_220;
             void *local_218;
             void *pvStack_210;
             void *local_208;
           // ... [truncated]
        */
        pub fn get() { todo!() }
    }
}
pub mod rgbpp_transferable {
    /// RE: rgbpp_daos::tables::rgbpp_transferable::transferable_key
    // enriched: ---
    // calls:
    //   - rgbpp_daos::tables::rgbpp_transferable::transferable_key
    //   - molecule::hex_string
    // enriched: ---
    /* ghidra: 0x00401d50  sig=void __rustcall rgbpp_daos::tables::rgbpp_transferable::transferable_key(undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6);
       
       /* rgbpp_daos::tables::rgbpp_transferable::transferable_key */
       
       void __rustcall
       rgbpp_daos::tables::rgbpp_transferable::transferable_key
                 (undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,
                 undefined8 param_5,undefined8 param_6)
       
       {
         undefined8 local_e0;
         long local_d8;
         void *local_d0;
         long local_c0;
         void *local_b8;
         undefined8 *local_a8;
         code *local_a0;
         long *local_98;
         code *local_90;
         long *local_88;
         code *local_80;
         undefined8 local_78;
         undefined8 uStack_70;
         undefined8 local_68;
         undefined **local_60;
         undefined8 local_58;
         undefined8 **local_50;
         undefined8 local_48;
         undefined8 local_40;
         
         local_e0 = param_2;
         molecule::hex_string(&local_d8,param_3,param_4);
                           /* try { // try from 00401d86 to 00401d95 has its CatchHandler @ 00401e93 */
         molecule::hex_string(&local_c0,param_5,param_6);
         local_a8 = &local_e0;
         local_a0 = _<&T_as_core::fmt::Display>::fmt;
         local_90 = _<alloc::string::String_as_core::fmt::Display>::fmt;
         local_80 = _<alloc::string::String_as_core::fmt::Display>::fmt;
         local_60 = &PTR_anon_16629561060f6ca205a688b5c10459fc_13_llvm_14956531465407023927_00bc32f8;
         local_58 = 3;
         local_40 = 0;
       // ... [truncated]
    */
    pub fn transferable_key() { todo!() }
    pub mod impl_rgbpptransferable {
        /// RE: rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00402810  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::connect
                     (undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::remove
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::remove
        //   - redb::table::Table<K,V>::remove
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00402bc0  sig=long * __rustcall rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::remove(long *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6,undefined8 param_7);
           
           /* rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::remove */
           
           long * __rustcall
           rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::remove
                     (long *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5
                     ,undefined8 param_6,undefined8 param_7)
           
           {
             int iVar1;
             undefined4 uVar2;
             long lVar3;
             long lVar4;
             long lVar5;
             long lVar6;
             long lVar7;
             long lVar8;
             long lVar9;
             long lVar10;
             long lVar11;
             long lVar12;
             long local_180;
             void *local_178;
             undefined8 local_170;
             long local_158;
             int local_148;
             undefined4 uStack_144;
             int iStack_140;
             undefined4 uStack_13c;
             undefined8 uStack_138;
             long local_130;
             long lStack_128;
             long lStack_120;
             long lStack_118;
             long lStack_110;
             long local_108;
             long lStack_100;
             long local_f8;
             long lStack_f0;
             long local_e8;
           // ... [truncated]
        */
        pub fn remove() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::write
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::write
        //   - redb::table::Table<K,V>::insert
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00402920  sig=long * __rustcall rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::write(long *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6,undefined8 param_7,undefined8 param_8,undefined8 param_9);
           
           /* rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::write */
           
           long * __rustcall
           rgbpp_daos::tables::rgbpp_transferable::RgbppTransferable::write
                     (long *param_1,undefined8 param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5
                     ,undefined8 param_6,undefined8 param_7,undefined8 param_8,undefined8 param_9)
           
           {
             int iVar1;
             undefined4 uVar2;
             long lVar3;
             long lVar4;
             long lVar5;
             long lVar6;
             long lVar7;
             long lVar8;
             long lVar9;
             long lVar10;
             long lVar11;
             long local_190;
             void *local_188;
             undefined8 local_180;
             int local_178;
             undefined4 uStack_174;
             int iStack_170;
             undefined4 uStack_16c;
             undefined8 uStack_168;
             long local_160;
             long lStack_158;
             long lStack_150;
             long lStack_148;
             long lStack_140;
             long local_138;
             long lStack_130;
             long local_128;
             long lStack_120;
             long local_118;
             long lStack_110;
             long local_f8;
           // ... [truncated]
        */
        pub fn write() { todo!() }
    }
    pub mod impl_rgbpptransferablereadable {
        /// RE: rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::account_token_transferable_cells
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::account_token_transferable_cells
        //   - molecule::hex_string
        //   - redb::tree_store::btree_iters::BtreeRangeIter<K,V>::new
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x004022a0  sig=undefined8 * __rustcall rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::account_token_transferable_cells(undefined8 *param_1,long *param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined4 param_6);
           
           /* rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::account_token_transferable_cells
               */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::account_token_transferable_cells
                     (undefined8 *param_1,long *param_2,undefined8 param_3,undefined8 param_4,
                     undefined8 param_5,undefined4 param_6)
           
           {
             long lVar1;
             void *__ptr;
             undefined **ppuVar2;
             undefined **ppuVar3;
             undefined8 uVar4;
             undefined8 local_350;
             undefined4 local_344;
             undefined8 local_340;
             undefined4 local_338;
             undefined4 uStack_334;
             long *local_330;
             code *local_328;
             long local_320;
             void *local_318;
             long local_308;
             void *local_300;
             undefined8 local_2f8;
             undefined4 local_2ef;
             undefined3 uStack_2eb;
             undefined **local_2e8;
             undefined **ppuStack_2e0;
             undefined **local_2d8;
             undefined **local_2c8;
             undefined **ppuStack_2c0;
             undefined **local_2b8;
             void *local_2a8;
             undefined8 local_2a0;
             void *local_298;
             undefined8 local_290;
             undefined **local_288;
           // ... [truncated]
        */
        pub fn account_token_transferable_cells() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00401ec0  sig=long * __rustcall rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::connect
                     (long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::get
        //   - _<redb::tree_store::page_store::base::PageImpl_as_core::clone::Clone>::clone
        //   - redb::tree_store::btree::Btree<K,V>::get_helper
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x00401ff0  sig=long * __rustcall rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::get(long *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,undefined8 param_6,undefined8 param_7);
           
           /* rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::get */
           
           long * __rustcall
           rgbpp_daos::tables::rgbpp_transferable::RgbppTransferableReadable::get
                     (long *param_1,long param_2,undefined8 param_3,undefined8 param_4,undefined8 param_5,
                     undefined8 param_6,undefined8 param_7)
           
           {
             undefined4 uVar1;
             long lVar2;
             undefined4 uVar3;
             long lVar4;
             long lVar5;
             long lVar6;
             long lVar7;
             long lVar8;
             long lVar9;
             long lVar10;
             long lVar11;
             long lVar12;
             long lVar13;
             long local_1b0;
             void *local_1a8;
             undefined8 local_1a0;
             undefined4 local_198;
             undefined4 uStack_194;
             undefined4 uStack_190;
             undefined4 uStack_18c;
             undefined8 uStack_188;
             long local_180;
             long lStack_178;
             long lStack_170;
             long lStack_168;
             long lStack_160;
             long local_158;
             long lStack_150;
             long local_148;
             long lStack_140;
             long local_138;
           // ... [truncated]
        */
        pub fn get() { todo!() }
    }
}
pub mod statistic {
    pub mod impl_statistic {
        /// RE: rgbpp_daos::tables::statistic::Statistic::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::statistic::Statistic::connect
        //   - redb::transactions::WriteTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // strings:
        //   - 'rgbpp daos src tables statistic'
        // enriched: ---
        /* ghidra: 0x0040be80  sig=undefined8 * __rustcall rgbpp_daos::tables::statistic::Statistic::connect(undefined8 *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::statistic::Statistic::connect */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::statistic::Statistic::connect(undefined8 *param_1,undefined8 param_2)
           
           {
             undefined8 uVar1;
             undefined4 local_108;
             undefined4 uStack_104;
             undefined4 uStack_100;
             undefined4 uStack_fc;
             undefined4 local_f8;
             undefined4 uStack_f4;
             undefined4 uStack_f0;
             undefined4 uStack_ec;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined4 local_a8;
             undefined4 uStack_a4;
             undefined4 uStack_a0;
             undefined4 uStack_9c;
             undefined8 local_98;
             long local_90;
             undefined8 local_88;
             undefined8 uStack_80;
             undefined8 local_78;
             undefined8 local_68;
             undefined8 uStack_60;
             undefined8 local_58;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::statistic::Statistic::set_schema
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::statistic::Statistic::set_schema
        // enriched: ---
        /* ghidra: 0x0040c1c0  sig=undefined8 __rustcall rgbpp_daos::tables::statistic::Statistic::set_schema(undefined8 param_1);
           
           /* rgbpp_daos::tables::statistic::Statistic::set_schema */
           
           undefined8 __rustcall rgbpp_daos::tables::statistic::Statistic::set_schema(undefined8 param_1)
           
           {
             write();
             return param_1;
           }
           
        */
        pub fn set_schema() { todo!() }
        /// RE: rgbpp_daos::tables::statistic::Statistic::write
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::statistic::Statistic::write
        //   - redb::table::Table<K,V>::insert
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<u64_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040bf90  sig=undefined8 * __rustcall rgbpp_daos::tables::statistic::Statistic::write(undefined8 *param_1,undefined8 param_2,undefined8 param_3);
           
           /* rgbpp_daos::tables::statistic::Statistic::write */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::statistic::Statistic::write
                     (undefined8 *param_1,undefined8 param_2,undefined8 param_3)
           
           {
             ulong uVar1;
             ulong uVar2;
             undefined8 uVar3;
             ulong *puVar4;
             ulong *puVar5;
             undefined8 unaff_R14;
             long local_118;
             undefined8 uStack_110;
             ulong uStack_108;
             ulong local_100;
             ulong local_f8;
             ulong uStack_f0;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined8 local_a8;
             undefined8 uStack_a0;
             ulong local_98;
             undefined8 local_88;
           // ... [truncated]
        */
        pub fn write() { todo!() }
    }
    pub mod impl_statisticreadable {
        /// RE: rgbpp_daos::tables::statistic::StatisticReadable::connect
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::statistic::StatisticReadable::connect
        //   - redb::transactions::ReadTransaction::open_table
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        // enriched: ---
        /* ghidra: 0x0040bae0  sig=long * __rustcall rgbpp_daos::tables::statistic::StatisticReadable::connect(long *param_1,undefined8 param_2);
           
           /* rgbpp_daos::tables::statistic::StatisticReadable::connect */
           
           long * __rustcall
           rgbpp_daos::tables::statistic::StatisticReadable::connect(long *param_1,undefined8 param_2)
           
           {
             long lVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             undefined4 uVar7;
             undefined4 uVar8;
             undefined4 uVar9;
             undefined4 uVar10;
             undefined4 uVar11;
             long lVar12;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 uStack_c8;
             undefined4 uStack_c4;
             undefined4 local_c0;
             undefined4 uStack_bc;
             undefined4 uStack_b8;
             undefined4 uStack_b4;
             undefined4 local_b0;
             undefined4 uStack_ac;
             undefined4 uStack_a8;
             undefined4 uStack_a4;
             undefined4 local_a0;
             undefined4 uStack_9c;
             undefined4 uStack_98;
             undefined4 uStack_94;
             undefined4 local_90;
             undefined4 uStack_8c;
             undefined8 uStack_88;
           // ... [truncated]
        */
        pub fn connect() { todo!() }
        /// RE: rgbpp_daos::tables::statistic::StatisticReadable::get
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::statistic::StatisticReadable::get
        //   - _<redb::tree_store::page_store::base::PageImpl_as_core::clone::Clone>::clone
        //   - redb::tree_store::btree::Btree<K,V>::get_helper
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - _<u64_as_redb::types::RedbValue>::from_bytes
        //   - _<redb::tree_store::btree_base::AccessGuard<V>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x0040bc10  sig=undefined8 * __rustcall rgbpp_daos::tables::statistic::StatisticReadable::get(undefined8 *param_1,long param_2);
           
           /* rgbpp_daos::tables::statistic::StatisticReadable::get */
           
           undefined8 * __rustcall
           rgbpp_daos::tables::statistic::StatisticReadable::get(undefined8 *param_1,long param_2)
           
           {
             ulong uVar1;
             undefined8 uVar2;
             ulong uVar3;
             ulong *puVar4;
             ulong *puVar5;
             long unaff_R14;
             long local_118;
             undefined8 uStack_110;
             ulong uStack_108;
             ulong local_100;
             ulong local_f8;
             ulong uStack_f0;
             undefined4 local_e8;
             undefined4 uStack_e4;
             undefined4 uStack_e0;
             undefined4 uStack_dc;
             undefined4 local_d8;
             undefined4 uStack_d4;
             undefined4 uStack_d0;
             undefined4 uStack_cc;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined4 local_b8;
             undefined4 uStack_b4;
             undefined4 uStack_b0;
             undefined4 uStack_ac;
             undefined8 local_a8;
             undefined8 uStack_a0;
             ulong local_98;
             undefined8 local_88;
             undefined8 uStack_80;
           // ... [truncated]
        */
        pub fn get() { todo!() }
        /// RE: rgbpp_daos::tables::statistic::StatisticReadable::schema
        // enriched: ---
        // calls:
        //   - rgbpp_daos::tables::statistic::StatisticReadable::schema
        // enriched: ---
        /* ghidra: 0x0040be70  sig=undefined8 __rustcall rgbpp_daos::tables::statistic::StatisticReadable::schema(undefined8 param_1);
           
           /* rgbpp_daos::tables::statistic::StatisticReadable::schema */
           
           undefined8 __rustcall rgbpp_daos::tables::statistic::StatisticReadable::schema(undefined8 param_1)
           
           {
             get();
             return param_1;
           }
           
        */
        pub fn schema() { todo!() }
    }
}
