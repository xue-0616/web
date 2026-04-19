import { Injectable } from '@nestjs/common';
import ABI_json from './abi/ABI.json';
import NFT_json from './abi/NFT.json';
import { BigNumber, Contract, providers } from 'ethers';
import { MAINNET_UNIPASS_WALLET_CONTEXT, TESTNET_UNIPASS_WALLET_CONTEXT } from '@unipasswallet/network';
import { moduleMain } from '@unipasswallet/abi';
import { encodeTypedDataDigest } from '@unipasswallet/popup-utils';
import { getSignMessage } from './utils/chain.info';
import { getNftIndexByAddress } from './utils/universe';

@Injectable()
export class ChainService {
    constructor(apiConfig: any, logger: any, upHttpService: any) {
        this.apiConfig = apiConfig;
        this.logger = logger;
        this.upHttpService = upHttpService;
        this.logger.setContext(ChainService.name);
        this.initContract();
    }
    apiConfig: any;
    logger: any;
    upHttpService: any;
    genProvider: any;
    moduleMainContract: any;
    initContract() {
            this.genProvider = new providers.JsonRpcProvider(`${this.apiConfig.getContractConfig.genNodeUrl}`);
            const unipassWalletContext = this.apiConfig.getContractConfig.isMainNet
                ? MAINNET_UNIPASS_WALLET_CONTEXT
                : TESTNET_UNIPASS_WALLET_CONTEXT;
            this.moduleMainContract = new Contract(unipassWalletContext.moduleMain, moduleMain.abi, this.genProvider);
            console.info({ isMainnet: this.apiConfig.getContractConfig.isMainNet });
        }
    async isUniPassAddress(address: any) {
            let source;
            let proxyModuleMainContract;
            try {
                proxyModuleMainContract = this.moduleMainContract.attach(address);
            }
            catch (error) {
                this.logger.warn(`[isUniPassAddress] attach ${error}, data=${address}`);
                return source !== undefined;
            }
            try {
                source = await proxyModuleMainContract.getSource();
            }
            catch (error) {
                this.logger.warn(`[getSource]${error}, data=${JSON.stringify({
                    address,
                })}`);
            }
            return source !== undefined;
        }
    async verifyIsValidTypedDataSignature(claimInfo: any, chainId: any, typeData: any) {
            const body = {
                walletAddress: claimInfo.sender,
                chainId,
                signature: claimInfo.signature,
                typeData,
            };
            const url = `${this.apiConfig.activityConfig.openApiHost}/API/IsValidTypedDataSignature`;
            const data = await this.upHttpService.httpPost(url, body, {
                headers: { 'Content-Type': 'application/json' },
            });
            if (!data) {
                return false;
            }
            this.logger.log(`[verifyIsValidTypedDataSignature] data  =${JSON.stringify({
                data,
            })}`);
            return data.isValid;
        }
    async checkNFTOwnerIsSender(claimInfo: any) {
            const { tokenId, contractAddress, sender } = claimInfo;
            try {
                const contract = new Contract(contractAddress, NFT_json, this.genProvider);
                const realOwner = (await contract.ownerOf(tokenId)).toLowerCase();
                this.logger.error(`[checkNFTOwnerIsSender] contractAddress=${contractAddress} tokenId=${tokenId} realOwner = ${realOwner}`);
                return realOwner === sender.toLowerCase();
            }
            catch (_a) {
                this.logger.error(`[checkNFTOwnerIsSender] query nft ownerOf abi error contractAddress=${contractAddress} tokenId=${tokenId}`);
                return false;
            }
        }
    async checkSignIsClaimed(typeData: any) {
            const messageHash = encodeTypedDataDigest(typeData);
            const entrypointAddress = this.apiConfig.activityConfig.entrypointAddress;
            try {
                const entryContract = new Contract(entrypointAddress, ABI_json, this.genProvider);
                const claimed = await entryContract._claimed(messageHash);
                return claimed;
            }
            catch (error) {
                this.logger.error(`[checkSignIsClaimed] _claimed contractAddress=${messageHash} entrypointAddress = ${entrypointAddress} error ${error}`);
                return false;
            }
        }
    async verifySignature(claimInfo: any) {
            const { contractAddress, deadline, sender, tokenId } = claimInfo;
            const isOwnerOf = await this.checkNFTOwnerIsSender(claimInfo);
            if (!isOwnerOf) {
                return false;
            }
            const chainId = this.apiConfig.getContractConfig.isMainNet
                ? '137'
                : '80001';
            const typeData = getSignMessage(sender, getNftIndexByAddress(contractAddress, this.logger), BigNumber.from(tokenId).toString(), deadline, this.apiConfig.activityConfig.entrypointAddress, Number(chainId));
            const isClaimed = await this.checkSignIsClaimed(typeData);
            this.logger.error(`[verifyIsSignature] nft ${contractAddress}:${tokenId} sender ${sender} is claimed = ${isClaimed}`);
            if (isClaimed) {
                return false;
            }
            const isSignatureValid = await this.verifyIsValidTypedDataSignature(claimInfo, chainId, typeData);
            this.logger.error(`[verifyIsSignature] nft ${contractAddress}:${tokenId} sender ${sender} sSignature valid is ${isSignatureValid}`);
            if (!isSignatureValid) {
                return false;
            }
            return true;
        }
}
