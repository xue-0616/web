import { BadRequestException, Injectable } from '@nestjs/common';
import shortid from 'shortid';
import { StatusName, TIME } from '../../shared/utils';
import { NFTs, getRandomNftMint } from './utils/universe';
import { keccak256, solidityPack } from 'ethers/lib/utils';
import { Wallet } from 'ethers/lib/ethers';
import { joinSignature } from '@ethersproject/bytes';

@Injectable()
export class ActivityService {
    constructor(apiConfig: any, redisService: any, logger: any, chainService: any) {
        this.apiConfig = apiConfig;
        this.redisService = redisService;
        this.logger = logger;
        this.chainService = chainService;
        this.logger.setContext(ActivityService.name);
    }
    apiConfig: any;
    redisService: any;
    logger: any;
    chainService: any;
    async isUniPassAddress(address: any) {
            const isUniPassAddress = await this.chainService.isUniPassAddress(address);
            if (!isUniPassAddress) {
                throw new BadRequestException(StatusName.ACCOUNT_NOT_FIND);
            }
        }
    checkOutput(cacheData: any) {
            const { nftIndex, contractAddress } = cacheData;
            for (const item of NFTs) {
                if (item.NFTIndex === nftIndex &&
                    item.contractAddress !== contractAddress) {
                    cacheData.contractAddress = item.contractAddress;
                }
            }
            return cacheData;
        }
    async getMintToken(input: any) {
            const { qrCodeId, address } = input;
            await this.isUniPassAddress(address);
            const key = `activity:wx:${address}_${qrCodeId}`;
            const signatureInfo = await this.redisService.getCacheData(key);
            if (signatureInfo) {
                this.logger.log(`[getMintToken] ${key} cache data exist ${signatureInfo} from ${address}`);
                const data = JSON.parse(signatureInfo);
                return this.checkOutput(data);
            }
            const nft = getRandomNftMint(this.logger);
            const nftIndex = nft.NFTIndex;
            const hash = keccak256(solidityPack(['address', 'uint256', 'uint256'], [address, qrCodeId, nftIndex]));
            const adminKey = this.apiConfig.activityConfig.adminKey;
            const wallet = new Wallet(adminKey);
            const signature = joinSignature(wallet._signingKey().signDigest(hash));
            this.logger.log(`[getMintToken] address=${address}_${qrCodeId}  wallet address = ${wallet.address},raw data = ${JSON.stringify({
                address,
                qrCodeId,
                nftIndex,
                hash,
                signature,
            })}`);
            const output = {
                contractAddress: nft.contractAddress,
                signature,
                nftIndex,
            };
            await this.redisService.saveCacheData(key, JSON.stringify(output), TIME.DAY * 20);
            this.logger.log(`[getMintToken] ${key} Initialization request ${JSON.stringify(output)} from ${address}`);
            return output;
        }
    async getShortKey(input: any) {
            const { tokenId, contractAddress, address } = input;
            await this.isUniPassAddress(address);
            const key = `activity:${address.toLocaleLowerCase()}:${contractAddress}:${tokenId}`;
            let shortKey = await this.redisService.getCacheData(key);
            this.logger.log(`[getShortKey] key ${key} bind shortKey = ${shortKey}`);
            if (shortKey) {
                const isValid = await this.checkSignIsValid(shortKey);
                if (isValid) {
                    this.logger.log(`[getShortKey] ${key} old key valid ${shortKey},return  ${shortKey}`);
                    return { shortKey };
                }
            }
            shortKey = await this.saveClaimInfo(input, address, key);
            return { shortKey };
        }
    async checkSignIsValid(shortKey: any) {
            const claimInfoStr = await this.redisService.getCacheData(shortKey);
            if (claimInfoStr) {
                const claimInfo = JSON.parse(claimInfoStr);
                const isValidSign = await this.chainService.verifySignature(claimInfo);
                this.logger.log(`[checkSignIsValid] ${shortKey},isValidSign = ${isValidSign}`);
                if (!isValidSign) {
                    await this.redisService.deleteCacheData(shortKey);
                }
                return isValidSign;
            }
            return false;
        }
    async saveClaimInfo(input: any, address: any, key: any) {
            const shortKey = shortid.generate();
            const { tokenId, deadline, signature, contractAddress } = input;
            const claimInfo = {
                tokenId,
                deadline,
                signature,
                sender: address,
                contractAddress,
            };
            await this.redisService.saveCacheData(shortKey, JSON.stringify(claimInfo), TIME.DAY * 20);
            await this.redisService.saveCacheData(key, shortKey, TIME.DAY * 20);
            this.logger.log(`[saveClaimInfo] key = ${key} bind shortKey: ${shortKey} claimInfo ${JSON.stringify(claimInfo)}`);
            return shortKey;
        }
    async getShortClaim(input: any) {
            const { shortKey } = input;
            const isShortId = shortid.isValid(shortKey);
            if (!isShortId) {
                this.logger.warn(`[getShortClaim] shortKey:${shortKey} not valid`);
                throw new BadRequestException(StatusName.SHORT_KEY_NOT_FIND);
            }
            const isSignatureValid = await this.checkSignIsValid(shortKey);
            if (!isSignatureValid) {
                this.logger.log(`[getShortClaim] rm invalid short key ${shortKey}  `);
                throw new BadRequestException(StatusName.SHORT_KEY_NOT_FIND);
            }
            const claimInfoStr = await this.redisService.getCacheData(shortKey);
            if (!claimInfoStr) {
                throw new BadRequestException(StatusName.SHORT_KEY_NOT_FIND);
            }
            this.logger.log(`[getShortClaim] return shortKey:${shortKey} data ${claimInfoStr} `);
            const claimInfo = JSON.parse(claimInfoStr);
            return claimInfo;
        }
}
