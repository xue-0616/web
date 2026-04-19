import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BlinkService } from './blink.service';
import { IBlinkActionInfo } from '../../common/interface/blink-actions';
import { extractAllUrls } from '../../common/utils/tools';
import { detectSolanaAction } from '../../common/utils/solana.blink';

@Injectable()
export class ParseBlinkService {
    constructor(private readonly logger: AppLoggerService, private readonly blinkService: BlinkService) {
        this.logger.setContext(ParseBlinkService.name);
    }
    async parseBlinkUrls(text: string): Promise<IBlinkActionInfo[]> {
            let urls: string[] = [];
            try {
                urls = extractAllUrls(text);
            }
            catch (error) {
                this.logger.warn(`parseBlinkUrls ${(error as Error)?.stack}`);
                return [];
            }
            let trustedHost = await this.blinkService.getAllTrustedHost();
            let hostList = trustedHost.list;
            if (hostList.length === 0) {
                return [];
            }
            let blinkUrls = (await Promise.all(urls.map((url: string) => {
                const hostname = new URL(url).hostname;
                if (hostList.includes(hostname)) {
                    return detectSolanaAction(url, this.logger);
                }
                return undefined;
            }))).filter((x): x is IBlinkActionInfo => Boolean(x));
            return blinkUrls;
        }
}
