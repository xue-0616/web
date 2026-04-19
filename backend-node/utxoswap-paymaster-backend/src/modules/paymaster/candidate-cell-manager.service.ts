import { AppLoggerService } from '../../common/utils-service/logger.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { IndexerCell } from '@rgbpp-sdk/ckb';
import { CkbCellOutputDto } from './dtos/ckb-cell.output';
import { RedlockService } from '../../common/utils-service/redlock.service';
import { AddressPrefix, addressToScript, privateKeyToAddress, scriptToHash } from '@nervosnetwork/ckb-sdk-utils';
import { DispatcherTransactionBuilder } from './transaction-builder';
import { MyCustomException, MyErrorCode } from '../../filters/custom.exception';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Cron } from '@nestjs/schedule';
import { Collector } from '@rgbpp-sdk/ckb';

@Injectable()
export class CandidateCellManagerService {
    private readonly _collector: Collector;
    private readonly _providerCkbAddress: string;
    private readonly _candidateCellCapacity: bigint;
    private readonly _builder: DispatcherTransactionBuilder;

    constructor(
        private readonly logger: AppLoggerService,
        @InjectRedis() private readonly redis: Redis,
        private readonly appConfig: AppConfigService,
        private readonly redlockService: RedlockService,
    ) {
        this._collector = new Collector({
            ckbNodeUrl: this.appConfig.cellManagerConfig.ckbNodeUrl,
            ckbIndexerUrl: this.appConfig.cellManagerConfig.ckbIndexerUrl,
        });
        this._providerCkbAddress = privateKeyToAddress(this.appConfig.cellManagerConfig.cellManagerKey, {
            prefix: !this.appConfig.isTestnet
                ? AddressPrefix.Mainnet
                : AddressPrefix.Testnet,
        });
        this._candidateCellCapacity = BigInt(this.appConfig.cellManagerConfig.candidateCellCapacity);
        this._builder = new DispatcherTransactionBuilder(this._collector, !this.appConfig.isTestnet, this.appConfig.cellManagerConfig.cellManagerKey);
    }
    async saveCandidateCellToCache(userLock: any, data: any, expiration: number): Promise<void> {
        await this.redis.setex(this.getCachedKeyForLock(userLock), expiration, JSON.stringify(data));
        await this.redis.setex(this.getCachedKeyForCell(data.ckbInputCell.outPoint), expiration, `${scriptToHash(userLock)}`);
    }
    async getCandidateCellFromCache(lock: any): Promise<CkbCellOutputDto | null> {
        const cellStr = await this.redis.get(this.getCachedKeyForLock(lock));
        if (cellStr != null) {
            const ret = JSON.parse(cellStr);
            const liveCell = await this._collector.getLiveCell(ret.ckbInputCell.outPoint);
            if (!!liveCell)
                return ret;
        }
        return null;
    }
    getCachedKeyForLock(lock: any): string {
        return `${this.appConfig.nodeEnv}:Utxoswap:Paymaster:CellByLock:${scriptToHash(lock)}{tag}`;
    }
    getCachedKeyForCell(outpoint: any): string {
        const { txHash, index } = outpoint;
        return `${this.appConfig.nodeEnv}:Utxoswap:Paymaster:LockByCell:${txHash}_${index}{tag}`;
    }
    getCandidateCellSetKey(): string {
        return `${this.appConfig.nodeEnv}:Utxoswap:Paymaster:CandidateCellSetKey{tag}`;
    }
    getPopCandidateCellRedlockKey(): string {
        const key = `${this.appConfig.nodeEnv}:Utxoswap:Paymaster:PopCandidateCell_AcquireLock{tag}`;
        return key;
    }
    async popCandidateCell(): Promise<IndexerCell> {
        const key = this.getPopCandidateCellRedlockKey();
        const redlock = await this.redlockService.acquireLock([key], 2 * 1000);
        if (redlock) {
            this.logger.log('[popCandidateCell] start');
            try {
                const cellStr = await this.redis.spop(this.getCandidateCellSetKey());
                if (!!cellStr) {
                    return JSON.parse(cellStr);
                }
                else {
                    throw new MyCustomException('No candidate cell', MyErrorCode.PaymasterOutOfService);
                }
            }
            catch (err) {
                this.logger.error(`[popCandidateCell] err: ${err}`);
                throw err;
            }
            finally {
                await this.redlockService.releaseLock(redlock);
            }
        }
        else {
            this.logger.log('[popCandidateCell] failed to get red lock');
            throw new MyCustomException('failed to get lock', MyErrorCode.PaymasterOutOfService);
        }
    }
    async pushCandidateCells(cells: any[]) {
        if (!cells || cells.length === 0)
            return;
        this.logger.log(`[pushCandidateCells] Start to add ${cells.length} cells to set`);
        const newCellsNum = await this.redis.sadd(this.getCandidateCellSetKey(), ...cells.map((x) => JSON.stringify(x)));
        this.logger.log(`[pushCandidateCells] Finally ${newCellsNum} cells added to set`);
    }
    async groupPaymasterCells(cells: any[]) {
        const occupiedCells = [];
        const candidateCells = [];
        const emptyCells = [];
        for (const cell of cells) {
            if (cell.output.capacity !== `0x${this._candidateCellCapacity.toString(16)}`) {
                emptyCells.push(cell);
                continue;
            }
            const utxo = await this.redis.get(this.getCachedKeyForCell(cell.outPoint));
            if (!!utxo) {
                occupiedCells.push(cell);
            }
            else {
                candidateCells.push(cell);
            }
        }
        return [emptyCells, candidateCells, occupiedCells];
    }
    async collectCell(address: string, capacity?: bigint): Promise<IndexerCell[]> {
        const emptyCells = await this._collector.getCells({
            lock: addressToScript(address),
        });
        this.logger.log(`[collectCell]${emptyCells.length}, ${addressToScript(address)}`);
        const collectedCells = [];
        for (const cell of emptyCells) {
            if (capacity && BigInt(cell.output.capacity) < capacity) {
                continue;
            }
            collectedCells.push(cell);
        }
        return collectedCells;
    }
    async generateCandidateCells(): Promise<string | undefined> {
        this.logger.log(`[generateCandidateCells] generate cell for ${this._providerCkbAddress}`);
        const cells = await this.collectCell(this._providerCkbAddress);
        const [emptyCells, candidateCells, occupiedCells] = await this.groupPaymasterCells(cells);
        await this.pushCandidateCells(candidateCells);
        if (emptyCells.length === 0) {
            throw new Error('No empty cells to generate candidate deploy cell');
        }
        if (candidateCells.length <
            this.appConfig.cellManagerConfig.candidateCellMaxNumber) {
            const needCellCount = this.appConfig.cellManagerConfig.candidateCellMaxNumber -
                candidateCells.length;
            this.logger.log(`start generate candidate cell`);
            const totalCapacity = emptyCells.reduce((sum, a) => sum + BigInt(a.output.capacity), BigInt(0));
            const maxCount = (totalCapacity - BigInt(62 * 10 ** 8)) / this._candidateCellCapacity;
            const count = maxCount > needCellCount ? needCellCount : maxCount;
            if (count === BigInt(0)) {
                throw new Error(`Empty Cells' Capacity ${totalCapacity} Not Enough to generate candidate deploy cell`);
            }
            const unsignedTx = this._builder.generateCandidateCellTransaction(emptyCells, this._candidateCellCapacity, Number(count));
            const signedTx = this._collector
                .getCkb()
                .signTransaction(this.appConfig.cellManagerConfig.cellManagerKey)(unsignedTx);
            const txHash = await this._collector
                .getCkb()
                .rpc.sendTransaction(signedTx, 'passthrough');
            this.logger.log(`[generateCandidateCells] tx ${txHash} sent successfully`);
            return txHash;
        }
    }
    // BUG-17 fix: Added retry logic for cell generation to prevent temporary paymaster unavailability
    @Cron('0 */1 * * * *')
    async watchCandidateCells(): Promise<void> {
        const key = `${this.appConfig.nodeEnv}:Utxoswap:Paymaster:WatchCandidateCells_AcquireLock{tag}`;
        const lock = await this.redlockService.acquireLock([key], 30 * 1000);
        if (lock) {
            this.logger.log('[watchCandidateCells] task start');
            const MAX_RETRIES = 3;
            let lastErr: any = null;
            try {
                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        await this.generateCandidateCells();
                        lastErr = null;
                        break;
                    } catch (err) {
                        lastErr = err;
                        this.logger.error(`[watchCandidateCells] attempt ${attempt}/${MAX_RETRIES} failed: ${err}`);
                        if (attempt < MAX_RETRIES) {
                            // Wait before retrying (exponential backoff: 2s, 4s)
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        }
                    }
                }
                if (lastErr) {
                    this.logger.error(`[watchCandidateCells] all ${MAX_RETRIES} retries failed`);
                }
            }
            finally {
                await this.redlockService.releaseLock(lock);
            }
        }
        else {
            this.logger.log('[watchCandidateCells] task is already running on another instance');
        }
    }
}
