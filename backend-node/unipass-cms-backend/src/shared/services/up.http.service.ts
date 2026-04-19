import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UpHttpService {
    httpService;
    constructor(httpService: HttpService) {
        this.httpService = httpService;
    }
    async httpGet(url: any, config = {}): Promise<any> {
        try {
            const result = await this.httpService.get(url, config).toPromise();
            return result?.data;
        }
        catch (error) {
            console.error(`[httpGet] ${error},data=${JSON.stringify({
                url,
                config,
            })}`);
        }
    }
    async httpPost(url: any, params = {}, config = {}): Promise<any> {
        try {
            const result = await this.httpService
                .post(url, params, config)
                .toPromise();
            return result?.data;
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
