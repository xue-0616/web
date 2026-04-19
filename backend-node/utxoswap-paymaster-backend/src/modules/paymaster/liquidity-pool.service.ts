import { AppLoggerService } from '../../common/utils-service/logger.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { GetPoolResponse, SequencerConfigurations } from '../../common/utils/swap-types';
import { append0x } from '@rgbpp-sdk/ckb';
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils';
import axios from 'axios';
import { CKB_TYPE_HASH, SWAP_INTENT_CELL_CAPACITY, generateSwapIntentArgs, getAmountIn, getAmountOut, PoolStatus } from '../../common/utils/swap-utils';
import { MyCustomException, MyErrorCode } from '../../filters/custom.exception';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class LiquidityPoolService {
    constructor(
        private readonly logger: AppLoggerService,
        @InjectRedis() private readonly redis: Redis,
        private readonly appConfig: AppConfigService,
    ) {}
    async getGlobalConfiguration(): Promise<SequencerConfigurations> {
        this.logger.log(`[getGlobalConfiguration] start`);
        const key = `${this.appConfig.nodeEnv}:Utxoswap:Paymaster:Sequencer:GlobalConfig{tag}`;
        const redisRes = await this.redis.get(key);
        if (!!redisRes) {
            return JSON.parse(redisRes);
        }
        const url = `${this.appConfig.cellManagerConfig.utxoSwapServerUrl}/configurations`;
        this.logger.log(`[getGlobalConfiguration] url = ${url}`);
        const res = await axios.get(url);
        this.logger.log(`res = ${res}`);
        if (res.status !== 200) {
            throw new MyCustomException('Fetch sequencer configuration failed', MyErrorCode.SequencerConnectionErr);
        }
        const ret = res.data.data;
        await this.redis.setex(key, 60, JSON.stringify(ret));
        return ret;
    }
    async getPool(sourceToken: string, destToken: string): Promise<GetPoolResponse> {
        const joinedToken = sourceToken < destToken
            ? `${sourceToken}_${destToken}`
            : `${destToken}_${sourceToken}`;
        const key = `${this.appConfig.nodeEnv}:Utxoswap:Paymaster:Sequencer:Pool:${joinedToken}{tag}`;
        const redisRes = await this.redis.get(key);
        if (!!redisRes) {
            return JSON.parse(redisRes);
        }
        const url = `${this.appConfig.cellManagerConfig.utxoSwapServerUrl}/pool/get_pool_by_tokens`;
        const res = await axios.post(url, {
            assetXTypeHash: sourceToken,
            assetYTypeHash: destToken,
        });
        if (res.status !== 200) {
            throw new MyCustomException('Fetch sequencer pool info failed', MyErrorCode.SequencerConnectionErr);
        }
        const ret = res.data.data;
        await this.redis.setex(key, 60, JSON.stringify(ret));
        return ret;
    }
    async estimateAmountIn(ckbAmount: bigint, udtScript: any): Promise<bigint> {
        const udtScriptHash = scriptToHash(udtScript);
        const { pool, status } = await this.getPool(CKB_TYPE_HASH, udtScriptHash);
        if (status !== PoolStatus.Created || !pool) {
            throw new MyCustomException('Pool Not Exist', MyErrorCode.AssetIsNotSupport);
        }
        const isXToY = pool.assetX.typeHash === udtScriptHash;
        const reserves = isXToY
            ? [pool.assetX.reserve, pool.assetY.reserve]
            : [pool.assetY.reserve, pool.assetX.reserve];
        const reserveIn = BigInt(reserves[0]);
        const reserveOut = BigInt(reserves[1]);
        let [amountIn] = getAmountIn(ckbAmount, reserveIn, reserveOut);
        if (amountIn <= 0) {
            throw new MyCustomException('Too less liquidity', MyErrorCode.PoolLiquidityNotEnough);
        }
        amountIn = (amountIn * BigInt(110)) / BigInt(100);
        return amountIn;
    }
    async generateSwapIntentUDTCellForPaymaster(ckbAmount: bigint, paymasterLock: any, udtScript: any): Promise<{ intentCell: any; udtAmount: bigint }> {
        const udtScriptHash = scriptToHash(udtScript);
        const { pool, status } = await this.getPool(CKB_TYPE_HASH, udtScriptHash);
        if (status !== PoolStatus.Created || !pool) {
            throw new MyCustomException('Pool Not Exist', MyErrorCode.AssetIsNotSupport);
        }
        const isXToY = pool.assetX.typeHash === udtScriptHash;
        const reserves = isXToY
            ? [pool.assetX.reserve, pool.assetY.reserve]
            : [pool.assetY.reserve, pool.assetX.reserve];
        const reserveIn = BigInt(reserves[0]);
        const reserveOut = BigInt(reserves[1]);
        let [amountIn] = getAmountIn(ckbAmount, reserveIn, reserveOut);
        amountIn = (amountIn * BigInt(110)) / BigInt(100);
        const [amountOut, reserveIn1, reserveOut1] = getAmountOut(amountIn, reserveIn, reserveOut);
        // BUG-14 fix: Use 5% slippage tolerance instead of 100% (1000/1000) to prevent MEV sandwich attacks
        const intentArgs = generateSwapIntentArgs(pool, paymasterLock, amountIn, amountOut, isXToY, BigInt(50));
        const config = await this.getGlobalConfiguration();
        const intentCell = {
            capacity: append0x(SWAP_INTENT_CELL_CAPACITY.toString(16)),
            lock: {
                args: intentArgs,
                codeHash: config.intentLock.codeHash,
                hashType: config.intentLock.hashType,
            },
            type: udtScript,
        };
        return { intentCell, udtAmount: amountIn };
    }
}
