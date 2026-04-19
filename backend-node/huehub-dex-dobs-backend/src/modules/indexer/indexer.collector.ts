import CKB from '@nervosnetwork/ckb-sdk-core';
import { IndexerCell, IndexerError, toCamelcase } from '@rgbpp-sdk/ckb';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import axios from 'axios';

const parseScript = (script: any) => ({
    code_hash: script.codeHash,
    hash_type: script.hashType,
    args: script.args,
});

export class Collector {
    constructor({ ckbNodeUrl, ckbIndexerUrl, logger, }: {
        ckbNodeUrl: string;
        ckbIndexerUrl: string;
        logger: AppLoggerService;
    }) {
        this.ckbNodeUrl = ckbNodeUrl;
        this.ckbIndexerUrl = ckbIndexerUrl;
        this.logger = logger;
    }
    private ckbNodeUrl: any;
    private ckbIndexerUrl: any;
    private logger: any;
    getCkb(): CKB {
            return new CKB(this.ckbNodeUrl);
        }
    async makePostRequest(body: string, timeout: number = 20000): Promise<any> {
            try {
                const response = await axios({
                    method: 'post',
                    url: this.ckbIndexerUrl,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: timeout,
                    data: body,
                });
                if (response.data.error) {
                    throw new IndexerError(response.data.error.message || 'Request error');
                }
                return response.data.result;
            }
            catch (error) {
                this.logger.error(`[makePostRequest] ${(error as Error)?.stack}`);
                throw new IndexerError('Network request failed');
            }
        }
    async getTipBolckNumber(): Promise<string> {
            let payload = {
                id: Math.floor(Math.random() * 100000),
                jsonrpc: '2.0',
                method: 'get_tip_block_number',
                params: [],
            };
            const body = JSON.stringify(payload, null, '  ');
            try {
                let bolckNumber = await this.makePostRequest(body);
                return bolckNumber;
            }
            catch (error) {
                this.logger.error(`[getTipBolckNumber] ${(error as Error)?.stack}`);
                throw new IndexerError('getTipBolckNumber error');
            }
        }
    async getCells({ lock, type, blockRange, cursor, }: {
        lock: CKBComponents.Script;
        type: CKBComponents.Script;
        blockRange: string[];
        cursor?: string;
    }): Promise<{
        cells: IndexerCell[];
        lastCursor: string;
    } | undefined> {
            let param = {
                script: parseScript(lock),
                script_type: 'lock',
                filter: {
                    script: parseScript(type),
                    block_range: blockRange,
                },
            };
            let params = [param, 'asc', '0x3E8'];
            if (cursor) {
                params = [param, 'asc', '0x3E8', cursor];
            }
            let payload = {
                id: Math.floor(Math.random() * 100000),
                jsonrpc: '2.0',
                method: 'get_cells',
                params,
            };
            const body = JSON.stringify(payload, null, '  ');
            try {
                let result = await this.makePostRequest(body);
                const cells = toCamelcase(result.objects);
                const lastCursor = result.last_cursor;
                return { cells, lastCursor };
            }
            catch (error) {
                this.logger.error(`[getCells] ${(error as Error)?.stack}`);
                throw new IndexerError('Get cells error');
            }
        }
}
