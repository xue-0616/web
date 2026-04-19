import { Injectable } from '@nestjs/common';
import moment from 'moment';
import { getCollectionCacheList, getNFTTokenCacheList, getNFTTokenImageUrl, getOpenseaUrl, initAlchemyCollectionUrl, initAlchemyNFTTokenUrl, initNFTScanCollectionUrl, initNFTScanNFTUrl, initNftScanUrl, initOpenSeaACollectionUrl, initOpenSeaANftUrl, initOpenSeaCollectionUrl, initOpenSeaNFTTokenUrl, parseAlchemyCollectionList, parseAlchemyNFTListByApi, parseNFTSScanTokenList, parseNFTScanCollection, parseNFTScanNft, parseNodeRealCollectionList, parseOpenSeaCollection, parseOpenSeaNFTToken, parseOpenSeaOneCollection, parseOpenSeaOneCollectionNft } from './nft.parse';
import { TIME } from '../../../../shared/utils';
// ethers v6: BigNumber removed — use native BigInt

@Injectable()
export class NFTService {
    // Runtime-assigned fields (preserved from original source via decompilation).
    [key: string]: any;
    constructor(logger: any, redisService: any, upHttpService: any, apiConfigService: any, nftDbService: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.upHttpService = upHttpService;
        this.apiConfigService = apiConfigService;
        this.nftDbService = nftDbService;
        this.logger.setContext(NFTService.name);
    }
    logger: any;
    redisService: any;
    upHttpService: any;
    apiConfigService: any;
    nftDbService: any;
    async getChainNFTCollectionList(getNFTInput: any, account: any) {
            const { chainId } = getNFTInput;
            const isMainnet = this.apiConfigService.getContractConfig.isMainNet;
            this.logger.log(`[getChainNFTCollectionList] find collection list by user:${account.email}_${account.provider} isMainnet = ${isMainnet} address =${getNFTInput.address}`);
            const alchemySupportChainId = ['1', '5', '137', '80001', '42161', '421613'];
            const noderealSupportChainId = ['56'];
            let data = {
                total: 0,
                list: [],
            };
            if (alchemySupportChainId.includes(chainId)) {
                data = await this.getAlchemyCollection(getNFTInput);
            }
            else if (noderealSupportChainId.includes(chainId)) {
                data = await this.getAllNoderalCollection(getNFTInput, data);
            }
            data.list = await getCollectionCacheList(data.list, this.nftDbService);
            data.total = data.list.length;
            return data;
        }
    async getOpenseaCollectionByCollectionId(assetOwner: any, chainId: any) {
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.openSeaApiKey;
            const { url, config } = initOpenSeaCollectionUrl(assetOwner, chainId, apiKey);
            const data = (await this.upHttpService.httpGet(url, config));
            if (!data) {
                this.logger.log('[getOpenseaCollectionByCollectionId] query info is null');
                return [];
            }
            const collections = parseOpenSeaCollection(data);
            await this.nftDbService.saveCollectionsToDb(collections);
            return collections;
        }
    async getOpenseaNFTTokenByCollection(owner: any, contractAddress: any, chainId: any, cursor?: any) {
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.openSeaApiKey;
            const { url, config } = initOpenSeaNFTTokenUrl(owner, contractAddress, chainId, apiKey, cursor);
            const data = (await this.upHttpService.httpGet(url, config));
            if (!data) {
                this.logger.log('[getOpenseaNFTTokenByCollection] query info is null');
                return [];
            }
            const nfts = parseOpenSeaNFTToken(contractAddress, data.assets);
            await this.nftDbService.saveNFTokenDb(nfts);
            return nfts;
        }
    async getAlchemyCollection(getNFTInput: any, qsData?: any, query: any = false) {
            const { chainId, address } = getNFTInput;
            const page = Number.parseInt(getNFTInput.page, 10)
                ? Number.parseInt(getNFTInput.page, 10)
                : 1;
            let limit = getNFTInput.limit ? Number.parseInt(getNFTInput.limit, 10) : 20;
            limit = limit ? limit : 20;
            const key = `nft:${address}:${chainId}:${limit}`;
            this.logger.log(`[getAlchemyCollection]:${key}`);
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.getAlchemyApiKey;
            const { url, qsData: qsDataInfo } = initAlchemyCollectionUrl(address, apiKey, chainId, qsData, limit);
            if (!query) {
                const cacheData = await this.getAlchemyCacheCollectionData(getNFTInput, key, page, qsDataInfo);
                return cacheData;
            }
            let collection = (await this.upHttpService.httpGet(url));
            if (!collection) {
                collection = (await this.upHttpService.httpGet(url.replace('&orderBy=transferTime', '')));
            }
            const nftDataList = {
                total: 0,
                list: [],
            };
            if (!collection) {
                return nftDataList;
            }
            const { list, isQuery } = await parseAlchemyCollectionList(collection.contracts, chainId, this.nftDbService);
            nftDataList.list = list;
            nftDataList.total = collection.totalCount;
            await this.getSaveCacheAlchemyData(nftDataList, key, page, collection.pageKey, true);
            if (isQuery) {
                void this.getOpenseaCollectionByCollectionId(address, chainId);
            }
            return nftDataList;
        }
    async getSaveCacheAlchemyData(data: any, key: any, page: any, pageKey: any, isCollection: any) {
            const time = isCollection ? TIME.HALF_HOUR : TIME.ONE_MINUTE;
            await this.redisService.saveCacheData(key, JSON.stringify(Object.assign(Object.assign({}, data), { nextPageKey: pageKey, currentPage: page, cacheTime: moment().unix(), startQuery: true })), time * 2);
        }
    async getAlchemyCacheCollectionData(getNFTInput: any, key: any, page: any, qsData: any) {
            const cacheData = await this.redisService.getCacheData(key);
            if (cacheData) {
                const data = JSON.parse(cacheData);
                const { nextPageKey, list, total, currentPage, cacheTime, startQuery } = data;
                const diff = moment().unix() - cacheTime;
                const nftDataList = {
                    total,
                    list: [],
                };
                this.logger.log(`query alchemy cache data from ${key}, page = ${page} cache page = ${currentPage} cache total = ${total} diff = ${diff} startQuery = ${startQuery}`);
                if (total <= 20 && page > currentPage) {
                    return nftDataList;
                }
                if (currentPage === page && diff < TIME.ONE_MINUTE) {
                    return {
                        list,
                        total,
                    };
                }
                if (!startQuery && diff < TIME.ONE_MINUTE) {
                    return {
                        list,
                        total,
                    };
                }
                await this.redisService.saveCacheData(key, JSON.stringify({
                    nextPageKey,
                    list,
                    total,
                    currentPage,
                    cacheTime,
                    startQuery: false,
                }), TIME.HALF_HOUR);
                qsData.pageKey = currentPage < page + 1 ? nextPageKey : undefined;
                if (page === 1) {
                    qsData.pageKey = undefined;
                }
            }
            return await this.getAlchemyCollection(getNFTInput, qsData, true);
        }
    async getNoderalCollection(getNFTInput: any, ercType: any = 'erc721', query: any = false) {
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.getNodeRealApiKey;
            const { address, chainId } = getNFTInput;
            const page = Number.parseInt(getNFTInput.page, 10)
                ? Number.parseInt(getNFTInput.page, 10)
                : 1;
            let limit = getNFTInput.limit ? Number.parseInt(getNFTInput.limit, 10) : 20;
            limit = limit ? limit : 20;
            const size = `0x${Number(limit).toString(16)}`;
            const key = `nft:${address}:${chainId}:${ercType}:${page}:${size}`;
            this.logger.log(`[getNoderalCollection]:${key}`);
            const nftDataList = {
                total: 0,
                list: [],
            };
            if (!query) {
                const cacheData = await this.getCacheNoderalCollection(getNFTInput, ercType, key);
                return cacheData;
            }
            const url = `https://bsc-mainnet.nodereal.io/v1/${apiKey}`;
            const data = {
                jsonrpc: '2.0',
                method: 'nr_getNFTHoldings',
                params: [address, ercType, `0x${page.toString(16)}`, size],
                id: 1,
            };
            try {
                const nftData = (await this.upHttpService.httpPost(url, data));
                if (!nftData) {
                    return nftDataList;
                }
                const { list, isQuery } = await parseNodeRealCollectionList(nftData.result.details, chainId, ercType, this.nftDbService);
                nftDataList.list = list;
                if (isQuery) {
                    void this.getOpenseaCollectionByCollectionId(address, chainId);
                }
                nftDataList.total = Number(BigInt(nftData.result.totalCount));
                await this.getSaveCacheNoderalCollection(nftDataList, key);
                return nftDataList;
            }
            catch (error) {
                this.logger.warn(`[getNoderalCollection] ${key} error ${error} data = ${data.params}`);
                return nftDataList;
            }
        }
    async getSaveCacheNoderalCollection(data: any, key: any) {
            await this.redisService.saveCacheData(key, JSON.stringify(Object.assign(Object.assign({}, data), { cacheTime: moment().unix(), startQuery: true })), TIME.ONE_MINUTE * 2);
        }
    async getCacheNoderalCollection(getNFTInput: any, ercType: any, key: any) {
            const cacheData = await this.redisService.getCacheData(key);
            if (cacheData) {
                const data = JSON.parse(cacheData);
                const { list, total, cacheTime, startQuery } = data;
                const diff = moment().unix() - cacheTime;
                if (!startQuery || diff < TIME.ONE_MINUTE) {
                    return {
                        list,
                        total,
                    };
                }
                await this.redisService.saveCacheData(key, JSON.stringify({
                    list,
                    total,
                    cacheTime,
                    startQuery: false,
                }), TIME.ONE_MINUTE * 2);
                void this.getNoderalCollection(getNFTInput, ercType, true);
                return {
                    list,
                    total,
                };
            }
            const data = await this.getNoderalCollection(getNFTInput, ercType, true);
            return data;
        }
    async getAllNoderalCollection(getNFTInput: any, data: any) {
            const erc721Data = this.getNoderalCollection(getNFTInput, 'erc721');
            const erc1155Data = this.getNoderalCollection(getNFTInput, 'erc1155');
            const [erc721, erc1155] = await Promise.all([erc721Data, erc1155Data]);
            data.list = [...erc721.list, ...erc1155.list];
            data.total = erc721.total + erc1155.total;
            return data;
        }
    async getCollectionTokenList(getNFTTokenInput: any, account: any) {
            const { chainId } = getNFTTokenInput;
            const alchemySupportChainId = ['1', '5', '137', '80001', '42161', '421613'];
            const noderealSupportChainId = ['56'];
            let data = {
                total: 0,
                list: [],
            };
            const { contractAddress } = getNFTTokenInput;
            const isMainnet = this.apiConfigService.getContractConfig.isMainNet;
            this.logger.log(`[getCollectionTokenList] find nft list by user:${account.email}_${account.provider} isMainnet = ${isMainnet} address =${getNFTTokenInput.address} chainId = ${chainId}`);
            if (alchemySupportChainId.includes(chainId)) {
                data = await this.getAlchemyTokenByAPI(getNFTTokenInput);
            }
            else if (noderealSupportChainId.includes(chainId)) {
                data = await this.getNFTsByNftScan(getNFTTokenInput);
            }
            const collectionData = await this.nftDbService.findOneCollection(contractAddress);
            data.list = await getNFTTokenCacheList(data.list, contractAddress, this.nftDbService, collectionData);
            return data;
        }
    async getNftImageUrl(getNFTImageUrlInput: any, account: any) {
            const { contractAddress, tokenId, chainId } = getNFTImageUrlInput;
            let imageUrl = '';
            let openseaUrl = '';
            let name = '';
            const isMainnet = this.apiConfigService.getContractConfig.isMainNet;
            this.logger.log(`[getNftImageUrl] find nft image info by user:${account.email}_${account.provider} isMainnet = ${isMainnet} address =${getNFTImageUrlInput.address}`);
            let collectionData = await this.nftDbService.findOneCollection(contractAddress);
            if (tokenId) {
                const info = await this.getNFTImageInfo(getNFTImageUrlInput, tokenId, collectionData);
                return info;
            }
            if (!collectionData) {
                await this.getOpenSeaACollectionUrl(getNFTImageUrlInput);
                collectionData = await this.nftDbService.findOneCollection(contractAddress);
            }
            if (!(collectionData === null || collectionData === void 0 ? void 0 : collectionData.imageUrl)) {
                await this.getNFTScanCollectionUrl(getNFTImageUrlInput);
                collectionData = await this.nftDbService.findOneCollection(contractAddress);
            }
            imageUrl = (collectionData === null || collectionData === void 0 ? void 0 : collectionData.imageUrl) ? collectionData === null || collectionData === void 0 ? void 0 : collectionData.imageUrl : '';
            openseaUrl = getOpenseaUrl(chainId, collectionData === null || collectionData === void 0 ? void 0 : collectionData.slug, contractAddress);
            name = (collectionData === null || collectionData === void 0 ? void 0 : collectionData.name) ? collectionData === null || collectionData === void 0 ? void 0 : collectionData.name : '';
            return { imageUrl, openseaUrl, name };
        }
    async getNFTImageInfo(getNFTImageUrlInput: any, tokenId: any, collectionData: any) {
            const { contractAddress } = getNFTImageUrlInput;
            let data = await this.nftDbService.findOneNFT(contractAddress, tokenId);
            if (!data) {
                await this.getOpenSeaANftUrl(getNFTImageUrlInput);
                data = await this.nftDbService.findOneNFT(contractAddress, tokenId);
            }
            if (!(data === null || data === void 0 ? void 0 : data.imageUrl)) {
                await this.getNFTScanNFTInfo(getNFTImageUrlInput);
                data = await this.nftDbService.findOneNFT(contractAddress, tokenId);
            }
            const imageUrl = getNFTTokenImageUrl((data === null || data === void 0 ? void 0 : data.imageUrl) ? data === null || data === void 0 ? void 0 : data.imageUrl : '', collectionData);
            const name = (data === null || data === void 0 ? void 0 : data.name) ? data === null || data === void 0 ? void 0 : data.name : '';
            return { imageUrl, openseaUrl: '', name };
        }
    async getOpenSeaACollectionUrl(getNFTImageUrlInput: any) {
            const { chainId, contractAddress } = getNFTImageUrlInput;
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.openSeaApiKey;
            const { url, config } = initOpenSeaACollectionUrl(contractAddress, chainId, apiKey);
            const data = (await this.upHttpService.httpGet(url, config));
            if (!data) {
                return;
            }
            const collections = parseOpenSeaOneCollection(data);
            if (collections.length > 0) {
                await this.nftDbService.saveCollectionsToDb(collections);
            }
        }
    async getNFTScanCollectionUrl(getNFTImageUrlInput: any) {
            const { chainId, contractAddress } = getNFTImageUrlInput;
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.nftScanApiKey;
            const { url, config } = initNFTScanCollectionUrl(contractAddress, chainId, apiKey);
            const data = (await this.upHttpService.httpGet(url, config));
            if (!data) {
                return;
            }
            const collections = parseNFTScanCollection(data, this.logger);
            if (collections.length > 0) {
                await this.nftDbService.saveCollectionsToDb(collections);
            }
        }
    async getOpenSeaANftUrl(getNFTImageUrlInput: any) {
            const { chainId, contractAddress, tokenId } = getNFTImageUrlInput;
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.openSeaApiKey;
            const { url, config } = initOpenSeaANftUrl(contractAddress, tokenId, chainId, apiKey);
            const data = (await this.upHttpService.httpGet(url, config));
            if (!data) {
                return;
            }
            const nfts = parseOpenSeaOneCollectionNft(contractAddress, data);
            if (nfts.length > 0) {
                await this.nftDbService.saveNFTokenDb(nfts);
            }
        }
    async getNFTScanNFTInfo(getNFTImageUrlInput: any) {
            const { chainId, contractAddress, tokenId } = getNFTImageUrlInput;
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.nftScanApiKey;
            const { url, config } = initNFTScanNFTUrl(contractAddress, tokenId, chainId, apiKey);
            const data = (await this.upHttpService.httpGet(url, config));
            this.logger.log(`[getNFTScanNFTInfo] data  ${JSON.stringify(data)}`);
            if (!data) {
                return;
            }
            const nfts = parseNFTScanNft(contractAddress, data, this.logger);
            this.logger.log(`[getNFTScanNFTInfo] nfts  ${JSON.stringify(nfts)}`);
            if (nfts.length > 0) {
                await this.nftDbService.saveNFTokenDb(nfts);
            }
        }
    async getAlchemyTokenByAPI(getNFTTokenInput: any, options?: any, query: any = false) {
            const { chainId, contractAddress, address } = getNFTTokenInput;
            const page = Number.parseInt(getNFTTokenInput.page, 10)
                ? Number.parseInt(getNFTTokenInput.page, 10)
                : 1;
            let limit = Number.parseInt(getNFTTokenInput.limit, 10)
                ? Number.parseInt(getNFTTokenInput.limit, 10)
                : 20;
            limit = limit ? limit : 20;
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.getAlchemyApiKey;
            const key = `nft:tokens:${address}:${chainId}:${contractAddress}:${limit}`;
            this.logger.log(`[getAlchemyTokenByAPI]:${key}`);
            const { url, qsData: qsOptions } = initAlchemyNFTTokenUrl(address, contractAddress, apiKey, chainId, options, limit);
            if (!query) {
                const cacheData = await this.getAlchemyCacheTokenData(getNFTTokenInput, page, key, qsOptions);
                return cacheData;
            }
            let data = (await this.upHttpService.httpGet(url));
            if (!data) {
                data = (await this.upHttpService.httpGet(url.replace('&orderBy=transferTime', '')));
            }
            const nftDataList = {
                total: 0,
                list: [],
            };
            if (!data) {
                return nftDataList;
            }
            const { list, isQuery } = await parseAlchemyNFTListByApi(data.ownedNfts, contractAddress, this.nftDbService);
            nftDataList.list = list;
            nftDataList.total = data.totalCount;
            await this.getSaveCacheAlchemyData(nftDataList, key, page, data.pageKey, false);
            if (isQuery) {
                void this.getOpenseaNFTTokenByCollection(address, contractAddress, chainId);
            }
            return nftDataList;
        }
    async getAlchemyCacheTokenData(getNFTInput: any, page: any, key: any, options: any) {
            const cacheData = await this.redisService.getCacheData(key);
            if (cacheData) {
                const data = JSON.parse(cacheData);
                const { nextPageKey, list, total, currentPage, cacheTime, startQuery } = data;
                const nftDataList = {
                    total,
                    list: [],
                };
                const diff = moment().unix() - cacheTime;
                this.logger.log(`query alchemy cache data from ${key}, page = ${page} cache page = ${currentPage} cache total = ${total} diff = ${diff} startQuery = ${startQuery}`);
                if (total <= 20 && page > currentPage) {
                    return nftDataList;
                }
                if (currentPage === page && diff < TIME.ONE_MINUTE) {
                    return {
                        list,
                        total,
                    };
                }
                if (!startQuery && diff < TIME.ONE_MINUTE) {
                    return {
                        list,
                        total,
                    };
                }
                await this.redisService.saveCacheData(key, JSON.stringify({
                    nextPageKey,
                    list,
                    total,
                    currentPage,
                    cacheTime,
                    startQuery: false,
                }), TIME.ONE_MINUTE * 2);
                options.pageKey = currentPage < page + 1 ? nextPageKey : undefined;
                if (page === 1) {
                    options.pageKey = undefined;
                }
            }
            const data = await this.getAlchemyTokenByAPI(getNFTInput, options, true);
            return data;
        }
    async getNFTsByNftScan(getNFTTokenInput: any) {
            const { chainId, contractAddress, address } = getNFTTokenInput;
            const page = Number.parseInt(getNFTTokenInput.page, 10)
                ? Number.parseInt(getNFTTokenInput.page, 10)
                : 1;
            let limit = Number.parseInt(getNFTTokenInput.limit, 10)
                ? Number.parseInt(getNFTTokenInput.limit, 10)
                : 20;
            limit = limit ? limit : 20;
            const nftDataList = {
                total: 0,
                list: [],
            };
            const key = `nft:tokens:${address}:${contractAddress}:${page}`;
            let cursor = await this.getNftScanCursor(address, contractAddress, page);
            if (cursor === 'NULL') {
                return nftDataList;
            }
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.nftScanApiKey;
            const { url, config } = initNftScanUrl(address, contractAddress, apiKey, cursor, limit);
            const data = (await this.upHttpService.httpGet(url, config))
                .data;
            if (!data || !data.content) {
                return nftDataList;
            }
            const { list, isQuery } = await parseNFTSScanTokenList(data.content, address, this.nftDbService);
            nftDataList.list = list;
            nftDataList.total = data.total;
            const time = TIME.ONE_MINUTE * 2;
            cursor = data.next ? data.next : 'NULL';
            await this.redisService.saveCacheData(key, cursor, time);
            if (isQuery) {
                void this.getOpenseaNFTTokenByCollection(contractAddress, address, chainId);
            }
            return nftDataList;
        }
    async getNftScanCursor(address: any, contractAddress: any, page: any) {
            const key = `nft:tokens:${address}:${contractAddress}:${page > 1 ? page - 1 : page}`;
            let cursor = await this.redisService.getCacheData(key);
            if (page === 1) {
                for (let item = 0; item < 10; item++) {
                    let oldKey = `nft:tokens:${address}:${contractAddress}:${item}`;
                    await this.redisService.deleteCacheData(oldKey);
                }
                return undefined;
            }
            if (page > 1 && !cursor) {
                cursor = 'NULL';
            }
            return cursor;
        }
}
