use ethers::prelude::abigen;

abigen!(
    UniPassBridge,
    r#"[
        function bridgeAsset(uint64 destChainId, address recipient, address token, uint256 amount) external payable
        event BridgeEvent(uint64 indexed destChainId, address indexed sender, address recipient, address token, uint256 amount)
    ]"#
);
