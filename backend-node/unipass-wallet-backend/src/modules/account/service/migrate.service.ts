import { BadRequestException, Injectable } from '@nestjs/common';
import moment from 'moment';
import node_rsa from 'node-rsa';
import { StatusName } from '../../../shared/utils';
import { verifyMessage } from 'ethers';
import { AccountStatus } from '../entities';

@Injectable()
export class MigrateService {
    constructor(logger: any, config: any, accountsDBService: any, oriHashDBService: any, keyDBService: any, tssUpKeyService: any) {
        this.logger = logger;
        this.config = config;
        this.accountsDBService = accountsDBService;
        this.oriHashDBService = oriHashDBService;
        this.keyDBService = keyDBService;
        this.tssUpKeyService = tssUpKeyService;
        this.logger.setContext(MigrateService.name);
    }
    logger: any;
    config: any;
    accountsDBService: any;
    oriHashDBService: any;
    keyDBService: any;
    tssUpKeyService: any;
    async getMigrateUserInfo(input: any) {
            const { appId, address, timestamp, signature } = input;
            let migrateInfo = this.config.appConfig.migrateAppInfo;
            let migrate = migrateInfo[appId];
            if (!migrate) {
                this.logger.warn(`[getUserInfo] migrate find ${appId}`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            let sources = migrate.sources;
            const digestStr = `appId=${appId}&address=${address}&timestamp=${timestamp}`;
            this.verifySignature(timestamp, signature, migrate.sigAddress, digestStr);
            let userInfo = await this.getUserInfo(address, sources);
            let data = '';
            try {
                data = this.encryptUserInfo(userInfo, migrate.publicPem);
            }
            catch (_a) {
                this.logger.warn(`[getMigrateUserInfo] encrypt error publicPem ${migrate.publicPem}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            return data;
        }
    async getMigrateUserAddress(input: any) {
            let { appId, email, provider, timestamp, signature } = input;
            let migrateInfo = this.config.appConfig.migrateAppInfo;
            let migrate = migrateInfo[appId];
            if (!migrate) {
                this.logger.warn(`[getMigrateUserAddress] migrate find ${appId}`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            const digestStr = `appId=${appId}&email=${email}&provider=${provider}&timestamp=${timestamp}`;
            this.verifySignature(timestamp, signature, migrate.sigAddress, digestStr);
            let account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account) {
                this.logger.warn(`[getMigrateUserAddress] accounts not find ${email}_${provider}`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            return account.address;
        }
    verifySignature(timestamp: any, signature: any, sigAddress: any, digestStr: any) {
            const diff = moment().diff(moment(Number(timestamp) * 1000), 's');
            if (diff > 3 * 60) {
                this.logger.warn(`[verifySignature] timestamp ${timestamp} timeout now = ${moment().unix()} diff = ${diff}`);
                throw new BadRequestException(StatusName.MIGRATE_SIG_ERROR);
            }
            let isVerify = false;
            try {
                const recoveredAddress = verifyMessage(digestStr, signature);
                isVerify = recoveredAddress.toLowerCase() === sigAddress.toLowerCase();
                this.logger.log(`[verifySignature] ${recoveredAddress} ${sigAddress}`);
            }
            catch (error) {
                this.logger.warn(`[verifySignature] error ${error}`);
            }
            if (!isVerify) {
                throw new BadRequestException(StatusName.MIGRATE_SIG_ERROR);
            }
        }
    async getUserInfo(address: any, sources: any) {
            let account = await this.accountsDBService.findOneByAddress(address);
            let migrateStatus = [AccountStatus.committed, AccountStatus.migrated];
            if (!account ||
                !migrateStatus.includes(account.status) ||
                !sources.includes(account.source)) {
                this.logger.warn(`[getUserInfo] address not find or source not match ${address}`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            let { masterKeyAddress, keyset } = await this.oriHashDBService.getKeyset(account.keysetHash);
            let userKeyInfo = await this.keyDBService.findOne({
                address: masterKeyAddress,
            });
            if (!userKeyInfo) {
                this.logger.warn(`[getUserInfo] userKeyInfo not find from keyset hash ${account.keysetHash}`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            let { uuid, keystore } = userKeyInfo;
            let serverKey = await this.tssUpKeyService.getServeKeyByUuid(uuid);
            let userInfo = {
                address: account.address,
                keyset,
                masterKey: {
                    address: masterKeyAddress,
                    serverKey,
                    encryptedUserKey: keystore.toString(),
                },
            };
            await this.updateAccountStatus(account.id);
            return userInfo;
        }
    encryptUserInfo(userInfo: any, pem: any) {
            const userInfoStr = JSON.stringify(userInfo);
            const key = new node_rsa(pem);
            const encrypted = key.encrypt(userInfoStr, 'base64');
            return encrypted;
        }
    async updateAccountStatus(id: any) {
            let update = {
                status: AccountStatus.migrated,
                updatedAt: new Date(),
            };
            await this.accountsDBService.updateDB(id, update);
        }
}
