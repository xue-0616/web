import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { Collector, IndexerCell } from '@rgbpp-sdk/ckb';
import { DispatcherTransactionBuilder, UTXO } from './transaction-builder';
import { RedlockService } from '../../common/utils-service/redlock.service';
import { AddressPrefix, addressToScript, privateKeyToAddress } from '@nervosnetwork/ckb-sdk-utils';
import { TIME } from '../../common/utils/const.config';

@Injectable()
export class CkbDeployerCellProviderService {
    constructor(private readonly logger: AppLoggerService, @InjectRedis() private readonly redis: Redis, private readonly appConfig: AppConfigService, private readonly redlockService: RedlockService) {
        this._collector = new Collector({
            ckbNodeUrl: this.appConfig.rgbPPConfig.ckbNodeUrl,
            ckbIndexerUrl: this.appConfig.rgbPPConfig.ckbIndexerUrl,
        });
        this._dispatcherAddress = privateKeyToAddress(this.appConfig.ckbCellDisptacherConfig.ckbCellDispatcherKey, {
            prefix: !this.appConfig.isTestnet
                ? AddressPrefix.Mainnet
                : AddressPrefix.Testnet,
        });
        this._candidateCellCapacity = BigInt(600 * 10 ** 8);
        this._builder = new DispatcherTransactionBuilder(this._collector, !this.appConfig.isTestnet, this.appConfig.ckbCellDisptacherConfig.ckbCellDispatcherKey);
        this.watchCandidateCells();
    }
    private _collector: any;
    private _dispatcherAddress: any;
    private _candidateCellCapacity: any;
    private _builder: any;
    async fetchRgblockCellByUtxo(utxo: UTXO): Promise<{
        signedTx: CKBComponents.RawTransaction;
        predicatedCell: IndexerCell;
    }> {
            const cell = await this.fetchCandidateCellByUtxo(utxo);
            return this._builder.generateRgbLockCellTransaction(utxo, cell);
        }
    async fetchCandidateCellByUtxo(utxo: UTXO): Promise<IndexerCell> {
            const cellByUtxoKey = this.getCellByUtxoCachedKey(utxo.txHash, utxo.index);
            const cellStr = await this.redis.get(cellByUtxoKey);
            if (cellStr != null) {
                return JSON.parse(cellStr);
            }
            const cells = await this.collectCell();
            const [_, candidateCells, occupiedCells] = await this.filterCells(cells);
            if (candidateCells.length === 0) {
                throw new Error('No empty cells');
            }
            if (candidateCells.length < 20) {
                this.logger.error(`[fetchCandidateCellByUtxo] candidate cells length [${candidateCells.length}] < 20`);
            }
            const cell = candidateCells[0];
            {
                await this.redis.setex(cellByUtxoKey, 1800, JSON.stringify(cell));
                const utxoByCellKey = this.getUtxoByCellCachedKey(cell.outPoint.txHash, Number(cell.outPoint.index));
                await this.redis.setex(utxoByCellKey, 1800, `${utxo.txHash}_${utxo.index}`);
            }
            return cell;
        }
    async releaseOccupiedCellByUtxo(utxo: UTXO): Promise<void> {
            this.logger.log(`[releaseOccupiedCellByUtxo] remove occupied cell ${utxo.txHash}_${utxo.index}`);
            const { txHash, index } = utxo;
            const key = this.getCellByUtxoCachedKey(txHash, index);
            const cellStr = await this.redis.getdel(key);
            if (!!cellStr) {
                const cell = JSON.parse(cellStr);
                const { txHash: ckbTxhash, index: ckbIndex } = cell.outPoint;
                const cellBindUtxoKey = this.getUtxoByCellCachedKey(ckbTxhash, Number(ckbIndex));
                await this.redis.del(cellBindUtxoKey);
            }
        }
    async filterCells(cells: IndexerCell[]): Promise<IndexerCell[][]> {
            const occupiedCells = [];
            const candidateCells = [];
            const emptyCells = [];
            for (const cell of cells) {
                if (cell.output.capacity !== `0x${this._candidateCellCapacity.toString(16)}`) {
                    emptyCells.push(cell);
                    continue;
                }
                const utxo = await this.redis.get(this.getUtxoByCellCachedKey(cell.outPoint.txHash, Number(cell.outPoint.index)));
                if (!!utxo) {
                    occupiedCells.push(cell);
                }
                else {
                    candidateCells.push(cell);
                }
            }
            return [emptyCells, candidateCells, occupiedCells];
        }
    async generateCandidateCells(): Promise<string> {
            const cells = await this.collectCell();
            const [emptyCells, candidateCells, _] = await this.filterCells(cells);
            if (emptyCells.length === 0) {
                throw new Error('No empty cells to generate candidate deploy cell');
            }
            if (candidateCells.length < 50) {
                const needCellCount = 50 - candidateCells.length;
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
                    .signTransaction(this.appConfig.ckbCellDisptacherConfig.ckbCellDispatcherKey)(unsignedTx);
                const txHash = await this._collector
                    .getCkb()
                    .rpc.sendTransaction(signedTx, 'passthrough');
                this.logger.log(`[generateCandidateCells] tx ${txHash} sent successfully`);
                return txHash;
            }
            return 'OK';
        }
    getCellByUtxoCachedKey(txHash: any, index: any) {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Dispatcher:CellByUtxo:${txHash}_${index}{tag}`;
        }
    getUtxoByCellCachedKey(txHash: any, index: any) {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Dispatcher:UtxoByCell:${txHash}_${index}{tag}`;
        }
    async collectCell(capacity?: any) {
            const emptyCells = await this._collector.getCells({
                lock: addressToScript(this._dispatcherAddress),
            });
            this.logger.log(`[collectCell]${emptyCells.length}, ${addressToScript(this._dispatcherAddress)}`);
            const collectedCells = [];
            for (const cell of emptyCells) {
                if (capacity && BigInt(cell.output.capacity) < capacity) {
                    continue;
                }
                collectedCells.push(cell);
            }
            return collectedCells;
        }
    watchCandidateCellsCacheKey() {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Task:WatchCandidateCells:{tag}`;
        }
    @Cron('0 */5 * * * *')
    async watchCandidateCells(): Promise<void> {
            const key = this.watchCandidateCellsCacheKey();
            const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
            if (lock) {
                this.logger.log('[watchCandidateCells] task start');
                try {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    await this.generateCandidateCells();
                }
                catch (err) {
                    this.logger.error(`[watchCandidateCells] err: ${err}`, (err as Error)?.stack);
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
