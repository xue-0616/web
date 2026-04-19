import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { LAUNCHPAD_BTC_STATUS, QUEUE_LAUNCHPAD_TX } from '../../../common/utils/bull.name';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { Job, Queue } from 'bull';
import { LaunchpadTransactionService } from '../launchpad.transaction.service';

@Processor(QUEUE_LAUNCHPAD_TX)
export class LaunchpadTransactionProcessor {
    constructor(private readonly logger: AppLoggerService, private readonly launchpadTransactionService: LaunchpadTransactionService, @InjectQueue(QUEUE_LAUNCHPAD_TX) private readonly queue: Queue) {
        this.logger.setContext(LaunchpadTransactionProcessor.name);
    }
    @Process(LAUNCHPAD_BTC_STATUS)
    async getRgbppBtcState(job: Job): Promise<void> {
            const jobData = job.data;
            this.logger.log(`[getRgbppBtcState] job start, job = ${JSON.stringify(jobData)} `);
            try {
                await this.launchpadTransactionService.updateMintTxStatus(jobData);
            }
            catch (error) {
                this.logger.error(`[getRgbppBtcState] job: ${error},${error?.stack}, job = ${JSON.stringify(jobData)}`);
                await this.launchpadTransactionService.addUpdateStatusJob(jobData);
            }
        }
    @OnQueueCompleted()
    async handelQueueCompleted(job: Job): Promise<void> {
            try {
                await job.remove();
            }
            catch (error) {
                this.logger.error(`[handelQueueCompleted] job: ${error.message}}`);
            }
        }
}
