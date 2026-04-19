import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { GetNonceInput, GetNonceOutput } from './dto/get.nonce.dto';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import Redis from 'ioredis';
import { UserLoginInput, UserLoginOutput } from './dto/user.login.dto';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { IJwt } from '../../common/interface/jwt';
import { AssetsInputDto } from './dto/assets.input.dto';
import { AssetInfo, AssetsOutputDto } from './dto/assets.output.dto';
import { RgbPPIndexerService } from '../rgbpp/indexer.service';
import { TokensService } from '../rgbpp/tokens/tokens.service';
import { BtcAssetsService } from '../btc/btc.assets.service';
import { BtcAssetsOutputDto } from './dto/btc.assets.output.dto';
import { MarketTokensService } from '../rgbpp/tokens/market.tokens.service';
import { BtcService } from '../btc/btc.service';
import { UsdPrice } from '../../common/interface/mempool.dto';
import Decimal from 'decimal.js';
import { randomBytes } from 'crypto';
import { TIME } from '../../common/utils/const.config';
import { StatusName } from '../../common/utils/error.code';
import { NetworkType, getAddressType, publicKeyToAddress } from '@rgbpp-sdk/btc';
import { verifyMessageOfECDSA } from '../../common/utils/ecdsa';

@Injectable()
export class UserService {
    constructor(private readonly appConfig: AppConfigService, private readonly rgbPpIndexer: RgbPPIndexerService, private readonly btcAssetsService: BtcAssetsService, private readonly tokenService: TokensService, private readonly btcService: BtcService, private readonly logger: AppLoggerService, private readonly marketTokensService: MarketTokensService, @InjectRedis() private readonly redis: Redis, private readonly jwtService: JwtService) {
        this.logger.setContext(UserService.name);
    }
    getUserNonceKey(input: any, nonce: any) {
            const { address } = input;
            return `${this.appConfig.nodeEnv}:Hue:Hub:User:Nonce:${address}:${nonce}{tag}`;
        }
    getLoginMessage(address: any, nonce: any) {
            const message = `Sign in HueHub with ${address}.\nNonce: ${nonce}.`;
            return message;
        }
    getUserRgbppCacheKey(address: string, full: boolean, tokenId: number, xudtTypeHash: string): string {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Asset:Btc:${address}:${full}_${tokenId}_${xudtTypeHash}{tag}`;
        }
    async getUserNonce(input: GetNonceInput): Promise<GetNonceOutput> {
            const buffer = randomBytes(16);
            let nonce = buffer.toString('base64');
            nonce = nonce.replaceAll(/[_\-+\/=]/g, '');
            const message = this.getLoginMessage(input.address, nonce);
            const key = this.getUserNonceKey(input, nonce);
            await this.redis.set(key, nonce, 'EX', TIME.HALF_HOUR);
            return { message, nonce };
        }
    async getAddressCacheNonce(input: GetNonceInput, nonce: string): Promise<string | null> {
            const key = this.getUserNonceKey(input, nonce);
            return await this.redis.get(key);
        }
    async delAddressCacheNonce(input: GetNonceInput, nonce: string): Promise<void> {
            const key = this.getUserNonceKey(input, nonce);
            await this.redis.del(key);
        }
    async login(input: UserLoginInput): Promise<UserLoginOutput> {
            const { address, nonce, signature, publicKey } = input;
            const cacheNonce = await this.getAddressCacheNonce({
                address: input.address,
            }, nonce);
            if (nonce !== cacheNonce) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            const message = this.getLoginMessage(input.address, nonce);
            const network = this.appConfig.isTestnet
                ? NetworkType.TESTNET
                : NetworkType.MAINNET;
            try {
                const addressType = getAddressType(address);
                const addr = publicKeyToAddress(publicKey, addressType, network);
                if (addr !== address) {
                    this.logger.log(`[login error] signature verified is false`);
                    throw new BadRequestException(StatusName.SignatureError);
                }
                const isVerified = verifyMessageOfECDSA(publicKey, message, signature);
                if (isVerified) {
                    const accessToken = this.jwtService.sign({ address, publicKey });
                    await this.delAddressCacheNonce({ address: input.address }, nonce);
                    return { isVerified, accessToken };
                }
                else {
                    this.logger.log(`[login error] signature verified is false`);
                    throw new BadRequestException(StatusName.SignatureError);
                }
            }
            catch (error) {
                this.logger.error(`[login error] ${(error as Error).message}`);
                throw new BadRequestException(StatusName.SignatureError);
            }
        }
    verifyToken(token: string): IJwt | undefined {
            try {
                const data = this.jwtService.verify(token);
                return data;
            }
            catch (error) {
                return undefined;
            }
        }
    async getRgbppAssetsByUser(user: IJwt, input: AssetsInputDto): Promise<AssetsOutputDto> {
            let { tokenId, fullUTXO, xudtTypeHash } = input;
            let tokens = [];
            const key = this.getUserRgbppCacheKey(user.address, fullUTXO, tokenId, xudtTypeHash);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let [btcUsd, btcBalance] = await Promise.all([
                this.btcService.getBtcPrice(),
                this.btcAssetsService.getBtcBalance(user.address),
            ]);
            let frozenBalance = btcBalance ? btcBalance.pending_satoshi : 0;
            let availableBalance = btcBalance ? btcBalance.satoshi : 0;
            let balance = frozenBalance + availableBalance;
            if (tokenId || xudtTypeHash) {
                tokens = await this.getOneTokenAssets(user.address, btcUsd, tokenId, xudtTypeHash);
            }
            else {
                tokens = await this.getAllTokenAssets(user.address, btcUsd, fullUTXO);
            }
            let data = {
                tokens,
                balance: balance.toString(),
                frozenBalance: frozenBalance.toString(),
                availableBalance: availableBalance.toString(),
            };
            await this.redis.set(key, JSON.stringify(data), 'EX', TIME.TEN_SECOND);
            return data;
        }
    async getAllTokenAssets(address: string, btcUsd: UsdPrice, fullUTXO: boolean): Promise<AssetInfo[]> {
            let balances = await this.rgbPpIndexer.getAccountBalance(address);
            if (!balances) {
                this.logger.warn(`[getAllTokenAssets] getAccountBalance not find`);
                return [];
            }
            let tokens: any[] = [];
            const items = await this.tokenService.itemService.getListingAndPendingItemsByAddress(address);
            for (const { tokenTypeHash, amount } of balances.list) {
                let [tokenEntity, pricePerToken] = await this.marketTokensService.getOneTokenInfo({
                    xudtTypeHash: tokenTypeHash,
                });
                if (!tokenEntity) {
                    continue;
                }
                let tokenInfo = this.tokenService.renderOneTokenInfo(tokenEntity, pricePerToken, new Decimal(amount), btcUsd);
                let utxos: any[] = [];
                if (fullUTXO) {
                    let tokenOutpoints = await this.rgbPpIndexer.getAccountTokenOutpoint(address, tokenTypeHash);
                    if (!tokenOutpoints) {
                        return [];
                    }
                    utxos = this.tokenService.renderUtxosStatus(tokenOutpoints, items);
                }
                tokenInfo.utxoCount = utxos.length;
                tokens.push({
                    tokenInfo,
                    utxos,
                });
            }
            return tokens;
        }
    async getOneTokenAssets(address: string, btcUsd: UsdPrice, tokenId: number, xudtTypeHash: string): Promise<AssetInfo[]> {
            const items = await this.tokenService.itemService.getListingAndPendingItemsByAddress(address);
            let [tokenEntity, pricePerToken] = await this.marketTokensService.getOneTokenInfo({
                id: tokenId,
                xudtTypeHash,
            });
            if (!tokenEntity) {
                return [];
            }
            let tokenOutpoints = await this.rgbPpIndexer.getAccountTokenOutpoint(address, tokenEntity.xudtTypeHash);
            if (!tokenOutpoints) {
                return [];
            }
            let tokenInfo = await this.tokenService.renderOneTokenInfo(tokenEntity, pricePerToken, new Decimal(tokenOutpoints.amount), btcUsd, tokenOutpoints.list.length);
            const utxos = await this.tokenService.renderUtxosStatus(tokenOutpoints, items);
            return [
                {
                    tokenInfo,
                    utxos,
                },
            ];
        }
    async getBtcAssets(user: IJwt): Promise<BtcAssetsOutputDto> {
            const { address } = user;
            const [btcUtxos, btcBalance] = await this.btcAssetsService.getAddressUtxo(address);
            let frozenBalance = btcBalance ? btcBalance.pending_satoshi : 0;
            let availableBalance = btcBalance ? btcBalance.satoshi : 0;
            let balance = frozenBalance + availableBalance;
            const data = {
                balance: balance.toString(),
                frozenBalance: frozenBalance.toString(),
                availableBalance: availableBalance.toString(),
                btcUtxos,
            };
            return data;
        }
}
