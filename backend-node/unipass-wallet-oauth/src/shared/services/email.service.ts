import { TemplateType } from '../../interfaces';
import { cassaveCodeTemplate, sendEmailBuriedName, unipassCodeTemplate } from '../utils';
import { ApiConfigService } from './api-config.service';
import { AppLoggerService } from './logger.service';
import { Injectable } from '@nestjs/common';

// Recovered from dist/email.service.js.map (source: ../../../src/shared/services/email.service.ts)

let SendGridService: any;
try { SendGridService = require('@anchan828/nest-sendgrid').SendGridService; } catch (_) {}

@Injectable()
export class EmailService {
    constructor(
        private readonly logger: AppLoggerService,
        private readonly sendGridService: any,
        private readonly apiConfigService: ApiConfigService,
    ) {
        this.logger.setContext(EmailService.name);
    }

    async sendEmail(ctx: any, mail: any): Promise<any> {
        try {
            return await this.sendEmailBySendGrid(mail);
        } catch (error: any) {
            this.logger.error(`[sendEmail] ${error},${error?.stack} data = ${JSON.stringify(mail)}`, ctx);
        }
    }

    async sendEmailBySendGrid(mail: any): Promise<any> {
        if (!mail.text) {
            mail.text = 'mail text';
        }
        return await this.sendGridService.send(mail);
    }

    async createAndSendEmail(ctx: any, body: string, template: TemplateType, subject: string, from: string, to: string): Promise<void> {
        const { html, subject: mailSubject } = this.getEmailTemplateAndSubject(body, template, subject);
        const options = { from, to, subject: mailSubject, html };
        const result = await this.sendEmail(ctx, options);
        this.logger.log(`[emailTemplate] EmailBaseService send email ${to} subject is ${mailSubject} body ${body} result is ${result}`, ctx);
        this.logger.log(`buried point event = ${(sendEmailBuriedName as any)[template]},email:${to},type:${template},subject is ${mailSubject}`);
    }

    getEmailTemplateAndSubject(body: string, template: TemplateType, subject: string): { html: string; subject: string } {
        let html = '';
        switch (template) {
            case TemplateType.cassava:
                html = cassaveCodeTemplate(body);
                break;
            default:
                html = unipassCodeTemplate(body);
                break;
        }
        return { html, subject };
    }
}
