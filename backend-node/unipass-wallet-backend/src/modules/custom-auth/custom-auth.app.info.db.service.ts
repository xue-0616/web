import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomAuthAppInfoEntity } from './entities/custom-auth.app.info.entity';
import { StatusName } from '../../shared/utils';

@Injectable()
export class CustomAuthAppInfoDbService {
    constructor(@InjectRepository(CustomAuthAppInfoEntity) customAuthAppRepository: any, connection: any, logger: any) {
        this.customAuthAppRepository = customAuthAppRepository;
        this.connection = connection;
        this.logger = logger;
        logger.setContext(CustomAuthAppInfoDbService.name);
    }
    customAuthAppRepository: any;
    connection: any;
    logger: any;
    async insertToOrUpdateToBAppInfo(info: any) {
            const { appName, appId } = info;
            const queryRunner = this.connection.createQueryRunner();
            this.logger.log(`[insertToOrUpdateToBAppInfo] start insert appNam:${appName} appId:${appId}`);
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const dbInfo = await manager.findOne(CustomAuthAppInfoEntity, {
                    where: { appName },
                    lock: { mode: 'pessimistic_write' },
                });
                const entity = this.getAppInfoEntity(info, dbInfo);
                await (manager === null || manager === void 0 ? void 0 : manager.save(entity));
                this.logger.log(`[insertToOrUpdateToBAppInfo] insert appNam:${appName} appId:${appId}`);
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
            const { appInfo, jwtPubkey, jwtVerifierIdKey, verifierName, web3authClientId, } = info;
            dbInfo = dbInfo ? dbInfo : new CustomAuthAppInfoEntity();
            dbInfo.jwtVerifierIdKey = jwtVerifierIdKey;
            dbInfo.appInfo = appInfo ? appInfo : dbInfo.appInfo;
            dbInfo.jwtPubkey = jwtPubkey ? jwtPubkey : dbInfo.jwtPubkey;
            dbInfo.verifierName = verifierName ? verifierName : dbInfo.verifierName;
            dbInfo.web3authClientId = web3authClientId
                ? web3authClientId
                : dbInfo.web3authClientId;
            dbInfo.updatedAt = new Date();
            return dbInfo;
        }
    getInitAppInfoEntity(info: any) {
            const { appName, appId, appInfo, jwtPubkey, jwtVerifierIdKey, verifierName, web3authClientId, } = info;
            const dbInfo = new CustomAuthAppInfoEntity();
            dbInfo.jwtVerifierIdKey = jwtVerifierIdKey;
            dbInfo.appId = appId;
            dbInfo.appName = appName;
            dbInfo.appInfo = appInfo ? appInfo : undefined;
            dbInfo.jwtPubkey = jwtPubkey ? jwtPubkey : undefined;
            dbInfo.verifierName = verifierName ? verifierName : undefined;
            dbInfo.web3authClientId = web3authClientId ? web3authClientId : undefined;
            dbInfo.createdAt = new Date();
            dbInfo.updatedAt = new Date();
            return dbInfo;
        }
    async getAppInfo(where: any) {
            const data = await this.customAuthAppRepository.findOne({
                where,
            });
            if (!data) {
                this.logger.warn(`appInfo data not find ${JSON.stringify(where)}`);
                throw new BadRequestException(StatusName.APPID_NOT_SUPPORT);
            }
            return data;
        }
    async getAppId(appName: any) {
            const data = await this.customAuthAppRepository.findOne({
                where: {
                    appName,
                },
            });
            const appId = data ? data.appId : '';
            return appId;
        }
}
