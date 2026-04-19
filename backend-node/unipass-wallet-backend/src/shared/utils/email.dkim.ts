import Mailparser from 'mailparser';
import { getEmailBuriedName } from './buried.point.name';
import { DkimParams } from '@unipasswallet/dkim';

export async function getEmailDkimInfo(originEmails: any, logger: any) {
    const mail = await Mailparser.simpleParser(originEmails);
    const subject = mail.subject;
    let fromAddress = '';
    try {
        fromAddress = mail.headers.get('from').value[0].address;
    }
    catch (error) {
        logger.error(`[getEmailDkimInfo]${error},${(error as Error)?.stack},data = ${JSON.stringify({
            originEmails,
        })}`);
        logger.log(`buried point event = ${getEmailBuriedName.emailParsingError}, data = ${originEmails}`);
    }
    try {
        const headers = await DkimParams.parseEmailParams(originEmails, [
            '1e100.net',
        ]);
        return {
            headers,
            fromAddress,
            subject,
        };
    }
    catch (error) {
        logger.error(`[getEmailDkimInfo]${error},${(error as Error)?.stack},data = ${JSON.stringify(originEmails)}`);
        logger.log(`buried point event = ${getEmailBuriedName.emailDkimParamsParsingError}, data = ${originEmails},email=${fromAddress}`);
        return {
            headers: undefined,
            fromAddress,
            subject,
        };
    }
}
