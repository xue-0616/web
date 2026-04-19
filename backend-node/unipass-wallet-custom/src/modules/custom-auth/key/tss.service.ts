import { BadRequestException, Injectable } from '@nestjs/common';
import { Wallet } from 'ethers';
import { concat, joinSignature, sha256, toUtf8Bytes } from 'ethers/lib/utils';
import { StatusName } from '../../../shared/utils';
import { KeyStatus } from '../entities/key.list.entity';

@Injectable()
export class TssService {
    constructor(logger: any, apiConfigService: any, httpService: any, keyDBService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.httpService = httpService;
        this.keyDBService = keyDBService;
        this.logger.setContext(TssService.name);
        this.wallet = new Wallet(apiConfigService.getTssConfig.privateKey);
    }
    logger: any;
    apiConfigService: any;
    httpService: any;
    keyDBService: any;
    wallet: any;
    async post(path: any, params: any = {}) {
            const url = `${this.apiConfigService.getTssConfig.host}/${path}`;
            const message = concat([
                toUtf8Bytes(`/${path}`),
                toUtf8Bytes(JSON.stringify(params)),
            ]);
            const hash = sha256(message);
            let signature = joinSignature(this.wallet._signingKey().signDigest(hash));
            signature = signature.slice(0, Math.max(0, signature.length - 2));
            this.logger.log(`[post] url = ${url}`);
            this.logger.log(`[post] body = ${JSON.stringify(params)}`);
            this.logger.log(`[post] signature = ${signature}`);
            try {
                const result = await this.httpService
                    .post(url, params, {
                    headers: {
                        signature,
                    },
                })
                    .toPromise();
                this.logger.log(`[post] tss result, ${JSON.stringify(result === null || result === void 0 ? void 0 : result.data)}`);
                return (result === null || result === void 0 ? void 0 : result.data) ? result === null || result === void 0 ? void 0 : result.data : true;
            }
            catch (error) {
                this.logger.error(`[post] TssService error ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    url,
                    signature,
                    params,
                })}`);
                return false;
            }
        }
    async startKeyGen({ id, appId, sub }: any) {
            this.logger.log(`[generate key step]  startKeyGen email = ${appId}_${sub} step create_keyId and /start_keygen/`);
            const keyId = await this.post('create_keyId');
            const tssRes = await this.post(`start_keygen/${keyId}/${id}/${sub}`);
            if (!tssRes) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            return {
                tssRes,
            };
        }
    async getKeygen(keyGenInput: any, { appId, sub }: any) {
            const { sessionId, tssMsg } = keyGenInput;
            this.logger.log(`[generate key step]  getKeygen email = ${appId}_${sub} step /keygen/`);
            const tssRes = await this.post(`keygen/${sessionId}`, { tssMsg });
            if (!tssRes) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            return {
                tssRes,
            };
        }
    async finishKeygen(finishKeygenInput: any, { appId, sub, id }: any) {
            const { sessionId, userId, localKeyAddress } = finishKeygenInput;
            this.logger.log(`[generate key step]  finishKeygen email = ${appId}_${sub} step  /finish_keygen/`);
            const tssRes = await this.post(`finish_keygen/${sessionId}`);
            if (!tssRes) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            await this.keyDBService.insertDB(id, '', localKeyAddress, KeyStatus.generateKey, userId);
            return {
                tssRes,
            };
        }
}
