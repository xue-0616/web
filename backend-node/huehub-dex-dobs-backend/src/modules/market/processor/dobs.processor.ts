import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { QUEUE_TRANSACTION, TRANSACTION_BTC_STATUS } from '../../../common/utils/bull.name';
import { AppLoggerService } from '../../../common/utils.service/logger.service';
import { Job, Queue } from 'bull';
import { TransactionService } from '../tx.service';

@Processor(QUEUE_TRANSACTION)
export class DobsProcessor {
    constructor(private readonly logger: AppLoggerService, private readonly transactionService: TransactionService, @InjectQueue(QUEUE_TRANSACTION) private readonly queue: Queue) {
        this.logger.setContext(DobsProcessor.name);
        this.logger.log(`Queue ${QUEUE_TRANSACTION} ready`);
    }
    @Process(TRANSACTION_BTC_STATUS)
    async getRgbppBtcState(job: Job): Promise<void> {
            const jobData = job.data;
            this.logger.log(`[getRgbppBtcState] job start, orderId = ${jobData.orderId} `);
            try {
                await this.transactionService.checkAndUpdateRgbppTransactionStatus(jobData);
            }
            catch (error) {
                this.logger.error(`[getRgbppBtcState] job: ${error},${(error as Error)?.stack},orderId = ${jobData.orderId}`);
                await this.transactionService.addUpdateStatusJob(jobData);
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
