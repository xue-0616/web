import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { DEPLOY_BTC_STATUS, QUEUE_TRANSACTION, TRANSACTION_BTC_STATUS } from '../../../common/utils/bull.name';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { Job, Queue } from 'bull';
import { RgbppAssetsService } from '../rgbpp.service';
import { AssetService } from '../asset/asset.service';
import { QueueDelayTime } from '../../../common/utils/const.config';

@Processor(QUEUE_TRANSACTION)
export class TokenProcessor {
    constructor(private readonly logger: AppLoggerService, private readonly rgbppServerice: RgbppAssetsService, private readonly assetService: AssetService, @InjectQueue(QUEUE_TRANSACTION) private readonly queue: Queue) {
        this.logger.setContext(TokenProcessor.name);
        this.logger.log(`Queue ${QUEUE_TRANSACTION} ready`);
    }
    @Process(TRANSACTION_BTC_STATUS)
    async getRgbppBtcState(job: Job): Promise<void> {
            const jobData = job.data;
            this.logger.log(`[getRgbppBtcState] job start, orderId = ${jobData.orderId} `);
            try {
                await this.rgbppServerice.checkAndUpdateRgbppTransactionStatus(jobData);
            }
            catch (error) {
                this.logger.error(`[getRgbppBtcState] job: ${error},${(error as Error)?.stack},orderId = ${jobData.orderId}`);
                await this.rgbppServerice.addUpdateStatusJob(jobData);
            }
        }
    @Process(DEPLOY_BTC_STATUS)
    async getDeployBtcState(job: Job): Promise<void> {
            const jobData = job.data;
            this.logger.log(`[getDeployBtcState] job start, deploy token id = ${jobData.deployTokenId} `);
            try {
                if (jobData.queryTime < 300) {
                    await this.assetService.getBtcTxStatus(jobData);
                }
                else {
                    this.logger.warn('[getDeployBtcState] queryTime >= 8');
                }
            }
            catch (error) {
                this.logger.error(`[getDeployBtcState] job: ${error},${(error as Error)?.stack},orderId = ${jobData.deployTokenId}`);
                jobData.queryTime = jobData.queryTime ? jobData.queryTime + 1 : 1;
                await this.queue.add(DEPLOY_BTC_STATUS, jobData, {
                    delay: QueueDelayTime(jobData.queryTime),
                });
            }
        }
    @OnQueueCompleted()
    async handelQueueCompleted(job: Job): Promise<void> {
            try {
                this.logger.log(`[handelQueueCompleted] job.id= ${job.id} Completed, will be remove`);
                await job.remove();
            }
            catch (error) {
                this.logger.error(`[handelQueueCompleted] job: ${(error as Error).message}}`);
            }
        }
}
