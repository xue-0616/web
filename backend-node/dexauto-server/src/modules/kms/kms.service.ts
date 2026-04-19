import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { UnknownError } from '../../error';

@Injectable()
export class KmsService {
    private logger: PinoLogger;
    private kmsClient: KMSClient;
    private kmsKeyId: string;

    constructor(config: ConfigService, @InjectPinoLogger(KmsService.name) logger: PinoLogger) {
        this.logger = logger;
        logger.setContext(KmsService.name);
        const region = config.getOrThrow('kmsRegion');
        const accessKeyId = config.getOrThrow('kmsAccessKeyId');
        const secretAccessKey = config.getOrThrow('kmsSecretAccessKey');
        this.kmsClient = new KMSClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        this.kmsKeyId = config.getOrThrow('kmsKeyId');
    }
    async encrypt(msg: Uint8Array): Promise<Buffer> {
        try {
            const command = new EncryptCommand({
                KeyId: this.kmsKeyId,
                Plaintext: msg,
                EncryptionAlgorithm: 'RSAES_OAEP_SHA_256',
            });
            const { CiphertextBlob } = await this.kmsClient.send(command);
            if (CiphertextBlob === undefined) {
                throw new UnknownError('expected CiphertextBlob');
            }
            return Buffer.from(CiphertextBlob);
        }
        catch (error) {
            throw new UnknownError(error);
        }
    }
    async decrypt(sig: Uint8Array): Promise<Buffer> {
        try {
            const command = new DecryptCommand({
                KeyId: this.kmsKeyId,
                CiphertextBlob: sig,
                EncryptionAlgorithm: 'RSAES_OAEP_SHA_256',
            });
            const { Plaintext } = await this.kmsClient.send(command);
            if (Plaintext === undefined) {
                throw new UnknownError('expected Plaintext');
            }
            return Buffer.from(Plaintext);
        }
        catch (error) {
            throw new UnknownError(error);
        }
    }
}
