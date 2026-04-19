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


/// RE: <rgbpp_indexer::chain::MAINNET_RGBPP_SCRIPT as core::ops::deref::Deref>::deref::__stability::LAZY
pub struct MAINNET_RGBPP_SCRIPT;
/// RE: <rgbpp_indexer::chain::MAINNET_XUDT_SCRIPT as core::ops::deref::Deref>::deref::__stability::LAZY
pub struct MAINNET_XUDT_SCRIPT;
/// RE: <rgbpp_indexer::chain::TESTNET_RGBPP_SCRIPT as core::ops::deref::Deref>::deref::__stability::LAZY
pub struct TESTNET_RGBPP_SCRIPT;
/// RE: <rgbpp_indexer::chain::TESTNET_XUDT_SCRIPT as core::ops::deref::Deref>::deref::__stability::LAZY
pub struct TESTNET_XUDT_SCRIPT;
pub mod impl_chain {
    /// RE: rgbpp_indexer::chain::Chain::rgbpp_script
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::chain::Chain::rgbpp_script
    // enriched: ---
    /* ghidra: 0x0038c690  sig=undefined8 * __rustcall rgbpp_indexer::chain::Chain::rgbpp_script(undefined8 *param_1,char param_2);
       
       /* WARNING: Globals starting with '_' overlap smaller symbols at the same address */
       /* rgbpp_indexer::chain::Chain::rgbpp_script */
       
       undefined8 * __rustcall rgbpp_indexer::chain::Chain::rgbpp_script(undefined8 *param_1,char param_2)
       
       {
         undefined8 *puVar1;
         undefined8 *local_98;
         undefined8 uStack_90;
         undefined8 local_88;
         undefined8 uStack_80;
         undefined1 *local_78;
         undefined8 uStack_70;
         undefined8 local_68;
         undefined8 uStack_60;
         undefined1 **local_58 [9];
         
         if (param_2 == '\0') {
           local_98 = &_<rgbpp_indexer::chain::MAINNET_RGBPP_SCRIPT_as_core::ops::deref::Deref>::deref::
                       __stability::LAZY;
           if (_DAT_00c3cb98 != 4) {
             local_58[0] = &local_78;
             local_78 = (undefined1 *)&local_98;
             std::sys_common::once::futex::Once::call(&DAT_00c3cb98,0,local_58,&DAT_00bbeff8);
           }
           puVar1 = local_98;
           (**(code **)*local_98)(&local_98,local_98 + 3,local_98[1],local_98[2]);
                           /* try { // try from 0038c73f to 0038c748 has its CatchHandler @ 0038c7f8 */
           (**(code **)puVar1[4])(&local_78,puVar1 + 7,puVar1[5],puVar1[6]);
         }
         else {
           if (param_2 != '\x01') {
             *param_1 = 0;
             return param_1;
           }
           local_98 = &_<rgbpp_indexer::chain::TESTNET_RGBPP_SCRIPT_as_core::ops::deref::Deref>::deref::
                       __stability::LAZY;
           if (_DAT_00c3cb08 != 4) {
             local_58[0] = &local_78;
       // ... [truncated]
    */
    pub fn rgbpp_script() { todo!() }
    /// RE: rgbpp_indexer::chain::Chain::xudt_script
    // enriched: ---
    // calls:
    //   - rgbpp_indexer::chain::Chain::xudt_script
    // enriched: ---
    /* ghidra: 0x0038c840  sig=undefined8 * __rustcall rgbpp_indexer::chain::Chain::xudt_script(undefined8 *param_1,char param_2);
       
       /* WARNING: Globals starting with '_' overlap smaller symbols at the same address */
       /* rgbpp_indexer::chain::Chain::xudt_script */
       
       undefined8 * __rustcall rgbpp_indexer::chain::Chain::xudt_script(undefined8 *param_1,char param_2)
       
       {
         undefined8 *puVar1;
         undefined8 *local_98;
         undefined8 uStack_90;
         undefined8 local_88;
         undefined8 uStack_80;
         undefined1 *local_78;
         undefined8 uStack_70;
         undefined8 local_68;
         undefined8 uStack_60;
         undefined1 **local_58 [9];
         
         if (param_2 == '\0') {
           local_98 = &_<rgbpp_indexer::chain::MAINNET_XUDT_SCRIPT_as_core::ops::deref::Deref>::deref::
                       __stability::LAZY;
           if (_DAT_00c3cbe0 != 4) {
             local_58[0] = &local_78;
             local_78 = (undefined1 *)&local_98;
             std::sys_common::once::futex::Once::call(&DAT_00c3cbe0,0,local_58,&DAT_00bbeff8);
           }
           puVar1 = local_98;
           (**(code **)*local_98)(&local_98,local_98 + 3,local_98[1],local_98[2]);
                           /* try { // try from 0038c8ef to 0038c8f8 has its CatchHandler @ 0038c9a8 */
           (**(code **)puVar1[4])(&local_78,puVar1 + 7,puVar1[5],puVar1[6]);
         }
         else {
           if (param_2 != '\x01') {
             *param_1 = 0;
             return param_1;
           }
           local_98 = &_<rgbpp_indexer::chain::TESTNET_XUDT_SCRIPT_as_core::ops::deref::Deref>::deref::
                       __stability::LAZY;
           if (_DAT_00c3cb50 != 4) {
             local_58[0] = &local_78;
       // ... [truncated]
    */
    pub fn xudt_script() { todo!() }
}
