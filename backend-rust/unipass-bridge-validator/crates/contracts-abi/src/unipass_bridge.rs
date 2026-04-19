use ethers::prelude::abigen;

abigen!(
    UniPassBridge,
    r#"[
        function bridgeAsset(uint64 destChainId, address recipient, address token, uint256 amount) external payable
        function submitBatch(bytes calldata _data, bytes[] calldata _signatures) external
        function validators(uint256 index) external view returns (address)
        function requiredSignatures() external view returns (uint256)
        event BridgeEvent(uint64 indexed destChainId, address indexed sender, address recipient, address token, uint256 amount)
        event BatchSubmitted(bytes32 indexed batchId, uint256 paymentCount)
    ]"#
);
