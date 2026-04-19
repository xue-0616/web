import { ConfigService } from '@nestjs/config';
import { ClientSubscription } from './interfaces/stream.interface';
import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'rpc-websockets';
import Decimal from 'decimal.js';

@Injectable()
export class StreamService {
    private configService: ConfigService;
    private logger: Logger;
    private subscriptions: Map<string, Set<ClientSubscription>>;
    private clientSocket: Client;
    private subscriptionId!: string;

    constructor(configService: ConfigService) {
        this.configService = configService;
        this.logger = new Logger(StreamService.name);
        this.subscriptions = new Map();
        const wsUrl = this.configService.getOrThrow('dataCenterWs');
        this.logger.log(`Connecting to ${wsUrl}`);
        this.clientSocket = new Client(wsUrl, {
            followRedirects: true,
            reconnect: true,
            max_reconnects: 0,
        });
        this.initializeSocketClient();
    }
    async initializeSocketClient() {
        this.logger.log('initializeSocketClient');
        this.clientSocket.on('open', async () => {
            this.logger.log('Data stream connection opened');
            await this.setupSubscriptions();
        });
        this.clientSocket.on('error', (error) => {
            this.logger.error(`WebSocket error: ${(error as Error).message}`);
        });
        this.clientSocket.on('close', () => {
            this.logger.warn('Data stream connection closed');
        });
        await this.clientSocket.connect();
    }
    getTradesByPool(dexTrades: any) {
        const tradesByPool = new Map();
        // Guard against a null/undefined/non-array payload so a single bad frame
        // from upstream doesn't take down the whole stream service.
        if (!Array.isArray(dexTrades)) return tradesByPool;
        dexTrades.forEach((dexTrade) => {
            if (!dexTrade || !dexTrade.pool_address) return;
            const poolAddress = dexTrade.pool_address;
            let p: string;
            try {
                const usdValue = new Decimal(dexTrade.usd_value ?? '0');
                const baseAmount = new Decimal(dexTrade.base_amount ?? '0');
                // Skip zero base_amount trades — price is undefined there and
                // would produce Infinity which breaks downstream formatting.
                if (baseAmount.isZero()) return;
                p = usdValue.dividedBy(baseAmount).abs().toFixed();
            } catch {
                // Malformed decimals (e.g. NaN string from partial frame) — skip.
                return;
            }
            const trade = { p, ...dexTrade };
            if (!tradesByPool.has(poolAddress)) {
                tradesByPool.set(poolAddress, [trade]);
            }
            else {
                tradesByPool.get(poolAddress).push(trade);
            }
        });
        return tradesByPool;
    }
    formatPoolsStatus(tradesByPool: any) {
        const poolsStatus = new Map();
        tradesByPool.forEach((dexTrades: any, poolAddress: any) => {
            dexTrades = dexTrades.filter((dexTrades: any) => Number(dexTrades.quote_amount) > 0.001);
            if (dexTrades.length) {
                const lastPoolTrade = dexTrades[dexTrades.length - 1];
                poolsStatus.set(poolAddress, {
                    b: lastPoolTrade.base_vault_balance,
                    q: lastPoolTrade.quote_vault_balance,
                    p: lastPoolTrade.p,
                });
            }
        });
        return poolsStatus;
    }
    formatPoolsTrades(tradesByPool: any) {
        const poolsTrades = new Map();
        tradesByPool.forEach((dexTrades: any, poolAddress: any) => {
            const trades = dexTrades.map((trade: any) => {
                return {
                    t: trade.block_time,
                    b: trade.base_amount,
                    q: trade.quote_amount,
                    v: trade.usd_value,
                    p: trade.p,
                    s: trade.signer,
                    tx: trade.tx_id,
                };
            });
            poolsTrades.set(poolAddress, trades);
        });
        return poolsTrades;
    }
    sendToClient(subscription: any, poolAddress: any, message: any) {
        subscription.client.send(message, (error: any) => {
            if (error) {
                this.logger.warn(`Failed to send message to client: ${(error as Error).message}`);
                this.unsubscribeFromPool(poolAddress, subscription);
            }
        });
    }
    formatKline(tradesByPool: any) {
        const klineMap = new Map();
        tradesByPool.forEach((trades: any, poolAddress: any) => {
            trades = trades.filter((trade: any) => Number(trade.quote_amount) > 0.001);
            if (trades.length) {
                const volume = trades.reduce((sum: any, trade: any) => sum + Number(trade.usd_value), 0);
                const lastTrade = trades[trades.length - 1];
                klineMap.set(poolAddress, {
                    t: lastTrade.block_time,
                    p: lastTrade.p,
                    v: volume.toString(),
                });
            }
        });
        return klineMap;
    }
    broadcastToSubscribers(dexTrades: any) {
        const tradesByPool = this.getTradesByPool(dexTrades);
        const poolsStatus = this.formatPoolsStatus(tradesByPool);
        const poolsTrades = this.formatPoolsTrades(tradesByPool);
        const kline = this.formatKline(tradesByPool);
        tradesByPool.forEach((_, poolAddress) => {
            const subscribers = this.subscriptions.get(poolAddress);
            if (!subscribers)
                return;
            Array.from(subscribers).forEach((subscription) => {
                if (subscription.types.has('kline') && kline.get(poolAddress)) {
                    this.sendToClient(subscription, poolAddress, JSON.stringify({ k: 'kline', data: kline.get(poolAddress) }));
                }
                if (subscription.types.has('trades')) {
                    this.sendToClient(subscription, poolAddress, JSON.stringify({
                        k: 'poolTrades',
                        data: poolsTrades.get(poolAddress),
                    }));
                }
                if (subscription.types.has('status') && poolsStatus.get(poolAddress)) {
                    this.sendToClient(subscription, poolAddress, JSON.stringify({
                        k: 'poolStatus',
                        data: poolsStatus.get(poolAddress),
                    }));
                }
            });
        });
    }
    async setupSubscriptions() {
        try {
            const result = await this.clientSocket.call('subscribeDexTrades', [[]]);
            if (result && typeof result === 'string') {
                this.subscriptionId = result;
                this.logger.log('Subscribed to dex trades');
            }
            this.clientSocket.on('dexTradesNotify', (notify) => {
                // Validate payload before dispatching — upstream proxies sometimes
                // deliver partial frames where `result` is missing or malformed.
                if (!notify || !Array.isArray(notify.result)) {
                    this.logger.warn('dexTradesNotify: dropping malformed payload');
                    return;
                }
                try {
                    this.broadcastToSubscribers(notify.result);
                } catch (err) {
                    this.logger.error(`broadcastToSubscribers failed: ${(err as Error)}`);
                }
            });
            await this.resubscribeToPools();
        }
        catch (error) {
            this.logger.error(`Error setting up subscriptions: ${(error as Error).message}`);
        }
    }
    async subscribeToPool(poolAddress: any): Promise<void> {
        try {
            await this.clientSocket.call('addPoolForDexTradesSubscription', [
                this.subscriptionId,
                [poolAddress],
            ]);
            this.logger.log(`Subscribed to pool ${poolAddress}`);
        }
        catch (error) {
            this.logger.error(`Error subscribing to pool ${poolAddress}: ${(error as Error).message}`);
        }
    }
    async resubscribeToPools(): Promise<void> {
        const poolAddresses = Array.from(this.subscriptions.keys());
        if (poolAddresses.length === 0) {
            return;
        }
        try {
            await this.clientSocket.call('addPoolForDexTradesSubscription', [
                this.subscriptionId,
                [...poolAddresses],
            ]);
            this.logger.log(`ReSubscribed to ${poolAddresses.length} pools`);
        }
        catch (error) {
            this.logger.error(`Error resubscribing to pools: ${(error as Error).message}`);
        }
    }
    async subscribe(poolAddress: any, subscription: any): Promise<void> {
        const subscribers = this.subscriptions.get(poolAddress);
        if (!subscribers) {
            this.subscriptions.set(poolAddress, new Set([subscription]));
        }
        else {
            subscribers.add(subscription);
        }
        await this.subscribeToPool(poolAddress);
    }
    async unsubscribe(clientSubscription: any): Promise<void> {
        this.unsubscribeFromPool(clientSubscription.poolAddress, clientSubscription);
    }
    unsubscribeFromPool(poolAddress: any, client: any): void {
        const subscribers = this.subscriptions.get(poolAddress);
        if (subscribers) {
            subscribers.delete(client);
            if (subscribers.size === 0) {
                this.subscriptions.delete(poolAddress);
                this.stopPoolSubscription(poolAddress);
            }
        }
    }
    async stopPoolSubscription(poolAddress: any) {
        try {
            await this.clientSocket.call('removePoolForDexTradesSubscription', [
                this.subscriptionId,
                [poolAddress],
            ]);
        }
        catch (error) {
            this.logger.error(`Error unsubscribing from pool ${poolAddress}: ${(error as Error).message}`);
        }
    }
}
