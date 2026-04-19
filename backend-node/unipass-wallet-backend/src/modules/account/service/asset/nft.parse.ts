import moment from 'moment';
import Querystringify from 'querystringify';
// ethers v6: BigNumber removed — use native BigInt
export const AlchemyNetwork = {
    1: 'eth-mainnet',
    137: 'polygon-mainnet',
    42161: 'arb-mainnet',
    5: 'eth-goerli',
    80001: 'polygon-mumbai',
    421613: 'arb-goerli',
};
const ScanHost = {
    1: 'https://etherscan.io/token',
    56: 'https://bscscan.com/token',
    137: 'https://polygonscan.com/token',
    42161: 'https://arbiscan.io/token',
    5: 'https://goerli.etherscan.io/token',
    80001: 'https://mumbai.polygonscan.com/token',
    421613: 'https://goerli.arbiscan.io/token',
    97288: 'https://testnet.bscscan.com/token',
};
const OpenseaHost = 'https://opensea.io/collection';
const OpenseaTestnetHost = 'https://testnets.opensea.io/collection';
const mainChainIds = new Set(['1', '56', '137', '42161']);
const nftScanChainHost = {
    '1': 'restapi',
    '56': 'bnbapi',
    '137': 'polygonapi',
    '42161': 'arbitrumapi',
};
const OpenseaApiHost = 'https://api.opensea.io';
const OpenseaTestnetApiHost = 'https://testnets-api.opensea.io';
export const getOpenseaUrl = (chainId, slug, address) => {
    let openseaUrl = '';
    const host = mainChainIds.has(chainId) ? OpenseaHost : OpenseaTestnetHost;
    if (!slug && !address) {
        return openseaUrl;
    }
    openseaUrl = slug
        ? `${host}/${slug}`
        : `${host.replace('collection', 'assets?search[query]=')}${address}`;
    return openseaUrl;
};
export const parseAlchemyCollectionList = async (collections, chainId, nftDbService) => {
    const collectionsList = [];
    let isQuery = false;
    for (const item of collections) {
        const { address, numDistinctTokensOwned, tokenType, symbol, name, opensea, } = item;
        const dbInfo = await nftDbService.findOneCollection(address);
        if (!dbInfo) {
            isQuery = true;
        }
        const openseaUrl = exports.getOpenseaUrl(chainId, dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.slug, address);
        const imageUrl = dbInfo ? dbInfo.imageUrl : '';
        const data = {
            contractAddress: address,
            totalTokens: numDistinctTokensOwned,
            tokenType,
            symbol,
            name,
            browserUrl: `${ScanHost[chainId]}/${address}`,
            openseaUrl,
            imageUrl,
            chainId,
            timeLastUpdated: (opensea === null || opensea === void 0 ? void 0 : opensea.lastIngestedAt) ? opensea === null || opensea === void 0 ? void 0 : opensea.lastIngestedAt : '',
        };
        collectionsList.push(data);
    }
    return { list: collectionsList, isQuery };
};
export const initAlchemyCollectionUrl = (address, apiKey, chainId, qsData, pageSize = 20) => {
    let pageKey;
    if (!qsData) {
        qsData = {
            owner: address,
            pageSize,
            orderBy: 'transferTime',
            pageKey,
        };
    }
    if (!qsData.pageKey) {
        delete qsData.pageKey;
    }
    const path = `https://${exports.AlchemyNetwork[chainId]}.g.alchemy.com/nft/v2/${apiKey}/getContractsForOwner`;
    const url = `${path}${Querystringify.stringify(qsData, true)}`;
    return { url, qsData };
};
export const initAlchemyNFTTokenUrl = (address, contractAddresses, apiKey, chainId, qsData, pageSize = 20) => {
    let pageKey;
    if (!qsData) {
        qsData = {
            owner: address,
            pageSize,
            pageKey,
            'contractAddresses[]': contractAddresses,
        };
    }
    if (!qsData.pageKey) {
        delete qsData.pageKey;
    }
    const path = `https://${exports.AlchemyNetwork[chainId]}.g.alchemy.com/nft/v2/${apiKey}/getNFTs`;
    const url = `${path}${Querystringify.stringify(qsData, true)}`;
    return { url, qsData };
};
export const parseNodeRealCollectionList = async (collections, chainId, tokenType, nftDbService) => {
    const collectionsList = [];
    let isQuery = false;
    for (const item of collections) {
        const { tokenAddress, tokenIdNum, tokenName, tokenSymbol } = item;
        const dbInfo = await nftDbService.findOneCollection(tokenAddress);
        if (!dbInfo) {
            isQuery = true;
        }
        const openseaUrl = exports.getOpenseaUrl(chainId, dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.slug, dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.address);
        const imageUrl = (dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.imageUrl) ? dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.imageUrl : '';
        const data = {
            contractAddress: tokenAddress,
            totalTokens: Number(BigInt(tokenIdNum)),
            tokenType,
            symbol: tokenSymbol,
            name: tokenName,
            browserUrl: `${ScanHost[chainId]}/${tokenAddress}`,
            openseaUrl,
            imageUrl,
            chainId,
            timeLastUpdated: new Date(),
        };
        collectionsList.push(data);
    }
    return { list: collectionsList, isQuery };
};
export const getCollectionCacheList = async (collectionsList, nftDbService) => {
    const distinctMap = new Map();
    const list = [];
    for (const item of collectionsList) {
        const { contractAddress, chainId, name } = item;
        const data = distinctMap.get(contractAddress);
        if (data) {
            distinctMap.set(contractAddress, contractAddress);
            continue;
        }
        const dbInfo = await nftDbService.findOneCollection(contractAddress);
        if (!dbInfo) {
            list.push(item);
            distinctMap.set(contractAddress, contractAddress);
            continue;
        }
        item.openseaUrl = exports.getOpenseaUrl(chainId, dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.slug, dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.address);
        item.imageUrl = (dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.imageUrl) ? dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.imageUrl : '';
        item.name = dbInfo.name ? dbInfo.name : name;
        list.push(item);
        distinctMap.set(contractAddress, contractAddress);
    }
    return list;
};
export function getNFTTokenImageUrl(imageUrl = '', collectionData) {
    const collectionUrl = collectionData === null || collectionData === void 0 ? void 0 : collectionData.imageUrl;
    if (imageUrl &&
        !imageUrl.startsWith('http') &&
        collectionUrl &&
        collectionUrl.startsWith('http')) {
        const host = collectionUrl.split('/ipfs/')[0];
        imageUrl = `${host}/ipfs/${imageUrl}`;
    }
    return imageUrl;
}
export const getNFTTokenCacheList = async (nftList, contractAddress, nftDbService, collectionData) => {
    for (const item of nftList) {
        const { tokenId } = item;
        const dbInfo = await nftDbService.findOneNFT(contractAddress, tokenId);
        if (!dbInfo) {
            continue;
        }
        item.imageUrl = getNFTTokenImageUrl(dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.imageUrl, collectionData);
        item.imageOriginalUrl = dbInfo === null || dbInfo === void 0 ? void 0 : dbInfo.imageOriginalUrl;
    }
    return nftList;
};
export const parseAlchemyNFTListByApi = async (tokens, address, nftDbService) => {
    const tokenList = [];
    let isQuery = false;
    for (const item of tokens) {
        const { id, title, description, timeLastUpdated, tokenUri, balance } = item;
        const { tokenMetadata, tokenId } = id;
        const data: any = {
            tokenId: String(BigInt(tokenId)),
            tokenType: tokenMetadata.tokenType,
            title,
            description,
            timeLastUpdated,
            total: Number(balance),
            imageUrl: tokenUri === null || tokenUri === void 0 ? void 0 : tokenUri.raw,
        };
        const tokenInfo = await nftDbService.findOneNFT(address, data.tokenId);
        if (!tokenInfo) {
            isQuery = true;
        }
        data.imageUrl = (tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.imageUrl) ? tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.imageUrl : '';
        data.imageOriginalUrl = (tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.imageOriginalUrl)
            ? tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.imageOriginalUrl
            : '';
        tokenList.push(data);
    }
    return { list: tokenList, isQuery };
};
export const initNftScanUrl = (address, contractAddress, apiKey, cursor, pageSize = 20) => {
    const queryData = {
        contract_address: contractAddress,
        cursor,
        limit: pageSize,
    };
    const url = `https://bnbapi.nftscan.com/api/v2/account/own/${address}${Querystringify.stringify(queryData, true)}`;
    const config = {
        headers: {
            'X-API-KEY': apiKey,
        },
    };
    return { url, config };
};
export const parseNFTSScanTokenList = async (nfts, address, nftDbService) => {
    var _a, _b;
    const tokenList = [];
    let isQuery = false;
    for (const item of nfts) {
        const { erc_type, token_uri, amount, token_id, name, description, mint_timestamp, } = item;
        const data: any = {
            tokenId: String(BigInt(token_id)),
            tokenType: erc_type.toUpperCase(),
            title: name,
            description,
            timeLastUpdated: moment(mint_timestamp).format('YYYY-MM-DD hh:mm:ss'),
            total: Number(amount),
            imageUrl: token_uri,
        };
        const tokenInfo = await nftDbService.findOneNFT(address, data.tokenId);
        if (!tokenInfo) {
            isQuery = true;
        }
        data.imageUrl = (_a = tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.imageUrl) !== null && _a !== void 0 ? _a : '';
        data.imageOriginalUrl = (_b = tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.imageOriginalUrl) !== null && _b !== void 0 ? _b : '';
        tokenList.push(data);
    }
    return { list: tokenList, isQuery };
};
export const initOpenSeaCollectionUrl = (assetOwner, chainId, apiKey, offset = 0, limit = 300) => {
    const queryData = {
        asset_owner: assetOwner,
        offset,
        limit,
    };
    const host = mainChainIds.has(chainId)
        ? OpenseaApiHost
        : OpenseaTestnetApiHost;
    const url = `${host}/api/v1/collections${Querystringify.stringify(queryData, true)}`;
    const config = {
        headers: {
            'X-API-KEY': apiKey,
            accept: 'application/json',
        },
    };
    if (host.includes('testnets')) {
        return { url, config: {} };
    }
    return { url, config };
};
export const initOpenSeaNFTTokenUrl = (owner, contractAddress, chainId, apiKey, cursor, limit = 200) => {
    const queryData = {
        owner,
        asset_contract_addresses: contractAddress,
        order_direction: 'desc',
        include_orders: false,
        limit,
        cursor,
    };
    if (!queryData.cursor) {
        delete queryData.cursor;
    }
    const host = mainChainIds.has(chainId)
        ? OpenseaApiHost
        : OpenseaTestnetApiHost;
    const url = `${host}/api/v1/assets${Querystringify.stringify(queryData, true)}`;
    const config = {
        headers: {
            'X-API-KEY': apiKey,
            accept: 'application/json',
        },
    };
    if (host.includes('testnets')) {
        return { url, config: {} };
    }
    return { url, config };
};
export const initOpenSeaACollectionUrl = (contractAddress, chainId, apiKey) => {
    const host = mainChainIds.has(chainId)
        ? OpenseaApiHost
        : OpenseaTestnetApiHost;
    const url = `${host}/api/v1/asset_contract/${contractAddress}`;
    const config = {
        headers: {
            'X-API-KEY': apiKey,
            accept: 'application/json',
        },
    };
    if (host.includes('testnets')) {
        return { url, config: {} };
    }
    return { url, config };
};
export const initOpenSeaANftUrl = (contractAddress, tokenId, chainId, apiKey) => {
    const host = mainChainIds.has(chainId)
        ? OpenseaApiHost
        : OpenseaTestnetApiHost;
    const url = `${host}/api/v1/asset/${contractAddress}/${tokenId}/`;
    const config = {
        headers: {
            'X-API-KEY': apiKey,
            accept: 'application/json',
        },
    };
    if (host.includes('testnets')) {
        return { url, config: {} };
    }
    return { url, config };
};
export const initNFTScanNFTUrl = (contractAddress, tokenId, chainId, apiKey) => {
    const url = `https://${nftScanChainHost[chainId]}.nftscan.com/api/v2/assets/${contractAddress}/${tokenId}?show_attribute=true`;
    const config = {
        headers: {
            'X-API-KEY': apiKey,
        },
    };
    return { url, config };
};
export const initNFTScanCollectionUrl = (contractAddress, chainId, apiKey) => {
    const url = `https://${nftScanChainHost[chainId]}.nftscan.com/api/v2/collections/${contractAddress}?show_attribute=false`;
    const config = {
        headers: {
            'X-API-KEY': apiKey,
        },
    };
    return { url, config };
};
export const parseOpenSeaOneCollection = (data) => {
    const controllers = [];
    const { collection, address, image_url, name, symbol, created_date } = data;
    if (!collection) {
        return controllers;
    }
    const imageUrl = image_url ? image_url : '';
    const slug = collection.slug;
    const nftCollection = {
        address,
        createdAt: new Date(created_date),
        name,
        symbol,
        imageUrl,
        slug,
    };
    controllers.push(nftCollection);
    return controllers;
};
export const parseOpenSeaOneCollectionNft = (address, data) => {
    const nfts = [];
    if (!data) {
        return nfts;
    }
    const { token_id, image_url, image_original_url, name } = data;
    const collection = {
        address,
        name,
        tokenId: token_id,
        imageUrl: image_url,
        imagOriginalUrl: image_original_url,
    };
    nfts.push(collection);
    return nfts;
};
export const parseNFTScanNft = (address, nftData, logger) => {
    const nfts = [];
    if (!nftData || nftData.code !== 200) {
        logger.warn(`[parseNFTScanNft] ${JSON.stringify(nftData)}`);
        return nfts;
    }
    const { data } = nftData;
    if (!data) {
        return nfts;
    }
    const { name, token_id, nftscan_uri, small_nftscan_uri, image_uri } = data;
    const collection = {
        address,
        name,
        tokenId: token_id,
        imageUrl: small_nftscan_uri ? small_nftscan_uri : image_uri,
        imagOriginalUrl: nftscan_uri ? nftscan_uri : image_uri,
    };
    nfts.push(collection);
    return nfts;
};
export const parseNFTScanCollection = (collectionData, logger) => {
    const collections = [];
    if (!collectionData || collectionData.code !== 200) {
        logger.warn(`[parseNFTScanCollection] ${JSON.stringify(collectionData)}`);
        return collections;
    }
    const { data } = collectionData;
    if (!data) {
        return collections;
    }
    const { name, contract_address, symbol, logo_url, featured_url } = data;
    const collection = {
        address: contract_address,
        createdAt: new Date(),
        name,
        symbol,
        imageUrl: logo_url ? logo_url : featured_url,
        slug: '',
    };
    collections.push(collection);
    return collections;
};
export const parseOpenSeaCollection = (list) => {
    const controllers = [];
    for (const item of list) {
        const { slug, primary_asset_contracts } = item;
        if (primary_asset_contracts.length === 0) {
            continue;
        }
        const { address, description, image_url, name, symbol, created_date } = primary_asset_contracts[0];
        const collection = {
            address,
            createdAt: new Date(created_date),
            name,
            symbol,
            description: description ? description : item.description,
            imageUrl: image_url ? image_url : item.image_url,
            slug,
        };
        controllers.push(collection);
    }
    return controllers;
};
export const parseOpenSeaNFTToken = (address, list) => {
    const nfts = [];
    for (const item of list) {
        const { token_id, image_url, image_original_url, description, name } = item;
        const collection = {
            address,
            name,
            tokenId: token_id,
            description,
            imageUrl: image_url,
            imagOriginalUrl: image_original_url,
        };
        nfts.push(collection);
    }
    return nfts;
};
