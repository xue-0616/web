use ethers::prelude::abigen;

abigen!(
    ModuleMain,
    r#"[
        function execute(bytes calldata _txs, uint256 _nonce, bytes calldata _signature) external
        function metaNonce() external view returns (uint256)
        function nonce() external view returns (uint256)
        function isValidSignature(bytes32 _hash, bytes calldata _signature) external view returns (bytes4)
    ]"#
);
