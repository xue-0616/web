import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import Redis from 'ioredis';
import { AppType, MessageType } from './dto/app-query.input.dto';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { AppQueryOutputDto } from './dto/app-query.output.dto';
import { ApiMethod, ForwardingApiInputDto } from './dto/forwarding-api.input.dto';
import { MyHttpService } from '../../common/utils-service/http.service';
import { StatusName } from '../../common/utils/error.code';
import { TIME } from '../../common/utils/time';
import { stringify } from 'querystringify';

@Injectable()
export class WalletService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, @InjectRedis() private readonly redis: Redis, private readonly myHttpService: MyHttpService) {
        this.logger.setContext(WalletService.name);
    }
    walletCacheKey(app: any, key: any) {
            return `${this.appConfig.nodeEnv}:Solagram:Message:${app}_${key}{tag}`;
        }
    walletRawTxCacheKey(app: any, key: any) {
            return `${this.appConfig.nodeEnv}:Solagram:Tx:${app}_${key}{tag}`;
        }
    async queryMessage(app: AppType, key: string, messageType: MessageType): Promise<AppQueryOutputDto> {
            let cacheKey = this.walletCacheKey(app, key);
            if (messageType && messageType == MessageType.TxRawData) {
                cacheKey = this.walletRawTxCacheKey(app, key);
            }
            let cacheData = await this.redis.get(cacheKey);
            if (!cacheData) {
                this.logger.error(`queryMessage ${cacheKey} not find`);
                throw new BadRequestException(StatusName.MessageNotFind);
            }
            return JSON.parse(cacheData);
        }
    async saveMessage(app: AppType, key: string, data: AppQueryOutputDto | any, messageType?: MessageType): Promise<void> {
            let cacheKey = this.walletCacheKey(app, key);
            if (messageType && messageType == MessageType.TxRawData) {
                cacheKey = this.walletRawTxCacheKey(app, key);
            }
            await this.redis.set(cacheKey, JSON.stringify(data), 'EX', TIME.TEN_MINUTES);
        }
    async forwardingSolanaApi(input: ForwardingApiInputDto): Promise<string | null> {
            let data = null;
            let url = `${this.appConfig.walletConfig.solanaApi}${input.path}`;
            let body = null;
            try {
                body = JSON.parse(input.body);
            }
            catch (error) {
                this.logger.error(`[forwardingSolanaApi] error ${(error as Error)?.stack}`);
            }
            switch (input.method) {
                case ApiMethod.POST:
                    data = await this.myHttpService.httpPost(url, body);
                    break;
                case ApiMethod.Get:
                    url = `${url}${stringify(body, true)}`;
                    data = await this.myHttpService.httpGet(url);
                    break;
                default:
                    break;
            }
            return data ? JSON.stringify(data) : null;
        }
}
