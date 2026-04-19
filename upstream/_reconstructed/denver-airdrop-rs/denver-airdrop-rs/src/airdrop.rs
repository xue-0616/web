// Auto-generated skeleton reconstructed from ELF symbols.
// This is **NOT** the original source — it is a structural approximation.
// Every `todo!()` body hides the original logic. Use this to:
//   * understand module layout and public API surface,
//   * seed a greenfield re-implementation,
//   * drive binary-diffing with the deployed ELF.
//
// Source: backend-bin/denver-airdrop-rs/denver-airdrop-rs
// Tool:   upstream/_reconstruct.py
#![allow(unused, non_snake_case, non_camel_case_types, dead_code)]


/// RE: denver_airdrop_rs::airdrop::_::<impl serde::ser::Serialize for denver_airdrop_rs::airdrop::AirDrop>::serialize
// enriched: ---
// trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
// calls:
//   - serde::ser::SerializeMap::serialize_entry
//   - _<serde_json::ser::Compound<W,F>as_serde::ser::SerializeStruct>::end
//   - serde_json::ser::invalid_raw_value
// enriched: ---
/* ghidra: 0x0020a050  sig=void __rustcall denver_airdrop_rs::airdrop::_::_<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::AirDrop>::serialize(long param_1,long *param_2);
   
   /* denver_airdrop_rs::airdrop::_::_<impl serde::ser::Serialize for
      denver_airdrop_rs::airdrop::AirDrop>::serialize */
   
   void __rustcall
   denver_airdrop_rs::airdrop::_::_<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::AirDrop>
   ::serialize(long param_1,long *param_2)
   
   {
     long *plVar1;
     long lVar2;
     undefined4 local_38;
     undefined4 uStack_34;
     undefined8 uStack_30;
     undefined4 local_28;
     undefined4 uStack_24;
     undefined4 uStack_20;
     undefined4 uStack_1c;
     
     plVar1 = (long *)*param_2;
     param_2[1] = param_2[1] + 1;
     *(undefined1 *)(param_2 + 4) = 0;
     lVar2 = plVar1[2];
     if (plVar1[1] == lVar2) {
       alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(plVar1,lVar2,1);
       lVar2 = plVar1[2];
     }
     *(undefined1 *)(*plVar1 + lVar2) = 0x7b;
     plVar1[2] = lVar2 + 1;
     local_38 = CONCAT22(local_38._2_2_,0x100);
     uStack_30 = param_2;
     lVar2 = serde::ser::SerializeMap::serialize_entry
                       (&local_38,&anon_1d0d29532c6390c9858817dadc3ded88_77_llvm_16861486678406314783,8
                        ,param_1);
     if (lVar2 != 0) {
       return;
     }
     if ((char)local_38 == '\0') {
       lVar2 = serde::ser::SerializeMap::serialize_entry
                         (&local_38,&anon_1d0d29532c6390c9858817dadc3ded88_78_llvm_16861486678406314783
   // ... [truncated]
*/
pub struct AirDrop;
// fields: pending_txstruct, PendingTx, with, elementsblockaddressesstruct
/// RE: denver_airdrop_rs::airdrop::_::<impl serde::ser::Serialize for denver_airdrop_rs::airdrop::AriDropInfo>::serialize
// enriched: ---
// trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
// calls:
//   - _<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::AriDropInfo>::serialize
//   - serde::ser::SerializeMap::serialize_entry
//   - _<serde_json::ser::Compound<W,F>as_serde::ser::SerializeMap>::serialize_key
//   - mut_serde_json::ser::Serializer<W,F>as_serde::ser::Serializer>::collect_str
//   - _<serde_json::ser::Compound<W,F>as_serde::ser::SerializeStruct>::serialize_field
//   - _<serde_json::ser::Compound<W,F>as_serde::ser::SerializeStruct>::end
//   - serde_json::ser::invalid_raw_value
// enriched: ---
/* ghidra: 0x0020a2a0  sig=void __rustcall denver_airdrop_rs::airdrop::_::_<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::AriDropInfo>::serialize(long param_1,long *param_2);
   
   /* denver_airdrop_rs::airdrop::_::_<impl serde::ser::Serialize for
      denver_airdrop_rs::airdrop::AriDropInfo>::serialize */
   
   void __rustcall
   denver_airdrop_rs::airdrop::_::
   _<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::AriDropInfo>::serialize
             (long param_1,long *param_2)
   
   {
     long *plVar1;
     long *plVar2;
     long lVar3;
     undefined4 local_48;
     undefined4 uStack_44;
     undefined8 uStack_40;
     undefined8 local_38;
     undefined4 uStack_30;
     undefined4 uStack_2c;
     long local_28;
     
     plVar1 = (long *)*param_2;
     param_2[1] = param_2[1] + 1;
     *(undefined1 *)(param_2 + 4) = 0;
     lVar3 = plVar1[2];
     if (plVar1[1] == lVar3) {
       alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(plVar1,lVar3,1);
       lVar3 = plVar1[2];
     }
     *(undefined1 *)(*plVar1 + lVar3) = 0x7b;
     plVar1[2] = lVar3 + 1;
     local_48 = CONCAT22(local_48._2_2_,0x100);
     uStack_40 = param_2;
     lVar3 = serde::ser::SerializeMap::serialize_entry
                       (&local_48,&anon_1d0d29532c6390c9858817dadc3ded88_78_llvm_16861486678406314783,5
                        ,param_1);
     if (lVar3 != 0) {
       return;
     }
     if ((char)local_48 == '\0') {
   // ... [truncated]
*/
pub struct AriDropInfo;
// fields: tx_hashassertion, failed, idx, rustc, library, alloc
/// RE: denver_airdrop_rs::airdrop::_::<impl serde::ser::Serialize for denver_airdrop_rs::airdrop::PendingTx>::serialize
// enriched: ---
// trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
// calls:
//   - _<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::PendingTx>::serialize
//   - serde::ser::SerializeMap::serialize_entry
//   - serde_json::ser::indent
//   - serde_json::error::Error::io
//   - serde_json::ser::invalid_raw_value
// enriched: ---
/* ghidra: 0x0020a150  sig=long __rustcall denver_airdrop_rs::airdrop::_::_<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::PendingTx>::serialize(long param_1,long *param_2);
   
   /* denver_airdrop_rs::airdrop::_::_<impl serde::ser::Serialize for
      denver_airdrop_rs::airdrop::PendingTx>::serialize */
   
   long __rustcall
   denver_airdrop_rs::airdrop::_::
   _<impl_serde::ser::Serialize_for_denver_airdrop_rs::airdrop::PendingTx>::serialize
             (long param_1,long *param_2)
   
   {
     long *plVar1;
     long lVar2;
     undefined2 local_28;
     long *local_20;
     
     plVar1 = (long *)*param_2;
     param_2[1] = param_2[1] + 1;
     *(undefined1 *)(param_2 + 4) = 0;
     lVar2 = plVar1[2];
     if (plVar1[1] == lVar2) {
       alloc::raw_vec::RawVec<T,A>::reserve::do_reserve_and_handle(plVar1,lVar2,1);
       lVar2 = plVar1[2];
     }
     *(undefined1 *)(*plVar1 + lVar2) = 0x7b;
     plVar1[2] = lVar2 + 1;
     local_28 = 0x100;
     local_20 = param_2;
     lVar2 = serde::ser::SerializeMap::serialize_entry
                       (&local_28,&anon_1d0d29532c6390c9858817dadc3ded88_78_llvm_16861486678406314783,5
                        ,param_1);
     if (lVar2 != 0) {
       return lVar2;
     }
     if ((char)local_28 == '\0') {
       lVar2 = serde::ser::SerializeMap::serialize_entry
                         (&local_28,&anon_1d0d29532c6390c9858817dadc3ded88_84_llvm_16861486678406314783
                          ,5,param_1 + 8);
       if (lVar2 != 0) {
         return lVar2;
       }
   // ... [truncated]
*/
pub struct PendingTx;
// fields: blockaddressesstruct, AriDropInfo, with
