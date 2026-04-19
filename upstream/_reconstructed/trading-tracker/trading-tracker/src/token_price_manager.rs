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


pub mod runner {
    /// RE: trading_tracker::token_price_manager::runner::_::<impl serde::ser::Serialize for trading_tracker::token_price_manager::runner::PoolPrice>::serialize
    // enriched: ---
    // trait-hint: fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error>
    // calls:
    //   - _<impl_serde::ser::Serialize_for_trading_tracker::token_price_manager::runner::PoolPrice>::serialize
    //   - serde::ser::SerializeMap::serialize_entry
    //   - serde_json::ser::invalid_raw_value
    // enriched: ---
    /* ghidra: 0x00344c00  sig=long __rustcall trading_tracker::token_price_manager::runner::_::_<impl_serde::ser::Serialize_for_trading_tracker::token_price_manager::runner::PoolPrice>::serialize(long param_1,long *param_2);
       
       /* trading_tracker::token_price_manager::runner::_::_<impl serde::ser::Serialize for
          trading_tracker::token_price_manager::runner::PoolPrice>::serialize */
       
       long __rustcall
       trading_tracker::token_price_manager::runner::_::
       _<impl_serde::ser::Serialize_for_trading_tracker::token_price_manager::runner::PoolPrice>::serialize
                 (long param_1,long *param_2)
       
       {
         long *plVar1;
         long lVar2;
         undefined2 local_28;
         long *local_20;
         
         plVar1 = (long *)*param_2;
         lVar2 = plVar1[2];
         if (*plVar1 == lVar2) {
           alloc::raw_vec::RawVecInner<A>::reserve::do_reserve_and_handle(plVar1,lVar2,1,1,1);
           lVar2 = plVar1[2];
         }
         *(undefined1 *)(plVar1[1] + lVar2) = 0x7b;
         plVar1[2] = lVar2 + 1;
         local_28 = 0x100;
         local_20 = param_2;
         lVar2 = serde::ser::SerializeMap::serialize_entry(&local_28,"block_height",0xc,param_1 + 0x40);
         if (lVar2 != 0) {
           return lVar2;
         }
         if ((char)local_28 != '\x01') {
           lVar2 = serde::ser::SerializeMap::serialize_entry(&local_28,"pool",4,param_1);
           if (lVar2 != 0) {
             return lVar2;
           }
           if ((char)local_28 != '\x01') {
             lVar2 = serde::ser::SerializeMap::serialize_entry(&local_28,"price",5,param_1 + 0x20);
             if (lVar2 != 0) {
               return lVar2;
             }
             if ((char)local_28 != '\x01') {
       // ... [truncated]
    */
    pub struct PoolPrice;
    pub mod impl_tokenpricerunner {
        /// RE: trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_msg
        // enriched: ---
        // calls:
        //   - trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_msg
        //   - hashbrown::map::HashMap<K,V,S,A>::insert
        //   - tokio::sync::mpsc::list::Tx<T>::close
        //   - tokio::sync::task::atomic_waker::AtomicWaker::wake
        //   - hashbrown::rustc_entry::_<impl_hashbrown::map::HashMap<K,V,S,A>>::rustc_entry
        //   - hashbrown::raw::RawTable<T,A>::remove_entry
        //   - _<alloc::vec::into_iter::IntoIter<T,A>as_core::iter::traits::iterator::Iterator>::fold
        //   - tokio::sync::oneshot::Sender<T>::send
        //   - _<hashbrown::map::HashMap<K,V,S,A>as_core::iter::traits::collect::Extend<
        // enriched: ---
        /* ghidra: 0x003434e0  sig=void __rustcall trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_msg(long *******param_1,long *param_2);
           
           /* WARNING: Type propagation algorithm not settling */
           /* trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_msg */
           
           void __rustcall
           trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_msg
                     (long *******param_1,long *param_2)
           
           {
             long ******pppppplVar1;
             ushort uVar2;
             long *******ppppppplVar3;
             long *******ppppppplVar4;
             long *******ppppppplVar5;
             ulong uVar6;
             undefined1 (*pauVar7) [16];
             uint uVar8;
             int iVar9;
             undefined8 uVar10;
             long *******ppppppplVar11;
             long ******pppppplVar12;
             undefined1 *puVar13;
             long *******ppppppplVar14;
             ulong uVar15;
             char cVar16;
             long *******ppppppplVar17;
             byte bVar18;
             long *******ppppppplVar19;
             byte bVar20;
             uint uVar21;
             ulong uVar22;
             long lVar23;
             long lVar24;
             size_t sVar25;
             long *in_FS_OFFSET;
             undefined1 auVar26 [16];
             long *******local_180;
             undefined8 local_168;
             long *******local_158;
             long *******ppppppplStack_150;
           // ... [truncated]
        */
        pub fn deal_msg() { todo!() }
        /// RE: trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_substream
        // enriched: ---
        // calls:
        //   - trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_substream
        //   - prost::message::Message::decode
        //   - drop_in_place<core::result::Result<trading_tracker::pb::dex::trades::v1::DexTradesData,prost::error::DecodeError>>
        //   - drop_in_place<core::option::Option<trading_tracker::pb::sf::substreams::rpc::v2::OutputDebugInfo>>
        //   - drop_in_place<trading_tracker::pb::sf::substreams::rpc::v2::MapModuleOutput>
        //   - drop_in_place<trading_tracker::pb::sf::substreams::rpc::v2::StoreModuleOutput>
        //   - drop_in_place<core::result::Result<trading_tracker::token_price_manager::substreams_stream::BlockResponse,anyhow::Error>>
        //   - solana_rpc_client::nonblocking::rpc_client::RpcClient::url
        //   - solana_rpc_client::nonblocking::rpc_client::RpcClient::new
        //   - _<alloc::collections::btree::map::BTreeMap<K,V,A>as_core::clone::Clone>::clone::clone_subtree
        //   - _<hashbrown::raw::RawTable<T,A>as_core::clone::Clone>::clone
        //   - anyhow::error::_<impl_core::ops::drop::Drop_for_anyhow::Error>::drop
        // strings:
        //   - 'rustc'
        // enriched: ---
        /* ghidra: 0x0033fcf0  sig=undefined8 * __rustcall trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_substream(undefined8 *param_1,long param_2,ulong *param_3);
           
           /* trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_substream */
           
           undefined8 * __rustcall
           trading_tracker::token_price_manager::runner::TokenPriceRunner::deal_substream
                     (undefined8 *param_1,long param_2,ulong *param_3)
           
           {
             ulong uVar1;
             code *pcVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             undefined4 uVar5;
             undefined4 uVar6;
             ulong uVar7;
             ulong uVar8;
             ulong uVar9;
             ulong uVar10;
             ulong uVar11;
             void *__dest;
             long lVar12;
             ulong uVar13;
             undefined8 *puVar14;
             ulong uVar15;
             long lVar16;
             ulong uVar17;
             bool bVar18;
             bool bVar19;
             ulong local_3b8;
             ulong local_3b0;
             undefined8 local_398;
             undefined8 uStack_390;
             ulong local_380;
             ulong uStack_378;
             long local_370;
             long lStack_368;
             long local_360;
             ulong local_358;
             long local_350;
             long lStack_348;
           // ... [truncated]
        */
        pub fn deal_substream() { todo!() }
        /// RE: trading_tracker::token_price_manager::runner::TokenPriceRunner::new::__closure__
        pub fn new() { todo!() }
        /// RE: trading_tracker::token_price_manager::runner::TokenPriceRunner::run::__closure__
        pub fn run() { todo!() }
    }
}
pub mod substreams {
    pub mod impl_substreamsendpoint {
        /// RE: trading_tracker::token_price_manager::substreams::SubstreamsEndpoint::new
        // enriched: ---
        // trait-hint: fn new(address: impl Into<ethers::types::Address>, client: Arc<M>) -> Self
        // calls:
        //   - trading_tracker::token_price_manager::substreams::SubstreamsEndpoint::new
        //   - bytes::bytes::Bytes::copy_from_slice
        //   - http::uri::Uri::from_shared
        //   - tonic::transport::channel::Channel::builder
        //   - tonic::transport::channel::endpoint::Endpoint::tls_config
        //   - _<http::uri::Uri_as_core::fmt::Display>::fmt
        //   - tonic::transport::channel::endpoint::Endpoint::connect_lazy
        // enriched: ---
        /* ghidra: 0x002dada0  sig=undefined8 * __rustcall trading_tracker::token_price_manager::substreams::SubstreamsEndpoint::new(undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined4 *param_4);
           
           /* trading_tracker::token_price_manager::substreams::SubstreamsEndpoint::new */
           
           undefined8 * __rustcall
           trading_tracker::token_price_manager::substreams::SubstreamsEndpoint::new
                     (undefined8 *param_1,undefined8 param_2,undefined8 param_3,undefined4 *param_4)
           
           {
             code *pcVar1;
             undefined4 uVar2;
             undefined4 uVar3;
             undefined4 uVar4;
             ulong uVar5;
             long lVar6;
             undefined8 uVar7;
             undefined8 uVar8;
             undefined8 uVar9;
             char cVar10;
             int *piVar11;
             undefined1 local_4a9;
             undefined8 local_4a8;
             undefined8 uStack_4a0;
             undefined4 local_498;
             undefined4 uStack_494;
             undefined4 uStack_490;
             undefined4 uStack_48c;
             undefined4 local_488;
             undefined4 uStack_484;
             undefined4 uStack_480;
             undefined4 uStack_47c;
             undefined4 local_478;
             undefined4 uStack_474;
             undefined4 uStack_470;
             undefined4 uStack_46c;
             undefined8 uStack_460;
             ulong local_458;
             int local_448;
             undefined4 uStack_444;
             undefined4 uStack_440;
             undefined4 uStack_43c;
           // ... [truncated]
        */
        pub fn new() { todo!() }
    }
}
pub mod substreams_stream {
    /// RE: trading_tracker::token_price_manager::substreams_stream::process_substreams_response::__closure__::__CALLSITE
    pub fn process_substreams_response() { todo!() }
    /// RE: trading_tracker::token_price_manager::substreams_stream::stream_blocks::__closure__::__CALLSITE
    pub fn stream_blocks() { todo!() }
    /// RE: <trading_tracker::token_price_manager::substreams_stream::SubstreamsStream as futures_core::stream::Stream>::poll_next
    /* ghidra: 0x00373520  sig=undefined8 __rustcall _<trading_tracker::token_price_manager::substreams_stream::SubstreamsStream_as_futures_core::stream::Stream>::poll_next(undefined8 param_1,undefined8 *param_2);
       
       /* _<trading_tracker::token_price_manager::substreams_stream::SubstreamsStream as
          futures_core::stream::Stream>::poll_next */
       
       undefined8 __rustcall
       _<trading_tracker::token_price_manager::substreams_stream::SubstreamsStream_as_futures_core::stream::Stream>
       ::poll_next(undefined8 param_1,undefined8 *param_2)
       
       {
         (**(code **)(param_2[1] + 0x18))(param_1,*param_2);
         return param_1;
       }
       
    */
    pub struct SubstreamsStream;
    pub mod impl_substreamsstream {
        /// RE: trading_tracker::token_price_manager::substreams_stream::SubstreamsStream::new
        // enriched: ---
        // trait-hint: fn new(address: impl Into<ethers::types::Address>, client: Arc<M>) -> Self
        // calls:
        //   - trading_tracker::token_price_manager::substreams_stream::SubstreamsStream::new
        //   - std::time::Instant::now
        // enriched: ---
        /* ghidra: 0x00373330  sig=undefined1  [16] __rustcall trading_tracker::token_price_manager::substreams_stream::SubstreamsStream::new(undefined8 param_1,long *param_2,undefined4 *param_3,undefined8 *param_4,undefined8 param_5,undefined8 param_6);
           
           /* trading_tracker::token_price_manager::substreams_stream::SubstreamsStream::new */
           
           undefined1  [16] __rustcall
           trading_tracker::token_price_manager::substreams_stream::SubstreamsStream::new
                     (undefined8 param_1,long *param_2,undefined4 *param_3,undefined8 *param_4,
                     undefined8 param_5,undefined8 param_6)
           
           {
             long lVar1;
             long lVar2;
             long lVar3;
             long lVar4;
             undefined1 auVar5 [16];
             long local_b50;
             long local_b48;
             long local_b40;
             undefined8 local_b38;
             undefined8 uStack_b30;
             undefined8 local_b28;
             undefined4 local_b20;
             undefined4 uStack_b1c;
             undefined4 uStack_b18;
             undefined4 uStack_b14;
             undefined4 local_b10;
             undefined4 uStack_b0c;
             undefined4 uStack_b08;
             undefined4 uStack_b04;
             undefined4 local_b00;
             undefined4 uStack_afc;
             undefined4 uStack_af8;
             undefined4 uStack_af4;
             undefined1 local_af0 [12];
             undefined8 local_ae0;
             undefined8 local_ad8;
             undefined8 local_ad0;
             undefined8 local_ac8;
             undefined4 local_ac0;
             undefined8 local_ab8;
             undefined8 local_ab0;
           // ... [truncated]
        */
        pub fn new() { todo!() }
    }
}
