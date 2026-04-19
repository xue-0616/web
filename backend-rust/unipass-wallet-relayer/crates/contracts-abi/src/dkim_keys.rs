use ethers::prelude::abigen;

abigen!(
    DkimKeys,
    r#"[
        function isDKIMPublicKeyHashValid(string memory domainName, bytes32 publicKeyHash) external view returns (bool)
        function setDKIMPublicKeyHash(string memory domainName, bytes32 publicKeyHash, address authorizer, bytes memory signature) external
    ]"#
);
