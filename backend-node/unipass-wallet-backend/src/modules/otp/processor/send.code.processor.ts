import { InjectQueue, OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { SEND_EMAIL_CODE_JOB, SEND_EMAIL_QUEUE, SEND_GUARDIAN_EMAIL_JOB, SEND_PHONE_CODE_JOB } from '../../../shared/utils';

@Processor(SEND_EMAIL_QUEUE)
export class SendEmailProcessor {
    constructor(logger: any, sendEmailService: any, phoneService: any, @InjectQueue(SEND_EMAIL_QUEUE) immediateQueue: any) {
        this.logger = logger;
        this.sendEmailService = sendEmailService;
        this.phoneService = phoneService;
        this.immediateQueue = immediateQueue;
        this.logger.setContext(SendEmailProcessor.name);
        this.logger.log(`Queue ${SEND_EMAIL_QUEUE} ready`);
    }
    logger: any;
    sendEmailService: any;
    phoneService: any;
    immediateQueue: any;
    @Process(SEND_EMAIL_CODE_JOB)
    async handleSendCodeEmailJob(job: any) {
            const { ctx, email, code } = job.data;
            this.logger.log(`handle send email code Job process start, job = ${JSON.stringify(job.data)} `, ctx);
            await this.sendEmailService.sendEmailVerificationCode(ctx, email, code);
        }
    @Process(SEND_GUARDIAN_EMAIL_JOB)
    async handleSendGuardinEmailJob(job: any) {
            const { ctx, email, code, action, registerEmail, provider } = job.data;
            this.logger.log(`handle send guardin email Job process start, job = ${JSON.stringify(job.data)} `, ctx);
            await this.sendEmailService.sendGuardianEmail(ctx, email, code, action, registerEmail, provider);
        }
    @Process(SEND_PHONE_CODE_JOB)
    async handleSendPhoneJob(job: any) {
            this.logger.log(`handle send phone code Job process start, job = ${JSON.stringify(job.data)} `);
            await this.phoneService.sendPhoneCode(job.data);
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
