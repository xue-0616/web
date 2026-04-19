use ethers::prelude::abigen;

abigen!(
    UniPassFactory,
    r#"[
        function createAccount(address _mainModule, bytes32 _salt) external returns (address)
        function getAddress(address _mainModule, bytes32 _salt) external view returns (address)
    ]"#
);
