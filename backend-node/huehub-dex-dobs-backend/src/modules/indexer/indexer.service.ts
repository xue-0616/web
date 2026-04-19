import { Cron } from '@nestjs/schedule';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { MyHttpService } from '../../common/utils.service/http.service';
import { BtcService } from '../btc/btc.service';
import Redis from 'ioredis';
import { UtxoInfo } from '../../common/interface/mempool.dto';
import { IndexerDbService } from './indexer.db.service';
import { RedlockService } from '../../common/utils.service/redlock.service';
import { DobsResponse } from '../../common/interface/dobs.data';
import { Collector } from './indexer.collector';
import { getRgbppLockScript, getSporeTypeScript } from '@rgbpp-sdk/ckb';
import { bufferToRawString, unpackToRawSporeData } from '@spore-sdk/core';
import { scriptToAddress, scriptToHash } from '@nervosnetwork/ckb-sdk-utils';
import { StatusName } from '../../common/utils/error.code';
import { DobsEntity } from '../../database/entities/dobs.entity';
import { formatDobsMediaUrl, getUxtoInfoByLockArgs, sleep } from '../../common/utils/tools';
import { TIME } from '../../common/utils/const.config';
import { IsNull } from 'typeorm';

@Injectable()
export class IndexerService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfigService: AppConfigService, private readonly myHttpService: MyHttpService, private readonly redlockService: RedlockService, private readonly btcService: BtcService, @InjectRedis() private readonly redis: Redis, private readonly indexerDbService: IndexerDbService) {
        this.logger.setContext(IndexerService.name);
        this.initCollector();
        this.watchIndexing();
        this.updateSportCellTraits();
    }
    private collector: any;
    async initCollector(): Promise<void> {
            this.collector = new Collector({
                ckbNodeUrl: this.appConfigService.rgbPPConfig.ckbNodeUrl,
                ckbIndexerUrl: this.appConfigService.rgbPPConfig.ckbIndexerUrl,
                logger: this.logger,
            });
        }
    getUtxoTxidKey(txid: any) {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Btc:Cell:Utxo:${txid}{tag}`;
        }
    watchBlockNumberKey() {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Indexer:Watch:{tag}`;
        }
    updateCellTraits() {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Indexer:Traits
    :{tag}`;
        }
    async getCellData(blockNumber: any) {
            const sporeTypeScript = {
                ...getSporeTypeScript(!this.appConfigService.isTestnet),
                args: '0x',
            };
            const rgbppLockScript = {
                ...getRgbppLockScript(!this.appConfigService.isTestnet),
                args: '0x',
            };
            let tipBolckNumber = await this.collector.getTipBolckNumber();
            let blockRange = [`0x${blockNumber.toString(16)}`, tipBolckNumber];
            let cursor: any = null;
            do {
                let { cells, lastCursor }: { cells: any[]; lastCursor: any } = await this.collector.getCells({
                    lock: rgbppLockScript,
                    type: sporeTypeScript,
                    blockRange,
                    cursor,
                });
                this.logger.log(`[getCellData] getCells${JSON.stringify({ cells: cells.length, cursor, blockRange })}`);
                if (cells && cells.length > 0) {
                    const entities = (await Promise.all(cells.map(async (cell: any) => this.parseCell(cell)))).filter((e): e is DobsEntity => e !== null);
                    await this.indexerDbService.insertOrUpdateDosCell(entities, parseInt(cells[cells.length - 1].blockNumber, 16));
                    cursor = lastCursor;
                }
                else {
                    cursor = null;
                }
            } while (cursor);
        }
    async parseCell(cell: any) {
            try {
                const sporeData = unpackToRawSporeData(cell.outputData);
                let contentStr = bufferToRawString(sporeData.content);
                if (sporeData.contentType !== 'dob/0' || !sporeData.clusterId) {
                    return null;
                }
                try {
                    JSON.parse(contentStr);
                }
                catch (error) {
                    this.logger.error(`[parseCell] contentStr json parse error ${contentStr}`);
                    return null;
                }
                const owner = scriptToAddress(cell.output.lock, !this.appConfigService.isTestnet);
                let utxoInfo;
                try {
                    utxoInfo = await this.getUtxoInfo(cell.output.lock.args);
                }
                catch (error) {
                    if ((error as Error).message === StatusName.UtxoErro) {
                        this.logger.error(`[parseCell] get utxoInfo error ${JSON.stringify(cell.outPoint)}`);
                        return null;
                    }
                }
                if (!utxoInfo) {
                    return null;
                }
                let entity = await this.indexerDbService.findOneDobsEntity({
                    typeArgs: cell.output.type.args,
                });
                if (!entity) {
                    entity = new DobsEntity();
                    entity.createdAt = new Date();
                    entity.typeCodeHash = cell.output.type.codeHash;
                    entity.typeArgs = cell.output.type.args;
                    entity.typeScriptHash = scriptToHash(cell.output.type);
                    entity.data = cell.outputData;
                    entity.clusterTypeArgs = sporeData.clusterId;
                    entity.sporeTokenId = contentStr ? JSON.parse(contentStr).id : null;
                }
                entity.updatedAt = new Date();
                entity.lockArgs = cell.output.lock.args;
                entity.lockCodeHash = cell.output.lock.codeHash;
                entity.lockScriptHash = scriptToHash(cell.output.lock);
                entity.btcTxHash = utxoInfo.txid;
                entity.btcIndex = utxoInfo.index;
                entity.owner = owner;
                entity.cellIndex = parseInt(cell.outPoint.index, 16);
                entity.txHash = cell.outPoint.txHash;
                entity.blockNumber = parseInt(cell.blockNumber, 16);
                entity.capacity = cell.output.capacity;
                entity.btcValue = utxoInfo.value ? utxoInfo.value : 0;
                entity.btcAddress = utxoInfo.scriptpubkeyAddress
                    ? utxoInfo.scriptpubkeyAddress
                    : '';
                if (!this.appConfigService.isTestnet) {
                    let dobsData = await this.getDataByDobsApi(entity.typeArgs);
                    if (dobsData && dobsData.dobs[0]) {
                        entity.sporeContentType = dobsData.dobs[0]['prev.type'];
                        entity.sporePrevBgcolor = dobsData.dobs[0]['prev.bgcolor'];
                        entity.sporeIconUrl = formatDobsMediaUrl(this.appConfigService.rgbPPConfig.dobsMediaHost, dobsData.dobs[0]['media_type'], dobsData.dobs[0]['prev.bg']);
                    }
                }
                return entity;
            }
            catch (error) {
                this.logger.error(`[parseCell] error ${(error as Error)?.stack}, ${JSON.stringify(cell.outPoint)} `);
                return null;
            }
        }
    @Cron('0 */1 * * * *')
    async watchIndexing(): Promise<void> {
            let key = this.watchBlockNumberKey();
            const lock = await this.redlockService.acquireLock([key], TIME.HALF_HOUR * 1000);
            if (lock) {
                try {
                    let [dbCkbBlock, tipBolckNumber] = await Promise.all([
                        this.indexerDbService.curCkbBlock(),
                        this.collector.getTipBolckNumber(),
                    ]);
                    let bolckNumber = parseInt(tipBolckNumber, 16);
                    if (!dbCkbBlock) {
                        await this.getCellData(0);
                    }
                    else {
                        if (bolckNumber > dbCkbBlock.curBlockNumber) {
                            await this.getCellData(dbCkbBlock.curBlockNumber);
                            dbCkbBlock.curBlockNumber = bolckNumber;
                            dbCkbBlock.updatedAt = new Date();
                            await this.indexerDbService.updateCkbBlockEntity(dbCkbBlock);
                        }
                    }
                }
                catch (error) {
                    this.logger.error(`[watchIndexing] error ${(error as Error)?.stack}`);
                }
                finally {
                    await this.redlockService.releaseLock(lock);
                }
            }
            else {
                this.logger.log('[watchIndexing] task is already running on another instance');
            }
        }
    @Cron('0 */1 * * * *')
    async updateSportCellTraits(): Promise<void> {
            let key = this.updateCellTraits();
            const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
            if (lock) {
                let where: any[] = [{ btcAddress: IsNull() }];
                if (!this.appConfigService.isTestnet) {
                    where.push({ sporePrevBgcolor: IsNull() });
                }
                let dobs = await this.indexerDbService.queryDobsEntity(where, 500);
                this.logger.log(`[updateSportCellTraits] dobs.len = ${dobs.length}`);
                if (dobs.length > 0) {
                    await Promise.all(dobs.map(async (item) => this.updateDobs(item)));
                }
                await this.redlockService.releaseLock(lock);
            }
            else {
                this.logger.log('[updateSportCellTraits] task is already running on another instance');
            }
        }
    async updateDobs(dobsEntity: any) {
            const utxoInfo = await this.getUtxoInfo(`0x${dobsEntity.lockArgs}`);
            if (!this.appConfigService.isTestnet) {
                let dobsData = await this.getDataByDobsApi(dobsEntity.typeArgs);
                if (dobsData && dobsData.dobs[0]) {
                    dobsEntity.sporeContentType = dobsData.dobs[0]['prev.type'];
                    dobsEntity.sporePrevBgcolor = dobsData.dobs[0]['prev.bgcolor'];
                    dobsEntity.sporeIconUrl = formatDobsMediaUrl(this.appConfigService.rgbPPConfig.dobsMediaHost, dobsData.dobs[0]['media_type'], dobsData.dobs[0]['prev.bg']);
                }
            }
            dobsEntity.btcValue = utxoInfo.value ? utxoInfo.value : null;
            dobsEntity.btcAddress = utxoInfo.scriptpubkeyAddress
                ? utxoInfo.scriptpubkeyAddress
                : null;
            await this.indexerDbService.updateDobsEntity(dobsEntity);
        }
    async getUtxoInfo(lockArgs: string): Promise<UtxoInfo> {
            let utxoInfo = getUxtoInfoByLockArgs(lockArgs);
            let key = this.getUtxoTxidKey(utxoInfo.txid);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                let data = JSON.parse(cacheData).vout[utxoInfo.index];
                if (!data) {
                    throw new BadRequestException(StatusName.UtxoErro);
                }
                return {
                    ...utxoInfo,
                    value: data.value,
                    scriptpubkeyAddress: data.scriptpubkeyAddress,
                };
            }
            await sleep(500);
            let transaction = await this.btcService.getTransaction(utxoInfo.txid);
            if (transaction) {
                await this.redis.set(key, JSON.stringify(transaction), 'EX', TIME.HALF_HOUR);
                let data = transaction.vout[utxoInfo.index];
                if (!data) {
                    throw new BadRequestException(StatusName.UtxoErro);
                }
                return {
                    ...utxoInfo,
                    value: data.value,
                    scriptpubkeyAddress: data.scriptpubkeyAddress,
                };
            }
            return {
                ...utxoInfo,
            };
        }
    async getDataByDobsApi(ids: string): Promise<DobsResponse | null> {
            await sleep(500);
            let url = `${this.appConfigService.rgbPPConfig.dobsApiUrl}/api/dobs/0`;
            let data = { ids };
            let dobsData = await this.myHttpService.httpPost(url, data);
            if (dobsData) {
                return dobsData;
            }
            return null;
        }
}
