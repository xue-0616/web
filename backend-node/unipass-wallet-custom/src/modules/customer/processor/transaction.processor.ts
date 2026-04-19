import { OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { POLICY_CALLBACK_JOB, POLICY_TRANSACTION_QUEUE } from '../../../shared/utils/bull.name';
import { ConsumptionStatus } from '../entities';

@Processor(POLICY_TRANSACTION_QUEUE)
export class PolicyTransactionProcessor {
    constructor(logger: any, customerDbService: any, appService: any) {
        this.logger = logger;
        this.customerDbService = customerDbService;
        this.appService = appService;
        this.logger.setContext(PolicyTransactionProcessor.name);
        this.logger.log(`Queue ${POLICY_TRANSACTION_QUEUE} ready`);
    }
    logger: any;
    customerDbService: any;
    appService: any;
    @Process(POLICY_CALLBACK_JOB)
    async handleCallbackUrl(job: any) {
            const queryData = job.data;
            this.logger.log(`[handleCallbackUrl]  Job process start, job = ${JSON.stringify(job.data)} `);
            try {
                queryData.queryTime += 1;
                const { consumptionHistory, callbackUrl, queryTime, rawData, authSig } = queryData;
                this.logger.log(`[handleCallbackUrl] res not find${JSON.stringify(Object.assign({}, queryData))} `);
                if (queryData.queryTime > 7) {
                    consumptionHistory.status = ConsumptionStatus.NotificationCompleted;
                    await this.customerDbService.insertOrUpdateGasConsumptionHistoryDb(consumptionHistory);
                    return;
                }
                const isSuccess = await this.appService.isSuccessSendCallback(consumptionHistory, callbackUrl, queryTime, rawData, authSig);
                consumptionHistory.status = isSuccess
                    ? ConsumptionStatus.NotificationCompleted
                    : ConsumptionStatus.NotificationFailed;
                await this.customerDbService.insertOrUpdateGasConsumptionHistoryDb(consumptionHistory);
            }
            catch (error) {
                this.logger.error(`[handleCallbackUrl] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
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
