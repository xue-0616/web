export function getSignMessage(
    sender: string,
    NFTIndex: string | number,
    tokenId: string | number,
    deadline: string | number,
    EntryPointAddress: string,
    chainId: string | number,
) {
    const eip712DemoData = {
        types: {
            EIP712Domain: [
                {
                    name: 'name',
                    type: 'string',
                },
                {
                    name: 'version',
                    type: 'string',
                },
                {
                    name: 'chainId',
                    type: 'uint256',
                },
                {
                    name: 'verifyingContract',
                    type: 'address',
                },
            ],
            claimNFT: [
                {
                    name: 'sender',
                    type: 'address',
                },
                {
                    name: 'NFTIndex',
                    type: 'uint256',
                },
                {
                    name: 'tokenId',
                    type: 'uint256',
                },
                {
                    name: 'deadline',
                    type: 'uint256',
                },
            ],
        },
        primaryType: 'claimNFT',
        domain: {
            name: 'Festival event',
            version: '1.0.0',
            chainId,
            verifyingContract: EntryPointAddress,
        },
        message: {
            sender,
            NFTIndex,
            tokenId,
            deadline,
        },
    };
    return eip712DemoData;
}
