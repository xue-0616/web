import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { DeploymentTokenEntity, DeploymentTokenStatus } from '../../../database/entities/deployment.token.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { BtcService } from '../../btc/btc.service';
import { RgbPPIndexerService } from '../indexer.service';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import { RedlockService } from '../../../common/utils-service/redlock.service';
import Decimal from 'decimal.js';
import { TokenStatisticService } from './token.statistic.service';
import { TIME } from '../../../common/utils/const.config';

@Injectable()
export class TokenMintService {
    constructor(@InjectRedis() private readonly redis: Redis, private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly btcService: BtcService, private readonly redlockService: RedlockService, private readonly rgbppIndexerService: RgbPPIndexerService, @InjectRepository(DeploymentTokenEntity) private deploymentTokenEntity: Repository<DeploymentTokenEntity>) {
        this.logger.setContext(TokenStatisticService.name);
        this.syncAllTokenMintProgress();
    }
    async getMintingTokens(currentBlock: number): Promise<DeploymentTokenEntity[]> {
            const query = this.deploymentTokenEntity
                .createQueryBuilder('deployment_tokens')
                .where('deployment_tokens.status = :status', {
                status: DeploymentTokenStatus.DeployTokenSuccess,
            })
                .andWhere('minted_ratio < :mintedRatio', { mintedRatio: 1 })
                .andWhere('btc_tx_block_height + relative_start_block <= :currentBlock', {
                currentBlock,
            })
                .leftJoinAndSelect('deployment_tokens.token', 'token');
            const tokens = await query.getMany();
            return tokens;
        }
    async syncTokenMintProgress(token: DeploymentTokenEntity): Promise<void> {
            try {
                const { token: { xudtTypeHash }, relativeStartBlock: relativeStartBlock, paymasterAddress, btcTxBlockHeight, } = token;
                const paymasterAmount = this.appConfig.rgbPPConfig.ckbCellCost +
                    this.appConfig.rgbPPConfig.mintFee;
                const startBlock = relativeStartBlock + btcTxBlockHeight;
                const mintTxsCountPromise = this.rgbppIndexerService.getTokenMintTxsCount(xudtTypeHash, startBlock, paymasterAddress, paymasterAmount.toString());
                const displacedTokenTypeHash = this.appConfig.displacedTokens.get(token.token.symbol);
                let displacedMintTxsCountPromise = new Promise((resolve) => {
                    resolve({
                        count: 0,
                    });
                });
                if (displacedTokenTypeHash !== undefined) {
                    displacedMintTxsCountPromise =
                        this.rgbppIndexerService.getTokenMintTxsCount(displacedTokenTypeHash, startBlock, paymasterAddress, paymasterAmount.toString());
                }
                const [mintTxsCount, displacedMintTxsCount] = await Promise.all([
                    mintTxsCountPromise,
                    displacedMintTxsCountPromise,
                ]);
                if (!mintTxsCount && !displacedMintTxsCount)
                    return;
                let count = mintTxsCount ? (mintTxsCount as any).count : 0;
                count += displacedMintTxsCount ? (displacedMintTxsCount as any).count : 0;
                if (count === 0)
                    return;
                this.logger.log(`[syncTokenMintProgress] token=${token.token.symbol} hash=${xudtTypeHash} mintCount = ${count}`);
                token.mintedAmount = count;
                const limitedCount = token.totalSupply.div(token.amountPerMint);
                token.mintedRatio = new Decimal(count).div(limitedCount);
                await this.deploymentTokenEntity.save(token);
            }
            catch (err) {
                this.logger.error(`[syncTokenMintProgress] token = ${token.id} err, ${err}`, (err as Error)?.stack);
            }
        }
    syncAllTokenMintProgressCacheKey() {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Task:SyncAllTokenMintProgress:{tag}`;
        }
    @Cron('0 */1 * * * *')
    async syncAllTokenMintProgress(): Promise<void> {
            const key = this.syncAllTokenMintProgressCacheKey();
            const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
            if (lock) {
                this.logger.log('[syncAllTokenMintProgress] task start');
                try {
                    const currentBlock = await this.btcService.getBlockHeigh();
                    const tokens = await this.getMintingTokens(currentBlock);
                    this.logger.log(`[syncAllTokenMintProgress] start sync tokens.length = ${tokens.length} currentBlock = ${currentBlock}`);
                    for (const token of tokens) {
                        await this.syncTokenMintProgress(token);
                    }
                }
                catch (err) {
                    this.logger.error(`[syncAllTokenMintProgress] err: ${err}`, (err as Error)?.stack);
                }
                finally {
                    await this.redlockService.releaseLock(lock);
                }
            }
            else {
                this.logger.log('[syncAllTokenMintProgress] task is already running on another instance');
            }
        }
}
