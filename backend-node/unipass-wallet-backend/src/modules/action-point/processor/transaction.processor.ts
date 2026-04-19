import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { ACTION_POINT_TRANSACTION_QUEUE, SEND_SYNC_ACTION_POINT_TRANSACTION_STATUS_JOB, TIME } from '../../../shared/utils';
import { IApTransactionStatus } from '../entities';

@Processor(ACTION_POINT_TRANSACTION_QUEUE)
export class ActionPointTransactionProcessor {
    constructor(logger: any, actionPointTransactionsService: any, transactionWorkerService: any, upHttpService: any, @InjectQueue(ACTION_POINT_TRANSACTION_QUEUE) queue: any) {
        this.logger = logger;
        this.actionPointTransactionsService = actionPointTransactionsService;
        this.transactionWorkerService = transactionWorkerService;
        this.upHttpService = upHttpService;
        this.queue = queue;
        this.logger.setContext(ActionPointTransactionProcessor.name);
        this.logger.log(`Queue ${ACTION_POINT_TRANSACTION_QUEUE} ready`);
    }
    logger: any;
    actionPointTransactionsService: any;
    transactionWorkerService: any;
    upHttpService: any;
    queue: any;
    @Process(SEND_SYNC_ACTION_POINT_TRANSACTION_STATUS_JOB)
    async handleActionPointTransaction(job: any) {
            const queryData = job.data;
            this.logger.log(`[handleActionPointTransaction] query action point status Job process start, job = ${JSON.stringify(job.data)} `);
            try {
                const transactionDb = (await this.actionPointTransactionsService.findTransactionDataByWhere({
                    relayerTxHash: queryData.relayerTxHash,
                }));
                if ((transactionDb === null || transactionDb === void 0 ? void 0 : transactionDb.status) === IApTransactionStatus.COMPLETE) {
                    return;
                }
                const relayerDb = (await this.actionPointTransactionsService.getRelayerDataByWhere({
                    id: transactionDb.relayerId,
                }));
                if (await this.isUpdateActionPointStatus(queryData, relayerDb.relayerUrl)) {
                    return;
                }
                if (queryData.queryTime <= 60) {
                    queryData.queryTime += 1;
                    await this.queue.add(SEND_SYNC_ACTION_POINT_TRANSACTION_STATUS_JOB, queryData, {
                        delay: TIME.HALF_A_MINUTE * 1000,
                    });
                }
                else {
                    this.logger.error(`action point transaction status has not been updated. ${JSON.stringify(Object.assign(Object.assign({}, job.data), { historyIs: transactionDb.historyId }))} `);
                }
            }
            catch (error) {
                this.logger.error(`[handleActionPointTransaction] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
    async isUpdateActionPointStatus(queryData: any, relayerUrl: any) {
            var _a;
            const url = `${relayerUrl}tx_receipt/${queryData.relayerTxHash}`;
            try {
                const result = await this.upHttpService.httpGet(url);
                const data = result === null || result === void 0 ? void 0 : result.data;
                const chainTxHash = (_a = data.data) === null || _a === void 0 ? void 0 : _a.receipt.transactionHash;
                if (!chainTxHash) {
                    return false;
                }
                const status = await this.transactionWorkerService.getTransactionReceipt(chainTxHash);
                if (status === 1) {
                    await this.actionPointTransactionsService.deductActionPoint(queryData.relayerTxHash, chainTxHash);
                    return true;
                }
            }
            catch (error) {
                this.logger.error(`[isUpdateActionPointStatus]${JSON.stringify(error)},data=${JSON.stringify({
                    url,
                    queryData,
                })}`);
                return false;
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
