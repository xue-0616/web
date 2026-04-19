use ethers::prelude::abigen;

abigen!(
    GasEstimator,
    r#"[
        function estimate(address _wallet, bytes calldata _data) external returns (bool success, bytes memory result, uint256 gas)
    ]"#
);
