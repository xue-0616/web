import { BadRequestException, Injectable } from '@nestjs/common';
import { KeyType } from '../../../interfaces';
import { StatusName } from '../../../shared/utils';

@Injectable()
export class KeyService {
    constructor(logger: any, keyDBService: any) {
        this.logger = logger;
        this.keyDBService = keyDBService;
        this.logger.setContext(KeyService.name);
    }
    logger: any;
    keyDBService: any;
    checkMasterKey(masterKey: any) {
            let { keyType } = masterKey;
            const { masterKeyAddress, keyStore } = masterKey;
            keyType = !keyType ? KeyType.MPC : Number(keyType);
            const keyTypes = [KeyType.CUSTOM_AUTH];
            if (keyTypes.includes(keyType) &&
                (!masterKeyAddress.trim() || !keyStore || !keyStore.trim())) {
                this.logger.warn('[checkMasterKey] !masterKeyAddress.trim() || !keyStore || !keyStore.trim()');
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            if (!keyStore) {
                masterKey.keyStore = '';
            }
            masterKey.keyType = keyType;
            return masterKey;
        }
    async updateWeb3authAddress(id: any, web3AuthAddress: any) {
            await this.keyDBService.updateDB(id, {
                web3AuthAddress,
                updatedAt: new Date(),
            });
        }
    async getKeystore(accountId: any, address: any) {
            const key = await this.keyDBService.findOne({
                accountId,
                address,
            });
            if (!key) {
                this.logger.warn(`key not find ${accountId},address=${address}`);
                throw new BadRequestException(StatusName.ACCOUNT_NOT_EXISTS);
            }
            return {
                keystore: key.keystore.toString(),
                keyType: key.keyType,
                web3authAddress: key.web3AuthAddress,
                keyId: key.id,
            };
        }
}
