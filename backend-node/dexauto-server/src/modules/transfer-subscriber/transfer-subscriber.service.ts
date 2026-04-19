import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { TransferSyncerService } from '../transfer-syncer/transfer-syncer.service';
import { AutomaticStrategySyncerService } from '../automatic-strategy-syncer/automatic-strategy-syncer.service';
import { TokenService } from '../token/token.service';
import Redlock from 'redlock';
import { Injectable, Inject } from '@nestjs/common';
import { InjectPinoLogger } from 'nestjs-pino';
import { Client } from 'rpc-websockets';
import { UnknownError } from '../../error';
import { WSOL } from '../../common/utils';
import { BANNED_TOKENS } from '../token/query/clickhouse-query';

export interface AccountDexTrade {
    tx_id: string;
    trader: string;
    base_mint: string;
    quote_mint: string;
    block_time: string;
    usd_value: string;
    base_amount: string;
    quote_amount: string;
    [key: string]: any;
}

const LOCK = `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:TRANSFER_SUBSCRIBER:LOCK`;
@Injectable()
export class TransferSubscriberService implements OnModuleInit, OnModuleDestroy {
    private redisClient: Redis;
    private configService: ConfigService;
    private logger: PinoLogger;
    private transferSyncer: TransferSyncerService;
    private automaticStrategySyncer: AutomaticStrategySyncerService;
    private tokenService: TokenService;
    private isRunning: boolean;
    private redlock: Redlock;
    private clientSocket: Client | undefined;
    private nativeTransferSubscriptionId: string | undefined;
    private tokenTransferSubscriptionId: string | undefined;
    private accountDexTradesSubscriptionId: string | undefined;
    private lock: any;

    constructor(
        @Inject('REDIS_CLIENT') redisClient: Redis,
        configService: ConfigService,
        @InjectPinoLogger(TransferSubscriberService.name) logger: PinoLogger,
        transferSyncer: TransferSyncerService,
        automaticStrategySyncer: AutomaticStrategySyncerService,
        tokenService: TokenService,
    ) {
        this.redisClient = redisClient;
        this.configService = configService;
        this.logger = logger;
        this.transferSyncer = transferSyncer;
        this.automaticStrategySyncer = automaticStrategySyncer;
        this.tokenService = tokenService;
        this.isRunning = true;
        this.redlock = new Redlock([this.redisClient], {
            driftFactor: 0.01,
            retryCount: 10,
            retryDelay: 200,
            retryJitter: 200,
            automaticExtensionThreshold: 500,
        });
    }
    async onModuleInit(): Promise<void> {
        this.run();
    }
    async onModuleDestroy(): Promise<void> {
        this.isRunning = false;
        if (this.clientSocket) {
            this.clientSocket.close();
        }
        if (this.lock) {
            await this.lock.release();
        }
        this.logger.info('Transfer subscriber service destroyed');
    }
    async run(): Promise<void> {
        const duration = 300000;
        while (this.isRunning) {
            try {
                if (!this.lock) {
                    this.lock = await this.redlock.acquire([LOCK], duration);
                }
                break;
            }
            catch { }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        this.logger.info('Get lock success');
        this.extendLock();
        await Promise.all([
            this.transferSyncer.initWallets(),
            this.automaticStrategySyncer.initStrategies(),
        ]);
        while (this.isRunning) {
            try {
                if (!this.clientSocket) {
                    const wsUrl = this.configService.getOrThrow('dataCenterWs');
                    this.clientSocket = new Client(wsUrl, {
                        followRedirects: true,
                        reconnect: true,
                        max_reconnects: 0,
                    });
                }
                this.clientSocket.on('error', (error) => {
                    this.logger.error(`WebSocket error: ${(error as Error).message}`);
                });
                this.clientSocket.on('close', () => {
                    this.logger.error('Data stream connection closed');
                    this.nativeTransferSubscriptionId = undefined;
                    this.tokenTransferSubscriptionId = undefined;
                    this.accountDexTradesSubscriptionId = undefined;
                });
                this.clientSocket.on('open', async () => {
                    this.logger.info('data center ws connected');
                    if (!this.clientSocket) {
                        throw new Error('Client socket not found');
                    }
                    if (!this.nativeTransferSubscriptionId) {
                        const wallets = this.transferSyncer.wallets?.keys();
                        if (!wallets) {
                            throw new Error('transfer syncer not initialized');
                        }
                        const nativeTransferSubscriptionId = await this.clientSocket.call('subscribeNativeTransfers', [Array.from(wallets)]);
                        if (nativeTransferSubscriptionId &&
                            typeof nativeTransferSubscriptionId === 'string') {
                            this.nativeTransferSubscriptionId = nativeTransferSubscriptionId;
                        }
                        else {
                            throw new Error('Failed to subscribe to native transfers');
                        }
                        this.syncNativeTransfers();
                    }
                    if (!this.tokenTransferSubscriptionId) {
                        const wallets = this.transferSyncer.wallets?.keys();
                        if (!wallets) {
                            throw new Error('transfer syncer not initialized');
                        }
                        const tokenTransferSubscriptionId = await this.clientSocket.call('subscribeTokenTransfers', [Array.from(wallets)]);
                        if (tokenTransferSubscriptionId &&
                            typeof tokenTransferSubscriptionId === 'string') {
                            this.tokenTransferSubscriptionId = tokenTransferSubscriptionId;
                        }
                        else {
                            throw new Error('Failed to subscribe to token transfers');
                        }
                        this.syncTokenTransfers();
                    }
                    // Skip WebSocket DEX trade subscription when Yellowstone gRPC is active
                    // (GeyserSubscriberService handles it with < 1s latency)
                    const geyserEndpoint = this.configService.get('GEYSER_GRPC_ENDPOINT');
                    if (!this.accountDexTradesSubscriptionId && !geyserEndpoint) {
                        console.log('init account dex trades (WebSocket fallback)');
                        const addresses = this.automaticStrategySyncer.monitorAddresses();
                        const accountDexTradesSubscriptionId = await this.clientSocket.call('subscribeAccountDexTrades', [addresses]);
                        if (accountDexTradesSubscriptionId &&
                            typeof accountDexTradesSubscriptionId === 'string') {
                            this.accountDexTradesSubscriptionId =
                                accountDexTradesSubscriptionId;
                        }
                        else {
                            throw new Error('Failed to subscribe to account dex trades');
                        }
                        this.syncAccountDexTrades();
                    }
                    else if (geyserEndpoint) {
                        this.logger.info('DEX trades handled by Yellowstone gRPC — skipping WebSocket subscription');
                    }
                });
                break;
            }
            catch (error) {
                this.logger.error(`run failed: ${(error as Error).message}`);
                await new Promise((resolve) => setTimeout(resolve, 300000));
            }
        }
        await Promise.all([
            this.transferSyncer.initQueue(async (walletAddresses: any) => {
                try {
                    if (!this.clientSocket) {
                        this.logger.error('Client socket not found');
                        throw new Error('Client socket not found');
                    }
                    await this.clientSocket.call('addAccountForNativeTransfersSubscription', [this.nativeTransferSubscriptionId, walletAddresses]);
                    await this.clientSocket.call('addAccountForTokenTransfersSubscription', [this.tokenTransferSubscriptionId, walletAddresses]);
                }
                catch (error) {
                    this.logger.error(`addAccountForNativeTransfersSubscription failed: ${(error as Error).message}`);
                }
            }),
            this.automaticStrategySyncer.initQueue(async (addresses: any) => {
                try {
                    if (!this.clientSocket) {
                        this.logger.error('Client socket not found');
                        throw new Error('Client socket not found');
                    }
                    await this.clientSocket.call('addAccountForAccountDexTradesSubscription', [this.accountDexTradesSubscriptionId, addresses]);
                }
                catch (error) {
                    this.logger.error(`addAccountForAccountDexTradesSubscription failed: ${(error as Error).message}`);
                }
            }),
        ]);
    }
    /** Maximum consecutive lock extension failures before this instance stops processing. */
    private static readonly MAX_LOCK_EXTEND_FAILURES = 3;

    async extendLock(): Promise<void> {
        let consecutiveFailures = 0;
        while (this.isRunning) {
            try {
                if (!this.lock) {
                    throw new Error('Lock not found');
                }
                await new Promise((resolve) => setTimeout(resolve, 240000));
                this.lock = await this.lock.extend(300000);
                consecutiveFailures = 0;
            }
            catch (error) {
                consecutiveFailures++;
                this.logger.error(`extendLock failed (${consecutiveFailures}/${TransferSubscriberService.MAX_LOCK_EXTEND_FAILURES}): ${(error as Error).message}`);
                if (consecutiveFailures >= TransferSubscriberService.MAX_LOCK_EXTEND_FAILURES) {
                    this.logger.error('Lock lost after max extend failures — stopping processing to prevent double-processing');
                    this.isRunning = false;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 30000));
            }
        }
    }
    /**
     * Validate that a WebSocket notify payload has the expected shape.
     * Returns the result array or null if the payload is malformed.
     */
    private validateNotifyPayload(notify: any, eventName: string): any[] | null {
        if (!notify || typeof notify !== 'object') {
            this.logger.error(`${eventName}: invalid notify payload (not an object)`);
            return null;
        }
        if (!Array.isArray(notify.result)) {
            this.logger.error(`${eventName}: invalid notify payload (result is not an array)`);
            return null;
        }
        return notify.result;
    }

    syncNativeTransfers(): void {
        if (!this.clientSocket) {
            this.logger.error('Client socket not found');
            throw new Error('Client socket not found');
        }
        this.clientSocket.on('nativeTransfersNotify', async (notify) => {
            try {
                const result = this.validateNotifyPayload(notify, 'nativeTransfersNotify');
                if (!result) return;
                const solPrice = (await this.tokenService._tokenPrices([WSOL]))[0];
                if (!solPrice) {
                    throw new UnknownError('Cannot get SOL price');
                }
                this.transferSyncer.syncNativeTransfers(result, solPrice);
            } catch (error) {
                this.logger.error(`syncNativeTransfers failed: ${(error as Error).message}`);
            }
        });
    }
    syncTokenTransfers(): void {
        if (!this.clientSocket) {
            this.logger.error('Client socket not found');
            throw new Error('Client socket not found');
        }
        this.clientSocket.on('tokenTransfersNotify', async (notify) => {
            try {
                await this.trySyncTokenTransfers(notify);
            }
            catch (error) {
                this.logger.error(`syncTokenTransfers failed: ${(error as Error).message}`);
            }
        });
    }
    async trySyncTokenTransfers(notify: any): Promise<void> {
        const result = this.validateNotifyPayload(notify, 'tokenTransfersNotify');
        if (!result) return;
        const tokens = Array.from(new Set(result.map((transfer) => transfer.token_mint)));
        const tokenPrices = await this.tokenService._tokenPrices(tokens);
        const tokenPricesMap = new Map(tokenPrices.map((price) => [price.baseMint, price]));
        this.transferSyncer.syncTokenTransfers(result, tokenPricesMap);
    }
    syncAccountDexTrades(): void {
        if (!this.clientSocket) {
            this.logger.error('Client socket not found');
            throw new Error('Client socket not found');
        }
        this.clientSocket.on('accountDexTradesNotify', async (notify) => {
            try {
                await this.trySyncAccountDexTrades(notify);
            }
            catch (error) {
                this.logger.error(`syncAccountDexTrades failed: ${(error as Error).message}`);
            }
        });
    }
    async trySyncAccountDexTrades(notify: any): Promise<void> {
        // Use the same validation guard as sibling methods. Previously this path
        // destructured `{ result }` directly and called `.map` on it, which would
        // throw if upstream sent a malformed payload (e.g. partial frame / proxy error).
        let result = this.validateNotifyPayload(notify, 'accountDexTradesNotify');
        if (!result) return;
        // Also guard against missing fields on individual trade entries. The upstream
        // data-center protocol sometimes buffers partial frames; rejecting those one-by-one
        // is safer than letting a single bad trade crash the whole sync batch.
        result = result
            .filter((trade) => trade
                && typeof trade.base_mint === 'string'
                && typeof trade.quote_mint === 'string'
                && typeof trade.trader === 'string')
            .map((trade) => {
                while (trade.base_mint.endsWith('\x00')) {
                    trade.base_mint = trade.base_mint.slice(0, -1);
                }
                while (trade.quote_mint.endsWith('\x00')) {
                    trade.quote_mint = trade.quote_mint.slice(0, -1);
                }
                while (trade.trader.endsWith('\x00')) {
                    trade.trader = trade.trader.slice(0, -1);
                }
                return trade;
            });
        result = result.filter((trade) => !BANNED_TOKENS.includes(trade.base_mint));
        const tokens = Array.from(new Set(result.map((trade) => trade.base_mint)));
        const [tokenPrices, tokenInfos, solTokenPrice] = await Promise.all([
            this.tokenService._tokenPrices(tokens),
            this.tokenService.findByMintAddresses(tokens),
            this.tokenService._tokenPrices([WSOL]),
        ]);
        const solPrice = solTokenPrice[0];
        if (!solPrice) {
            throw new UnknownError('Cannot get SOL price');
        }
        const tokenPricesMap = new Map(tokenPrices.map((price) => [price.baseMint, price]));
        const tokenInfosMap = new Map(tokenInfos.map((info) => [info.mintAddress, info]));
        this.automaticStrategySyncer.syncAccountDexTrades(result, tokenPricesMap, tokenInfosMap, solPrice.latestPrice);
    }
}
