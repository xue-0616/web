import { AppLoggerService } from '../../../shared/services';
import { SEND_EMAIL_CODE_JOB, SEND_EMAIL_QUEUE } from '../../../shared/utils';
import { SendEmailService } from '../service/send.email.service';
import { OnQueueCompleted, Process, Processor } from '@nestjs/bull';

// Recovered from dist/send.code.processor.js.map (source: ../../../../src/modules/otp/processor/send.code.processor.ts)
export class SendEmailProcessor {
    constructor(private readonly logger: AppLoggerService, private readonly sendEmailService: SendEmailService) {
        this.logger.setContext(SendEmailProcessor.name);
    }
    @Process(SEND_EMAIL_CODE_JOB)
    async handleSendCodeEmailJob(job: any): Promise<void> {
        const { ctx, email, code, templateType } = job.data;
        this.logger.log(`handle send email code Job process start, job = ${JSON.stringify(job.data)} `, ctx);
        await this.sendEmailService.sendEmailVerificationCode(ctx, email, code, templateType);
    }

    @OnQueueCompleted()
    async handlQeueueCompleted(job: any): Promise<void> {
        try {
            this.logger.log(`[handlQeueueCompleted] job.id= ${job.id} Completed, will be remove`);
            await job.remove();
        } catch (error: any) {
            this.logger.error(`[handlQeueueCompleted] job ${error},${error?.stack},data = ${JSON.stringify(job.data)}`);
        }
    }
}

Processor(SEND_EMAIL_QUEUE)(SendEmailProcessor);
