import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { ACCOUNT_QUEUE, SEND_NOTIFY_EMAIL_JOB, SEND_RECOVERY_EMAIL_JOB, SEND_SYNC_ACCOUNT_JOB } from '../../../shared/utils';

@Processor(ACCOUNT_QUEUE)
export class AccountProcessor {
    constructor(logger: any, keyService: any, emailService: any, chainSyncService: any, @InjectQueue(ACCOUNT_QUEUE) immediateQueue: any) {
        this.logger = logger;
        this.keyService = keyService;
        this.emailService = emailService;
        this.chainSyncService = chainSyncService;
        this.immediateQueue = immediateQueue;
        this.logger.setContext(AccountProcessor.name);
        this.logger.log(`Queue ${ACCOUNT_QUEUE} ready`);
    }
    logger: any;
    keyService: any;
    emailService: any;
    chainSyncService: any;
    immediateQueue: any;
    @Process(SEND_RECOVERY_EMAIL_JOB)
    async handleSendEmailJob(job: any) {
            try {
                this.logger.log(`handle send recovery email Job process start, job = ${JSON.stringify(job.data)} `);
                await this.keyService.sendRecoveryEmail(job.data);
            }
            catch (error) {
                this.logger.error(`[handleSendEmailJob] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
    @Process(SEND_NOTIFY_EMAIL_JOB)
    async handleSendNotifyEmailJob(job: any) {
            try {
                const { ctx, email, body, detail, notifyType, subject } = job.data;
                this.logger.log(`handle send notify email Job process start, job = ${JSON.stringify({
                    email,
                    body,
                    subject,
                })}`);
                await this.emailService.sendEmailNotify(ctx, body, email, detail, notifyType, subject);
            }
            catch (error) {
                this.logger.error(`[handleSendNotifyEmailJob] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
            }
        }
    @Process(SEND_SYNC_ACCOUNT_JOB)
    async handleSendSyncAccountEmailJob(job: any) {
            try {
                this.logger.log(`handle send aync account email Job process start, job = ${JSON.stringify(job.data)} `);
                await this.chainSyncService.sendSyncAccountEmail(job.data);
            }
            catch (error) {
                this.logger.error(`[handleSendSyncAccountEmailJob] job: ${error},${(error as Error)?.stack},data = ${JSON.stringify(job.data)}`);
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
