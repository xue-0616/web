import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { StatusName } from '../../../shared/utils';

@Injectable()
export class TssUpKeyService {
    constructor(logger: any, config: any, @InjectConnection('tss_db') tssDb: any) {
        this.logger = logger;
        this.config = config;
        this.tssDb = tssDb;
        this.logger.setContext(TssUpKeyService.name);
        let tssConfig = {
            region: this.config.awsConfig.tssRegion,
            credentials: {
                accessKeyId: this.config.awsConfig.tssAccessKey,
                secretAccessKey: this.config.awsConfig.tssSecretKey,
            },
        };
        this.tssKmsClient = new KMSClient(tssConfig);
    }
    logger: any;
    config: any;
    tssDb: any;
    tssKmsClient: any;
    async getServeKeyByUuid(uuid: any) {
            uuid = uuid.replace(/-/g, '');
            const dbData = await this.executeQuery(uuid);
            if (dbData.length === 0) {
                this.logger.error(`[findOneByUUid] uuid not find ${uuid}`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            try {
                const encryptedTextBuffer = Buffer.from(dbData[0].p1Private, 'base64');
                const data = await this.decryptData(encryptedTextBuffer);
                return data;
            }
            catch (error) {
                this.logger.error(`[DecryptCommand] error ${error}, ${(error as Error)?.stack} uuid = ${uuid} email = ${dbData[0].email}`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
        }
    async executeQuery(uuid: any) {
            const query = `SELECT hex(upkey_id) as uuid, email, p1_private as p1Private FROM UPKey WHERE upkey_id = x'${uuid}'`;
            return (await this.tssDb.query(query));
        }
    async decryptData(encryptedTextBuffer: any) {
            const data = await this.tssKmsClient.send(new DecryptCommand({
                CiphertextBlob: encryptedTextBuffer,
                KeyId: this.config.awsConfig.tssKmsKeyId,
            }));
            const decryptedBuffer = Buffer.from(data.Plaintext);
            const decrypted = decryptedBuffer.toString('utf-8');
            return decrypted;
        }
}
