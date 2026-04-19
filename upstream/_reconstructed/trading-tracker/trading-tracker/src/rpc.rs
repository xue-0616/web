// Auto-generated skeleton reconstructed from ELF symbols.
// This is **NOT** the original source — it is a structural approximation.
// Every `todo!()` body hides the original logic. Use this to:
//   * understand module layout and public API surface,
//   * seed a greenfield re-implementation,
//   * drive binary-diffing with the deployed ELF.
//
// Source: backend-bin/trading-tracker/trading-tracker
// Tool:   upstream/_reconstruct.py
#![allow(unused, non_snake_case, non_camel_case_types, dead_code)]


/// RE: <trading_tracker::rpc::TradingTrackerServer as trading_tracker::rpc::TradingTrackerRpcServer>::subscribe_token_price
// enriched: ---
// calls:
//   - subscribe_token_price::___closure__
// enriched: ---
/* ghidra: 0x003749c0  sig=void __rustcall _<trading_tracker::rpc::TradingTrackerServer_as_trading_tracker::rpc::TradingTrackerRpcServer>::subscribe_token_price::_{{closure}}(undefined8 param_1,long param_2);
   
   /* _<trading_tracker::rpc::TradingTrackerServer as
      trading_tracker::rpc::TradingTrackerRpcServer>::subscribe_token_price::_{{closure}} */
   
   void __rustcall
   _<trading_tracker::rpc::TradingTrackerServer_as_trading_tracker::rpc::TradingTrackerRpcServer>::
   subscribe_token_price::___closure__(undefined8 param_1,long param_2)
   
   {
                       /* WARNING: Could not recover jumptable at 0x00374a02. Too many branches */
                       /* WARNING: Treating indirect jump as call */
     (*(code *)(&DAT_00e6f5c0 + *(int *)(&DAT_00e6f5c0 + (ulong)*(byte *)(param_2 + 0x168) * 4)))();
     return;
   }
   
*/
pub struct TradingTrackerRpcServer;
pub mod impl_tradingtrackerrpcserver {
    /// RE: trading_tracker::rpc::TradingTrackerRpcServer::into_rpc
    // enriched: ---
    // calls:
    //   - trading_tracker::rpc::TradingTrackerRpcServer::into_rpc
    //   - jsonrpsee_core::server::rpc_module::Methods::verify_and_insert
    //   - jsonrpsee_core::server::rpc_module::Methods::verify_method_name
    //   - jsonrpsee_core::server::rpc_module::Methods::mut_callbacks
    //   - hashbrown::raw::RawTable<T,A>::reserve_rehash
    // enriched: ---
    /* ghidra: 0x0032ff70  sig=undefined8 * __rustcall trading_tracker::rpc::TradingTrackerRpcServer::into_rpc(undefined8 *param_1,undefined8 param_2);
       
       /* trading_tracker::rpc::TradingTrackerRpcServer::into_rpc */
       
       undefined8 * __rustcall
       trading_tracker::rpc::TradingTrackerRpcServer::into_rpc(undefined8 *param_1,undefined8 param_2)
       
       {
         char *pcVar1;
         long lVar2;
         undefined1 (*pauVar3) [16];
         ulong uVar4;
         undefined8 uVar5;
         code *pcVar6;
         uint uVar7;
         undefined1 auVar8 [16];
         undefined4 uVar9;
         byte bVar10;
         ushort uVar11;
         uint uVar12;
         int iVar13;
         long *plVar14;
         undefined8 *puVar15;
         ulong uVar16;
         ulong uVar17;
         uint uVar18;
         undefined1 auVar19 [16];
         undefined1 auVar20 [16];
         long local_f8;
         long *plStack_f0;
         int local_e8;
         undefined4 uStack_e4;
         undefined4 uStack_e0;
         undefined4 uStack_dc;
         undefined4 local_d8;
         undefined4 uStack_d4;
         undefined4 uStack_d0;
         undefined4 uStack_cc;
         undefined1 local_c8;
         undefined7 uStack_c7;
         int local_c0;
       // ... [truncated]
    */
    pub fn into_rpc() { todo!() }
}
