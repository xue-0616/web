import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsumptionStatus, CustomerEntity, GasConsumptionHistoryEntity } from './entities';
import decimal_js from 'decimal.js';

@Injectable()
export class CustomerDbService {
    constructor(@InjectRepository(CustomerEntity) customerRepository: any, @InjectRepository(GasConsumptionHistoryEntity) gasConsumptionHistoryEntity: any, logger: any, connection: any) {
        this.customerRepository = customerRepository;
        this.gasConsumptionHistoryEntity = gasConsumptionHistoryEntity;
        this.logger = logger;
        this.connection = connection;
        this.logger.setContext(CustomerDbService.name);
    }
    customerRepository: any;
    gasConsumptionHistoryEntity: any;
    logger: any;
    connection: any;
    async insertToOrUpdateToBAppInfo(input: any) {
            const { provider, sub } = input;
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const dbInfo = await manager.findOne(CustomerEntity, {
                    where: { sub, provider },
                    lock: { mode: 'pessimistic_write' },
                });
                const entity = this.getAppInfoEntity(input, dbInfo);
                await (manager === null || manager === void 0 ? void 0 : manager.save(entity));
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.warn(`insertToOrUpdateToBAppInfo find error ${error}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
    getAppInfoEntity(info: any, dbInfo: any) {
            dbInfo = !dbInfo
                ? this.getInitAppInfoEntity(info)
                : this.getUpdateAppInfoEntity(info, dbInfo);
            return dbInfo;
        }
    getUpdateAppInfoEntity(info: any, dbInfo: any) {
            const { status, provider, sub, gasTankBalance } = info;
            dbInfo = dbInfo ? dbInfo : new CustomerEntity();
            dbInfo.status = status;
            dbInfo.provider = provider ? provider : dbInfo.provider;
            dbInfo.sub = sub ? sub : dbInfo.sub;
            dbInfo.gasTankBalance = gasTankBalance
                ? gasTankBalance
                : dbInfo.gasTankBalance;
            dbInfo.updatedAt = new Date();
            return dbInfo;
        }
    getInitAppInfoEntity(info: any) {
            const { status, provider, sub, gasTankBalance } = info;
            const dbInfo = new CustomerEntity();
            dbInfo.status = status;
            dbInfo.provider = provider;
            dbInfo.sub = sub;
            dbInfo.gasTankBalance = gasTankBalance ? gasTankBalance : 0;
            dbInfo.createdAt = new Date();
            dbInfo.updatedAt = new Date();
            return dbInfo;
        }
    findOne(where: any) {
            const data = this.customerRepository.findOne({
                where,
            });
            return data;
        }
    async insertOrUpdateGasConsumptionHistoryDb(consumptionInfo: any, customerId: any) {
            let isSuccess = false;
            const { relayerTxHash } = consumptionInfo;
            const queryRunner = this.connection.createQueryRunner();
            this.logger.log(`[insertOrUpdateGasConsumptionHistoryDb] start insert relayerTxHash:${relayerTxHash}`);
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let entity = await manager.findOne(GasConsumptionHistoryEntity, {
                    where: { relayerTxHash },
                    lock: { mode: 'pessimistic_write' },
                });
                entity = !entity
                    ? this.generateGasConsumptionHistoryEntity(consumptionInfo)
                    : this.updateGasConsumptionHistoryEntity(entity, consumptionInfo);
                await manager.save(entity);
                await this.updateCustomerTank(manager, entity, customerId);
                await queryRunner.commitTransaction();
                isSuccess = true;
            }
            catch (error) {
                this.logger.warn(`insertOrUpdateGasConsumptionHistoryDb find error ${error}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return isSuccess;
        }
    generateGasConsumptionHistoryEntity(customAuthAccounts: any) {
            const entity = new GasConsumptionHistoryEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.status = customAuthAccounts.status;
            entity.policyType = customAuthAccounts.policyType;
            entity.nonce = customAuthAccounts.nonce;
            entity.relayerTxHash = customAuthAccounts.relayerTxHash;
            entity.customTransactions = customAuthAccounts.customTransactions;
            entity.chainId = customAuthAccounts.chainId;
            entity.appId = customAuthAccounts.appId;
            entity.userAddress = customAuthAccounts.userAddress;
            entity.policyId = customAuthAccounts.policyId || undefined;
            entity.feeTransaction = customAuthAccounts.feeTransaction || undefined;
            entity.userPaidGas = customAuthAccounts.userPaidGas || 0;
            entity.userPaidFee = customAuthAccounts.userPaidFee || 0;
            entity.userPaidToken = customAuthAccounts.userPaidToken || undefined;
            entity.userPaidTokenUsdPrice =
                customAuthAccounts.userPaidTokenUsdPrice || 0;
            entity.nativeTokenUsdPrice = customAuthAccounts.nativeTokenUsdPrice || 0;
            return entity;
        }
    updateGasConsumptionHistoryEntity(entity: any, customAuthAccounts: any) {
            const { status, policyType, policyId, feeTransaction, chainTxHash, tankPaidGas, tankPaidToken, tankPaidFee, consumedGasUsed, consumedGasPrice, consumedFee, chainId, appId, customTransactions, userAddress, userPaidGas, userPaidFee, userPaidToken, userPaidTokenUsdPrice, nativeTokenUsdPrice, tankPaidTokenUsdPrice, errorReason, } = customAuthAccounts;
            if (entity.status === status) {
                return entity;
            }
            entity.updatedAt = new Date();
            entity.status = status;
            entity.policyType =
                policyType !== entity.policyType ? policyType : entity.policyType;
            entity.customTransactions = customTransactions;
            entity.chainId = chainId;
            entity.appId = appId;
            entity.userAddress = userAddress;
            entity.policyId = policyId || entity.policyId;
            entity.feeTransaction = feeTransaction || entity.feeTransaction;
            entity.chainTxHash = chainTxHash || entity.chainTxHash;
            entity.userPaidGas = userPaidGas || entity.userPaidGas;
            entity.userPaidToken = userPaidToken || entity.userPaidToken;
            entity.userPaidFee = userPaidFee || entity.userPaidFee;
            entity.userPaidTokenUsdPrice =
                userPaidTokenUsdPrice || entity.userPaidTokenUsdPrice;
            entity.tankPaidGas = tankPaidGas || entity.tankPaidGas;
            entity.tankPaidToken = tankPaidToken || entity.tankPaidToken;
            entity.tankPaidFee = tankPaidFee || entity.tankPaidFee;
            entity.tankPaidTokenUsdPrice =
                tankPaidTokenUsdPrice || entity.tankPaidTokenUsdPrice;
            entity.consumedGasUsed = consumedGasUsed || entity.consumedGasUsed;
            entity.consumedGasPrice = consumedGasPrice || entity.consumedGasPrice;
            entity.consumedFee = consumedFee || entity.consumedFee;
            entity.nativeTokenUsdPrice =
                nativeTokenUsdPrice || entity.nativeTokenUsdPrice;
            entity.errorReason = errorReason || entity.errorReason;
            return entity;
        }
    async getGasConsumptionHistoryByWhere(where: any) {
            const data = await this.gasConsumptionHistoryEntity.findOne({
                where,
            });
            return data;
        }
    async updateCustomerTank(manager: any, consumptionHistoryEntity: any, customerId: any) {
            if (consumptionHistoryEntity.status === ConsumptionStatus.OnChainComplete &&
                customerId) {
                let customer = await manager.findOne(CustomerEntity, {
                    where: { id: customerId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (customer) {
                    const gasTank = new decimal_js(customer.gasTankBalance).sub(new decimal_js(consumptionHistoryEntity.tankPaidFee));
                    customer.gasTankBalance = gasTank.toNumber();
                }
                await manager.save(customer);
            }
        }
}
