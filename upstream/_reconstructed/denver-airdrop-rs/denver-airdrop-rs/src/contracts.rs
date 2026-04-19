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


pub mod module_main {
    pub mod module_main {
        /// RE: denver_airdrop_rs::contracts::module_main::module_main::MODULEMAIN_ABI
        pub struct MODULEMAIN_ABI;
        /// RE: <denver_airdrop_rs::contracts::module_main::module_main::SetSourceFilter as ethers_contract::event::EthEvent>::decode_log
        // enriched: ---
        // trait-hint: fn decode_log(log: &ethers_core::abi::RawLog) -> Result<Self, ethers_core::abi::Error>
        // calls:
        //   - _<alloc::vec::Vec<T>as_alloc::vec::spec_from_iter::SpecFromIter<T,I>>::from_iter
        //   - ethabi::decoder::decode
        //   - as_ethers_core::abi::tokens::Tokenizable>::from_token
        //   - _<alloc::vec::into_iter::IntoIter<T,A>as_core::ops::drop::Drop>::drop
        //   - _<alloc::vec::Vec<T,A>as_core::ops::drop::Drop>::drop
        // enriched: ---
        /* ghidra: 0x001ac7c0  sig=undefined1 * __rustcall _<denver_airdrop_rs::contracts::module_main::module_main::SetSourceFilter_as_ethers_contract::event::EthEvent>::decode_log(undefined1 *param_1,long *param_2);
           
           /* WARNING: Globals starting with '_' overlap smaller symbols at the same address */
           /* _<denver_airdrop_rs::contracts::module_main::module_main::SetSourceFilter as
              ethers_contract::event::EthEvent>::decode_log */
           
           undefined1 * __rustcall
           _<denver_airdrop_rs::contracts::module_main::module_main::SetSourceFilter_as_ethers_contract::event::EthEvent>
           ::decode_log(undefined1 *param_1,long *param_2)
           
           {
             void *pvVar1;
             undefined8 uVar2;
             undefined8 uVar3;
             long lVar4;
             undefined1 uVar5;
             char cVar6;
             char *pcVar7;
             long lVar8;
             char *pcVar9;
             undefined1 auVar10 [16];
             undefined1 auVar11 [16];
             char local_1a8;
             undefined1 uStack_1a7;
             undefined1 uStack_1a6;
             undefined1 uStack_1a5;
             undefined1 uStack_1a4;
             undefined1 uStack_1a3;
             undefined1 uStack_1a2;
             undefined1 uStack_1a1;
             undefined1 uStack_1a0;
             undefined1 uStack_19f;
             undefined1 uStack_19e;
             undefined1 uStack_19d;
             undefined1 uStack_19c;
             undefined1 uStack_19b;
             undefined1 uStack_19a;
             undefined1 uStack_199;
             char local_198;
             undefined7 uStack_197;
             undefined1 uStack_190;
           // ... [truncated]
        */
        pub struct SetSourceFilter;
        pub mod impl_modulemain {
            /// RE: denver_airdrop_rs::contracts::module_main::module_main::ModuleMain<M>::new
            // enriched: ---
            // trait-hint: fn new(address: impl Into<ethers::types::Address>, client: Arc<M>) -> Self
            // calls:
            //   - denver_airdrop_rs::contracts::module_main::module_main::ModuleMain<M>::new
            //   - once_cell::imp::OnceCell<T>::initialize
            //   - _<alloc::vec::Vec<T,A>as_core::clone::Clone>::clone
            //   - _<alloc::collections::btree::map::BTreeMap<K,V,A>as_core::clone::Clone>::clone::clone_subtree
            //   - _<ethers_contract::base::BaseContract_as_core::convert::From<ethabi::contract::Contract>>::from
            // enriched: ---
            /* ghidra: 0x001ac460  sig=void * __rustcall denver_airdrop_rs::contracts::module_main::module_main::ModuleMain<M>::new(void *param_1,undefined4 *param_2,undefined8 param_3);
               
               /* denver_airdrop_rs::contracts::module_main::module_main::ModuleMain<M>::new */
               
               void * __rustcall
               denver_airdrop_rs::contracts::module_main::module_main::ModuleMain<M>::new
                         (void *param_1,undefined4 *param_2,undefined8 param_3)
               
               {
                 undefined8 uVar1;
                 undefined8 uVar2;
                 undefined8 uVar3;
                 undefined8 uVar4;
                 undefined8 uVar5;
                 undefined8 local_1d0;
                 undefined8 uStack_1c8;
                 undefined8 local_1c0;
                 undefined8 local_1b8;
                 undefined8 uStack_1b0;
                 undefined8 local_1a8;
                 undefined8 local_1a0;
                 undefined4 local_198;
                 undefined4 uStack_194;
                 undefined4 uStack_190;
                 undefined4 uStack_18c;
                 undefined4 local_188;
                 undefined8 local_178;
                 undefined8 uStack_170;
                 undefined8 local_168;
                 undefined8 uStack_160;
                 undefined8 uStack_158;
                 undefined8 uStack_150;
                 undefined8 uStack_140;
                 undefined8 local_138;
                 undefined8 local_130;
                 undefined8 uStack_128;
                 undefined8 local_120;
                 undefined4 local_118;
                 undefined4 uStack_114;
                 undefined8 uStack_110;
                 undefined8 local_108;
               // ... [truncated]
            */
            pub fn new() { todo!() }
        }
    }
}
pub mod user_erc721a {
    pub mod user_erc721a {
        /// RE: denver_airdrop_rs::contracts::user_erc721a::user_erc721a::USERERC721A_ABI
        pub struct USERERC721A_ABI;
        pub mod impl_usererc721a {
            /// RE: denver_airdrop_rs::contracts::user_erc721a::user_erc721a::UserERC721A<M>::new
            // enriched: ---
            // trait-hint: fn new(address: impl Into<ethers::types::Address>, client: Arc<M>) -> Self
            // calls:
            //   - denver_airdrop_rs::contracts::user_erc721a::user_erc721a::UserERC721A<M>::new
            //   - once_cell::imp::OnceCell<T>::initialize
            //   - _<alloc::vec::Vec<T,A>as_core::clone::Clone>::clone
            //   - _<alloc::collections::btree::map::BTreeMap<K,V,A>as_core::clone::Clone>::clone::clone_subtree
            //   - _<ethers_contract::base::BaseContract_as_core::convert::From<ethabi::contract::Contract>>::from
            // enriched: ---
            /* ghidra: 0x001a0910  sig=void * __rustcall denver_airdrop_rs::contracts::user_erc721a::user_erc721a::UserERC721A<M>::new(void *param_1,undefined4 *param_2,undefined8 param_3);
               
               /* denver_airdrop_rs::contracts::user_erc721a::user_erc721a::UserERC721A<M>::new */
               
               void * __rustcall
               denver_airdrop_rs::contracts::user_erc721a::user_erc721a::UserERC721A<M>::new
                         (void *param_1,undefined4 *param_2,undefined8 param_3)
               
               {
                 undefined8 uVar1;
                 undefined8 uVar2;
                 undefined8 uVar3;
                 undefined8 uVar4;
                 undefined8 uVar5;
                 undefined8 local_1d0;
                 undefined8 uStack_1c8;
                 undefined8 local_1c0;
                 undefined8 local_1b8;
                 undefined8 uStack_1b0;
                 undefined8 local_1a8;
                 undefined8 local_1a0;
                 undefined4 local_198;
                 undefined4 uStack_194;
                 undefined4 uStack_190;
                 undefined4 uStack_18c;
                 undefined4 local_188;
                 undefined8 local_178;
                 undefined8 uStack_170;
                 undefined8 local_168;
                 undefined8 uStack_160;
                 undefined8 uStack_158;
                 undefined8 uStack_150;
                 undefined8 uStack_140;
                 undefined8 local_138;
                 undefined8 local_130;
                 undefined8 uStack_128;
                 undefined8 local_120;
                 undefined4 local_118;
                 undefined4 uStack_114;
                 undefined8 uStack_110;
                 undefined8 local_108;
               // ... [truncated]
            */
            pub fn new() { todo!() }
        }
    }
}
