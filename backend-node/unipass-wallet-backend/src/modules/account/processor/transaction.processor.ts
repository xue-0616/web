import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { SEND_TRANSACTION_JOB, SYNC_TRANSACTION_JOB, TRANSACTION_QUEUE } from '../../../shared/utils';

@Processor(TRANSACTION_QUEUE)
export class TransactionProcessor {
    constructor(packTransactionService: any, syncAccountService: any, logger: any, @InjectQueue(TRANSACTION_QUEUE) immediateQueue: any) {
        this.packTransactionService = packTransactionService;
        this.syncAccountService = syncAccountService;
        this.logger = logger;
        this.immediateQueue = immediateQueue;
        this.logger.setContext(TransactionProcessor.name);
        this.logger.log(`Queue ${TRANSACTION_QUEUE} ready`);
    }
    packTransactionService: any;
    syncAccountService: any;
    logger: any;
    immediateQueue: any;
    @Process(SEND_TRANSACTION_JOB)
    async handleTransaction(job: any) {
            try {
                const waitingCount = await this.immediateQueue.getWaitingCount();
                this.logger.log(`[handleTransaction] pack transaction job start ${JSON.stringify(job.data)},waitingCount=${waitingCount}`);
                const jobIds = await this.packTransactionService.packTransaction(job);
                return jobIds;
            }
            catch (error) {
                this.logger.error(`[handleTransaction] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
                return [];
            }
        }
    @Process(SYNC_TRANSACTION_JOB)
    async handleSyncTransaction(job: any) {
            try {
                const waitingCount = await this.immediateQueue.getWaitingCount();
                this.logger.log(`[handleSyncTransaction] sync transaction job start ${JSON.stringify(job.data)},waitingCount=${waitingCount}`);
                await this.syncAccountService.updateAccountTransaction(job.data);
            }
            catch (error) {
                this.logger.error(`[handleSyncTransaction] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
    @OnQueueCompleted()
    async handlQeueueCompleted(job: any) {
            try {
                this.logger.log(`[handlQeueueCompleted] job.id= ${job.id} Completed, will be remove`);
                await job.remove();
            }
            catch (error) {
                this.logger.error(`[handlQeueueCompleted] job ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
}
