import { Injectable } from '@nestjs/common';
import { MSG, accountInfoTemplate, codeTemplate, forwardRecoveryTemplate, forwardSyncAccountTemplate, noticeTemplate, sendEmailBuriedName, verifyUrlTemplate } from '../utils';
import { TemplateType } from '../../interfaces';

@Injectable()
export class EmailService {
    constructor(logger: any, sendGridService: any, apiConfigService: any) {
        this.logger = logger;
        this.sendGridService = sendGridService;
        this.apiConfigService = apiConfigService;
        this.logger.setContext(EmailService.name);
    }
    logger: any;
    sendGridService: any;
    apiConfigService: any;
    async sendEmail(ctx: any, mail: any) {
            try {
                return await this.sendEmailBySendGrid(mail);
            }
            catch (error) {
                this.logger.error(`[sendEmail] ${error},${(error as Error)?.stack} data = ${JSON.stringify(mail)}`, ctx);
            }
        }
    async sendEmailBySendGrid(mail: any) {
            if (!mail.text) {
                mail.text = 'mail text';
            }
            return await this.sendGridService.send(mail);
        }
    async createAndSendEmail(ctx: any, body: any, template: any, subject: any, from: any, to: any, alice: any, detail: any) {
            const { html, subject: mailSubject } = this.getEmailTemplateAndSubject(body, template, subject, to, alice, detail);
            const options = {
                from,
                to,
                subject: mailSubject,
                html,
            };
            const result = await this.sendEmail(ctx, options);
            this.logger.log(`[emailTemplate] EmailBaseService send email ${to} subject is ${mailSubject} body ${body} result is ${result}`, ctx);
            this.logger.log(`buried point event = ${(sendEmailBuriedName as Record<string, string>)[template]},email:${to},type:${template},subject is ${mailSubject}`);
        }
    getEmailTemplateAndSubject(body: any, template: any, subject: any, to: any, alice: any, detail: any) {
            let html = '';
            const mailSubjectPrefix = this.apiConfigService.getOtpConfig.subjectPrefix;
            const mailSubject = mailSubjectPrefix + subject;
            const botMail = this.apiConfigService.getOtpConfig.botMail;
            switch (template) {
                case TemplateType.code:
                    html = codeTemplate(body);
                    break;
                case TemplateType.guardianRecoveryEmail:
                    subject = `UniPass-Start-Recovery${mailSubject}`;
                    html = forwardRecoveryTemplate(subject, botMail, to, alice);
                    break;
                case TemplateType.policyRecoveryEmail:
                    subject = `UniPass-Update-Account${mailSubject}`;
                    html = forwardRecoveryTemplate(subject, botMail, to, alice);
                    break;
                case TemplateType.syncAccount:
                    subject = `UniPass-Sync-Account${mailSubject}`;
                    html = forwardSyncAccountTemplate(subject, botMail, to);
                    break;
                case TemplateType.verifyUrl:
                    html = verifyUrlTemplate(body, alice);
                    break;
                case TemplateType.notify:
                    html = noticeTemplate(body, detail);
                    break;
                case TemplateType.accountInfo:
                    html = accountInfoTemplate(subject, body, detail);
                    break;
            }
            return {
                html,
                subject,
            };
        }
    async sendEmailNotify(ctx: any, body: any, email: any, details: any = '', notifyType: any = TemplateType.notify, subject: any = MSG.NOTIFY_UNIPASS) {
            const from = this.apiConfigService.getOtpConfig.mailFrom;
            const to = email;
            this.logger.log(`[sendEmailNotify] body=${body}, from=${from}, to=${to}`);
            await this.createAndSendEmail(ctx, body, notifyType, subject, from, to, undefined, details);
        }
}
