import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { SEND_ZK_QUERY_PROOF_JOB, SEND_ZK_REQUEST_PROOF_JOB, ZK_QUEUE } from '../../../shared/utils';

@Processor(ZK_QUEUE)
export class ZKProcessor {
    constructor(logger: any, zkService: any, @InjectQueue(ZK_QUEUE) immediateQueue: any) {
        this.logger = logger;
        this.zkService = zkService;
        this.immediateQueue = immediateQueue;
        this.logger.setContext(ZKProcessor.name);
        this.logger.log(`Queue ${ZK_QUEUE} ready`);
    }
    logger: any;
    zkService: any;
    immediateQueue: any;
    @Process(SEND_ZK_REQUEST_PROOF_JOB)
    async handleSendZkRequestProofJob(job: any) {
            try {
                const data = job.data;
                this.logger.log(`handle send zk requset proof Job process start, job = ${JSON.stringify({
                    fromAddress: data.emailData.fromAddress,
                    zkInfo: data.zkInfo,
                })} `);
                await this.zkService.getRequestProof(data);
            }
            catch (error) {
                this.logger.error(`[handleSendZkRequestProofJob] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
    @Process(SEND_ZK_QUERY_PROOF_JOB)
    async handleSendZkQueryProofJob(job: any) {
            try {
                const data = job.data;
                this.logger.log(`handle send zk query proof Job process start, job = ${JSON.stringify({
                    emailHeaderHash: data.emailHeaderHash,
                    fromAddress: data.emailData.fromAddress,
                })} `);
                await this.zkService.getRequestProofEmailHeaderHash(data);
            }
            catch (error) {
                this.logger.error(`[handleSendZkQueryProofJob] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
    @OnQueueCompleted()
    async handlQeueueCompleted(job: any) {
            try {
                this.logger.log(`[handlQeueueCompleted] zk job.id= ${job.id} Completed, will be remove`);
                await job.remove();
            }
            catch (error) {
                this.logger.error(`[handlQeueueCompleted] zkjob ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
}
