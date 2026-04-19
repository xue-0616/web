use ethers::prelude::abigen;

abigen!(
    SingletonFactory,
    r#"[
        function deploy(bytes memory _initCode, bytes32 _salt) external returns (address)
    ]"#
);
