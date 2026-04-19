import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class UpHttpService {
    constructor(private readonly httpService: HttpService) {
    }
    async httpGet(url: string, config: {} = {}): Promise<any> {
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
    async httpPost(url: string, params: {} = {}, config: {} = {}): Promise<any> {
            try {
                const result = await this.httpService
                    .post(url, params, config)
                    .toPromise();
                return result === null || result === void 0 ? void 0 : result.data;
            }
            catch (error) {
                console.error(`[httpPost] error ${error}, data=${JSON.stringify({
                    url,
                    params,
                    config,
                })}`);
            }
        }
}
