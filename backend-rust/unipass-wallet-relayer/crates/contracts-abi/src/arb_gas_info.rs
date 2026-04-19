use ethers::prelude::abigen;

abigen!(
    ArbGasInfo,
    r#"[
        function getPricesInWei() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)
        function getL1BaseFeeEstimate() external view returns (uint256)
        function getCurrentTxL1GasFees() external view returns (uint256)
    ]"#
);
