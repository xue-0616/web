use ethers::prelude::abigen;

abigen!(
    ModuleGuest,
    r#"[
        function execute(bytes calldata _txs, uint256 _nonce, bytes calldata _signature) external
        event TxExecuted(bytes32 indexed _tx) anonymous
    ]"#
);
