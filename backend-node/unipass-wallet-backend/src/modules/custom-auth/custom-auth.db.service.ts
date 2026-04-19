import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomAuthAccountsEntity } from './entities/custom-auth.accounts.entity';
import { AccountStatus, KeyListEntity, OriHashEntity } from '../account/entities';

@Injectable()
export class CustomAuthDBService {
    constructor(@InjectRepository(CustomAuthAccountsEntity) customAuthAccountsRepository: any, logger: any, connection: any) {
        this.customAuthAccountsRepository = customAuthAccountsRepository;
        this.logger = logger;
        this.connection = connection;
        logger.setContext(CustomAuthDBService.name);
    }
    customAuthAccountsRepository: any;
    logger: any;
    connection: any;
    async insertToOrUpdateCustomAuthDb(customAuthAccounts: any) {
            const { sub, appId, initKeysetHash, userInfo, email } = customAuthAccounts;
            const queryRunner = this.connection.createQueryRunner();
            this.logger.log(`[insertToOrUpdateCustomAuthDb] start insert sub:${sub} appId:${appId}`);
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const dbInfo = await manager.findOne(CustomAuthAccountsEntity, {
                    where: { sub, appId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (dbInfo) {
                    if (dbInfo.status === AccountStatus.generateKey) {
                        dbInfo.status = AccountStatus.pending;
                        dbInfo.initKeysetHash = initKeysetHash
                            ? initKeysetHash
                            : dbInfo.initKeysetHash;
                        dbInfo.updatedAt = new Date();
                        await manager.save(dbInfo);
                    }
                    this.logger.log(`insertToOrUpdateCustomAuthDb  sub:${sub} source:${appId} is exist status = ${dbInfo.status}`);
                }
                else {
                    const entity = new CustomAuthAccountsEntity();
                    entity.sub = sub;
                    entity.appId = appId;
                    entity.userInfo = userInfo ? userInfo : entity.userInfo;
                    entity.email = email;
                    entity.status = AccountStatus.generateKey;
                    entity.createdAt = new Date();
                    entity.updatedAt = new Date();
                    await (manager === null || manager === void 0 ? void 0 : manager.save(entity));
                    this.logger.log(`[insertDataToApRelayerDB] insert sub:${sub} appId:${appId}`);
                }
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.warn(`insertToOrUpdateCustomAuthDb find error ${error}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
    async findOne(sub: any, appId: any) {
            const data = await this.customAuthAccountsRepository.findOne({
                where: {
                    sub,
                    appId,
                },
            });
            return data;
        }
    async updateCustomAuthDb(updateEntity: any) {
            const queryRunner = this.connection.createQueryRunner();
            this.logger.log(`[updateCustomAuthDb] update:${JSON.stringify(updateEntity)}`);
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const dbInfo = await manager.findOne(CustomAuthAccountsEntity, {
                    where: { id: updateEntity.id },
                    lock: { mode: 'pessimistic_write' },
                });
                if (dbInfo) {
                    await manager.save(updateEntity);
                    await queryRunner.commitTransaction();
                }
            }
            catch (error) {
                this.logger.warn(`updateCustomAuthDb find error ${error}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
    async initToBAccountForChain(update: any, oriHashInfo: any, iKeyDbInfo: any) {
            const queryRunner = this.connection.createQueryRunner();
            let isRegister = false;
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                this.logger.log('update account start');
                const accountInfo = (await manager.findOne(CustomAuthAccountsEntity, {
                    where: { id: update.id },
                    lock: { mode: 'pessimistic_write' },
                }));
                accountInfo.address = update.address;
                accountInfo.status = update.status;
                accountInfo.initKeysetHash = update.initKeysetHash;
                accountInfo.updatedAt = new Date();
                await manager.save(accountInfo);
                this.logger.log(`update raw info start ${JSON.stringify(oriHashInfo)}`);
                const oriInfo = (await manager.findOne(OriHashEntity, {
                    where: { hash: oriHashInfo.hash },
                    lock: { mode: 'pessimistic_write' },
                }));
                this.logger.log(`oriInfo ${JSON.stringify(oriInfo)}`);
                if (!oriInfo) {
                    const oriEntity = new OriHashEntity();
                    oriEntity.raw = oriHashInfo.raw;
                    oriEntity.hash = oriHashInfo.hash;
                    oriEntity.alg = oriHashInfo.alg;
                    oriEntity.createdAt = new Date();
                    oriEntity.updatedAt = new Date();
                    await manager.save(oriEntity);
                }
                this.logger.log('update key info start');
                let keyInfo = (await manager.findOne(KeyListEntity, {
                    where: { accountId: iKeyDbInfo.accountId, address: iKeyDbInfo.address },
                    lock: { mode: 'pessimistic_write' },
                }));
                keyInfo = this.getKeyEntity(iKeyDbInfo, keyInfo);
                await manager.save(keyInfo);
                await queryRunner.commitTransaction();
                this.logger.log('register success');
                isRegister = true;
            }
            catch (error) {
                this.logger.warn(`initToBAccountForChain find error ${error}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return isRegister;
        }
    getKeyEntity(iKeyDbInfo: any, keyInfo: any) {
            if (!keyInfo) {
                const keyEntity = new KeyListEntity();
                keyEntity.address = iKeyDbInfo.address;
                keyEntity.accountId = iKeyDbInfo.accountId;
                keyEntity.keystore = iKeyDbInfo.keystore;
                keyEntity.keyType = iKeyDbInfo.keyType;
                keyEntity.status = iKeyDbInfo.status;
                keyEntity.web3AuthAddress = iKeyDbInfo.web3AuthAddress
                    ? iKeyDbInfo.web3AuthAddress
                    : undefined;
                keyEntity.uuid = iKeyDbInfo.uuid ? iKeyDbInfo.uuid : '';
                keyEntity.updatedAt = new Date();
                keyEntity.updatedAt = new Date();
                return keyEntity;
            }
            keyInfo.keystore = iKeyDbInfo.keystore;
            keyInfo.keyType = iKeyDbInfo.keyType;
            keyInfo.status = iKeyDbInfo.status;
            keyInfo.web3AuthAddress = iKeyDbInfo.web3AuthAddress
                ? iKeyDbInfo.web3AuthAddress
                : keyInfo.web3AuthAddress;
            keyInfo.updatedAt = new Date();
            return keyInfo;
        }
}
