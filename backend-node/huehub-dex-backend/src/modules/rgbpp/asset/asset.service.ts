import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeploymentTokenEntity, DeploymentTokenStatus } from '../../../database/entities/deployment.token.entity';
import { InjectQueue } from '@nestjs/bull';
import { DEPLOY_BTC_STATUS, QUEUE_TRANSACTION } from '../../../common/utils/bull.name';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { DeployInputDto } from '../dto/deploy.input.dto';
import { DeployOutputDto } from '../dto/deploy.outputs.dto';
import { IJwt } from '../../../common/interface/jwt';
import { RgbppTokenInfo, appendCkbTxWitnesses, buildRgbppLockArgs, getXudtTypeScript, updateCkbTxWithRealBtcTxId } from '@rgbpp-sdk/ckb';
import { RgbppAssetsService } from '../rgbpp.service';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import { bitcoin, remove0x, transactionToHex } from '@rgbpp-sdk/btc';
import { DataSource, Repository } from 'typeorm';
import { RgbppLaunchVirtualTxResult } from '../../../common/utils/launch.interface';
import { Queue } from 'bull';
import { BtcLaunchQueueJobData } from '../../../common/interface/btc.queue';
import { CkbDeployerCellProviderService } from '../../ckb/ckb-deploy-cell-provider.service';
import Redis from 'ioredis';
import { PreDeployOutputDto } from '../dto/pre.deploy.cell.outputs.dto';
import { PreDeployInputDto } from '../dto/pre.deploy.cell.input.dto';
import { BtcService } from '../../btc/btc.service';
import { TokenStatisticService } from '../tokens/token.statistic.service';
import Decimal from 'decimal.js';
import { Collector } from '../../../common/utils/launch.collector';
import { StatusName } from '../../../common/utils/error.code';
import { BTC_UTXO_DUST_LIMIT, QueueDelayTime, TIME } from '../../../common/utils/const.config';
import { genRgbppLaunchCkbVirtualTx } from '../../../common/utils/launch';
import { TokenEntity, TokenStatus } from '../../../database/entities/token.entity';
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils';
import { TokenIconEntity } from '../../../database/entities/tokens.icon.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class AssetService {
    constructor(private readonly logger: AppLoggerService, private readonly rgbppAssetsService: RgbppAssetsService, private readonly btcService: BtcService, private readonly appConfig: AppConfigService, private readonly tokenStaticsService: TokenStatisticService, private readonly ckbDispatcherService: CkbDeployerCellProviderService, @InjectRepository(DeploymentTokenEntity) private deploymentTokenEntityRepository: Repository<DeploymentTokenEntity>, readonly dataSource: DataSource, @InjectQueue(QUEUE_TRANSACTION) private readonly queue: Queue, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(AssetService.name);
        this.initConfig();
    }
    network!: bitcoin.networks.Network;
    private collector: any;
    private isMainnet: any;
    initConfig(): void {
            this.network = this.appConfig.isTestnet
                ? bitcoin.networks.testnet
                : bitcoin.networks.bitcoin;
            this.collector = new Collector({
                ckbNodeUrl: this.appConfig.rgbPPConfig.ckbNodeUrl,
                ckbIndexerUrl: this.appConfig.rgbPPConfig.ckbIndexerUrl,
            });
            this.isMainnet = !this.appConfig.isTestnet;
        }
    async deploy(user: IJwt, deployInput: DeployInputDto): Promise<DeployOutputDto> {
            const { launchBtcTx, id } = deployInput;
            let key = this.getDeployDataKey(id);
            let deployData = await this.redis.get(key);
            if (!deployData) {
                this.logger.error(`[deploy]deployData not find`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            const data = JSON.parse(deployData);
            const { decimal, name, symbol, supply } = data;
            const rgbppTokenInfo = {
                decimal,
                name,
                symbol,
            };
            const totalSupply = BigInt(supply) * BigInt(10 ** decimal);
            const { ckbVirtualTxResult, launchPsbt, btcTxHash, ckbPrepareTxHash } = await this.verifyLaunchBtcTx(user.address, launchBtcTx, rgbppTokenInfo, totalSupply);
            let typeScript = getXudtTypeScript(this.appConfig.isTestnet ? false : true);
            const typeAsset = {
                ...typeScript,
                args: ckbVirtualTxResult.ckbRawTx.outputs[0].type?.args ?? '',
            };
            const deployTokenEntity = await this.initDeployTokenEntity(data, user.address, this.appConfig.rgbPPConfig.paymasterAddress, launchBtcTx, typeAsset, btcTxHash, ckbPrepareTxHash, totalSupply.toString());
            if (!deployTokenEntity) {
                this.logger.error(`[initDeployTokenEntity] insert deployment data fail`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            try {
                const btcTx = launchPsbt.extractTransaction();
                this.logger.log(`btcTx:${btcTx.toHex()}`);
                await this.rgbppAssetsService.service.sendBtcTransaction(btcTx.toHex());
                deployTokenEntity.status = DeploymentTokenStatus.DeployTokenPending;
                deployTokenEntity.updatedAt = new Date();
                await this.deploymentTokenEntityRepository.save(deployTokenEntity);
                await this.prepareLaunchCkbTx({
                    deployTokenId: deployTokenEntity.id,
                    btcTxHash: btcTxHash,
                    ckbVirtualTxResult,
                    rgbppTokenInfo,
                    queryTime: 0,
                }, deployTokenEntity);
            }
            catch (error) {
                deployTokenEntity.status = DeploymentTokenStatus.DeployTokenBtcFail;
                deployTokenEntity.updatedAt = new Date();
                await this.deploymentTokenEntityRepository.save(deployTokenEntity);
                this.logger.error(`[deploy] sendBtcTransaction error ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            await this.queue.add(DEPLOY_BTC_STATUS, {
                deployTokenId: deployTokenEntity.id,
                btcTxHash: btcTxHash,
                ckbVirtualTxResult,
                rgbppTokenInfo,
                queryTime: 0,
            }, {
                delay: QueueDelayTime(0),
            });
            return {
                btcTxHash,
            };
        }
    async verifyLaunchBtcTx(deployerAddress: string, launchBtcTx: string, rgbppTokenInfo: RgbppTokenInfo, launchAmount: bigint): Promise<{
        ckbVirtualTxResult: RgbppLaunchVirtualTxResult;
        launchPsbt: bitcoin.Psbt;
        btcTxHash: string;
        ckbPrepareTxHash: string;
    }> {
            let utxos = await this.rgbppAssetsService.service.getBtcUtxos(deployerAddress, { min_satoshi: BTC_UTXO_DUST_LIMIT });
            let launchPsbt = null;
            try {
                launchPsbt = bitcoin.Psbt.fromHex(launchBtcTx, { network: this.network });
            }
            catch (error) {
                this.logger.error(`[verifyPrepareLaunchBtcTx]  ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            launchPsbt.txInputs.map((uxto) => {
                let txid = uxto.hash.reverse().toString('hex');
                let index = uxto.index;
                let find = utxos.find((x) => x.txid === txid && x.vout == index && x.status.confirmed);
                if (!find) {
                    this.logger.error(`[verifyPrepareLaunchBtcTx] input utxo not deplayer live utxo ${txid}:${index}`);
                    throw new BadRequestException(StatusName.ParameterException);
                }
            });
            let outputs = launchPsbt.txOutputs;
            let txHash = launchPsbt.txInputs[0].hash.reverse().toString('hex');
            let index = launchPsbt.txInputs[0].index;
            const ownerRgbppLockArgs = buildRgbppLockArgs(index, txHash);
            const { predicatedCell } = await this.ckbDispatcherService.fetchRgblockCellByUtxo({ txHash, index });
            const ckbVirtualTxResult = await genRgbppLaunchCkbVirtualTx({
                collector: this.collector,
                ownerRgbppLockArgs,
                rgbppTokenInfo,
                launchAmount,
                isMainnet: this.isMainnet,
                emptyCells: [predicatedCell],
                toCkbAddress: this.appConfig.rgbPPConfig.distributorTimeLockCkbAddress,
            });
            this.logger.log(`${JSON.stringify(ckbVirtualTxResult)}`);
            const embedOut = bitcoin.payments.embed({
                data: [Buffer.from(remove0x(ckbVirtualTxResult.commitment), 'hex')],
            }).output as Buffer;
            if (!outputs[0].script.equals(embedOut)) {
                this.logger.log(` outputs[0].script ${outputs[0].script.toString('hex')}`);
                this.logger.log(` ckbVirtualTxResult.commitment ${embedOut.toString('hex')}`);
                this.logger.error(`btc commitment not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
            if (outputs[1].address !== this.appConfig.rgbPPConfig.paymasterAddress &&
                outputs[1].value !== this.appConfig.rgbPPConfig.deployFee) {
                this.logger.error(`[verifyPrepareLaunchBtcTx] output[2] address not us address or fee not match`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            try {
                launchPsbt.finalizeAllInputs();
            }
            catch (error) {
                this.logger.error(`[verifyPrepareLaunchBtcTx] finalizeAllInputs error ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            let btcTxHash = launchPsbt
                .extractTransaction()
                .getHash()
                .reverse()
                .toString('hex');
            return {
                ckbVirtualTxResult,
                launchPsbt,
                btcTxHash,
                ckbPrepareTxHash: predicatedCell.outPoint.txHash,
            };
        }
    async initDeployTokenEntity(input: PreDeployInputDto, deployerAddress: string, paymasterAddress: string, deploymentTx: string, typeScript: CKBComponents.Script, deploymentTxHash: string, ckbPrepareTxHash: string, totalSupply: string): Promise<DeploymentTokenEntity | null> {
            let deployTokenEntity = null;
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let tokenEntity = new TokenEntity();
                tokenEntity.lowercaseSymbol = input.symbol.toLowerCase();
                tokenEntity.name = input.name;
                tokenEntity.symbol = input.symbol;
                tokenEntity.xudtCodeHash = typeScript.codeHash;
                tokenEntity.xudtArgs = typeScript.args;
                tokenEntity.status = TokenStatus.Pending;
                tokenEntity.decimals = input.decimal;
                tokenEntity.iconUrl = input.iconData;
                tokenEntity.lastSales = new Decimal(0);
                tokenEntity.lastVolume = new Decimal(0);
                tokenEntity.floorPrice = new Decimal(0);
                tokenEntity.marketCap = new Decimal(0);
                tokenEntity.xudtTypeHash = scriptToHash(typeScript);
                tokenEntity.totalSupply = new Decimal(totalSupply);
                tokenEntity.createdAt = new Date();
                tokenEntity.updatedAt = new Date();
                tokenEntity = await manager.save(tokenEntity);
                if (input.iconData) {
                    let tokenIconEntity = new TokenIconEntity();
                    tokenIconEntity.tokenId = tokenEntity.id;
                    tokenIconEntity.imageData = input.iconData;
                    tokenIconEntity.createdAt = new Date();
                    tokenIconEntity.updatedAt = new Date();
                    tokenIconEntity = await manager.save(tokenIconEntity);
                }
                deployTokenEntity = new DeploymentTokenEntity();
                deployTokenEntity.tokenId = tokenEntity.id;
                deployTokenEntity.decimal = input.decimal;
                deployTokenEntity.amountPerMint = new Decimal(input.limitPerMint).mul(Decimal.pow(10, input.decimal));
                deployTokenEntity.lockedBtcAge = input.lockedBtcAge;
                deployTokenEntity.lockedBtcAmounts = input.lockedBtcAmounts;
                deployTokenEntity.deployerAddress = deployerAddress;
                deployTokenEntity.paymasterAddress = paymasterAddress;
                deployTokenEntity.ckbPrepareTxHash = ckbPrepareTxHash;
                deployTokenEntity.deployFeeAmount = new Decimal(this.appConfig.rgbPPConfig.deployFee);
                deployTokenEntity.deploymentTx = deploymentTx;
                deployTokenEntity.mintedAmount = new Decimal(0);
                deployTokenEntity.mintedRatio = new Decimal(0);
                deployTokenEntity.lockedBtcAge = 0;
                deployTokenEntity.deploymentTxHash = deploymentTxHash;
                deployTokenEntity.ckbTimeLockAddress =
                    this.appConfig.rgbPPConfig.distributorTimeLockCkbAddress;
                deployTokenEntity.relativeStartBlock = input.startBlock;
                deployTokenEntity.status = DeploymentTokenStatus.Init;
                deployTokenEntity.totalSupply = new Decimal(totalSupply);
                deployTokenEntity.createdAt = new Date();
                deployTokenEntity.updatedAt = new Date();
                deployTokenEntity = await manager.save(deployTokenEntity);
                tokenEntity.deploymentTokenId = deployTokenEntity.id;
                await manager.save(tokenEntity);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[initDeployTokenEntity] ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
                deployTokenEntity = null;
            }
            finally {
                await queryRunner.release();
            }
            return deployTokenEntity;
        }
    async getBtcTxStatus(data: BtcLaunchQueueJobData): Promise<void> {
            const { btcTxHash, deployTokenId } = data;
            const deployTokenEntity = await this.deploymentTokenEntityRepository.findOne({
                where: { id: deployTokenId },
            });
            if (!deployTokenEntity) {
                this.logger.warn(`[getBtcTxStatus] deployTokenEntity not find ${deployTokenId}  `);
                return;
            }
            if (deployTokenEntity.status === DeploymentTokenStatus.DeployTokenPending) {
                let transaction = await this.rgbppAssetsService.service.getBtcTransaction(btcTxHash);
                if (transaction && transaction.status.confirmed) {
                    deployTokenEntity.status = DeploymentTokenStatus.DeployTokenBtcSuccess;
                    deployTokenEntity.btcTxBlockHeight = transaction.status.block_height;
                    deployTokenEntity.deployedTime = new Date();
                    deployTokenEntity.updatedAt = new Date();
                    await this.updateDeployTokenEntity(deployTokenEntity);
                }
            }
            else if (deployTokenEntity.status === DeploymentTokenStatus.DeployTokenBtcSuccess) {
                await this.updateCkbRgppAsset(data, deployTokenEntity);
            }
            if (![
                DeploymentTokenStatus.DeployTokenBtcFail,
                DeploymentTokenStatus.DeployTokenSuccessFail,
            ].includes(deployTokenEntity.status)) {
                if (deployTokenEntity.status !== DeploymentTokenStatus.DeployTokenSuccess) {
                    await this.queue.add(DEPLOY_BTC_STATUS, { ...data, queryTime: (data.queryTime ?? 0) + 1 }, {
                        delay: QueueDelayTime((data.queryTime ?? 0) + 1),
                    });
                }
            }
        }
    async prepareLaunchCkbTx(data: BtcLaunchQueueJobData, deployTokenEntity: DeploymentTokenEntity): Promise<void> {
            const launchPsbt = bitcoin.Psbt.fromHex(deployTokenEntity.deploymentTx, {
                network: this.network,
            });
            const { signedTx } = await this.ckbDispatcherService.fetchRgblockCellByUtxo({
                txHash: launchPsbt.txInputs[0].hash.reverse().toString('hex'),
                index: launchPsbt.txInputs[0].index,
            });
            try {
                this.logger.log(`[signedTx] ${signedTx}`);
                const txHash = await this.collector
                    .getCkb()
                    .rpc.sendTransaction(signedTx, 'passthrough');
                deployTokenEntity.prepareDeploymentCkbTxHash = txHash;
                deployTokenEntity.updatedAt = new Date();
                await this.deploymentTokenEntityRepository.save(deployTokenEntity);
            }
            catch (error) {
                this.logger.error(`prepareLaunchCkbTx error ${(error as Error)?.stack}`);
            }
        }
    async updateCkbRgppAsset(data: BtcLaunchQueueJobData, deployTokenEntity: DeploymentTokenEntity): Promise<void> {
            const launchBtcSigTx = deployTokenEntity.deploymentTx;
            const { ckbRawTx } = data.ckbVirtualTxResult;
            const launchPsbt = bitcoin.Psbt.fromHex(launchBtcSigTx, {
                network: this.network,
            });
            launchPsbt.finalizeAllInputs();
            const btcTx = launchPsbt.extractTransaction();
            const btcTxBytes = transactionToHex(btcTx, false);
            try {
                const rgbppApiSpvProof = await this.rgbppAssetsService.service.getRgbppSpvProof(data.btcTxHash, 0);
                const newCkbRawTx = updateCkbTxWithRealBtcTxId({
                    ckbRawTx,
                    btcTxId: data.btcTxHash,
                    isMainnet: this.isMainnet,
                });
                const ckbTx = await appendCkbTxWitnesses({
                    ckbRawTx: newCkbRawTx,
                    btcTxBytes,
                    rgbppApiSpvProof,
                });
                const ckbTxHash = await this.collector
                    .getCkb()
                    .rpc.sendTransaction(ckbTx, 'passthrough');
                deployTokenEntity.status = DeploymentTokenStatus.DeployTokenSuccess;
                deployTokenEntity.deploymentCkbTxHash = ckbTxHash;
                deployTokenEntity.updatedAt = new Date();
                await this.deploymentTokenEntityRepository.save(deployTokenEntity);
                this.logger.log(`[updateCkbRgppAsset] deploy success ckbTxHash:${ckbTxHash}btcHash: ${data.btcTxHash}`);
            }
            catch (error) {
                this.logger.error(`[updateCkbRgppAsset] error ${(error as Error)?.stack}`);
            }
        }
    getDeployDataKey(id: any) {
            return `${this.appConfig.nodeEnv}:Hue:Hub:User:Deploy:${id}{tag}`;
        }
    async getPreDeploy(user: IJwt, input: PreDeployInputDto): Promise<PreDeployOutputDto> {
            await this.checkDeployParameter(input);
            const buffer = randomBytes(16);
            let id = buffer.toString('base64');
            let key = this.getDeployDataKey(id);
            const { address } = user;
            let utxos = await this.rgbppAssetsService.service.getBtcUtxos(address, {
                min_satoshi: BTC_UTXO_DUST_LIMIT,
            });
            utxos.sort((a, b) => {
                if (a.status.confirmed && b.status.confirmed) {
                    return b.value - a.value;
                }
                if (!a.status.confirmed) {
                    return 1;
                }
                if (!b.status.confirmed) {
                    return -1;
                }
                return 0;
            });
            if (utxos.length === 0) {
                this.logger.error(`[getPreDeploy] utxos length = 0`);
                throw new BadRequestException(StatusName.InsufficientBalance);
            }
            let { txid: txHash, vout: index, value } = utxos[0];
            try {
                const { predicatedCell } = await this.ckbDispatcherService.fetchRgblockCellByUtxo({
                    txHash,
                    index,
                });
                await this.redis.set(key, JSON.stringify(input), 'EX', TIME.HALF_HOUR);
                return {
                    cell: predicatedCell,
                    paymasterAddress: this.appConfig.rgbPPConfig.paymasterAddress,
                    deployFee: this.appConfig.rgbPPConfig.deployFee,
                    distributorTimeLockAddress: this.appConfig.rgbPPConfig.distributorTimeLockCkbAddress,
                    id,
                    txHash,
                    index,
                    value,
                };
            }
            catch (error) {
                this.logger.error(`[getCandidateCell] error ${error}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
        }
    async checkDeployParameter(input: PreDeployInputDto): Promise<void> {
            const { name, symbol, supply, startBlock } = input;
            const symbolRegex = /^[a-zA-Z0-9%$#@&+-]{4,5}$/;
            const nameRegex = /^[a-zA-Z0-9%$#@&+-\s]{1,32}$/;
            if (!symbolRegex.test(symbol) || !nameRegex.test(name)) {
                this.logger.error(`[checkDeployParm] symbol name not match regex `);
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (new Decimal(supply) <= new Decimal(0)) {
                this.logger.error(`[checkDeployParm] supply less 0`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (startBlock < 6) {
                this.logger.error(`[checkDeployParm] startBlock less 6`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            let lowercaseSymbol = symbol.toLowerCase();
            const symbolBlacklist = this.appConfig.rgbPPConfig.symbolBlacklist
                .toLowerCase()
                .split(',');
            if (symbolBlacklist.includes(lowercaseSymbol)) {
                this.logger.error(`[checkDeployParm]  token symbol existing`);
                throw new BadRequestException(StatusName.DeployInvalid);
            }
            let token = await this.tokenStaticsService.getTokenInfo({
                lowercaseSymbol,
            });
            if (token) {
                this.logger.error(`[checkDeployParm]  deploy token invalid `);
                throw new BadRequestException(StatusName.DeployInvalid);
            }
        }
    async updateDeployTokenEntity(deployTokenEntity: DeploymentTokenEntity): Promise<DeploymentTokenEntity | null> {
            const queryRunner = this.dataSource.createQueryRunner();
            let result: DeploymentTokenEntity | null = deployTokenEntity;
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let tokenEntity = await manager.findOne(TokenEntity, {
                    where: { id: deployTokenEntity.tokenId },
                });
                if (!tokenEntity) {
                    throw new Error(`[updateDeployTokenEntity]token not find ${deployTokenEntity.tokenId}`);
                }
                tokenEntity.status = TokenStatus.Listing;
                tokenEntity.deployedTime = new Date().getTime();
                tokenEntity.updatedAt = new Date();
                await manager.save(tokenEntity);
                await manager.save(deployTokenEntity);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[initDeployTokenEntity] ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
                result = null;
            }
            finally {
                await queryRunner.release();
            }
            return result;
        }
}
