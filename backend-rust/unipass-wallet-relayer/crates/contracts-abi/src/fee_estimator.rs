use ethers::prelude::abigen;

abigen!(
    FeeEstimator,
    r#"[
        function estimateFee(address _wallet, bytes calldata _txs) external view returns (uint256 fee, address feeToken)
    ]"#
);
