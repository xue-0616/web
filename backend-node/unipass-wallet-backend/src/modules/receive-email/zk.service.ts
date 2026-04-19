import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { SEND_ZK_QUERY_PROOF_JOB, SEND_ZK_REQUEST_PROOF_JOB, ZK_QUEUE } from '../../shared/utils';
import { RequestContext } from '../../interfaces';

@Injectable()
export class ZkService {
    constructor(logger: any, apiConfigService: any, upHttpService: any, receiveEmailService: any, @InjectQueue(ZK_QUEUE) zkQueue: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.upHttpService = upHttpService;
        this.receiveEmailService = receiveEmailService;
        this.zkQueue = zkQueue;
        this.logger.setContext(ZkService.name);
    }
    logger: any;
    apiConfigService: any;
    upHttpService: any;
    receiveEmailService: any;
    zkQueue: any;
    async getZkStatus() {
            const url = `${this.apiConfigService.getContractConfig.zkUrl}/status`;
            const zkInfo = (await this.upHttpService.httpGet(url));
            if (!zkInfo) {
                this.logger.error(`zk health error ${url}`);
                return false;
            }
            return zkInfo.healthOk;
        }
    async getRequestProof(zkJobData: any) {
            const isHealthOk = await this.getZkStatus();
            if (!isHealthOk) {
                await this.zkQueue.add(SEND_ZK_REQUEST_PROOF_JOB, zkJobData, {
                    delay: 10 * 1000,
                });
                return;
            }
            const requestProof = zkJobData.zkInfo;
            const url = `${this.apiConfigService.getContractConfig.zkUrl}/request_proof`;
            const zkInfo = (await this.upHttpService.httpPost(url, requestProof));
            if (!zkInfo) {
                this.logger.warn(`[zKParams]=request_proof return null :${JSON.stringify({
                    url,
                    requestProof,
                })}`);
                return;
            }
            zkJobData.time = 1;
            zkJobData.emailHeaderHash = zkInfo.data;
            await this.zkQueue.add(SEND_ZK_QUERY_PROOF_JOB, zkJobData, {
                delay: 10 * 1000,
            });
            this.logger.log(`[zKParams]=request_proof success,emailData:${JSON.stringify({
                fromAddress: zkJobData.emailData.fromAddress,
                url,
            })}`);
            return zkInfo.data;
        }
    async getRequestProofEmailHeaderHash(zkDataInfo: any) {
            const isHealthOk = await this.getZkStatus();
            if (!isHealthOk) {
                return undefined;
            }
            const { emailHeaderHash, emailData, zkInfo } = zkDataInfo;
            let { time } = zkDataInfo;
            const url = `${this.apiConfigService.getContractConfig.zkUrl}/query_proof/${emailHeaderHash}`;
            const proofInfo = (await this.upHttpService.httpGet(url));
            if (!proofInfo || !proofInfo.data) {
                time = time + 1;
                if (time >= 60) {
                    return;
                }
                zkDataInfo.time += 1;
                await this.zkQueue.add(SEND_ZK_QUERY_PROOF_JOB, zkDataInfo, {
                    delay: 10 * 1000,
                });
                return;
            }
            const zKParams = proofInfo.data;
            if (zKParams.failedReason && zKParams.failedReason.includes('dkim error')) {
                this.logger.warn('zKParams.failedReason:' + zKParams.failedReason);
                await this.receiveEmailService.dkimVerify(emailData, zkInfo.fromPepper, true);
            }
            zkDataInfo.zkProof = zKParams;
            await this.receiveEmailService.processEmail(new RequestContext(), zkDataInfo.emailData, zKParams);
            this.logger.log(`[zKParams]=query success,emailData:${JSON.stringify({
                fromAddress: zkDataInfo.emailData.fromAddress,
                url,
            })}`);
            return zKParams;
        }
}
