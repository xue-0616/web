import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { DataSource, NetworkType, Utxo } from '@rgbpp-sdk/btc';
import { BtcApiBalance, BtcApiUtxo, BtcAssetsApi } from '@rgbpp-sdk/service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { ShowUtxoStatus, UTXOInfo } from '../user/dto/assets.output.dto';
import { BTC_UTXO_DUST_LIMIT } from '../../common/utils/const.config';

@Injectable()
export class BtcAssetsService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService) {
        this.logger.setContext(BtcAssetsService.name);
        this.initSdkService();
    }
    service!: BtcAssetsApi;
    private source: any;
    initSdkService() {
            const networkType = this.appConfig.isTestnet
                ? NetworkType.TESTNET
                : NetworkType.MAINNET;
            this.service = BtcAssetsApi.fromToken(this.appConfig.rgbPPConfig.btcAssetsApiUrl, this.appConfig.rgbPPConfig.btcApiToken, this.appConfig.rgbPPConfig.btcApiOrigin);
            this.source = new DataSource(this.service, networkType);
        }
    async getAddressUtxo(address: string): Promise<[UTXOInfo[], BtcApiBalance?]> {
            try {
                const [utxos, balance] = await Promise.all([
                    this.service.getBtcUtxos(address, { min_satoshi: BTC_UTXO_DUST_LIMIT }),
                    this.getBtcBalance(address),
                ]);
                let list = this.getUtxoInfoList(utxos);
                return [list, balance ?? undefined];
            }
            catch (error) {
                this.logger.error(`[getAddressUtxo] ${(error as Error).message}`);
                return [[], undefined];
            }
        }
    async getBtcBalance(address: string): Promise<BtcApiBalance | null> {
            try {
                const balance = await this.service.getBtcBalance(address);
                return balance;
            }
            catch (error) {
                this.logger.error(`[getAddressUtxo] ${(error as Error).message}`);
                return null;
            }
        }
    getUtxoInfoList(utxos: BtcApiUtxo[]): UTXOInfo[] {
            return utxos.map((x): any => {
                return {
                    txHash: x.txid,
                    index: x.vout,
                    value: x.value.toString(),
                    status: x.status.confirmed
                        ? ShowUtxoStatus.LiveUtxo
                        : ShowUtxoStatus.FreezeUtxo,
                };
            });
        }
    async getUtxo(address: string, txHash: string, index: number): Promise<Utxo | null> {
            try {
                const utxo = await this.source.getUtxo(txHash, index);
                if (address !== utxo.address) {
                    return null;
                }
                return utxo;
            }
            catch (error) {
                this.logger.error(`[getUtxo] ${error}`);
                return null;
            }
        }
    async getBtcTransactionStatus(btcTxId: string): Promise<Boolean> {
            try {
                const tx = await this.service.getBtcTransaction(btcTxId);
                return true;
            }
            catch (err) {
                if (String(err).includes('Transaction not found')) {
                    return false;
                }
                throw err;
            }
        }
}
