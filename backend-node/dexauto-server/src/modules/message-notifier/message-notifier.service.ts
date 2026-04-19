import { Redis } from 'ioredis';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { Notify, NotifyData, NotifyDataType, toNotifyType } from './entities/notify.entity';
import { DataSource, MoreThan, Repository, QueryRunner } from 'typeorm';
import { NotifiesDto, toNotifyDto } from './dto/response.dto';
import { User } from '../user/entities/user.entity';
import { getByTag } from 'locale-codes';
import Decimal from 'decimal.js';
import { Wallet } from '../wallet/entities/wallet.entity';
import { TradingOrder } from '../trading/entities/tradingOrder.entity';
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { v7 } from 'uuid';
import { web3 } from '@coral-xyz/anchor';
import { DEFAULT_LANGUAGE } from '../user/dto/response.dto';

/** Token expiry in seconds (60 days). Redis EXPIRE expects seconds, not milliseconds. */
const EXPIRE_TIME = 60 * 60 * 24 * 60;
const USD_PRECISION = 8;
/** Maximum Firebase registration tokens stored per user to prevent Redis bloat. */
const MAX_FIREBASE_TOKENS_PER_USER = 20;
/** Firebase tokens are typically 100-200 chars long (FCM registration tokens). */
const MIN_FIREBASE_TOKEN_LENGTH = 100;
const MAX_FIREBASE_TOKEN_LENGTH = 300;
export interface NotifyInfo {
    language: any;
    tokens: string[];
}

@Injectable()
export class MessageNotifierService {
    redisClient: Redis;
    logger: PinoLogger;
    configService: ConfigService;
    notifyRepository: Repository<Notify>;
    userRepository: Repository<User>;
    app: any;
    constructor(
        redisClient: Redis,
        @InjectPinoLogger(MessageNotifierService.name) logger: PinoLogger,
        configService: ConfigService,
        @InjectRepository(Notify) notifyRepository: Repository<Notify>,
        @InjectRepository(User) userRepository: Repository<User>,
    ) {
        this.redisClient = redisClient;
        this.logger = logger;
        this.configService = configService;
        this.notifyRepository = notifyRepository;
        this.userRepository = userRepository;
        // Fail at startup if Firebase credentials are not configured, rather
        // than silently sending zero push notifications. Also guard against
        // duplicate initializeApp calls during hot-reload / multi-worker.
        const existingApps = getApps();
        if (existingApps.length > 0) {
            this.app = existingApps[0];
        } else {
            this.app = initializeApp({
                credential: cert({
                    projectId: this.configService.getOrThrow('firebaseProjectId'),
                    privateKey: this.configService.getOrThrow('firebasePrivateKey'),
                    clientEmail: this.configService.getOrThrow('firebaseClientEmail'),
                }),
            });
        }
    }
    onModuleInit(): void {
        this.redisClient.on('error', (err) => {
            this.logger.error(`Redis error: ${(err as Error).message}`);
        });
    }
    cacheKey(userId: any): string {
        return `${(process.env.NODE_ENV || 'dev').toUpperCase() || 'DEV'}:DEXAUTO:USER:FIREBASE_TOKEN:${userId}`;
    }
    async addFirebaseToken(userId: any, token: any): Promise<void> {
        // Validate token format: must be a string of reasonable length
        if (typeof token !== 'string' || token.length < MIN_FIREBASE_TOKEN_LENGTH || token.length > MAX_FIREBASE_TOKEN_LENGTH) {
            this.logger.warn(`Invalid Firebase token format for user ${userId}: length=${typeof token === 'string' ? token.length : 'N/A'}`);
            return;
        }
        const cacheKey = this.cacheKey(userId);
        // Enforce per-user token limit: evict oldest tokens if limit exceeded
        const currentCount = await this.redisClient.zcard(cacheKey);
        if (currentCount >= MAX_FIREBASE_TOKENS_PER_USER) {
            // Remove oldest tokens to stay within the limit
            const excess = currentCount - MAX_FIREBASE_TOKENS_PER_USER + 1;
            await this.redisClient.zremrangebyrank(cacheKey, 0, excess - 1);
        }
        await this.redisClient.zadd(cacheKey, Date.now(), token);
        await this.redisClient.expire(cacheKey, EXPIRE_TIME);
        // Clean up expired tokens (use EXPIRE_TIME in ms for score comparison since scores are Date.now())
        this.redisClient.zremrangebyscore(cacheKey, 0, Date.now() - EXPIRE_TIME * 1000);
    }
    async getFirebaseToken(userId: any): Promise<string[]> {
        return await this.redisClient.zrange(this.cacheKey(userId), 0, -1);
    }
    async removeFirebaseToken(userId: any, token: any): Promise<void> {
        await this.redisClient.zrem(this.cacheKey(userId), token);
    }
    async getUserNotifyInfo(userId: any): Promise<NotifyInfo | null> {
        const [user, tokens] = await Promise.all([
            this.userRepository.findOneBy({ id: userId }),
            this.getFirebaseToken(userId),
        ]);
        if (user === null) {
            this.logger.error(`Invalid user id: ${userId}`);
            return null;
        }
        const languageCode = user.language ?? DEFAULT_LANGUAGE;
        const language = getByTag(languageCode);
        if (!language) {
            this.logger.error(`Invalid language code: ${languageCode}`);
            return null;
        }
        return {
            language,
            tokens,
        };
    }
    async sendMessage(userId: any, data: any, tokens: any): Promise<void> {
        await this.saveMessage(userId, data);
        await this.sendMessageByTokens(userId, tokens, data);
    }
    async saveMessage(userId: any, data: any, queryRunner?: any): Promise<Notify> {
        const notify = this.notifyRepository.create({
            id: v7(),
            userId,
            notifyType: toNotifyType(data.type),
            data,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        if (queryRunner) {
            await queryRunner.manager.save(notify);
        }
        else {
            await this.notifyRepository.save(notify);
        }
        return notify;
    }
    async sendMessageByTokens(userId: any, tokens: any, data: any): Promise<void> {
        if (tokens.length > 0) {
            try {
                const validData = Object.fromEntries(Object.entries(data).map(([key, value]) => [
                    key,
                    typeof value === 'object' ? JSON.stringify(value) : String(value),
                ]));
                const notify = {
                    data: validData,
                    tokens,
                };
                const messaging = getMessaging(this.app);
                const response = await messaging.sendEachForMulticast(notify);
                response.responses.forEach((res, index) => {
                    if (res.error) {
                        this.logger.error(`Error sending message to ${userId}: code=${res.error?.code} message=${res.error?.message}`);
                        if (res.error.code === 'messaging/registration-token-not-registered') {
                            this.removeFirebaseToken(userId, tokens[index]);
                        }
                    }
                });
            } catch (error) {
                // CRITICAL: Firebase SDK errors must NEVER propagate to callers.
                // These notify methods are called from trading flows — an
                // unhandled rejection here would crash the trading pipeline and
                // leave orders in inconsistent states.
                this.logger.error(`sendMessageByTokens failed for userId=${userId}: ${error}`);
            }
        }
    }
    getNativeWithdrawNotification(language: any, solNormalizedAmount: any, walletAddress: any): { title: string; body: string } {
        const walletAddressEnd = walletAddress.slice(-4);
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `成功提现 ${solNormalizedAmount} SOL`,
                    body: `您成功提现 ${solNormalizedAmount} SOL 至尾号 ${walletAddressEnd} 地址`,
                };
            default:
                return {
                    title: `Withdrawal ${solNormalizedAmount} SOL successful`,
                    body: `You have successfully withdrawn ${solNormalizedAmount} SOL to the address ending in ${walletAddressEnd}`,
                };
        }
    }
    getNativeDepositNotification(language: any, solNormalizedAmount: any, walletAddress: any): { title: string; body: string } {
        const walletAddressEnd = walletAddress.slice(-4);
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `成功存入 ${solNormalizedAmount} SOL`,
                    body: `您成功存入 ${solNormalizedAmount} SOL 至尾号 ${walletAddressEnd} 地址`,
                };
            default:
                return {
                    title: `Deposit ${solNormalizedAmount} SOL successful`,
                    body: `You have successfully deposited ${solNormalizedAmount} SOL from the address ending in ${walletAddressEnd}`,
                };
        }
    }
    getTokenWithdrawNotification(language: any, tokenSymbol: any, tokenNormalizedAmount: any, walletAddress: any): { title: string; body: string } {
        const walletAddressEnd = walletAddress.slice(-4);
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `成功提现 ${tokenNormalizedAmount} ${tokenSymbol}`,
                    body: `您成功提现 ${tokenNormalizedAmount} ${tokenSymbol} 至尾号 ${walletAddressEnd} 地址`,
                };
            default:
                return {
                    title: `Withdrawal ${tokenNormalizedAmount} ${tokenSymbol} successful`,
                    body: `You have successfully withdrawn ${tokenNormalizedAmount} ${tokenSymbol} to the address ending in ${walletAddressEnd}`,
                };
        }
    }
    getTokenDepositNotification(language: any, tokenSymbol: any, tokenNormalizedAmount: any, walletAddress: any): { title: string; body: string } {
        const walletAddressEnd = walletAddress.slice(-4);
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `充值成功 ${tokenNormalizedAmount} ${tokenSymbol}`,
                    body: `您成功充值 ${tokenNormalizedAmount} ${tokenSymbol} 至尾号 ${walletAddressEnd} 地址`,
                };
            default:
                return {
                    title: `Deposit ${tokenNormalizedAmount} ${tokenSymbol} successful`,
                    body: `You have successfully deposited ${tokenNormalizedAmount} ${tokenSymbol} from the address ending in ${walletAddressEnd}`,
                };
        }
    }
    getLimitOrderFailedNotification(language: any, errorReason: any): { title: string; body: string } {
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `限价交易失败`,
                    body: `您的限价订单失败`,
                };
            default:
                return {
                    title: `Limit order failed`,
                    body: `Your limit order has failed`,
                };
        }
    }
    getLimitBuySuccessNotification(language: any, solNormalizedAmount: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 买入执行成功`,
                    body: `您已成功花费 ${solNormalizedAmount} SOL 买入 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Limit order successful`,
                    body: `You have successfully spent ${solNormalizedAmount} SOL to buy ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getLimitSellSuccessNotification(language: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 卖出执行成功`,
                    body: `您已成功卖出 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Limit order successful`,
                    body: `You have successfully sold ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getSwapBuySuccessNotification(language: any, solNormalizedAmount: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 买入执行成功`,
                    body: `您已成功花费 ${solNormalizedAmount} SOL 买入 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Swap buy successful`,
                    body: `You have successfully spent ${solNormalizedAmount} SOL to buy ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getSwapSellSuccessNotification(language: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 卖出执行成功`,
                    body: `您已成功卖出 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Swap sell successful`,
                    body: `You have successfully sold ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getSwapSellForAutoTradeBaseInSuccessNotification(language: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 卖出执行成功`,
                    body: `您已成功卖出 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Swap sell successful`,
                    body: `You have successfully sold ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getSwapSellForAutoTradeBaseOutSuccessNotification(language: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 卖出执行成功`,
                    body: `您已成功卖出 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Swap sell successful`,
                    body: `You have successfully sold ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getSwapSellForAutoTradeBaseInFailedNotification(language: any, errorReason: any): { title: string; body: string } {
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `交易失败`,
                    body: `您的Swap订单失败`,
                };
            default:
                return {
                    title: `Swap failed`,
                    body: `Your swap has failed`,
                };
        }
    }
    getSwapSellForAutoTradeBaseOutFailedNotification(language: any, errorReason: any): { title: string; body: string } {
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `交易失败`,
                    body: `您的Swap订单失败`,
                };
            default:
                return {
                    title: `Swap failed`,
                    body: `Your swap has failed`,
                };
        }
    }
    getSwapFailedNotification(language: any, errorReason: any): { title: string; body: string } {
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `交易失败`,
                    body: `您的Swap订单失败`,
                };
            default:
                return {
                    title: `Swap failed`,
                    body: `Your swap has failed`,
                };
        }
    }
    getAutoStrategyNotification(language: any, strategyName: any, triggerIndex: any, tokenSymbol: any, tokenUsdPrice: any, tokenMarketCap: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice.toFixed();
        const tokenMarketCapStr = formatDecimalWithUnit(tokenMarketCap);
        switch (language['iso639-1']) {
            case 'zh': {
                return {
                    title: `【${strategyName}】策略报警`,
                    body: `【$${tokenSymbol}】 满足触发器${triggerIndex}
【价格】$${tokenUsdPriceStr}
【市值】$${tokenMarketCapStr}`,
                };
            }
            default: {
                return {
                    title: `【${strategyName}】Strategy alert`,
                    body: `【$${tokenSymbol}】meets Trigger ${triggerIndex}
【Price】$${tokenUsdPriceStr}
【Market Cap】$${tokenMarketCapStr}`,
                };
            }
        }
    }
    getAutoTradeBuyFailedNotification(language: any, errorReason: any): { title: string; body: string } {
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `自动交易失败`,
                    body: `您的自动交易失败`,
                };
            default:
                return {
                    title: `Auto trade failed`,
                    body: `Your auto trade has failed`,
                };
        }
    }
    getAutoTradeBuySuccessNotification(language: any, solNormalizedAmount: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 买入执行成功`,
                    body: `您已成功花费 ${solNormalizedAmount} SOL 买入 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Auto trade successful`,
                    body: `You have successfully spent ${solNormalizedAmount} SOL to buy ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getAutoTradeSellSuccessNotification(language: any, tokenSymbol: any, tokenNormalizedAmount: any, tokenUsdPrice: any): { title: string; body: string } {
        const tokenUsdPriceStr = tokenUsdPrice
            .toDecimalPlaces(USD_PRECISION)
            .toFixed();
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `${tokenSymbol} 卖出执行成功`,
                    body: `您已成功卖出 ${tokenNormalizedAmount} ${tokenSymbol}，成交均价 $${tokenUsdPriceStr}`,
                };
            default:
                return {
                    title: `Limit order successful`,
                    body: `You have successfully sold ${tokenNormalizedAmount} ${tokenSymbol} at $${tokenUsdPriceStr}`,
                };
        }
    }
    getAutoTradeSellFailedNotification(language: any, errorReason: any): { title: string; body: string } {
        switch (language['iso639-1']) {
            case 'zh':
                return {
                    title: `限价交易失败`,
                    body: `您的限价订单失败`,
                };
            default:
                return {
                    title: `Limit order failed`,
                    body: `Your limit order has failed`,
                };
        }
    }
    async notifyNativeWithdraw(wallet: any, solNormalizedAmount: any): Promise<void> {
        const notifyType = NotifyDataType.NativeWithdraw;
        const notifyInfo = await this.getUserNotifyInfo(wallet.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(wallet.address).toBase58();
        const { title, body } = this.getNativeWithdrawNotification(language, solNormalizedAmount, walletAddress);
        const data = {
            type: notifyType,
            title,
            body,
            walletId: wallet.id,
            walletAddress,
        };
        await this.sendMessage(wallet.userId, data, tokens);
    }
    async notifyNativeDeposit(wallet: any, solNormalizedAmount: any): Promise<void> {
        const notifyType = NotifyDataType.NativeDeposit;
        const notifyInfo = await this.getUserNotifyInfo(wallet.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(wallet.address).toBase58();
        const { title, body } = this.getNativeDepositNotification(language, solNormalizedAmount, walletAddress);
        const data = {
            type: notifyType,
            title,
            body,
            walletId: wallet.id,
            walletAddress,
        };
        await this.sendMessage(wallet.userId, data, tokens);
    }
    async notifyTokenWithdraw(wallet: any, tokenSymbol: any, tokenNormalizedAmount: any): Promise<void> {
        const notifyType = NotifyDataType.TokenWithdraw;
        const notifyInfo = await this.getUserNotifyInfo(wallet.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(wallet.address).toBase58();
        const { title, body } = this.getTokenWithdrawNotification(language, tokenSymbol, tokenNormalizedAmount, walletAddress);
        const data = {
            type: notifyType,
            title,
            body,
            walletId: wallet.id,
            walletAddress,
        };
        await this.sendMessage(wallet.userId, data, tokens);
    }
    async notifyTokenDeposit(wallet: any, tokenSymbol: any, tokenNormalizedAmount: any): Promise<void> {
        const notifyType = NotifyDataType.TokenDeposit;
        const notifyInfo = await this.getUserNotifyInfo(wallet.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(wallet.address).toBase58();
        const { title, body } = this.getTokenDepositNotification(language, tokenSymbol, tokenNormalizedAmount, walletAddress);
        const data = {
            type: notifyType,
            title,
            body,
            walletId: wallet.id,
            walletAddress,
        };
        await this.sendMessage(wallet.userId, data, tokens);
    }
    async notifyLimitBuySuccess(order: any): Promise<void> {
        const notifyType = NotifyDataType.LimitBuySuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getLimitBuySuccessNotification(language, new Decimal(order.solNormalizedAmount || '0'), order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifyLimitSellSuccess(order: any): Promise<void> {
        const notifyType = NotifyDataType.LimitSellSuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getLimitSellSuccessNotification(language, order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifyLimitOrderFailed(order: any): Promise<void> {
        const notifyType = NotifyDataType.LimitOrderFailed;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getLimitOrderFailedNotification(language, order.errorReason || '');
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifySwapBuySuccess(order: any): Promise<void> {
        const notifyType = NotifyDataType.SwapBuySuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getSwapBuySuccessNotification(language, new Decimal(order.solNormalizedAmount || '0'), order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifySwapSellSuccess(order: any): Promise<void> {
        const notifyType = NotifyDataType.SwapSellSuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getSwapSellSuccessNotification(language, order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifySwapFailed(order: any): Promise<void> {
        const notifyType = NotifyDataType.SwapFailed;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getSwapFailedNotification(language, order.errorReason || '');
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifySwapSellForAutoTradeBaseInSuccess(order: any): Promise<void> {
        const notifyType = NotifyDataType.SwapSellForAutoTradeBaseInSuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getSwapSellForAutoTradeBaseInSuccessNotification(language, order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            eventId: order.remoteId || '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifySwapSellForAutoTradeBaseOutSuccess(order: any): Promise<void> {
        const notifyType = NotifyDataType.SwapSellForAutoTradeBaseOutSuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getSwapSellForAutoTradeBaseOutSuccessNotification(language, order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            eventId: order.remoteId || '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifySwapSellForAutoTradeBaseInFailed(order: any): Promise<void> {
        const notifyType = NotifyDataType.SwapSellForAutoTradeBaseInFailed;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getSwapSellForAutoTradeBaseInFailedNotification(language, order.errorReason || '');
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            eventId: order.remoteId || '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifySwapSellForAutoTradeBaseOutFailed(order: any): Promise<void> {
        const notifyType = NotifyDataType.SwapSellForAutoTradeBaseOutFailed;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const { title, body } = this.getSwapSellForAutoTradeBaseOutFailedNotification(language, order.errorReason || '');
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            eventId: order.remoteId || '',
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifyAutoTradeBuySuccess(order: any, autoStrategyId: any): Promise<void> {
        const notifyType = NotifyDataType.AutoTradeBuySuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const { title, body } = this.getAutoTradeBuySuccessNotification(language, new Decimal(order.solNormalizedAmount || '0'), order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const data = {
            type: notifyType,
            title,
            body,
            strategyId: autoStrategyId,
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifyAutoTradeBuyFailed(order: any, autoStrategyId: any): Promise<void> {
        const notifyType = NotifyDataType.AutoTradeBuyFailed;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        // Removed dead `walletAddress` variable that was never used in `data`
        // but could crash on null `order.walletAddress`.
        const { title, body } = this.getAutoTradeBuyFailedNotification(language, order.errorReason || '');
        const data = {
            type: notifyType,
            title,
            body,
            strategyId: autoStrategyId,
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifyAutoTradeSellSuccess(order: any, autoStrategyId: any): Promise<void> {
        const notifyType = NotifyDataType.AutoTradeSellSuccess;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const { title, body } = this.getAutoTradeSellSuccessNotification(language, order.tokenSymbol, new Decimal(order.tokenNormalizedAmount || '0'), new Decimal(order.tokenUsdPrice || '0'));
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            strategyId: autoStrategyId,
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async notifyAutoTradeSellFailed(order: any, autoStrategyId: any): Promise<void> {
        const notifyType = NotifyDataType.AutoTradeSellFailed;
        const notifyInfo = await this.getUserNotifyInfo(order.userId);
        if (notifyInfo === null) {
            return;
        }
        const { language, tokens } = notifyInfo;
        const { title, body } = this.getAutoTradeSellFailedNotification(language, order.errorReason || '');
        const walletAddress = new web3.PublicKey(order.walletAddress).toBase58();
        const data = {
            type: notifyType,
            title,
            body,
            walletId: order.walletId || '',
            walletAddress,
            tokenMint: order.tokenMint
                ? new web3.PublicKey(order.tokenMint).toBase58()
                : '',
            poolId: order.pool ? new web3.PublicKey(order.pool).toBase58() : '',
            strategyId: autoStrategyId,
        };
        await this.sendMessage(order.userId, data, tokens);
    }
    async getNotifies(userId: any, startId: any, limit: any): Promise<NotifiesDto> {
        // Clamp limit to [1, 100] to prevent DB DoS via large scans.
        const maxLimit = 100;
        const effectiveLimit = Math.max(1, Math.min(Number(limit) || 10, maxLimit));
        const notifies = await this.notifyRepository.find({
            where: { userId, id: startId ? MoreThan(startId) : undefined },
            order: { id: 'DESC' },
            take: effectiveLimit,
        });
        return {
            notifies: notifies.map((notify) => toNotifyDto(notify)),
        };
    }
}
function formatDecimalWithUnit(value: any) {
    const absValue = value.abs();
    if (absValue.gte(1_000_000_000_000)) {
        return `${value.dividedBy(1_000_000_000_000).toFixed(2)}t`;
    }
    else if (absValue.gte(1_000_000_000)) {
        return `${value.dividedBy(1_000_000_000).toFixed(2)}b`;
    }
    else if (absValue.gte(1_000_000)) {
        return `${value.dividedBy(1_000_000).toFixed(2)}m`;
    }
    else if (absValue.gte(1_000)) {
        return `${value.dividedBy(1_000).toFixed(2)}k`;
    }
    else {
        return value.toFixed();
    }
}
