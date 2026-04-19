import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { MyHttpService } from '../../../common/utils-service/http.service';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import { ExplorerResponse } from '../../../common/interface/ckb.explorer.api';
import { stringify } from 'querystringify';
import { toCamelCase } from '../../../common/utils/tools';

@Injectable()
export class CkbExplorerApiService {
    constructor(private readonly logger: AppLoggerService, private readonly myHttpService: MyHttpService, private readonly appConfig: AppConfigService) {
        this.logger.setContext(CkbExplorerApiService.name);
    }
    async getXudtList(symbol: string, page: number = 1): Promise<ExplorerResponse | null> {
            let url = `${this.appConfig.ckbExplorerConfig.host}/api/v1/xudts`;
            let queryData: any = {
                symbol: null,
                tags: ['rgbpp-compatible'],
                timestamp: Date.now(),
                page,
                page_size: 100,
                sort: 'created_at.desc',
            };
            if (symbol) {
                queryData.symbol = symbol;
            }
            url = `${url}${stringify(queryData, true)}`;
            let config = {
                headers: {
                    Accept: 'application/vnd.api+json',
                    'Content-Type': 'application/vnd.api+json',
                },
            };
            try {
                let response = await this.myHttpService.httpGet(url, config);
                if (response) {
                    let data = toCamelCase(response);
                    return data;
                }
                this.logger.error(`[getXudtList] data not find`);
                return null;
            }
            catch (error) {
                this.logger.error(`[getXudtList] ${(error as Error)?.stack}`);
                return null;
            }
        }
}
