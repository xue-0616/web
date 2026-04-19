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


/// RE: rgbpp_daos::types::rgbpp_impls::<impl core::convert::From<rgbpp_daos::types::rgbpp::U32> for u32>::from
// enriched: ---
// trait-hint: fn from(value: T) -> Self
// enriched: ---
pub fn rgbpp_impls() { todo!() }
pub mod btc_mint_transaction {
    /// RE: rgbpp_daos::types::btc_mint_transaction::_::<impl serde::ser::Serialize for rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction>::serialize
    // enriched: ---
    // trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
    // calls:
    //   - _<bincode::ser::Compound<W,O>as_serde::ser::SerializeStruct>::serialize_field
    //   - _<impl_serde::ser::Serialize_for_rgbpp_daos::types::script_key::ScriptKey>::serialize
    // enriched: ---
    /* ghidra: 0x003ff840  sig=long __rustcall rgbpp_daos::types::btc_mint_transaction::_::_<impl_serde::ser::Serialize_for_rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction>::serialize(long param_1,long *param_2);
       
       /* rgbpp_daos::types::btc_mint_transaction::_::_<impl serde::ser::Serialize for
          rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction>::serialize */
       
       long __rustcall
       rgbpp_daos::types::btc_mint_transaction::_::
       _<impl_serde::ser::Serialize_for_rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction>::
       serialize(long param_1,long *param_2)
       
       {
         undefined1 uVar1;
         undefined8 uVar2;
         long *plVar3;
         long lVar4;
         long lVar5;
         
         lVar4 = _<bincode::ser::Compound<W,O>as_serde::ser::SerializeStruct>::serialize_field
                           (param_2,param_1 + 0xb0);
         if (lVar4 == 0) {
           lVar4 = script_key::_::
                   _<impl_serde::ser::Serialize_for_rgbpp_daos::types::script_key::ScriptKey>::serialize
                             (param_1,param_2);
           if (lVar4 == 0) {
             uVar2 = *(undefined8 *)(param_1 + 0x28);
             plVar3 = (long *)*param_2;
             lVar4 = plVar3[2];
             if ((ulong)(*plVar3 - lVar4) < 8) {
               alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(plVar3,lVar4,8);
               lVar4 = plVar3[2];
             }
             *(undefined8 *)(plVar3[1] + lVar4) = uVar2;
             plVar3[2] = lVar4 + 8;
             plVar3 = (long *)*param_2;
             lVar4 = plVar3[2];
             lVar5 = -0x35;
             do {
               uVar1 = *(undefined1 *)(param_1 + 0xad + lVar5);
               if (*plVar3 == lVar4) {
                 alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(plVar3,lVar4,1);
                 lVar4 = plVar3[2];
       // ... [truncated]
    */
    pub struct BtcMintTransaction;
    // fields: struct, Commitment, with
    pub mod impl_btcminttransaction {
        /// RE: rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction::from_transaction
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction::from_transaction
        //   - bitcoin_hashes::Hash::hash
        //   - script_key::ScriptKey::from_script
        //   - bitcoin::blockdata::transaction::Transaction::txid
        // enriched: ---
        /* ghidra: 0x003ff2e0  sig=long * __rustcall rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction::from_transaction(long *param_1,long param_2,undefined1 param_3);
           
           /* rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction::from_transaction */
           
           long * __rustcall
           rgbpp_daos::types::btc_mint_transaction::BtcMintTransaction::from_transaction
                     (long *param_1,long param_2,undefined1 param_3)
           
           {
             ulong uVar1;
             long lVar2;
             long lVar3;
             long lVar4;
             long lVar5;
             long lVar6;
             long *plVar7;
             void *pvVar8;
             long *__ptr;
             undefined1 auVar9 [16];
             undefined1 auVar10 [16];
             undefined1 auVar11 [16];
             undefined2 local_1eb;
             undefined1 local_1e9;
             long local_1c8;
             long *plStack_1c0;
             long local_1b8;
             long lStack_1b0;
             undefined8 local_1a8;
             char cStack_1a0;
             char cStack_19f;
             char cStack_19e;
             char cStack_19d;
             char cStack_19c;
             char cStack_19b;
             char cStack_19a;
             char cStack_199;
             undefined4 uStack_198;
             undefined1 uStack_194;
             long local_188;
             long lStack_180;
             long local_178;
           // ... [truncated]
        */
        pub fn from_transaction() { todo!() }
    }
}
pub mod rgbpp {
    /// RE: rgbpp_daos::types::rgbpp_impls::<impl core::convert::From<&ckb_gen_types::generated::blockchain::Byte32> for rgbpp_daos::types::rgbpp::Bytes32>::from
    // enriched: ---
    // trait-hint: fn from(value: T) -> Self
    // enriched: ---
    pub struct Bytes32;
    /// RE: <rgbpp_daos::types::rgbpp::Bytes32Reader as molecule::prelude::Reader>::to_entity
    pub struct Bytes32Reader;
    /// RE: <rgbpp_daos::types::rgbpp::BytesReader as molecule::prelude::Reader>::to_entity
    pub struct BytesReader;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppBalance as molecule::prelude::Entity>::new_builder
    // enriched: ---
    // calls:
    //   - _<rgbpp_daos::types::rgbpp::RgbppBalance_as_molecule::prelude::Entity>::new_builder
    // enriched: ---
    /* ghidra: 0x003f27b0  sig=undefined8 * __rustcall _<rgbpp_daos::types::rgbpp::RgbppBalance_as_molecule::prelude::Entity>::new_builder(undefined8 *param_1);
       
       /* _<rgbpp_daos::types::rgbpp::RgbppBalance as molecule::prelude::Entity>::new_builder */
       
       undefined8 * __rustcall
       _<rgbpp_daos::types::rgbpp::RgbppBalance_as_molecule::prelude::Entity>::new_builder
                 (undefined8 *param_1)
       
       {
         *param_1 = &PTR_static_clone_00bc2aa0;
         param_1[1] = "";
         param_1[2] = 0x10;
         param_1[3] = 0;
         param_1[4] = &PTR_static_clone_00bc2aa0;
         param_1[5] = "";
         param_1[6] = 8;
         param_1[7] = 0;
         param_1[8] = &PTR_static_clone_00bc2aa0;
         param_1[9] = &DAT_0093cc31;
         param_1[10] = 0x24;
         param_1[0xb] = 0;
         return param_1;
       }
       
    */
    pub struct RgbppBalance;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppBalanceBuilder as molecule::prelude::Builder>::build
    // enriched: ---
    // trait-hint: fn build(self) -> <Self as Builder>::Output
    // calls:
    //   - _<rgbpp_daos::types::rgbpp::RgbppBalanceBuilder_as_molecule::prelude::Builder>::build
    //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
    // enriched: ---
    /* ghidra: 0x003f28b0  sig=void __rustcall _<rgbpp_daos::types::rgbpp::RgbppBalanceBuilder_as_molecule::prelude::Builder>::build(undefined8 *param_1,long param_2);
       
       /* _<rgbpp_daos::types::rgbpp::RgbppBalanceBuilder as molecule::prelude::Builder>::build */
       
       void __rustcall
       _<rgbpp_daos::types::rgbpp::RgbppBalanceBuilder_as_molecule::prelude::Builder>::build
                 (undefined8 *param_1,long param_2)
       
       {
         void *pvVar1;
         ulong uVar2;
         long lVar3;
         long extraout_RAX;
         long lVar4;
         long lVar5;
         long local_70;
         long local_68;
         long local_60;
         undefined8 *local_58;
         undefined8 local_50;
         undefined8 uStack_48;
         undefined8 local_40;
         undefined8 uStack_38;
         
         local_58 = param_1;
         std::alloc::__default_lib_allocator::__rust_alloc();
         if (extraout_RAX == 0) {
                           /* WARNING: Subroutine does not return */
           alloc::alloc::handle_alloc_error();
         }
         local_70 = 0x3c;
         local_60 = 0;
         pvVar1 = *(void **)(param_2 + 8);
         uVar2 = *(ulong *)(param_2 + 0x10);
         local_68 = extraout_RAX;
         if (0x3c < uVar2) {
                           /* try { // try from 003f2916 to 003f2924 has its CatchHandler @ 003f2a24 */
           alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(&local_70,0,uVar2);
         }
         lVar3 = local_60;
         lVar5 = local_68;
       // ... [truncated]
    */
    pub struct RgbppBalanceBuilder;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppBalanceReader as molecule::prelude::Reader>::to_entity
    pub struct RgbppBalanceReader;
    /// RE: rgbpp_daos::types::rgbpp_impls::<impl core::cmp::Ord for rgbpp_daos::types::rgbpp::RgbppOutPoint>::cmp
    // enriched: ---
    // trait-hint: fn cmp(&self, other: &Self) -> std::cmp::Ordering
    // enriched: ---
    /* ghidra: 0x003f2dc0  sig=undefined1 __rustcall rgbpp_daos::types::rgbpp_impls::_<impl_core::cmp::Ord_for_rgbpp_daos::types::rgbpp::RgbppOutPoint>::cmp(long param_1,long param_2);
       
       /* rgbpp_daos::types::rgbpp_impls::_<impl core::cmp::Ord for
          rgbpp_daos::types::rgbpp::RgbppOutPoint>::cmp */
       
       undefined1 __rustcall
       rgbpp_daos::types::rgbpp_impls::_<impl_core::cmp::Ord_for_rgbpp_daos::types::rgbpp::RgbppOutPoint>::
       cmp(long param_1,long param_2)
       
       {
         ulong uVar1;
         ulong uVar2;
         undefined1 uVar3;
         int iVar4;
         ulong __n;
         long lVar5;
         
         uVar1 = *(ulong *)(param_1 + 0x10);
         uVar2 = *(ulong *)(param_2 + 0x10);
         __n = uVar2;
         if (uVar1 < uVar2) {
           __n = uVar1;
         }
         iVar4 = memcmp(*(void **)(param_1 + 8),*(void **)(param_2 + 8),__n);
         lVar5 = uVar1 - uVar2;
         if (iVar4 != 0) {
           lVar5 = (long)iVar4;
         }
         uVar3 = 0xff;
         if (-1 < lVar5) {
           uVar3 = lVar5 != 0;
         }
         return uVar3;
       }
       
    */
    pub struct RgbppOutPoint;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppOutPointBuilder as molecule::prelude::Builder>::build
    // enriched: ---
    // trait-hint: fn build(self) -> <Self as Builder>::Output
    // calls:
    //   - _<rgbpp_daos::types::rgbpp::RgbppOutPointBuilder_as_molecule::prelude::Builder>::build
    //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
    // enriched: ---
    /* ghidra: 0x003f1fa0  sig=void __rustcall _<rgbpp_daos::types::rgbpp::RgbppOutPointBuilder_as_molecule::prelude::Builder>::build(undefined8 *param_1,long param_2);
       
       /* _<rgbpp_daos::types::rgbpp::RgbppOutPointBuilder as molecule::prelude::Builder>::build */
       
       void __rustcall
       _<rgbpp_daos::types::rgbpp::RgbppOutPointBuilder_as_molecule::prelude::Builder>::build
                 (undefined8 *param_1,long param_2)
       
       {
         void *pvVar1;
         ulong uVar2;
         long lVar3;
         long lVar4;
         long extraout_RAX;
         long lVar5;
         long local_70;
         long local_68;
         long local_60;
         undefined8 *local_58;
         undefined8 local_50;
         undefined8 uStack_48;
         undefined8 local_40;
         undefined8 uStack_38;
         
         local_58 = param_1;
         std::alloc::__default_lib_allocator::__rust_alloc();
         if (extraout_RAX == 0) {
                           /* WARNING: Subroutine does not return */
           alloc::alloc::handle_alloc_error();
         }
         local_70 = 0x24;
         local_60 = 0;
         pvVar1 = *(void **)(param_2 + 8);
         uVar2 = *(ulong *)(param_2 + 0x10);
         local_68 = extraout_RAX;
         if (0x24 < uVar2) {
                           /* try { // try from 003f2006 to 003f2014 has its CatchHandler @ 003f20ca */
           alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(&local_70,0,uVar2);
         }
         lVar4 = local_60;
         lVar5 = local_68;
       // ... [truncated]
    */
    pub struct RgbppOutPointBuilder;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppOutPointReader as molecule::prelude::Reader>::to_entity
    pub struct RgbppOutPointReader;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppToken as molecule::prelude::Entity>::new_builder
    // enriched: ---
    // calls:
    //   - _<rgbpp_daos::types::rgbpp::RgbppToken_as_molecule::prelude::Entity>::new_builder
    // enriched: ---
    /* ghidra: 0x003f2360  sig=undefined8 * __rustcall _<rgbpp_daos::types::rgbpp::RgbppToken_as_molecule::prelude::Entity>::new_builder(undefined8 *param_1);
       
       /* _<rgbpp_daos::types::rgbpp::RgbppToken as molecule::prelude::Entity>::new_builder */
       
       undefined8 * __rustcall
       _<rgbpp_daos::types::rgbpp::RgbppToken_as_molecule::prelude::Entity>::new_builder
                 (undefined8 *param_1)
       
       {
         *param_1 = &PTR_static_clone_00bc2aa0;
         param_1[1] = "";
         param_1[2] = 0x20;
         param_1[3] = 0;
         param_1[4] = &PTR_static_clone_00bc2aa0;
         param_1[5] = "";
         param_1[6] = 0x10;
         param_1[7] = 0;
         param_1[8] = &PTR_static_clone_00bc2aa0;
         param_1[9] = "";
         param_1[10] = 0x10;
         param_1[0xb] = 0;
         return param_1;
       }
       
    */
    pub struct RgbppToken;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder as molecule::prelude::Builder>::build
    // enriched: ---
    // trait-hint: fn build(self) -> <Self as Builder>::Output
    // calls:
    //   - _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder_as_molecule::prelude::Builder>::build
    //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
    // enriched: ---
    /* ghidra: 0x003f2a50  sig=void __rustcall _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder_as_molecule::prelude::Builder>::build(undefined8 *param_1,long param_2);
       
       /* _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder as molecule::prelude::Builder>::build */
       
       void __rustcall
       _<rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder_as_molecule::prelude::Builder>::build
                 (undefined8 *param_1,long param_2)
       
       {
         void *pvVar1;
         ulong uVar2;
         long lVar3;
         long lVar4;
         long extraout_RAX;
         long lVar5;
         long local_70;
         long local_68;
         long local_60;
         undefined8 *local_58;
         undefined8 local_50;
         undefined8 uStack_48;
         undefined8 local_40;
         undefined8 uStack_38;
         
         local_58 = param_1;
         std::alloc::__default_lib_allocator::__rust_alloc();
         if (extraout_RAX == 0) {
                           /* WARNING: Subroutine does not return */
           alloc::alloc::handle_alloc_error();
         }
         local_70 = 0x30;
         local_60 = 0;
         pvVar1 = *(void **)(param_2 + 8);
         uVar2 = *(ulong *)(param_2 + 0x10);
         local_68 = extraout_RAX;
         if (0x30 < uVar2) {
                           /* try { // try from 003f2ab6 to 003f2ac4 has its CatchHandler @ 003f2b7a */
           alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(&local_70,0,uVar2);
         }
         lVar4 = local_60;
         lVar5 = local_68;
       // ... [truncated]
    */
    pub struct RgbppTokenAmountBuilder;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppTokenAmountReader as molecule::prelude::Reader>::to_entity
    pub struct RgbppTokenAmountReader;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppTokenBuilder as molecule::prelude::Builder>::build
    // enriched: ---
    // trait-hint: fn build(self) -> <Self as Builder>::Output
    // calls:
    //   - _<rgbpp_daos::types::rgbpp::RgbppTokenBuilder_as_molecule::prelude::Builder>::build
    //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
    // enriched: ---
    /* ghidra: 0x003f2610  sig=void __rustcall _<rgbpp_daos::types::rgbpp::RgbppTokenBuilder_as_molecule::prelude::Builder>::build(undefined8 *param_1,long param_2);
       
       /* _<rgbpp_daos::types::rgbpp::RgbppTokenBuilder as molecule::prelude::Builder>::build */
       
       void __rustcall
       _<rgbpp_daos::types::rgbpp::RgbppTokenBuilder_as_molecule::prelude::Builder>::build
                 (undefined8 *param_1,long param_2)
       
       {
         void *pvVar1;
         ulong uVar2;
         long lVar3;
         long extraout_RAX;
         long lVar4;
         long lVar5;
         long local_70;
         long local_68;
         long local_60;
         undefined8 *local_58;
         undefined8 local_50;
         undefined8 uStack_48;
         undefined8 local_40;
         undefined8 uStack_38;
         
         local_58 = param_1;
         std::alloc::__default_lib_allocator::__rust_alloc();
         if (extraout_RAX == 0) {
                           /* WARNING: Subroutine does not return */
           alloc::alloc::handle_alloc_error();
         }
         local_70 = 0x40;
         local_60 = 0;
         pvVar1 = *(void **)(param_2 + 8);
         uVar2 = *(ulong *)(param_2 + 0x10);
         local_68 = extraout_RAX;
         if (0x40 < uVar2) {
                           /* try { // try from 003f2676 to 003f2684 has its CatchHandler @ 003f2784 */
           alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(&local_70,0,uVar2);
         }
         lVar3 = local_60;
         lVar5 = local_68;
       // ... [truncated]
    */
    pub struct RgbppTokenBuilder;
    /// RE: <rgbpp_daos::types::rgbpp::RgbppTokenReader as molecule::prelude::Reader>::to_entity
    pub struct RgbppTokenReader;
    /// RE: rgbpp_daos::types::rgbpp_impls::<impl core::convert::From<rgbpp_daos::types::rgbpp::U128> for u128>::from
    // enriched: ---
    // trait-hint: fn from(value: T) -> Self
    // enriched: ---
    pub struct U128;
    /// RE: <rgbpp_daos::types::rgbpp::U128Reader as molecule::prelude::Reader>::to_entity
    pub struct U128Reader;
    /// RE: rgbpp_daos::types::rgbpp_impls::<impl core::convert::From<rgbpp_daos::types::rgbpp::U32> for u32>::from
    // enriched: ---
    // trait-hint: fn from(value: T) -> Self
    // enriched: ---
    pub struct U32;
    /// RE: <rgbpp_daos::types::rgbpp::U32Reader as molecule::prelude::Reader>::to_entity
    // enriched: ---
    // calls:
    //   - _<rgbpp_daos::types::rgbpp::U32Reader_as_molecule::prelude::Reader>::to_entity
    //   - _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from
    // enriched: ---
    /* ghidra: 0x003f17e0  sig=undefined8 * __rustcall _<rgbpp_daos::types::rgbpp::U32Reader_as_molecule::prelude::Reader>::to_entity(undefined8 *param_1,undefined8 *param_2);
       
       /* _<rgbpp_daos::types::rgbpp::U32Reader as molecule::prelude::Reader>::to_entity */
       
       undefined8 * __rustcall
       _<rgbpp_daos::types::rgbpp::U32Reader_as_molecule::prelude::Reader>::to_entity
                 (undefined8 *param_1,undefined8 *param_2)
       
       {
         void *__src;
         size_t __n;
         undefined1 *extraout_RAX;
         size_t local_58;
         undefined1 *local_50;
         size_t local_48;
         undefined8 local_40;
         undefined8 uStack_38;
         undefined8 local_30;
         undefined8 uStack_28;
         
         __src = (void *)*param_2;
         __n = param_2[1];
         if (__n == 0) {
           local_50 = &DAT_00000001;
         }
         else {
           if ((long)__n < 0) {
                           /* WARNING: Subroutine does not return */
             alloc::raw_vec::capacity_overflow();
           }
           std::alloc::__default_lib_allocator::__rust_alloc();
           local_50 = extraout_RAX;
           if (extraout_RAX == (undefined1 *)0x0) {
                           /* WARNING: Subroutine does not return */
             alloc::alloc::handle_alloc_error();
           }
         }
         memcpy(local_50,__src,__n);
         local_58 = __n;
         local_48 = __n;
         _<bytes::bytes::Bytes_as_core::convert::From<alloc::vec::Vec<u8>>>::from(&local_40,&local_58);
       // ... [truncated]
    */
    pub struct U32Reader;
    /// RE: rgbpp_daos::types::rgbpp_impls::<impl core::convert::From<rgbpp_daos::types::rgbpp::U64> for u64>::from
    // enriched: ---
    // trait-hint: fn from(value: T) -> Self
    // enriched: ---
    pub struct U64;
    /// RE: <rgbpp_daos::types::rgbpp::U64Reader as molecule::prelude::Reader>::to_entity
    pub struct U64Reader;
    pub mod impl_rgbppbalancebuilder {
        /// RE: rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::amount
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::amount
        // enriched: ---
        /* ghidra: 0x003f2420  sig=long * __rustcall rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::amount(long *param_1,long *param_2,long *param_3);
           
           /* rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::amount */
           
           long * __rustcall
           rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::amount(long *param_1,long *param_2,long *param_3)
           
           {
             long lVar1;
             long lVar2;
             long lVar3;
             long lVar4;
             long lVar5;
             long lVar6;
             long lVar7;
             long lVar8;
             long lVar9;
             long lVar10;
             long lVar11;
             
                               /* try { // try from 003f243d to 003f243f has its CatchHandler @ 003f2486 */
             (**(code **)(*param_2 + 0x10))(param_2 + 3,param_2[1],param_2[2]);
             lVar1 = *param_3;
             lVar2 = param_3[1];
             lVar3 = param_3[2];
             lVar4 = param_3[3];
             param_2[2] = lVar3;
             param_2[3] = lVar4;
             *param_2 = lVar1;
             param_2[1] = lVar2;
             lVar5 = param_2[4];
             lVar6 = param_2[5];
             lVar7 = param_2[6];
             lVar8 = param_2[7];
             lVar9 = param_2[8];
             lVar10 = param_2[9];
             lVar11 = param_2[0xb];
             param_1[10] = param_2[10];
             param_1[0xb] = lVar11;
             param_1[8] = lVar9;
             param_1[9] = lVar10;
           // ... [truncated]
        */
        pub fn amount() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::ckb_out_point
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::ckb_out_point
        // enriched: ---
        /* ghidra: 0x003f2560  sig=undefined8 * __rustcall rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::ckb_out_point(undefined8 *param_1,undefined8 *param_2,undefined8 *param_3);
           
           /* rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::ckb_out_point */
           
           undefined8 * __rustcall
           rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::ckb_out_point
                     (undefined8 *param_1,undefined8 *param_2,undefined8 *param_3)
           
           {
             undefined8 uVar1;
             undefined8 uVar2;
             undefined8 uVar3;
             undefined8 uVar4;
             undefined8 uVar5;
             undefined8 uVar6;
             undefined8 uVar7;
             
                               /* try { // try from 003f2585 to 003f2587 has its CatchHandler @ 003f25df */
             (**(code **)(param_2[8] + 0x10))(param_2 + 0xb,param_2[9],param_2[10]);
             uVar1 = *param_3;
             uVar2 = param_3[1];
             uVar3 = param_3[3];
             param_2[10] = param_3[2];
             param_2[0xb] = uVar3;
             param_2[8] = uVar1;
             param_2[9] = uVar2;
             uVar1 = param_2[0xb];
             param_1[10] = param_2[10];
             param_1[0xb] = uVar1;
             uVar1 = param_2[9];
             param_1[8] = param_2[8];
             param_1[9] = uVar1;
             uVar1 = *param_2;
             uVar2 = param_2[1];
             uVar3 = param_2[2];
             uVar4 = param_2[3];
             uVar5 = param_2[4];
             uVar6 = param_2[5];
             uVar7 = param_2[7];
             param_1[6] = param_2[6];
             param_1[7] = uVar7;
           // ... [truncated]
        */
        pub fn ckb_out_point() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::value
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::value
        // enriched: ---
        /* ghidra: 0x003f24b0  sig=undefined8 * __rustcall rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::value(undefined8 *param_1,undefined8 *param_2,undefined8 *param_3);
           
           /* rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::value */
           
           undefined8 * __rustcall
           rgbpp_daos::types::rgbpp::RgbppBalanceBuilder::value
                     (undefined8 *param_1,undefined8 *param_2,undefined8 *param_3)
           
           {
             undefined8 uVar1;
             undefined8 uVar2;
             undefined8 uVar3;
             undefined8 uVar4;
             undefined8 uVar5;
             undefined8 uVar6;
             undefined8 uVar7;
             
                               /* try { // try from 003f24d5 to 003f24d7 has its CatchHandler @ 003f252f */
             (**(code **)(param_2[4] + 0x10))(param_2 + 7,param_2[5],param_2[6]);
             uVar1 = *param_3;
             uVar2 = param_3[1];
             uVar3 = param_3[3];
             param_2[6] = param_3[2];
             param_2[7] = uVar3;
             param_2[4] = uVar1;
             param_2[5] = uVar2;
             uVar1 = param_2[0xb];
             param_1[10] = param_2[10];
             param_1[0xb] = uVar1;
             uVar1 = param_2[9];
             param_1[8] = param_2[8];
             param_1[9] = uVar1;
             uVar1 = *param_2;
             uVar2 = param_2[1];
             uVar3 = param_2[2];
             uVar4 = param_2[3];
             uVar5 = param_2[4];
             uVar6 = param_2[5];
             uVar7 = param_2[7];
             param_1[6] = param_2[6];
             param_1[7] = uVar7;
           // ... [truncated]
        */
        pub fn value() { todo!() }
    }
    pub mod impl_rgbppbalancereader {
        /// RE: rgbpp_daos::types::rgbpp::RgbppBalanceReader::amount
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppBalanceReader::amount
        // enriched: ---
        /* ghidra: 0x003f2820  sig=undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppBalanceReader::amount(undefined8 *param_1);
           
           /* rgbpp_daos::types::rgbpp::RgbppBalanceReader::amount */
           
           undefined1  [16] __rustcall
           rgbpp_daos::types::rgbpp::RgbppBalanceReader::amount(undefined8 *param_1)
           
           {
             undefined1 auVar1 [16];
             
             if (0xf < (ulong)param_1[1]) {
               auVar1._8_8_ = 0x10;
               auVar1._0_8_ = *param_1;
               return auVar1;
             }
                               /* WARNING: Subroutine does not return */
             core::slice::index::slice_end_index_len_fail();
           }
           
        */
        pub fn amount() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppBalanceReader::ckb_out_point
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppBalanceReader::ckb_out_point
        // enriched: ---
        /* ghidra: 0x003f2880  sig=undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppBalanceReader::ckb_out_point(long *param_1);
           
           /* rgbpp_daos::types::rgbpp::RgbppBalanceReader::ckb_out_point */
           
           undefined1  [16] __rustcall
           rgbpp_daos::types::rgbpp::RgbppBalanceReader::ckb_out_point(long *param_1)
           
           {
             undefined1 auVar1 [16];
             
             if (0x3b < (ulong)param_1[1]) {
               auVar1._0_8_ = *param_1 + 0x18;
               auVar1._8_8_ = 0x24;
               return auVar1;
             }
                               /* WARNING: Subroutine does not return */
             core::slice::index::slice_end_index_len_fail();
           }
           
        */
        pub fn ckb_out_point() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppBalanceReader::value
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppBalanceReader::value
        // enriched: ---
        /* ghidra: 0x003f2850  sig=undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppBalanceReader::value(long *param_1);
           
           /* rgbpp_daos::types::rgbpp::RgbppBalanceReader::value */
           
           undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppBalanceReader::value(long *param_1)
           
           {
             undefined1 auVar1 [16];
             
             if (0x17 < (ulong)param_1[1]) {
               auVar1._0_8_ = *param_1 + 0x10;
               auVar1._8_8_ = 8;
               return auVar1;
             }
                               /* WARNING: Subroutine does not return */
             core::slice::index::slice_end_index_len_fail();
           }
           
        */
        pub fn value() { todo!() }
    }
    pub mod impl_rgbppoutpoint {
        /// RE: rgbpp_daos::types::rgbpp::RgbppOutPoint::tx_hash
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppOutPoint::tx_hash
        // enriched: ---
        /* ghidra: 0x003f1960  sig=undefined8 * __rustcall rgbpp_daos::types::rgbpp::RgbppOutPoint::tx_hash(undefined8 *param_1,undefined8 *param_2);
           
           /* rgbpp_daos::types::rgbpp::RgbppOutPoint::tx_hash */
           
           undefined8 * __rustcall
           rgbpp_daos::types::rgbpp::RgbppOutPoint::tx_hash(undefined8 *param_1,undefined8 *param_2)
           
           {
             ulong local_68 [2];
             undefined1 *local_58;
             long lStack_50;
             ulong **local_48;
             undefined8 local_40;
             undefined8 local_38;
             ulong *local_28;
             code *local_20;
             undefined1 *local_18;
             code *local_10;
             
             local_18 = (undefined1 *)local_68;
             local_68[0] = param_2[2];
             local_68[1] = 0x24;
             if (0x23 < local_68[0]) {
               (**(code **)*param_2)(&local_58,param_2 + 3,param_2[1]);
               param_1[2] = 0x20;
               param_1[3] = local_40;
               *param_1 = local_58;
               param_1[1] = lStack_50 + 4;
               return param_1;
             }
             local_28 = local_68 + 1;
             local_20 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_10 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_58 = anon_9ae6781133aa8e50ea887dafea5fce24_19_llvm_15576785283908433043;
             lStack_50 = 2;
             local_38 = 0;
             local_48 = &local_28;
             local_40 = 2;
                               /* WARNING: Subroutine does not return */
             core::panicking::panic_fmt();
           }
           // ... [truncated]
        */
        pub fn tx_hash() { todo!() }
    }
    pub mod impl_rgbppoutpointbuilder {
        /// RE: rgbpp_daos::types::rgbpp::RgbppOutPointBuilder::tx_hash
        pub fn tx_hash() { todo!() }
    }
    pub mod impl_rgbppoutpointreader {
        /// RE: rgbpp_daos::types::rgbpp::RgbppOutPointReader::tx_hash
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppOutPointReader::tx_hash
        // enriched: ---
        /* ghidra: 0x003f1e50  sig=undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppOutPointReader::tx_hash(long *param_1);
           
           /* rgbpp_daos::types::rgbpp::RgbppOutPointReader::tx_hash */
           
           undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppOutPointReader::tx_hash(long *param_1)
           
           {
             undefined1 auVar1 [16];
             
             if (0x23 < (ulong)param_1[1]) {
               auVar1._0_8_ = *param_1 + 4;
               auVar1._8_8_ = 0x20;
               return auVar1;
             }
                               /* WARNING: Subroutine does not return */
             core::slice::index::slice_end_index_len_fail();
           }
           
        */
        pub fn tx_hash() { todo!() }
    }
    pub mod impl_rgbpptoken {
        /// RE: rgbpp_daos::types::rgbpp::RgbppToken::holders
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppToken::holders
        // enriched: ---
        /* ghidra: 0x003f2290  sig=undefined8 * __rustcall rgbpp_daos::types::rgbpp::RgbppToken::holders(undefined8 *param_1,undefined8 *param_2);
           
           /* rgbpp_daos::types::rgbpp::RgbppToken::holders */
           
           undefined8 * __rustcall
           rgbpp_daos::types::rgbpp::RgbppToken::holders(undefined8 *param_1,undefined8 *param_2)
           
           {
             ulong local_68 [2];
             undefined1 *local_58;
             long lStack_50;
             ulong **local_48;
             undefined8 local_40;
             undefined8 local_38;
             ulong *local_28;
             code *local_20;
             undefined1 *local_18;
             code *local_10;
             
             local_18 = (undefined1 *)local_68;
             local_68[0] = param_2[2];
             local_68[1] = 0x40;
             if (0x3f < local_68[0]) {
               (**(code **)*param_2)(&local_58,param_2 + 3,param_2[1]);
               param_1[2] = 0x10;
               param_1[3] = local_40;
               *param_1 = local_58;
               param_1[1] = lStack_50 + 0x30;
               return param_1;
             }
             local_28 = local_68 + 1;
             local_20 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_10 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_58 = anon_9ae6781133aa8e50ea887dafea5fce24_19_llvm_15576785283908433043;
             lStack_50 = 2;
             local_38 = 0;
             local_48 = &local_28;
             local_40 = 2;
                               /* WARNING: Subroutine does not return */
             core::panicking::panic_fmt();
           }
           // ... [truncated]
        */
        pub fn holders() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppToken::supply
        pub fn supply() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppToken::type_hash
        pub fn type_hash() { todo!() }
    }
    pub mod impl_rgbpptokenamount {
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenAmount::amount
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppTokenAmount::amount
        // enriched: ---
        /* ghidra: 0x003f21c0  sig=undefined8 * __rustcall rgbpp_daos::types::rgbpp::RgbppTokenAmount::amount(undefined8 *param_1,undefined8 *param_2);
           
           /* rgbpp_daos::types::rgbpp::RgbppTokenAmount::amount */
           
           undefined8 * __rustcall
           rgbpp_daos::types::rgbpp::RgbppTokenAmount::amount(undefined8 *param_1,undefined8 *param_2)
           
           {
             ulong local_68 [2];
             undefined1 *local_58;
             long lStack_50;
             ulong **local_48;
             undefined8 local_40;
             undefined8 local_38;
             ulong *local_28;
             code *local_20;
             undefined1 *local_18;
             code *local_10;
             
             local_18 = (undefined1 *)local_68;
             local_68[0] = param_2[2];
             local_68[1] = 0x30;
             if (0x2f < local_68[0]) {
               (**(code **)*param_2)(&local_58,param_2 + 3,param_2[1]);
               param_1[2] = 0x10;
               param_1[3] = local_40;
               *param_1 = local_58;
               param_1[1] = lStack_50 + 0x20;
               return param_1;
             }
             local_28 = local_68 + 1;
             local_20 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_10 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_58 = anon_9ae6781133aa8e50ea887dafea5fce24_19_llvm_15576785283908433043;
             lStack_50 = 2;
             local_38 = 0;
             local_48 = &local_28;
             local_40 = 2;
                               /* WARNING: Subroutine does not return */
             core::panicking::panic_fmt();
           }
           // ... [truncated]
        */
        pub fn amount() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenAmount::type_hash
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppTokenAmount::type_hash
        // enriched: ---
        /* ghidra: 0x003f20f0  sig=undefined8 * __rustcall rgbpp_daos::types::rgbpp::RgbppTokenAmount::type_hash(undefined8 *param_1,undefined8 *param_2);
           
           /* rgbpp_daos::types::rgbpp::RgbppTokenAmount::type_hash */
           
           undefined8 * __rustcall
           rgbpp_daos::types::rgbpp::RgbppTokenAmount::type_hash(undefined8 *param_1,undefined8 *param_2)
           
           {
             ulong local_68 [2];
             undefined1 *local_58;
             undefined8 uStack_50;
             ulong **local_48;
             undefined8 local_40;
             undefined8 local_38;
             ulong *local_28;
             code *local_20;
             undefined1 *local_18;
             code *local_10;
             
             local_18 = (undefined1 *)local_68;
             local_68[0] = param_2[2];
             local_68[1] = 0x20;
             if (0x1f < local_68[0]) {
               (**(code **)*param_2)(&local_58,param_2 + 3,param_2[1]);
               *param_1 = local_58;
               param_1[1] = uStack_50;
               param_1[2] = 0x20;
               param_1[3] = local_40;
               return param_1;
             }
             local_28 = local_68 + 1;
             local_20 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_10 = core::fmt::num::_<impl_core::fmt::Debug_for_usize>::fmt;
             local_58 = anon_9ae6781133aa8e50ea887dafea5fce24_19_llvm_15576785283908433043;
             uStack_50 = 2;
             local_38 = 0;
             local_48 = &local_28;
             local_40 = 2;
                               /* WARNING: Subroutine does not return */
             core::panicking::panic_fmt();
           }
           // ... [truncated]
        */
        pub fn type_hash() { todo!() }
    }
    pub mod impl_rgbpptokenamountbuilder {
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder::amount
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder::amount
        // enriched: ---
        /* ghidra: 0x003f1f00  sig=undefined8 * __rustcall rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder::amount(undefined8 *param_1,undefined8 *param_2,undefined8 *param_3);
           
           /* rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder::amount */
           
           undefined8 * __rustcall
           rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder::amount
                     (undefined8 *param_1,undefined8 *param_2,undefined8 *param_3)
           
           {
             undefined8 uVar1;
             undefined8 uVar2;
             undefined8 uVar3;
             undefined8 uVar4;
             undefined8 uVar5;
             undefined8 uVar6;
             undefined8 uVar7;
             
                               /* try { // try from 003f1f25 to 003f1f27 has its CatchHandler @ 003f1f6d */
             (**(code **)(param_2[4] + 0x10))(param_2 + 7,param_2[5],param_2[6]);
             uVar1 = *param_3;
             uVar2 = param_3[1];
             uVar3 = param_3[3];
             param_2[6] = param_3[2];
             param_2[7] = uVar3;
             param_2[4] = uVar1;
             param_2[5] = uVar2;
             uVar1 = *param_2;
             uVar2 = param_2[1];
             uVar3 = param_2[2];
             uVar4 = param_2[3];
             uVar5 = param_2[4];
             uVar6 = param_2[5];
             uVar7 = param_2[7];
             param_1[6] = param_2[6];
             param_1[7] = uVar7;
             param_1[4] = uVar5;
             param_1[5] = uVar6;
             param_1[2] = uVar3;
             param_1[3] = uVar4;
             *param_1 = uVar1;
             param_1[1] = uVar2;
           // ... [truncated]
        */
        pub fn amount() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenAmountBuilder::type_hash
        pub fn type_hash() { todo!() }
    }
    pub mod impl_rgbpptokenbuilder {
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenBuilder::holders
        pub fn holders() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenBuilder::supply
        pub fn supply() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenBuilder::type_hash
        pub fn type_hash() { todo!() }
    }
    pub mod impl_rgbpptokenreader {
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenReader::holders
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppTokenReader::holders
        // enriched: ---
        /* ghidra: 0x003f23f0  sig=undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppTokenReader::holders(long *param_1);
           
           /* rgbpp_daos::types::rgbpp::RgbppTokenReader::holders */
           
           undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppTokenReader::holders(long *param_1)
           
           {
             undefined1 auVar1 [16];
             
             if (0x3f < (ulong)param_1[1]) {
               auVar1._0_8_ = *param_1 + 0x30;
               auVar1._8_8_ = 0x10;
               return auVar1;
             }
                               /* WARNING: Subroutine does not return */
             core::slice::index::slice_end_index_len_fail();
           }
           
        */
        pub fn holders() { todo!() }
        /// RE: rgbpp_daos::types::rgbpp::RgbppTokenReader::supply
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::rgbpp::RgbppTokenReader::supply
        // enriched: ---
        /* ghidra: 0x003f23c0  sig=undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppTokenReader::supply(long *param_1);
           
           /* rgbpp_daos::types::rgbpp::RgbppTokenReader::supply */
           
           undefined1  [16] __rustcall rgbpp_daos::types::rgbpp::RgbppTokenReader::supply(long *param_1)
           
           {
             undefined1 auVar1 [16];
             
             if (0x2f < (ulong)param_1[1]) {
               auVar1._0_8_ = *param_1 + 0x20;
               auVar1._8_8_ = 0x10;
               return auVar1;
             }
                               /* WARNING: Subroutine does not return */
             core::slice::index::slice_end_index_len_fail();
           }
           
        */
        pub fn supply() { todo!() }
    }
}
pub mod script_key {
    /// RE: rgbpp_daos::types::script_key::_::<impl serde::ser::Serialize for rgbpp_daos::types::script_key::ScriptKey>::serialize
    // enriched: ---
    // trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
    // calls:
    //   - _<impl_serde::ser::Serialize_for_rgbpp_daos::types::script_key::ScriptKey>::serialize
    //   - serde::ser::Serializer::collect_str
    // enriched: ---
    /* ghidra: 0x003f83e0  sig=undefined8 __rustcall rgbpp_daos::types::script_key::_::_<impl_serde::ser::Serialize_for_rgbpp_daos::types::script_key::ScriptKey>::serialize(long *param_1,long *param_2);
       
       /* rgbpp_daos::types::script_key::_::_<impl serde::ser::Serialize for
          rgbpp_daos::types::script_key::ScriptKey>::serialize */
       
       undefined8 __rustcall
       rgbpp_daos::types::script_key::_::
       _<impl_serde::ser::Serialize_for_rgbpp_daos::types::script_key::ScriptKey>::serialize
                 (long *param_1,long *param_2)
       
       {
         long *plVar1;
         long lVar2;
         long lVar3;
         long lVar4;
         long *local_20;
         
         if (*param_1 == -0x7ffffffffffffffe) {
           param_2 = (long *)*param_2;
           lVar4 = param_2[2];
           if ((ulong)(*param_2 - lVar4) < 4) {
             alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(param_2,lVar4,4);
             lVar4 = param_2[2];
           }
           *(undefined4 *)(param_2[1] + lVar4) = 1;
           lVar4 = lVar4 + 4;
           param_2[2] = lVar4;
           if ((ulong)(*param_2 - lVar4) < 8) {
             alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(param_2,lVar4,8);
             lVar4 = param_2[2];
           }
           *(undefined8 *)(param_2[1] + lVar4) = 0x14;
           lVar4 = lVar4 + 8;
           param_2[2] = lVar4;
           if ((ulong)(*param_2 - lVar4) < 0x14) {
             alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(param_2,lVar4,0x14);
             lVar4 = param_2[2];
           }
           lVar2 = param_2[1];
           *(int *)(lVar2 + 0x10 + lVar4) = (int)param_1[3];
           lVar3 = param_1[2];
       // ... [truncated]
    */
    pub struct ScriptKey;
    pub mod impl_scriptkey {
        /// RE: rgbpp_daos::types::script_key::ScriptKey::from_script
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::script_key::ScriptKey::from_script
        //   - bitcoin::address::Address::from_script
        //   - _<bitcoin_hashes::sha256::HashEngine_as_bitcoin_hashes::HashEngine>::input
        //   - _<bitcoin::blockdata::script::ScriptHash_as_bitcoin_hashes::Hash>::from_engine
        // enriched: ---
        /* ghidra: 0x003f7d70  sig=undefined8 * __rustcall rgbpp_daos::types::script_key::ScriptKey::from_script(undefined8 *param_1,undefined8 param_2,undefined8 param_3);
           
           /* rgbpp_daos::types::script_key::ScriptKey::from_script */
           
           undefined8 * __rustcall
           rgbpp_daos::types::script_key::ScriptKey::from_script
                     (undefined8 *param_1,undefined8 param_2,undefined8 param_3)
           
           {
             undefined8 local_14c;
             undefined8 uStack_144;
             undefined4 local_13c;
             long local_138;
             void *local_130;
             undefined8 uStack_128;
             undefined8 local_120;
             undefined8 uStack_118;
             undefined1 local_110;
             undefined8 local_108;
             undefined8 uStack_100;
             undefined8 local_f8;
             undefined8 uStack_f0;
             undefined8 local_e8;
             undefined8 uStack_e0;
             undefined8 local_d8;
             undefined8 uStack_d0;
             undefined4 local_c8;
             undefined4 uStack_c4;
             undefined4 uStack_c0;
             undefined4 uStack_bc;
             undefined8 local_b8;
             undefined8 uStack_b0;
             undefined8 local_a8;
             undefined4 local_98;
             undefined4 uStack_94;
             undefined4 uStack_90;
             undefined4 uStack_8c;
             undefined4 local_88;
             undefined4 uStack_84;
             undefined4 uStack_80;
             undefined4 uStack_7c;
           // ... [truncated]
        */
        pub fn from_script() { todo!() }
        /// RE: rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
        // enriched: ---
        // calls:
        //   - rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
        //   - _<bitcoin::blockdata::script::ScriptHash_as_core::str::traits::FromStr>::from_str
        //   - anyhow::error::_<impl_core::convert::From<E>for_anyhow::Error>::from
        //   - bitcoin::address::Address<bitcoin::address::NetworkUnchecked>::is_valid_for_network
        //   - anyhow::error::_<impl_anyhow::Error>::msg
        // enriched: ---
        /* ghidra: 0x003f7f00  sig=long * __rustcall rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network(long *param_1,undefined8 param_2,undefined8 param_3,undefined1 param_4);
           
           /* rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network */
           
           long * __rustcall
           rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
                     (long *param_1,undefined8 param_2,undefined8 param_3,undefined1 param_4)
           
           {
             char cVar1;
             long lVar2;
             undefined1 local_101;
             undefined8 **local_100;
             void *local_f8;
             long local_f0;
             undefined4 uStack_e8;
             undefined4 uStack_e4;
             long local_e0;
             undefined8 **local_d8;
             undefined4 local_d0;
             long *local_c8;
             undefined4 local_bc;
             long local_b8;
             undefined1 local_a8 [9];
             undefined4 local_9f;
             char local_90;
             undefined7 uStack_8f;
             undefined1 uStack_88;
             undefined7 uStack_87;
             undefined1 uStack_80;
             undefined4 local_7f;
             undefined3 local_7b;
             undefined4 uStack_78;
             undefined4 uStack_74;
             undefined8 local_70;
             long **local_60;
             code *local_58;
             long **local_50;
             undefined8 uStack_48;
             undefined1 *local_40;
             code *local_38;
           // ... [truncated]
        */
        pub fn from_str_and_validate_network() { todo!() }
    }
}
