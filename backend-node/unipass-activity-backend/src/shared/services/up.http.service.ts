import { Injectable } from '@nestjs/common';

@Injectable()
export class UpHttpService {
    constructor(httpService: any, logger: any) {
        this.httpService = httpService;
        this.logger = logger;
    }
    httpService: any;
    logger: any;
    async httpGet(url: any, config: any = {}) {
            try {
                const result = await this.httpService.get(url, config).toPromise();
                return result === null || result === void 0 ? void 0 : result.data;
            }
            catch (error) {
                console.error(`[httpGet] ${error},data=${JSON.stringify({
                    url,
                    config,
                })}`);
            }
        }
    async httpPost(url: any, params: any = {}, config: any = {}) {
            this.logger.log(`[httpPost] url ${url} params=${JSON.stringify({
                params,
                config,
            })}`);
            try {
                const result = await this.httpService
                    .post(url, params, config)
                    .toPromise();
                return result === null || result === void 0 ? void 0 : result.data;
            }
            catch (error) {
                this.logger.error(`[httpPost] error ${error} data=${JSON.stringify({
                    url,
                    params,
                    config,
                })}`);
            }
        }
}
