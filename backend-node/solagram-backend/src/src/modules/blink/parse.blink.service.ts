import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BlinkService } from './blink.service';
import { IBlinkActionInfo } from '../../common/interface/blink-actions';
import { extractAllUrls } from '../../common/utils/tools';
import { detectSolanaAction } from '../../common/utils/solana.blink';
import { isTrustedBlinkUrl } from './blink-url.validator';

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
            // BUG-S6 fix: use isTrustedBlinkUrl rather than a raw
            // `hostList.includes` check. That helper normalises case /
            // www, enforces https, and — critically — rejects URLs
            // whose query string smuggles another destination via
            // ?url=/?redirect= etc., closing the proxy.dial.to style
            // bypass. See blink-url.validator.ts for the full matrix.
            let blinkUrls = (await Promise.all(urls.map((url: string) => {
                const check = isTrustedBlinkUrl(url, hostList);
                if (check.ok) {
                    return detectSolanaAction(url, this.logger);
                }
                this.logger.debug(
                    `[parseBlinkUrls] dropping ${url}: ${check.reason}`,
                );
                return undefined;
            }))).filter((x): x is IBlinkActionInfo => Boolean(x));
            return blinkUrls;
        }
}
