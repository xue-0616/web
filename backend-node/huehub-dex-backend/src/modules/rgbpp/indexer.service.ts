import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { MyHttpService } from '../../common/utils-service/http.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { AccountBalanceList, AccountTokenOutpointList, HolderList, IndexerTokenInfoList, MintTxsCount, OutpointInfo } from './dto/rgbpp.indexer.dto';

@Injectable()
export class RgbPPIndexerService {
    constructor(private readonly logger: AppLoggerService, private readonly myHttpService: MyHttpService, private readonly appConfig: AppConfigService) {
        this.logger.setContext(RgbPPIndexerService.name);
    }
    async getTokens(tokenTypeHash: string): Promise<IndexerTokenInfoList | null> {
            let url = `${this.appConfig.rgbPPConfig.indexerUrl}/api/v1/rgbpp/tokens`;
            let data = await this.myHttpService.httpPost(url, { tokenTypeHash });
            return data ? data.data : null;
        }
    async getTokenHolders(tokenTypeHash: string, page: number, limit: number): Promise<HolderList | null> {
            let url = `${this.appConfig.rgbPPConfig.indexerUrl}/api/v1/rgbpp/token/holders`;
            let data = await this.myHttpService.httpPost(url, {
                tokenTypeHash,
                limit,
                page,
                paginationVersion: 2,
            });
            return data ? data.data : null;
        }
    async getTokenMintTxsCount(tokenTypeHash: string, startBlock: number, paymasterAddress: string, paymasterAmount: string): Promise<MintTxsCount | null> {
            let url = `${this.appConfig.rgbPPConfig.indexerUrl}/api/v1/rgbpp/token/mint/txs/count`;
            const reqData = {
                tokenTypeHash,
                startBlock,
                paymaster: paymasterAddress,
                paymasterAmount,
            };
            let data = await this.myHttpService.httpPost(url, reqData);
            return data ? data.data : null;
        }
    async getAccountBalance(account: string, tokenTypeHash?: string): Promise<AccountBalanceList | null> {
            let url = `${this.appConfig.rgbPPConfig.indexerUrl}/api/v1/rgbpp/account/balances`;
            let data = await this.myHttpService.httpPost(url, {
                account,
                tokenTypeHash,
            });
            return data ? data.data : null;
        }
    async getAccountTokenOutpoint(account: string, tokenTypeHash?: string, btcOutPoint?: OutpointInfo): Promise<AccountTokenOutpointList | null> {
            let url = `${this.appConfig.rgbPPConfig.indexerUrl}/api/v1/rgbpp/account/token/outpoints`;
            let data = await this.myHttpService.httpPost(url, {
                account,
                tokenTypeHash,
                btcOutPoint,
            });
            return data ? data.data : null;
        }
}
