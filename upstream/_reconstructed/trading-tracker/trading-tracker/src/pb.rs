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


pub mod sf {
    pub mod substreams {
        pub mod rpc {
            pub mod v2 {
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::BlockRange as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::rpc::v2::BlockRange_as_prost::message::Message>::merge_field
                //   - prost::encoding::varint::decode_varint
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x0034af00  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::BlockRange_as_prost::message::Message>::merge_field(long *param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::BlockRange as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::BlockRange_as_prost::message::Message>::merge_field
                             (long *param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     long lVar1;
                     undefined1 auVar2 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     if ((int)param_2 == 2) {
                       local_7a = 0;
                       if (param_3 == '\0') {
                         auVar2 = prost::encoding::varint::decode_varint(param_4);
                         local_78 = auVar2._8_8_;
                         if (auVar2._0_8_ == 0) {
                           *param_1 = (long)local_78;
                           return (undefined1 *)0;
                         }
                         if (local_78 == (undefined1 *)0x0) {
                           return (undefined1 *)0;
                         }
                       }
                       else {
                         local_48 = &local_79;
                   // ... [truncated]
                */
                pub struct BlockRange;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::BlockScopedData as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::error::DecodeError::new
                //   - prost::encoding::merge_loop
                //   - prost::error::DecodeError::push
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::encoding::varint::decode_varint
                //   - prost::encoding::skip_field
                //   - prost::encoding::message::merge_repeated
                // enriched: ---
                /* ghidra: 0x00347fb0  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::BlockScopedData_as_prost::message::Message>::merge_field(int *param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::BlockScopedData as
                      prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::BlockScopedData_as_prost::message::Message>::
                   merge_field(int *param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     char **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     switch((int)param_2) {
                     case 1:
                       if (SBORROW8(0,*(long *)(param_1 + 0x20))) {
                         param_1[0x20] = 0;
                         param_1[0x21] = 0;
                         param_1[0x22] = 1;
                         param_1[0x23] = 0;
                         param_1[0x24] = 0;
                         param_1[0x25] = 0;
                         param_1[0x26] = 0;
                         param_1[0x27] = -0x80000000;
                         param_1[0x32] = 0;
                         param_1[0x33] = -0x80000000;
                       }
                   // ... [truncated]
                */
                pub struct BlockScopedData;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::BlockUndoSignal as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::error::DecodeError::new
                //   - prost::encoding::merge_loop
                //   - prost::error::DecodeError::push
                //   - prost::encoding::skip_field
                //   - prost::encoding::bytes::merge_one_copy
                // enriched: ---
                /* ghidra: 0x00347dc0  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::BlockUndoSignal_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::BlockUndoSignal as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::BlockUndoSignal_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     if ((int)param_2 == 1) {
                       if (SBORROW8(0,*(long *)(param_1 + 0x18))) {
                         *(undefined8 *)(param_1 + 0x18) = 0;
                         *(undefined8 *)(param_1 + 0x20) = 1;
                         *(undefined8 *)(param_1 + 0x28) = 0;
                         *(undefined8 *)(param_1 + 0x30) = 0;
                       }
                       local_7a = 2;
                       local_79 = param_3;
                       if (param_3 == '\x02') {
                         if (param_5 == 0) {
                           local_78 = (undefined1 *)prost::error::DecodeError::new("recursion limit reached",0x17);
                         }
                         else {
                           local_78 = (undefined1 *)prost::encoding::merge_loop(param_1 + 0x18,param_4,param_5 + -1);
                           if (local_78 == (undefined1 *)0x0) {
                   // ... [truncated]
                */
                pub struct BlockUndoSignal;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::Error as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::rpc::v2::Error_as_prost::message::Message>::merge_field
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::string::merge_repeated
                //   - prost::encoding::varint::decode_varint
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x003497d0  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::Error_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::Error as prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::Error_as_prost::message::Message>::merge_field
                             (long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     char **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     switch((int)param_2) {
                     case 1:
                                       /* try { // try from 003497f6 to 0034983a has its CatchHandler @ 00349a5d */
                       puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                       if (puVar1 == (undefined1 *)0x0) {
                         core::str::converts::from_utf8
                                   (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                         if (((ulong)local_78 & 1) == 0) {
                           return 0;
                         }
                         puVar1 = (undefined1 *)
                                  prost::error::DecodeError::new
                                            ("invalid string value: data is not UTF-8 encoded",0x2f);
                       }
                       *(undefined8 *)(param_1 + 0x10) = 0;
                                       /* try { // try from 00349848 to 0034986b has its CatchHandler @ 00349a38 */
                   // ... [truncated]
                */
                pub struct Error;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::ExternalCallMetric as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::varint::decode_varint
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x0034a930  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::ExternalCallMetric_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::ExternalCallMetric as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::ExternalCallMetric_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     int iVar3;
                     undefined1 auVar4 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     iVar3 = (int)param_2;
                     if (iVar3 == 1) {
                                       /* try { // try from 0034aa00 to 0034aa40 has its CatchHandler @ 0034abb3 */
                       puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                       if (puVar1 == (undefined1 *)0x0) {
                         core::str::converts::from_utf8
                                   (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                         if (((ulong)local_78 & 1) == 0) {
                           return (undefined1 *)0;
                         }
                         puVar1 = (undefined1 *)
                                  prost::error::DecodeError::new
                                            ("invalid string value: data is not UTF-8 encoded",0x2f);
                       }
                   // ... [truncated]
                */
                pub struct ExternalCallMetric;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotComplete as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::skip_field
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                // enriched: ---
                /* ghidra: 0x003487d0  sig=ulong __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotComplete_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotComplete as
                      prost::message::Message>::merge_field */
                   
                   ulong __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotComplete_as_prost::message::Message>
                   ::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,
                                undefined4 param_5)
                   
                   {
                     ulong uVar1;
                     long lVar2;
                     ulong local_28 [3];
                     
                     if ((int)param_2 != 1) {
                       lVar2 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                       return lVar2;
                     }
                                       /* try { // try from 003487dc to 0034881c has its CatchHandler @ 0034888a */
                     uVar1 = prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                     if (uVar1 == 0) {
                       core::str::converts::from_utf8
                                 (local_28,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                       if ((local_28[0] & 1) == 0) {
                         return 0;
                       }
                       uVar1 = prost::error::DecodeError::new("invalid string value: data is not UTF-8 encoded",0x2f);
                     }
                     *(undefined8 *)(param_1 + 0x10) = 0;
                     local_28[0] = uVar1;
                                       /* try { // try from 00348829 to 0034884a has its CatchHandler @ 00348876 */
                     prost::error::DecodeError::push(local_28,"InitialSnapshotComplete",0x17,"cursor",6);
                     return local_28[0];
                   }
                   
                */
                pub struct InitialSnapshotComplete;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotData as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::message::merge_repeated
                //   - prost::encoding::varint::decode_varint
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x003488a0  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotData_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotData as
                      prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::InitialSnapshotData_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     char **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     switch((int)param_2) {
                     case 1:
                                       /* try { // try from 003488c6 to 0034890a has its CatchHandler @ 00348b76 */
                       puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                       if (puVar1 == (undefined1 *)0x0) {
                         core::str::converts::from_utf8
                                   (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                         if (((ulong)local_78 & 1) == 0) {
                           return 0;
                         }
                         puVar1 = (undefined1 *)
                                  prost::error::DecodeError::new
                                            ("invalid string value: data is not UTF-8 encoded",0x2f);
                       }
                   // ... [truncated]
                */
                pub struct InitialSnapshotData;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::Job as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::rpc::v2::Job_as_prost::message::Message>::merge_field
                //   - prost::encoding::uint32::merge
                //   - prost::error::DecodeError::push
                //   - prost::encoding::varint::decode_varint
                //   - prost::error::DecodeError::new
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x00349a70  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::Job_as_prost::message::Message>::merge_field(long *param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::Job as prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::Job_as_prost::message::Message>::merge_field
                             (long *param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     long lVar1;
                     undefined1 auVar2 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     char **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     switch((int)param_2) {
                     case 1:
                       local_78 = (undefined1 *)prost::encoding::uint32::merge(param_3,param_1 + 4,param_4,param_5);
                       if (local_78 == (undefined1 *)0x0) {
                         return 0;
                       }
                                       /* try { // try from 00349ab9 to 00349adf has its CatchHandler @ 00349e72 */
                       prost::error::DecodeError::push(&local_78,"Job",3,"stage",5);
                       break;
                     case 2:
                       local_7a = 0;
                       if (param_3 == '\0') {
                         auVar2 = prost::encoding::varint::decode_varint(param_4);
                         local_78 = auVar2._8_8_;
                         if (auVar2._0_8_ == 0) {
                           *param_1 = (long)local_78;
                   // ... [truncated]
                */
                pub struct Job;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::MapModuleOutput as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::merge_loop
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x00348b90  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::MapModuleOutput_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::MapModuleOutput as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::MapModuleOutput_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     int iVar3;
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     iVar3 = (int)param_2;
                     if (iVar3 == 1) {
                                       /* try { // try from 00348cd5 to 00348d15 has its CatchHandler @ 00348ea4 */
                       puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                       if (puVar1 == (undefined1 *)0x0) {
                         core::str::converts::from_utf8
                                   (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                         if (((ulong)local_78 & 1) == 0) {
                           return (undefined1 *)0;
                         }
                         puVar1 = (undefined1 *)
                                  prost::error::DecodeError::new
                                            ("invalid string value: data is not UTF-8 encoded",0x2f);
                       }
                       *(undefined8 *)(param_1 + 0x10) = 0;
                   // ... [truncated]
                */
                pub struct MapModuleOutput;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::ModuleStats as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::rpc::v2::ModuleStats_as_prost::message::Message>::merge_field
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::varint::decode_varint
                //   - prost::encoding::message::merge_repeated
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x00349f70  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::ModuleStats_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::ModuleStats as
                      prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::ModuleStats_as_prost::message::Message>::merge_field
                             (long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     char **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     switch((int)param_2) {
                     case 1:
                                       /* try { // try from 00349f96 to 00349fda has its CatchHandler @ 0034a91d */
                       puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                       if (puVar1 == (undefined1 *)0x0) {
                         core::str::converts::from_utf8
                                   (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                         if (((ulong)local_78 & 1) == 0) {
                           return 0;
                         }
                         puVar1 = (undefined1 *)
                                  prost::error::DecodeError::new
                                            ("invalid string value: data is not UTF-8 encoded",0x2f);
                       }
                   // ... [truncated]
                */
                pub struct ModuleStats;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::ModulesProgress as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::message::merge_repeated
                //   - prost::error::DecodeError::push
                //   - prost::error::DecodeError::new
                //   - prost::encoding::merge_loop
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x00349370  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::ModulesProgress_as_prost::message::Message>::merge_field(byte *param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::ModulesProgress as
                      prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::ModulesProgress_as_prost::message::Message>::
                   merge_field(byte *param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5)
                   
                   {
                     long lVar1;
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     switch((int)param_2) {
                     case 2:
                       local_78 = (undefined1 *)
                                  prost::encoding::message::merge_repeated(param_3,param_1 + 0x18,param_4,param_5);
                       if (local_78 == (undefined1 *)0x0) {
                         return 0;
                       }
                                       /* try { // try from 003493b8 to 003493de has its CatchHandler @ 003495ae */
                       prost::error::DecodeError::push(&local_78,"ModulesProgress",0xf,"running_jobs",0xc);
                       break;
                     case 3:
                       local_78 = (undefined1 *)
                                  prost::encoding::message::merge_repeated(param_3,param_1 + 0x30,param_4,param_5);
                       if (local_78 == (undefined1 *)0x0) {
                         return 0;
                       }
                                       /* try { // try from 003494cd to 003494f3 has its CatchHandler @ 003495ac */
                   // ... [truncated]
                */
                pub struct ModulesProgress;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::OutputDebugInfo as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::string::merge_repeated
                //   - prost::error::DecodeError::push
                //   - prost::encoding::varint::decode_varint
                //   - prost::error::DecodeError::new
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x00349110  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::OutputDebugInfo_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::OutputDebugInfo as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::OutputDebugInfo_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     long lVar1;
                     int iVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     iVar2 = (int)param_2;
                     if (iVar2 == 1) {
                       local_78 = (undefined1 *)
                                  prost::encoding::string::merge_repeated(param_3,param_1,param_4,param_5);
                       if (local_78 == (undefined1 *)0x0) {
                         return (undefined1 *)0;
                       }
                                       /* try { // try from 00349201 to 00349227 has its CatchHandler @ 0034935a */
                       prost::error::DecodeError::push(&local_78,"OutputDebugInfo",0xf,"logs",4);
                     }
                     else {
                       local_79 = param_3;
                       if (iVar2 == 2) {
                         local_7a = 0;
                         if (param_3 == '\0') {
                   // ... [truncated]
                */
                pub struct OutputDebugInfo;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::ProcessedBytes as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::varint::decode_varint
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x003495d0  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::ProcessedBytes_as_prost::message::Message>::merge_field(long *param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::ProcessedBytes as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::ProcessedBytes_as_prost::message::Message>::
                   merge_field(long *param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     long lVar1;
                     undefined1 auVar2 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     if ((int)param_2 == 1) {
                       local_7a = 0;
                       if (param_3 == '\0') {
                         auVar2 = prost::encoding::varint::decode_varint(param_4);
                         local_78 = auVar2._8_8_;
                         if (auVar2._0_8_ == 0) {
                           *param_1 = (long)local_78;
                           return (undefined1 *)0;
                         }
                         if (local_78 == (undefined1 *)0x0) {
                           return (undefined1 *)0;
                         }
                       }
                       else {
                         local_48 = &local_79;
                   // ... [truncated]
                */
                pub struct ProcessedBytes;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::SessionInit as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::rpc::v2::SessionInit_as_prost::message::Message>::merge_field
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::varint::decode_varint
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x00348460  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::SessionInit_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::SessionInit as
                      prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::SessionInit_as_prost::message::Message>::merge_field
                             (long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     char **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     switch((int)param_2) {
                     case 1:
                                       /* try { // try from 00348486 to 003484ca has its CatchHandler @ 003487be */
                       puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                       if (puVar1 == (undefined1 *)0x0) {
                         core::str::converts::from_utf8
                                   (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                         if (((ulong)local_78 & 1) == 0) {
                           return 0;
                         }
                         puVar1 = (undefined1 *)
                                  prost::error::DecodeError::new
                                            ("invalid string value: data is not UTF-8 encoded",0x2f);
                       }
                   // ... [truncated]
                */
                pub struct SessionInit;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::Stage as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::rpc::v2::Stage_as_prost::message::Message>::merge_field
                //   - prost::encoding::string::merge_repeated
                //   - prost::error::DecodeError::push
                //   - prost::encoding::skip_field
                //   - prost::encoding::message::merge_repeated
                // enriched: ---
                /* ghidra: 0x00349e90  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::Stage_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::Stage as prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::Stage_as_prost::message::Message>::merge_field
                             (long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     long lVar1;
                     long local_18;
                     
                     if ((int)param_2 == 1) {
                       local_18 = prost::encoding::string::merge_repeated(param_3,param_1,param_4,param_5);
                       if (local_18 == 0) {
                         return 0;
                       }
                                       /* try { // try from 00349f08 to 00349f2c has its CatchHandler @ 00349f58 */
                       prost::error::DecodeError::push(&local_18,"Stage",5,"modules",7);
                     }
                     else {
                       if ((int)param_2 != 2) {
                         lVar1 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                         return lVar1;
                       }
                       local_18 = prost::encoding::message::merge_repeated(param_3,param_1 + 0x18,param_4,param_5);
                       if (local_18 == 0) {
                         return 0;
                       }
                                       /* try { // try from 00349ec7 to 00349eeb has its CatchHandler @ 00349f5a */
                       prost::error::DecodeError::push
                                 (&local_18,"Stage",5,
                                  anon_8d1c46df56195978272831eefbf6c1e0_224_llvm_17189013856288145710,0x10);
                     }
                     return local_18;
                   }
                   
                */
                pub struct Stage;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::StoreDelta as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::rpc::v2::StoreDelta_as_prost::message::Message>::merge_field
                //   - prost::encoding::varint::decode_varint
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::encoding::bytes::merge
                //   - prost::encoding::skip_field
                // enriched: ---
                /* ghidra: 0x0034abd0  sig=long __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::StoreDelta_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::StoreDelta as
                      prost::message::Message>::merge_field */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::StoreDelta_as_prost::message::Message>::merge_field
                             (long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     char **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     local_79 = param_3;
                     switch((int)param_2) {
                     case 1:
                       local_7a = 0;
                       if (param_3 == '\0') {
                         auVar3 = prost::encoding::varint::decode_varint(param_4);
                         local_78 = auVar3._8_8_;
                         if (auVar3._0_8_ == 0) {
                           *(int *)(param_1 + 0x50) = auVar3._8_4_;
                           return 0;
                         }
                         if (local_78 == (undefined1 *)0x0) {
                           return 0;
                         }
                       }
                   // ... [truncated]
                */
                pub struct StoreDelta;
                /// RE: <trading_tracker::pb::sf::substreams::rpc::v2::StoreModuleOutput as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::message::merge_repeated
                //   - prost::encoding::skip_field
                //   - prost::encoding::merge_loop
                // enriched: ---
                /* ghidra: 0x00348ec0  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::rpc::v2::StoreModuleOutput_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::rpc::v2::StoreModuleOutput as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::rpc::v2::StoreModuleOutput_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     int iVar3;
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     iVar3 = (int)param_2;
                     if (iVar3 == 1) {
                                       /* try { // try from 00348fbb to 00348ffb has its CatchHandler @ 003490fe */
                       puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                       if (puVar1 == (undefined1 *)0x0) {
                         core::str::converts::from_utf8
                                   (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                         if (((ulong)local_78 & 1) == 0) {
                           return (undefined1 *)0;
                         }
                         puVar1 = (undefined1 *)
                                  prost::error::DecodeError::new
                                            ("invalid string value: data is not UTF-8 encoded",0x2f);
                       }
                       *(undefined8 *)(param_1 + 0x10) = 0;
                   // ... [truncated]
                */
                pub struct StoreModuleOutput;
                pub mod response {
                    pub mod impl_message {
                        /// RE: trading_tracker::pb::sf::substreams::rpc::v2::response::Message::merge
                        // enriched: ---
                        // calls:
                        //   - trading_tracker::pb::sf::substreams::rpc::v2::response::Message::merge
                        //   - prost::error::DecodeError::new
                        //   - prost::encoding::merge_loop
                        //   - drop_in_place<core::option::Option<trading_tracker::pb::sf::substreams::rpc::v2::response::Message>>
                        // enriched: ---
                        /* ghidra: 0x00373540  sig=long __rustcall trading_tracker::pb::sf::substreams::rpc::v2::response::Message::merge(long *param_1,undefined4 param_2,char param_3,undefined8 param_4,int param_5);
                           
                           /* WARNING: Type propagation algorithm not settling */
                           /* trading_tracker::pb::sf::substreams::rpc::v2::response::Message::merge */
                           
                           long __rustcall
                           trading_tracker::pb::sf::substreams::rpc::v2::response::Message::merge
                                     (long *param_1,undefined4 param_2,char param_3,undefined8 param_4,int param_5)
                           
                           {
                             char ****ppppcVar1;
                             code *pcVar2;
                             long lVar3;
                             long lVar4;
                             ulong uVar5;
                             long lVar6;
                             long lVar7;
                             long lVar8;
                             undefined8 *puVar9;
                             undefined1 local_332 [2];
                             undefined1 ****local_330;
                             code *pcStack_328;
                             long local_320;
                             undefined1 ****local_318;
                             code *pcStack_310;
                             undefined1 *****local_308;
                             code *pcStack_300;
                             long local_2f8;
                             undefined4 uStack_2f0;
                             undefined4 uStack_2ec;
                             long local_2e8;
                             undefined4 uStack_2e0;
                             undefined4 uStack_2dc;
                             long *local_2d8;
                             ulong uStack_2d0;
                             undefined4 local_2c8;
                             undefined4 uStack_2c4;
                             undefined4 uStack_2c0;
                             undefined4 uStack_2bc;
                             long *local_2b8;
                             long *local_228;
                           // ... [truncated]
                        */
                        pub fn merge() { todo!() }
                    }
                }
            }
        }
        pub mod v1 {
            /// RE: <trading_tracker::pb::sf::substreams::v1::Binary as prost::message::Message>::encode_raw
            // enriched: ---
            // calls:
            //   - _<trading_tracker::pb::sf::substreams::v1::Binary_as_prost::message::Message>::encode_raw
            //   - prost::encoding::varint::encode_varint
            //   - _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice
            //   - bytes::bytes_mut::BytesMut::reserve_inner
            //   - bytes::panic_advance
            //   - prost::encoding::message::encode
            // enriched: ---
            /* ghidra: 0x0034b210  sig=void __rustcall _<trading_tracker::pb::sf::substreams::v1::Binary_as_prost::message::Message>::encode_raw(long param_1,long *param_2);
               
               /* _<trading_tracker::pb::sf::substreams::v1::Binary as prost::message::Message>::encode_raw */
               
               void __rustcall
               _<trading_tracker::pb::sf::substreams::v1::Binary_as_prost::message::Message>::encode_raw
                         (long param_1,long *param_2)
               
               {
                 int iVar1;
                 undefined8 uVar2;
                 void *__src;
                 undefined8 uVar3;
                 ulong uVar4;
                 long lVar5;
                 ulong uVar6;
                 undefined8 *puVar7;
                 undefined8 *__n;
                 long lVar8;
                 
                 lVar5 = *(long *)(param_1 + 0x10);
                 if (lVar5 != 0) {
                   uVar2 = *(undefined8 *)(param_1 + 8);
                   lVar8 = *param_2;
                   prost::encoding::varint::encode_varint(10,lVar8);
                   prost::encoding::varint::encode_varint(lVar5,lVar8);
                   _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice(lVar8,uVar2,lVar5);
                 }
                 __n = *(undefined8 **)(param_1 + 0x28);
                 if (__n == (undefined8 *)0x0) {
                   return;
                 }
                 __src = *(void **)(param_1 + 0x20);
                 param_2 = (long *)*param_2;
                 prost::encoding::varint::encode_varint(0x12,param_2);
                 prost::encoding::varint::encode_varint(__n,param_2);
                 lVar5 = param_2[1];
                 if ((undefined8 *)(param_2[2] - lVar5) < __n) {
                   bytes::bytes_mut::BytesMut::reserve_inner(param_2,__n,1);
                   lVar5 = param_2[1];
                 }
               // ... [truncated]
            */
            pub struct Binary;
            /// RE: <trading_tracker::pb::sf::substreams::v1::BlockRef as prost::message::Message>::merge_field
            // enriched: ---
            // calls:
            //   - _<trading_tracker::pb::sf::substreams::v1::BlockRef_as_prost::message::Message>::merge_field
            //   - prost::encoding::bytes::merge_one_copy
            //   - prost::error::DecodeError::new
            //   - prost::error::DecodeError::push
            //   - prost::encoding::skip_field
            //   - prost::encoding::varint::decode_varint
            // enriched: ---
            /* ghidra: 0x0034b820  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::v1::BlockRef_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
               
               /* _<trading_tracker::pb::sf::substreams::v1::BlockRef as prost::message::Message>::merge_field */
               
               undefined1 * __rustcall
               _<trading_tracker::pb::sf::substreams::v1::BlockRef_as_prost::message::Message>::merge_field
                         (long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
               
               {
                 undefined1 *puVar1;
                 long lVar2;
                 undefined1 auVar3 [16];
                 undefined1 local_7a;
                 char local_79;
                 undefined1 *local_78;
                 undefined8 local_70;
                 undefined1 **local_68;
                 undefined8 local_60;
                 undefined8 local_58;
                 char *local_48;
                 code *local_40;
                 undefined1 *local_38;
                 code *local_30;
                 undefined1 local_28 [24];
                 
                 if ((int)param_2 == 1) {
                                   /* try { // try from 0034b88e to 0034b8ce has its CatchHandler @ 0034b9c0 */
                   puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                   if (puVar1 == (undefined1 *)0x0) {
                     core::str::converts::from_utf8
                               (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                     if (((ulong)local_78 & 1) == 0) {
                       return (undefined1 *)0;
                     }
                     puVar1 = (undefined1 *)
                              prost::error::DecodeError::new
                                        ("invalid string value: data is not UTF-8 encoded",0x2f);
                   }
                   *(undefined8 *)(param_1 + 0x10) = 0;
                                   /* try { // try from 0034b8dc to 0034b8ff has its CatchHandler @ 0034b9ab */
                   local_78 = puVar1;
               // ... [truncated]
            */
            pub struct BlockRef;
            /// RE: <trading_tracker::pb::sf::substreams::v1::Clock as prost::message::Message>::merge_field
            // enriched: ---
            // calls:
            //   - _<trading_tracker::pb::sf::substreams::v1::Clock_as_prost::message::Message>::merge_field
            //   - prost::encoding::bytes::merge_one_copy
            //   - prost::error::DecodeError::new
            //   - prost::error::DecodeError::push
            //   - prost::encoding::varint::decode_varint
            //   - prost::encoding::skip_field
            //   - prost::encoding::merge_loop
            // enriched: ---
            /* ghidra: 0x0034b550  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::v1::Clock_as_prost::message::Message>::merge_field(byte *param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5);
               
               /* _<trading_tracker::pb::sf::substreams::v1::Clock as prost::message::Message>::merge_field */
               
               undefined1 * __rustcall
               _<trading_tracker::pb::sf::substreams::v1::Clock_as_prost::message::Message>::merge_field
                         (byte *param_1,undefined8 param_2,char param_3,undefined8 param_4,int param_5)
               
               {
                 undefined1 *puVar1;
                 long lVar2;
                 int iVar3;
                 undefined1 auVar4 [16];
                 undefined1 local_7a;
                 char local_79;
                 undefined1 *local_78;
                 undefined8 local_70;
                 undefined1 **local_68;
                 undefined8 local_60;
                 undefined8 local_58;
                 char *local_48;
                 code *local_40;
                 undefined1 *local_38;
                 code *local_30;
                 undefined1 local_28 [24];
                 
                 iVar3 = (int)param_2;
                 if (iVar3 == 1) {
                                   /* try { // try from 0034b651 to 0034b68e has its CatchHandler @ 0034b80e */
                   puVar1 = (undefined1 *)
                            prost::encoding::bytes::merge_one_copy(param_3,param_1 + 0x18,param_4,param_5);
                   if (puVar1 == (undefined1 *)0x0) {
                     core::str::converts::from_utf8
                               (&local_78,*(undefined8 *)(param_1 + 0x20),*(undefined8 *)(param_1 + 0x28));
                     if (((ulong)local_78 & 1) == 0) {
                       return (undefined1 *)0;
                     }
                     puVar1 = (undefined1 *)
                              prost::error::DecodeError::new
                                        ("invalid string value: data is not UTF-8 encoded",0x2f);
                   }
               // ... [truncated]
            */
            pub struct Clock;
            /// RE: <trading_tracker::pb::sf::substreams::v1::Module as prost::message::Message>::encode_raw
            // enriched: ---
            // calls:
            //   - _<trading_tracker::pb::sf::substreams::v1::Module_as_prost::message::Message>::encode_raw
            //   - prost::encoding::varint::encode_varint
            //   - _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice
            //   - prost::encoding::message::encode
            // enriched: ---
            /* ghidra: 0x0034b2e0  sig=void __rustcall _<trading_tracker::pb::sf::substreams::v1::Module_as_prost::message::Message>::encode_raw(long param_1,undefined8 *param_2);
               
               /* _<trading_tracker::pb::sf::substreams::v1::Module as prost::message::Message>::encode_raw */
               
               void __rustcall
               _<trading_tracker::pb::sf::substreams::v1::Module_as_prost::message::Message>::encode_raw
                         (long param_1,undefined8 *param_2)
               
               {
                 int iVar1;
                 undefined8 uVar2;
                 undefined8 uVar3;
                 ulong uVar4;
                 long lVar5;
                 ulong uVar6;
                 long lVar7;
                 
                 lVar5 = *(long *)(param_1 + 0x10);
                 if (lVar5 != 0) {
                   uVar2 = *(undefined8 *)(param_1 + 8);
                   uVar3 = *param_2;
                   prost::encoding::varint::encode_varint(10,uVar3);
                   prost::encoding::varint::encode_varint(lVar5,uVar3);
                   _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice(uVar3,uVar2,lVar5);
                 }
                 if (*(ulong *)(param_1 + 0x90) != 0x8000000000000003) {
                   uVar4 = *(ulong *)(param_1 + 0x90) ^ 0x8000000000000000;
                   uVar6 = 1;
                   if (uVar4 < 3) {
                     uVar6 = uVar4;
                   }
                   if (uVar6 != 0) {
                     if (uVar6 == 1) {
                       prost::encoding::message::encode(3,param_1 + 0x90,param_2);
                       iVar1 = *(int *)(param_1 + 0xb8);
                     }
                     else {
                       prost::encoding::message::encode(10,param_1 + 0x98,param_2);
                       iVar1 = *(int *)(param_1 + 0xb8);
                     }
                     goto joined_r0x0034b4fc;
               // ... [truncated]
            */
            pub struct Module;
            /// RE: <trading_tracker::pb::sf::substreams::v1::Modules as prost::message::Message>::encode_raw
            // enriched: ---
            // calls:
            //   - _<trading_tracker::pb::sf::substreams::v1::Modules_as_prost::message::Message>::encode_raw
            //   - prost::encoding::message::encode
            //   - prost::encoding::varint::encode_varint
            //   - _<trading_tracker::pb::sf::substreams::v1::Binary_as_prost::message::Message>::encode_raw
            // enriched: ---
            /* ghidra: 0x0034b100  sig=void __rustcall _<trading_tracker::pb::sf::substreams::v1::Modules_as_prost::message::Message>::encode_raw(long param_1,undefined8 *param_2);
               
               /* _<trading_tracker::pb::sf::substreams::v1::Modules as prost::message::Message>::encode_raw */
               
               void __rustcall
               _<trading_tracker::pb::sf::substreams::v1::Modules_as_prost::message::Message>::encode_raw
                         (long param_1,undefined8 *param_2)
               
               {
                 undefined8 uVar1;
                 long lVar2;
                 ulong uVar3;
                 long lVar4;
                 long lVar5;
                 long lVar6;
                 
                 if (*(long *)(param_1 + 0x10) != 0) {
                   lVar6 = *(long *)(param_1 + 0x10) * 0xc0;
                   lVar4 = *(long *)(param_1 + 8);
                   do {
                     prost::encoding::message::encode(1,lVar4,param_2);
                     lVar6 = lVar6 + -0xc0;
                     lVar4 = lVar4 + 0xc0;
                   } while (lVar6 != 0);
                 }
                 if (*(long *)(param_1 + 0x28) != 0) {
                   lVar6 = *(long *)(param_1 + 0x28) * 0x30;
                   lVar4 = *(long *)(param_1 + 0x20);
                   do {
                     uVar1 = *param_2;
                     prost::encoding::varint::encode_varint(0x12,uVar1);
                     uVar3 = *(ulong *)(lVar4 + 0x10);
                     if (uVar3 == 0) {
                       lVar2 = 0;
                       uVar3 = *(ulong *)(lVar4 + 0x28);
                       if (uVar3 == 0) goto LAB_0034b1ff;
               LAB_0034b170:
                       lVar5 = 0x3f;
                       if ((uVar3 | 1) != 0) {
                         for (; (uVar3 | 1) >> lVar5 == 0; lVar5 = lVar5 + -1) {
                         }
               // ... [truncated]
            */
            pub struct Modules;
            /// RE: <trading_tracker::pb::sf::substreams::v1::NetworkParams as core::default::Default>::default
            // enriched: ---
            // trait-hint: fn default() -> Self
            // calls:
            //   - _<trading_tracker::pb::sf::substreams::v1::NetworkParams_as_core::default::Default>::default
            // enriched: ---
            /* ghidra: 0x0034bcd0  sig=undefined8 * __rustcall _<trading_tracker::pb::sf::substreams::v1::NetworkParams_as_core::default::Default>::default(undefined8 *param_1);
               
               /* _<trading_tracker::pb::sf::substreams::v1::NetworkParams as core::default::Default>::default */
               
               undefined8 * __rustcall
               _<trading_tracker::pb::sf::substreams::v1::NetworkParams_as_core::default::Default>::default
                         (undefined8 *param_1)
               
               {
                 undefined1 (*pauVar1) [16];
                 long lVar2;
                 long lVar3;
                 long lVar4;
                 undefined1 auVar5 [16];
                 long *in_FS_OFFSET;
                 undefined1 auVar6 [16];
                 undefined1 auVar7 [16];
                 
                 lVar3 = *(long *)(*in_FS_OFFSET + -0x20);
                 if (lVar3 == 0) {
                   auVar7 = std::sys::random::linux::hashmap_random_keys();
                   lVar2 = *in_FS_OFFSET;
                   *(undefined8 *)(lVar2 + -0x20) = 1;
                   *(long *)(lVar2 + -0x10) = auVar7._8_8_;
                   lVar3 = auVar7._0_8_ + 1;
                   auVar6._8_8_ = auVar7._8_8_;
                   auVar6._0_8_ = lVar3;
                   *(long *)(lVar2 + -0x18) = lVar3;
                 }
                 else {
                   lVar4 = *in_FS_OFFSET;
                   pauVar1 = (undefined1 (*) [16])(lVar4 + -0x18);
                   auVar5 = *pauVar1;
                   auVar7 = *pauVar1;
                   lVar2 = *(long *)*pauVar1 + 1;
                   auVar6._8_8_ = *(undefined8 *)(lVar4 + -0x10);
                   auVar6._0_8_ = lVar2;
                   *(long *)(lVar4 + -0x18) = lVar2;
                   if (lVar3 == 0) {
                                   /* try { // try from 0034bd3c to 0034bd41 has its CatchHandler @ 0034be21 */
                     auVar6 = std::sys::random::linux::hashmap_random_keys();
               // ... [truncated]
            */
            pub struct NetworkParams;
            /// RE: <trading_tracker::pb::sf::substreams::v1::Package as core::default::Default>::default
            // enriched: ---
            // trait-hint: fn default() -> Self
            // calls:
            //   - _<trading_tracker::pb::sf::substreams::v1::Package_as_core::default::Default>::default
            // enriched: ---
            /* ghidra: 0x0034b9d0  sig=undefined8 * __rustcall _<trading_tracker::pb::sf::substreams::v1::Package_as_core::default::Default>::default(undefined8 *param_1);
               
               /* _<trading_tracker::pb::sf::substreams::v1::Package as core::default::Default>::default */
               
               undefined8 * __rustcall
               _<trading_tracker::pb::sf::substreams::v1::Package_as_core::default::Default>::default
                         (undefined8 *param_1)
               
               {
                 undefined1 (*pauVar1) [16];
                 long lVar2;
                 long lVar3;
                 undefined1 auVar4 [16];
                 long lVar5;
                 long *in_FS_OFFSET;
                 undefined1 auVar6 [16];
                 undefined1 auVar7 [16];
                 undefined8 uStack_78;
                 undefined8 local_70;
                 undefined8 uStack_68;
                 undefined8 local_60;
                 undefined8 uStack_58;
                 undefined8 uStack_48;
                 undefined8 local_40;
                 undefined8 uStack_38;
                 undefined8 local_30;
                 undefined8 uStack_28;
                 
                 lVar2 = *(long *)(*in_FS_OFFSET + -0x20);
                 if (lVar2 == 0) {
                                   /* try { // try from 0034bad4 to 0034bad9 has its CatchHandler @ 0034bc86 */
                   auVar7 = std::sys::random::linux::hashmap_random_keys();
                   lVar2 = *in_FS_OFFSET;
                   *(undefined8 *)(lVar2 + -0x20) = 1;
                   *(long *)(lVar2 + -0x10) = auVar7._8_8_;
                   lVar5 = auVar7._0_8_ + 1;
                   auVar6._8_8_ = auVar7._8_8_;
                   auVar6._0_8_ = lVar5;
                   *(long *)(lVar2 + -0x18) = lVar5;
                 }
                 else {
               // ... [truncated]
            */
            pub struct Package;
            pub mod module {
                /// RE: <trading_tracker::pb::sf::substreams::v1::module::BlockFilter as prost::message::Message>::encode_raw
                // enriched: ---
                // calls:
                //   - prost::encoding::varint::encode_varint
                //   - _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice
                // enriched: ---
                /* ghidra: 0x00388fd0  sig=void __rustcall _<trading_tracker::pb::sf::substreams::v1::module::BlockFilter_as_prost::message::Message>::encode_raw(long param_1,undefined8 *param_2);
                   
                   /* _<trading_tracker::pb::sf::substreams::v1::module::BlockFilter as
                      prost::message::Message>::encode_raw */
                   
                   void __rustcall
                   _<trading_tracker::pb::sf::substreams::v1::module::BlockFilter_as_prost::message::Message>::
                   encode_raw(long param_1,undefined8 *param_2)
                   
                   {
                     long lVar1;
                     undefined8 uVar2;
                     undefined8 uVar3;
                     undefined1 local_23;
                     undefined1 local_22;
                     undefined1 local_21;
                     
                     lVar1 = *(long *)(param_1 + 0x10);
                     if (lVar1 != 0) {
                       uVar2 = *param_2;
                       prost::encoding::varint::encode_varint(10,uVar2);
                       prost::encoding::varint::encode_varint(lVar1,uVar2);
                       _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice
                                 (uVar2,*(undefined8 *)(param_1 + 8),lVar1);
                     }
                     if (*(long *)(param_1 + 0x18) != -0x7fffffffffffffff) {
                       if (*(long *)(param_1 + 0x18) == -0x8000000000000000) {
                         uVar2 = *param_2;
                         _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice(uVar2,&local_23,1);
                         _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice(uVar2,&local_22,1);
                       }
                       else {
                         uVar2 = *param_2;
                         _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice(uVar2,&local_21,1);
                         uVar3 = *(undefined8 *)(param_1 + 0x28);
                         prost::encoding::varint::encode_varint(uVar3,uVar2);
                         _<bytes::bytes_mut::BytesMut_as_bytes::buf::buf_mut::BufMut>::put_slice
                                   (uVar2,*(undefined8 *)(param_1 + 0x20),uVar3);
                       }
                     }
                     return;
                   // ... [truncated]
                */
                pub struct BlockFilter;
                /// RE: <trading_tracker::pb::sf::substreams::v1::module::Input as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::v1::module::Input_as_prost::message::Message>::merge_field
                //   - prost::encoding::skip_field
                //   - prost::encoding::message::merge
                //   - prost::error::DecodeError::push
                // enriched: ---
                /* ghidra: 0x002b4c50  sig=long __rustcall _<trading_tracker::pb::sf::substreams::v1::module::Input_as_prost::message::Message>::merge_field(ulong *param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::v1::module::Input as prost::message::Message>::merge_field
                       */
                   
                   long __rustcall
                   _<trading_tracker::pb::sf::substreams::v1::module::Input_as_prost::message::Message>::merge_field
                             (ulong *param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,
                             undefined4 param_5)
                   
                   {
                     long lVar1;
                     long lVar2;
                     ulong uVar3;
                     ulong uVar4;
                     undefined8 local_58;
                     undefined8 uStack_50;
                     ulong local_48;
                     undefined4 uStack_40;
                     undefined4 uStack_3c;
                     undefined8 local_38;
                     undefined4 uStack_30;
                     undefined4 uStack_2c;
                     ulong local_28;
                     undefined4 uStack_20;
                     undefined4 uStack_1c;
                     
                     if (3 < (int)param_2 - 1U) {
                       lVar1 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                       return lVar1;
                     }
                     uVar3 = *param_1;
                     switch((int)param_2) {
                     case 1:
                       if (SBORROW8(0,uVar3)) {
                         lVar1 = prost::encoding::message::merge(param_3,param_1 + 1,param_4,param_5);
                         goto LAB_002b5027;
                       }
                       local_58 = 0;
                       uStack_50 = 1;
                       local_48 = 0;
                   // ... [truncated]
                */
                pub struct Input;
                /// RE: <trading_tracker::pb::sf::substreams::v1::module::KindBlockIndex as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::skip_field
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                // enriched: ---
                /* ghidra: 0x002ab8d0  sig=ulong __rustcall _<trading_tracker::pb::sf::substreams::v1::module::KindBlockIndex_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::v1::module::KindBlockIndex as
                      prost::message::Message>::merge_field */
                   
                   ulong __rustcall
                   _<trading_tracker::pb::sf::substreams::v1::module::KindBlockIndex_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5
                              )
                   
                   {
                     ulong uVar1;
                     long lVar2;
                     ulong local_28 [3];
                     
                     if ((int)param_2 != 1) {
                       lVar2 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                       return lVar2;
                     }
                                       /* try { // try from 002ab8dc to 002ab91c has its CatchHandler @ 002ab98a */
                     uVar1 = prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                     if (uVar1 == 0) {
                       core::str::converts::from_utf8
                                 (local_28,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                       if ((local_28[0] & 1) == 0) {
                         return 0;
                       }
                       uVar1 = prost::error::DecodeError::new
                                         (anon_3ed7d454aaf5088bb0893c09cd859f53_72_llvm_8940828269134358837,0x2f);
                     }
                     *(undefined8 *)(param_1 + 0x10) = 0;
                     local_28[0] = uVar1;
                                       /* try { // try from 002ab929 to 002ab94a has its CatchHandler @ 002ab976 */
                     prost::error::DecodeError::push(local_28,"KindBlockIndex",0xe,"output_type",0xb);
                     return local_28[0];
                   }
                   
                */
                pub struct KindBlockIndex;
                /// RE: <trading_tracker::pb::sf::substreams::v1::module::KindMap as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::v1::module::KindMap_as_prost::message::Message>::merge_field
                //   - prost::encoding::skip_field
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                // enriched: ---
                /* ghidra: 0x002aaef0  sig=ulong __rustcall _<trading_tracker::pb::sf::substreams::v1::module::KindMap_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::v1::module::KindMap as
                      prost::message::Message>::merge_field */
                   
                   ulong __rustcall
                   _<trading_tracker::pb::sf::substreams::v1::module::KindMap_as_prost::message::Message>::merge_field
                             (long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     ulong uVar1;
                     long lVar2;
                     ulong local_28 [3];
                     
                     if ((int)param_2 != 1) {
                       lVar2 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                       return lVar2;
                     }
                                       /* try { // try from 002aaefc to 002aaf3c has its CatchHandler @ 002aafaa */
                     uVar1 = prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                     if (uVar1 == 0) {
                       core::str::converts::from_utf8
                                 (local_28,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                       if ((local_28[0] & 1) == 0) {
                         return 0;
                       }
                       uVar1 = prost::error::DecodeError::new
                                         (anon_3ed7d454aaf5088bb0893c09cd859f53_72_llvm_8940828269134358837,0x2f);
                     }
                     *(undefined8 *)(param_1 + 0x10) = 0;
                     local_28[0] = uVar1;
                                       /* try { // try from 002aaf49 to 002aaf6a has its CatchHandler @ 002aaf96 */
                     prost::error::DecodeError::push(local_28,"KindMap",7,"output_type",0xb);
                     return local_28[0];
                   }
                   
                */
                pub struct KindMap;
                /// RE: <trading_tracker::pb::sf::substreams::v1::module::KindStore as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - prost::encoding::varint::decode_varint
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                //   - prost::encoding::skip_field
                //   - prost::encoding::bytes::merge_one_copy
                // enriched: ---
                /* ghidra: 0x002aafc0  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::v1::module::KindStore_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::v1::module::KindStore as
                      prost::message::Message>::merge_field */
                   
                   undefined1 * __rustcall
                   _<trading_tracker::pb::sf::substreams::v1::module::KindStore_as_prost::message::Message>::
                   merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     undefined1 *puVar1;
                     long lVar2;
                     undefined1 auVar3 [16];
                     undefined1 local_7a;
                     char local_79;
                     undefined1 *local_78;
                     undefined8 local_70;
                     undefined1 **local_68;
                     undefined8 local_60;
                     undefined8 local_58;
                     char *local_48;
                     code *local_40;
                     undefined1 *local_38;
                     code *local_30;
                     undefined1 local_28 [24];
                     
                     if ((int)param_2 == 1) {
                       local_7a = 0;
                       local_79 = param_3;
                       if (param_3 == '\0') {
                         auVar3 = prost::encoding::varint::decode_varint(param_4);
                         local_78 = auVar3._8_8_;
                         if (auVar3._0_8_ == 0) {
                           *(int *)(param_1 + 0x18) = auVar3._8_4_;
                           return (undefined1 *)0;
                         }
                         if (local_78 == (undefined1 *)0x0) {
                           return (undefined1 *)0;
                         }
                       }
                       else {
                   // ... [truncated]
                */
                pub struct KindStore;
                /// RE: <trading_tracker::pb::sf::substreams::v1::module::Output as prost::message::Message>::merge_field
                // enriched: ---
                // calls:
                //   - _<trading_tracker::pb::sf::substreams::v1::module::Output_as_prost::message::Message>::merge_field
                //   - prost::encoding::skip_field
                //   - prost::encoding::bytes::merge_one_copy
                //   - prost::error::DecodeError::new
                //   - prost::error::DecodeError::push
                // enriched: ---
                /* ghidra: 0x002b5800  sig=ulong __rustcall _<trading_tracker::pb::sf::substreams::v1::module::Output_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                   
                   /* _<trading_tracker::pb::sf::substreams::v1::module::Output as
                      prost::message::Message>::merge_field */
                   
                   ulong __rustcall
                   _<trading_tracker::pb::sf::substreams::v1::module::Output_as_prost::message::Message>::merge_field
                             (long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5)
                   
                   {
                     ulong uVar1;
                     long lVar2;
                     ulong local_28 [3];
                     
                     if ((int)param_2 != 1) {
                       lVar2 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                       return lVar2;
                     }
                                       /* try { // try from 002b580c to 002b584c has its CatchHandler @ 002b58ba */
                     uVar1 = prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                     if (uVar1 == 0) {
                       core::str::converts::from_utf8
                                 (local_28,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                       if ((local_28[0] & 1) == 0) {
                         return 0;
                       }
                       uVar1 = prost::error::DecodeError::new
                                         (anon_3ed7d454aaf5088bb0893c09cd859f53_72_llvm_8940828269134358837,0x2f);
                     }
                     *(undefined8 *)(param_1 + 0x10) = 0;
                     local_28[0] = uVar1;
                                       /* try { // try from 002b5859 to 002b587a has its CatchHandler @ 002b58a6 */
                     prost::error::DecodeError::push(local_28,"Output",6,"r#type",6);
                     return local_28[0];
                   }
                   
                */
                pub struct Output;
                pub mod impl_kind {
                    /// RE: trading_tracker::pb::sf::substreams::v1::module::Kind::merge
                    // enriched: ---
                    // calls:
                    //   - trading_tracker::pb::sf::substreams::v1::module::Kind::merge
                    //   - prost::encoding::message::merge
                    // strings:
                    //   - 'internal error entered unreacha'
                    // enriched: ---
                    /* ghidra: 0x002abc10  sig=long __rustcall trading_tracker::pb::sf::substreams::v1::module::Kind::merge(ulong *param_1,int param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                       
                       /* trading_tracker::pb::sf::substreams::v1::module::Kind::merge */
                       
                       long __rustcall
                       trading_tracker::pb::sf::substreams::v1::module::Kind::merge
                                 (ulong *param_1,int param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5)
                       
                       {
                         long lVar1;
                         ulong uVar2;
                         ulong uVar3;
                         ulong uVar4;
                         undefined **local_70;
                         code *pcStack_68;
                         ulong local_60;
                         undefined4 uStack_58;
                         undefined4 uStack_54;
                         int local_4c;
                         undefined **local_48;
                         ulong uStack_40;
                         undefined ***local_38;
                         undefined8 uStack_30;
                         undefined8 local_28;
                         
                         local_4c = param_2;
                         if (param_2 == 2) {
                           if (SBORROW8(0,*param_1)) {
                             lVar1 = prost::encoding::message::merge(param_3,param_1 + 1,param_4,param_5);
                             return lVar1;
                           }
                           local_70 = (undefined **)0x0;
                           pcStack_68 = (code *)0x1;
                           local_60 = 0;
                                           /* try { // try from 002abd94 to 002abda6 has its CatchHandler @ 002abfb4 */
                           lVar1 = prost::encoding::message::merge(param_3,&local_70,param_4,param_5);
                           if (lVar1 == 0) {
                             uVar4 = 0x8000000000000000;
                             local_38 = (undefined ***)local_60;
                             local_48 = local_70;
                             uStack_40 = (ulong)pcStack_68;
                       // ... [truncated]
                    */
                    pub fn merge() { todo!() }
                }
                pub mod block_filter {
                    pub mod impl_query {
                        /// RE: trading_tracker::pb::sf::substreams::v1::module::block_filter::Query::merge
                        // enriched: ---
                        // calls:
                        //   - trading_tracker::pb::sf::substreams::v1::module::block_filter::Query::merge
                        //   - prost::encoding::message::merge
                        //   - prost::encoding::bytes::merge_one_copy
                        //   - prost::error::DecodeError::new
                        // strings:
                        //   - 'internal error entered unreacha'
                        // enriched: ---
                        /* ghidra: 0x002b6330  sig=long __rustcall trading_tracker::pb::sf::substreams::v1::module::block_filter::Query::merge(long *param_1,int param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                           
                           /* trading_tracker::pb::sf::substreams::v1::module::block_filter::Query::merge */
                           
                           long __rustcall
                           trading_tracker::pb::sf::substreams::v1::module::block_filter::Query::merge
                                     (long *param_1,int param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5)
                           
                           {
                             long lVar1;
                             undefined1 local_69;
                             undefined **local_68;
                             code *pcStack_60;
                             long local_58;
                             int local_4c;
                             undefined **local_48;
                             long lStack_40;
                             undefined ***local_38;
                             undefined8 local_30;
                             undefined8 local_28;
                             
                             local_4c = param_2;
                             if (param_2 != 2) {
                               if (param_2 != 3) {
                                 local_68 = (undefined **)&local_4c;
                                 pcStack_60 = core::fmt::num::imp::_<impl_core::fmt::Display_for_u32>::fmt;
                                 local_48 = &PTR_s_internal_error__entered_unreacha_011bbed8;
                                 lStack_40 = 1;
                                 local_28 = 0;
                                 local_38 = &local_68;
                                 local_30 = 1;
                                               /* WARNING: Subroutine does not return */
                                 core::panicking::panic_fmt(&local_48,&PTR_s__app_src_pb_sf_substreams_v1_rs_011bbee8);
                               }
                               if (*param_1 != -0x8000000000000000) {
                                 lVar1 = prost::encoding::message::merge(param_3,&local_69,param_4,param_5);
                                 if (lVar1 == 0) {
                                   lVar1 = *param_1;
                                   if ((-0x7fffffffffffffff < lVar1) && (lVar1 != 0)) {
                                     __rust_dealloc(param_1[1],lVar1,1);
                                   }
                           // ... [truncated]
                        */
                        pub fn merge() { todo!() }
                    }
                }
                pub mod input {
                    /// RE: <trading_tracker::pb::sf::substreams::v1::module::input::Map as prost::message::Message>::merge_field
                    // enriched: ---
                    // calls:
                    //   - prost::encoding::skip_field
                    //   - prost::encoding::bytes::merge_one_copy
                    //   - prost::error::DecodeError::new
                    //   - prost::error::DecodeError::push
                    // enriched: ---
                    /* ghidra: 0x002ab170  sig=ulong __rustcall _<trading_tracker::pb::sf::substreams::v1::module::input::Map_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                       
                       /* _<trading_tracker::pb::sf::substreams::v1::module::input::Map as
                          prost::message::Message>::merge_field */
                       
                       ulong __rustcall
                       _<trading_tracker::pb::sf::substreams::v1::module::input::Map_as_prost::message::Message>::
                       merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5
                                  )
                       
                       {
                         ulong uVar1;
                         long lVar2;
                         ulong local_28 [3];
                         
                         if ((int)param_2 != 1) {
                           lVar2 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                           return lVar2;
                         }
                                           /* try { // try from 002ab17c to 002ab1bc has its CatchHandler @ 002ab22a */
                         uVar1 = prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                         if (uVar1 == 0) {
                           core::str::converts::from_utf8
                                     (local_28,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                           if ((local_28[0] & 1) == 0) {
                             return 0;
                           }
                           uVar1 = prost::error::DecodeError::new
                                             (anon_3ed7d454aaf5088bb0893c09cd859f53_72_llvm_8940828269134358837,0x2f);
                         }
                         *(undefined8 *)(param_1 + 0x10) = 0;
                         local_28[0] = uVar1;
                                           /* try { // try from 002ab1c9 to 002ab1ea has its CatchHandler @ 002ab216 */
                         prost::error::DecodeError::push(local_28,"Map",3,"module_name",0xb);
                         return local_28[0];
                       }
                       
                    */
                    pub struct Map;
                    /// RE: <trading_tracker::pb::sf::substreams::v1::module::input::Params as prost::message::Message>::merge_field
                    // enriched: ---
                    // calls:
                    //   - prost::encoding::skip_field
                    //   - prost::encoding::bytes::merge_one_copy
                    //   - prost::error::DecodeError::new
                    //   - prost::error::DecodeError::push
                    // enriched: ---
                    /* ghidra: 0x002ab510  sig=ulong __rustcall _<trading_tracker::pb::sf::substreams::v1::module::input::Params_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                       
                       /* _<trading_tracker::pb::sf::substreams::v1::module::input::Params as
                          prost::message::Message>::merge_field */
                       
                       ulong __rustcall
                       _<trading_tracker::pb::sf::substreams::v1::module::input::Params_as_prost::message::Message>::
                       merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5
                                  )
                       
                       {
                         ulong uVar1;
                         long lVar2;
                         ulong local_28 [3];
                         
                         if ((int)param_2 != 1) {
                           lVar2 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                           return lVar2;
                         }
                                           /* try { // try from 002ab51c to 002ab55c has its CatchHandler @ 002ab5ca */
                         uVar1 = prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                         if (uVar1 == 0) {
                           core::str::converts::from_utf8
                                     (local_28,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                           if ((local_28[0] & 1) == 0) {
                             return 0;
                           }
                           uVar1 = prost::error::DecodeError::new
                                             (anon_3ed7d454aaf5088bb0893c09cd859f53_72_llvm_8940828269134358837,0x2f);
                         }
                         *(undefined8 *)(param_1 + 0x10) = 0;
                         local_28[0] = uVar1;
                                           /* try { // try from 002ab569 to 002ab58a has its CatchHandler @ 002ab5b6 */
                         prost::error::DecodeError::push(local_28,"Params",6,"value",5);
                         return local_28[0];
                       }
                       
                    */
                    pub struct Params;
                    /// RE: <trading_tracker::pb::sf::substreams::v1::module::input::Source as prost::message::Message>::merge_field
                    // enriched: ---
                    // calls:
                    //   - prost::encoding::skip_field
                    //   - prost::encoding::bytes::merge_one_copy
                    //   - prost::error::DecodeError::new
                    //   - prost::error::DecodeError::push
                    // enriched: ---
                    /* ghidra: 0x002ab5e0  sig=ulong __rustcall _<trading_tracker::pb::sf::substreams::v1::module::input::Source_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5);
                       
                       /* _<trading_tracker::pb::sf::substreams::v1::module::input::Source as
                          prost::message::Message>::merge_field */
                       
                       ulong __rustcall
                       _<trading_tracker::pb::sf::substreams::v1::module::input::Source_as_prost::message::Message>::
                       merge_field(long param_1,undefined8 param_2,undefined1 param_3,undefined8 param_4,undefined4 param_5
                                  )
                       
                       {
                         ulong uVar1;
                         long lVar2;
                         ulong local_28 [3];
                         
                         if ((int)param_2 != 1) {
                           lVar2 = prost::encoding::skip_field(param_3,param_2,param_4,param_5);
                           return lVar2;
                         }
                                           /* try { // try from 002ab5ec to 002ab62c has its CatchHandler @ 002ab69a */
                         uVar1 = prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                         if (uVar1 == 0) {
                           core::str::converts::from_utf8
                                     (local_28,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                           if ((local_28[0] & 1) == 0) {
                             return 0;
                           }
                           uVar1 = prost::error::DecodeError::new
                                             (anon_3ed7d454aaf5088bb0893c09cd859f53_72_llvm_8940828269134358837,0x2f);
                         }
                         *(undefined8 *)(param_1 + 0x10) = 0;
                         local_28[0] = uVar1;
                                           /* try { // try from 002ab639 to 002ab65a has its CatchHandler @ 002ab686 */
                         prost::error::DecodeError::push(local_28,"Source",6,"r#type",6);
                         return local_28[0];
                       }
                       
                    */
                    pub struct Source;
                    /// RE: <trading_tracker::pb::sf::substreams::v1::module::input::Store as prost::message::Message>::merge_field
                    // enriched: ---
                    // calls:
                    //   - prost::encoding::bytes::merge_one_copy
                    //   - prost::error::DecodeError::new
                    //   - prost::error::DecodeError::push
                    //   - prost::encoding::skip_field
                    //   - prost::encoding::varint::decode_varint
                    // enriched: ---
                    /* ghidra: 0x002ab360  sig=undefined1 * __rustcall _<trading_tracker::pb::sf::substreams::v1::module::input::Store_as_prost::message::Message>::merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5);
                       
                       /* _<trading_tracker::pb::sf::substreams::v1::module::input::Store as
                          prost::message::Message>::merge_field */
                       
                       undefined1 * __rustcall
                       _<trading_tracker::pb::sf::substreams::v1::module::input::Store_as_prost::message::Message>::
                       merge_field(long param_1,undefined8 param_2,char param_3,undefined8 param_4,undefined4 param_5)
                       
                       {
                         undefined1 *puVar1;
                         long lVar2;
                         undefined1 auVar3 [16];
                         undefined1 local_7a;
                         char local_79;
                         undefined1 *local_78;
                         undefined8 local_70;
                         undefined1 **local_68;
                         undefined8 local_60;
                         undefined8 local_58;
                         char *local_48;
                         code *local_40;
                         undefined1 *local_38;
                         code *local_30;
                         undefined1 local_28 [24];
                         
                         if ((int)param_2 == 1) {
                                           /* try { // try from 002ab3ce to 002ab40e has its CatchHandler @ 002ab4ff */
                           puVar1 = (undefined1 *)prost::encoding::bytes::merge_one_copy(param_3,param_1,param_4,param_5);
                           if (puVar1 == (undefined1 *)0x0) {
                             core::str::converts::from_utf8
                                       (&local_78,*(undefined8 *)(param_1 + 8),*(undefined8 *)(param_1 + 0x10));
                             if (((ulong)local_78 & 1) == 0) {
                               return (undefined1 *)0;
                             }
                             puVar1 = (undefined1 *)
                                      prost::error::DecodeError::new
                                                (anon_3ed7d454aaf5088bb0893c09cd859f53_72_llvm_8940828269134358837,0x2f);
                           }
                           *(undefined8 *)(param_1 + 0x10) = 0;
                                           /* try { // try from 002ab41c to 002ab43f has its CatchHandler @ 002ab4ea */
                       // ... [truncated]
                    */
                    pub struct Store;
                }
            }
        }
    }
}
