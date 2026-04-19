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


/// RE: <denver_airdrop_rs::config::_::<impl serde::de::Deserialize for denver_airdrop_rs::config::Config>::deserialize::__FieldVisitor as serde::de::Visitor>::visit_str
// enriched: ---
// trait-hint: fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E>
// enriched: ---
/* ghidra: 0x001a0c70  sig=undefined1 * __rustcall _<denver_airdrop_rs::config::_::<impl_serde::de::Deserialize_for_denver_airdrop_rs::config::Config>::deserialize::__FieldVisitor_as_serde::de::Visitor>::visit_str(undefined1 *param_1,long *param_2,size_t param_3);
   
   /* _<denver_airdrop_rs::config::_::<impl serde::de::Deserialize for
      denver_airdrop_rs::config::Config>::deserialize::__FieldVisitor as serde::de::Visitor>::visit_str
       */
   
   undefined1 * __rustcall
   _<denver_airdrop_rs::config::_::<impl_serde::de::Deserialize_for_denver_airdrop_rs::config::Config>::deserialize::__FieldVisitor_as_serde::de::Visitor>
   ::visit_str(undefined1 *param_1,long *param_2,size_t param_3)
   
   {
     byte bVar1;
     int iVar2;
     undefined1 auVar3 [16];
     undefined1 auVar4 [16];
     
     bVar1 = 7;
     switch(param_3) {
     case 7:
       if (*(int *)((long)param_2 + 3) == 0x6c72755f && (int)*param_2 == 0x5f637072) {
         bVar1 = 0;
       }
       break;
     case 9:
       iVar2 = bcmp(param_2,"stop_time",param_3);
       if (iVar2 == 0) {
         bVar1 = 5;
       }
       else {
         iVar2 = bcmp(param_2,"store_dir",param_3);
         bVar1 = iVar2 == 0 ^ 7;
       }
       break;
     case 10:
       bVar1 = ((short)param_2[1] != 0x6b63 || *param_2 != 0x6f6c625f6d6f7266) * '\x03' + 4;
       break;
     case 0xb:
       if (*(long *)((long)param_2 + 3) == 0x737365726464615f && *param_2 == 0x726464615f74666e) {
         bVar1 = 1;
       }
       else if (*(long *)((long)param_2 + 3) == 0x79656b5f65746176 && *param_2 == 0x5f65746176697270) {
   // ... [truncated]
*/
pub struct Config;
