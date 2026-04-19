import { Inject, Injectable, OnModuleInit, forwardRef } from '@nestjs/common';
import { DataSource, In, LessThan, MoreThan, QueryRunner, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger } from 'nestjs-pino';
import { TradingSetting } from './entities/tradingSetting.entity';
import { TradingSettingDto, TradingSettingsDto, getTradingSettingDto } from './dto/setting.response.dto';
import Decimal from 'decimal.js';
import { TradingStrategy } from './entities/tradingStrategy.entity';
import { TradingStrategyItem, TradingStrategyItemType } from './entities/tradingStrategyItem.entity';
import { TradingStrategiesDto, TradingStrategyDto, getItemType, getTradingStrategyDto } from './dto/strategy.response.dto';
import { UpdateStrategyDto } from './dto/updateStrategy.dto';
import { DeleteStrategyDto } from './dto/deleteStrategy.dto';
import { CreateStrategyDto } from './dto/createStrategy.dto';
import { web3 } from '@coral-xyz/anchor';
import { TradingOrder, TradingOrderStatus, TradingOrderType } from './entities/tradingOrder.entity';
import { OrderTypeDto, TradingOrderDto, TradingOrdersDto, TradingOrderStatusDto, getOrderDto, getTradingOrderStatus, getTradingOrderType } from './dto/order.response.dto';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { PositionMonitorService } from '../position-monitor/position-monitor.service';
import { WalletService } from '../wallet/wallet.service';
import { ClickHouseService } from '../../infrastructure/clickhouse/clickhouse.service';
import { TokenService } from '../token/token.service';
import { TokenInfo } from '../token/entities/token-info.entity';
import { TradingOrderByDto } from './dto/order.dto';
import { MessageNotifierService } from '../message-notifier/message-notifier.service';
import { WalletOrderStatistic } from '../wallet/entities/walletOrderStatistic.entity';
import { AutomaticStrategyEvent, AutomaticTradeStatus } from '../automatic-strategy/entities/AutomaticStrategyEvent.entity';
import { AutomaticStrategy } from '../automatic-strategy/entities/AutomaticStrategy.entity';
import { Chain, SUPPORTED_CHAINS, SUPPORTED_EVM_CHAIN_IDS } from '../../common/genericChain';
import { getChainIdDao } from '../../common/dto/chain';
import { v7 } from 'uuid';
import { ethers } from 'ethers';
import { BadRequestException, UnknownError } from '../../error';
import { PendingOrder } from '../../common/pendingOrder';
import { SwapTransactionStatus, TradingClient } from '../../common/tradingClient';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { WSOL, assertNever, isNullOrUndefined } from '../../common/utils';

export const DEFAULT_SLIPPAGE = '0.3';
export const DEFAULT_IS_MEV_ENABLED = true;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const DEFAULT_ETHEREUM_PRIORITY_FEE_PER_GAS = ethers.parseUnits('10', 'gwei');
export const DEFAULT_ETHEREUM_BRIBERY_AMOUNT = ethers.parseEther('0.001');
export const DEFAULT_SOLANS_PRIORITY_FEE = 0.005 * web3.LAMPORTS_PER_SOL;
export const DEFAULT_SOLANS_BRIBERY_AMOUNT = 0.01 * web3.LAMPORTS_PER_SOL;
export const DEFAULT_STRATEGY_1_NAME = 's1';
export const DEFAULT_STRATEGY_1_TRIGGER = '1';
export const DEFAULT_STRATEGY_1_SELL_RATE = '0.5';
export const DEFAULT_STRATEGY_2_NAME = 's2';
export const DEFAULT_STRATEGY_2_TRIGGER = '10';
export const DEFAULT_STRATEGY_2_SELL_RATE = '1';
@Injectable()
export class TradingService implements OnModuleInit {
    private tradingSettingRepository: Repository<TradingSetting>;
    private tradingStrategyRepository: Repository<TradingStrategy>;
    private tradingStrategyItemRepository: Repository<TradingStrategyItem>;
    private tradingOrderRepository: Repository<TradingOrder>;
    private walletOrderStatisticRepository: Repository<WalletOrderStatistic>;
    private walletService: WalletService;
    private dataSource: DataSource;
    private clickHouseService: ClickHouseService;
    private tokenService: TokenService;
    private logger: PinoLogger;
    private messageNotifierService: MessageNotifierService;
    private automaticStrategyRepository: Repository<AutomaticStrategy>;
    private automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>;
    private tradingClient: TradingClient;
    private positionMonitorService?: PositionMonitorService;
    constructor(
        @InjectRepository(TradingSetting) tradingSettingRepository: Repository<TradingSetting>,
        @InjectRepository(TradingStrategy) tradingStrategyRepository: Repository<TradingStrategy>,
        @InjectRepository(TradingStrategyItem) tradingStrategyItemRepository: Repository<TradingStrategyItem>,
        @InjectRepository(TradingOrder) tradingOrderRepository: Repository<TradingOrder>,
        @InjectRepository(WalletOrderStatistic) walletOrderStatisticRepository: Repository<WalletOrderStatistic>,
        @Inject(forwardRef(() => WalletService)) walletService: WalletService,
        dataSource: DataSource,
        clickHouseService: ClickHouseService,
        @Inject(forwardRef(() => TokenService)) tokenService: TokenService,
        configService: ConfigService,
        @InjectPinoLogger(TradingService.name) logger: PinoLogger,
        @Inject(forwardRef(() => MessageNotifierService)) messageNotifierService: MessageNotifierService,
        @InjectRepository(AutomaticStrategy) automaticStrategyRepository: Repository<AutomaticStrategy>,
        @InjectRepository(AutomaticStrategyEvent) automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>,
        positionMonitorService?: PositionMonitorService,
    ) {
        this.tradingSettingRepository = tradingSettingRepository;
        this.tradingStrategyRepository = tradingStrategyRepository;
        this.tradingStrategyItemRepository = tradingStrategyItemRepository;
        this.tradingOrderRepository = tradingOrderRepository;
        this.walletOrderStatisticRepository = walletOrderStatisticRepository;
        this.walletService = walletService;
        this.dataSource = dataSource;
        this.clickHouseService = clickHouseService;
        this.tokenService = tokenService;
        this.logger = logger;
        this.messageNotifierService = messageNotifierService;
        this.automaticStrategyRepository = automaticStrategyRepository;
        this.automaticStrategyEventRepository = automaticStrategyEventRepository;
        this.tradingClient = new TradingClient(configService.getOrThrow('tradingServerUrl'));
        this.positionMonitorService = positionMonitorService;
    }
    private resumedOrderIds = new Set<string>();
    async onModuleInit(): Promise<void> {
        const pendingOrders = await this.tradingOrderRepository.findBy({
            status: In([
                TradingOrderStatus.Created,
                TradingOrderStatus.ChainTxPending,
            ]),
        });
        pendingOrders.forEach((pendingOrder) => {
            if (this.resumedOrderIds.has(pendingOrder.id)) {
                this.logger.warn(`Skipping duplicate pending order resume: ${pendingOrder.id}`);
                return;
            }
            this.resumedOrderIds.add(pendingOrder.id);
            const order = new PendingOrder(pendingOrder, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifierService, this.tradingSettingRepository);
            order.wait().catch((error) => {
                this.logger.error(`PendingOrder.wait() failed for order ${pendingOrder.id}: ${error}`);
            });
        });
    }
    async getTradingSettingDaoById(id: any, userId: any): Promise<TradingSetting | null> {
        let setting;
        try {
            setting = await this.tradingSettingRepository.findOneBy({
                id,
                userId,
            });
        }
        catch (error) {
            this.logger.error(`get trading setting failed: ${error}`);
            throw new UnknownError(error);
        }
        return setting;
    }
    async tradingSettings(userId: any): Promise<TradingSettingsDto> {
        let settingsDaos;
        try {
            settingsDaos = await this.tradingSettingRepository.find({
                where: { userId },
                order: {
                    chain: 'ASC',
                    chainId: 'ASC',
                },
            });
        }
        catch (error) {
            this.logger.error(`get trading settings failed: ${error}`);
            throw new UnknownError(error);
        }
        const settings = settingsDaos.map(getTradingSettingDto);
        return {
            settings,
        };
    }
    async createDefault(userId: any, queryRunner: any): Promise<any> {
        const settings = await this.createDefaultTradingSettings(userId, queryRunner);
        const { strategies } = await this.createDefaultTradingStrategies(userId, queryRunner);
        return { settings, strategies };
    }
    async createDefaultTradingSettings(userId: any, queryRunner: any) {
        const now = new Date();
        const settings = [];
        for (const chain of SUPPORTED_CHAINS) {
            let chainIdDao = null;
            if (chain === Chain.Evm) {
                for (const chainId of SUPPORTED_EVM_CHAIN_IDS) {
                    chainIdDao = getChainIdDao(chainId);
                    let setting = this.tradingSettingRepository.create({
                        id: v7(),
                        userId,
                        chain,
                        chainId: chainIdDao,
                        isMevEnabled: DEFAULT_IS_MEV_ENABLED,
                        slippage: DEFAULT_SLIPPAGE,
                        priorityFee: DEFAULT_ETHEREUM_PRIORITY_FEE_PER_GAS.toString(),
                        briberyAmount: DEFAULT_ETHEREUM_BRIBERY_AMOUNT.toString(),
                        createdAt: now,
                        updatedAt: now,
                    });
                    if (queryRunner) {
                        setting = await queryRunner.manager.save(setting);
                    }
                    else {
                        try {
                            setting = await this.tradingSettingRepository.save(setting);
                        }
                        catch (error) {
                            this.logger.error(`create default trading setting failed: ${error}`);
                            throw new UnknownError(error);
                        }
                    }
                    settings.push(setting);
                }
            }
            else {
                let setting = this.tradingSettingRepository.create({
                    id: v7(),
                    userId,
                    chain,
                    chainId: chainIdDao,
                    isMevEnabled: DEFAULT_IS_MEV_ENABLED,
                    slippage: DEFAULT_SLIPPAGE,
                    priorityFee: DEFAULT_SOLANS_PRIORITY_FEE.toString(),
                    briberyAmount: DEFAULT_SOLANS_BRIBERY_AMOUNT.toString(),
                    createdAt: now,
                    updatedAt: now,
                });
                if (queryRunner) {
                    setting = await queryRunner.manager.save(setting);
                }
                else {
                    try {
                        setting = await this.tradingSettingRepository.save(setting);
                    }
                    catch (error) {
                        this.logger.error(`create default trading setting failed: ${error}`);
                        throw new UnknownError(error);
                    }
                }
                settings.push(setting);
            }
        }
        return settings.map(getTradingSettingDto);
    }
    async updateSetting(userId: any, id: any, isMevEnabled: any, slippage: any, priorityFee: any, briberyAmount: any): Promise<TradingSettingDto> {
        if (isMevEnabled === null &&
            slippage === null &&
            priorityFee === null &&
            briberyAmount === null) {
            throw new BadRequestException('expected update info');
        }
        let setting = await this.getTradingSettingDaoById(id, userId);
        if (setting === null) {
            throw new BadRequestException('invalid setting id');
        }
        if (isMevEnabled !== null) {
            setting.isMevEnabled = isMevEnabled;
        }
        if (slippage !== null) {
            setting.slippage = slippage.toFixed();
        }
        // Cap priorityFee at 1 SOL (1e9 lamports) to prevent accidental fund drain
        const MAX_PRIORITY_FEE = BigInt(1_000_000_000);
        if (priorityFee !== null) {
            if (priorityFee < 0n) {
                throw new BadRequestException('priority fee cannot be negative');
            }
            if (priorityFee > MAX_PRIORITY_FEE) {
                throw new BadRequestException('priority fee exceeds maximum allowed (1 SOL)');
            }
            setting.priorityFee = priorityFee.toString();
        }
        // Cap briberyAmount at 1 SOL (1e9 lamports)
        const MAX_BRIBERY_AMOUNT = BigInt(1_000_000_000);
        if (briberyAmount !== null) {
            if (briberyAmount < 0n) {
                throw new BadRequestException('bribery amount cannot be negative');
            }
            if (briberyAmount > MAX_BRIBERY_AMOUNT) {
                throw new BadRequestException('bribery amount exceeds maximum allowed (1 SOL)');
            }
            setting.briberyAmount = briberyAmount.toString();
        }
        setting.updatedAt = new Date();
        setting = await this.tradingSettingRepository.save(setting);
        return getTradingSettingDto(setting);
    }
    async createDefaultTradingStrategies(userId: any, queryRunner: any): Promise<TradingStrategiesDto> {
        const now = new Date();
        let defaultStrategy1 = this.tradingStrategyRepository.create({
            id: v7(),
            userId,
            name: DEFAULT_STRATEGY_1_NAME,
            isAlive: true,
            createdAt: now,
            updatedAt: now,
        });
        let defaultStrategy1Item = this.tradingStrategyItemRepository.create({
            id: v7(),
            strategyId: defaultStrategy1.id,
            itemType: TradingStrategyItemType.TakeProfit,
            trigger: DEFAULT_STRATEGY_1_TRIGGER,
            sellRate: DEFAULT_STRATEGY_1_SELL_RATE,
            isAlive: true,
            createdAt: now,
            updatedAt: now,
        });
        let defaultStrategy2 = this.tradingStrategyRepository.create({
            id: v7(),
            userId,
            name: DEFAULT_STRATEGY_2_NAME,
            isAlive: true,
            createdAt: now,
            updatedAt: now,
        });
        let defaultStrategy2Item = this.tradingStrategyItemRepository.create({
            id: v7(),
            strategyId: defaultStrategy2.id,
            itemType: TradingStrategyItemType.TakeProfit,
            trigger: DEFAULT_STRATEGY_2_TRIGGER,
            sellRate: DEFAULT_STRATEGY_2_SELL_RATE,
            isAlive: true,
            createdAt: now,
            updatedAt: now,
        });
        if (queryRunner) {
            defaultStrategy1 = await queryRunner.manager.save(defaultStrategy1);
            defaultStrategy1Item =
                await queryRunner.manager.save(defaultStrategy1Item);
            defaultStrategy2 = await queryRunner.manager.save(defaultStrategy2);
            defaultStrategy2Item =
                await queryRunner.manager.save(defaultStrategy2Item);
        }
        else {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                defaultStrategy1 = await queryRunner.manager.save(defaultStrategy1);
                defaultStrategy1Item =
                    await queryRunner.manager.save(defaultStrategy1Item);
                defaultStrategy2 = await queryRunner.manager.save(defaultStrategy2);
                defaultStrategy2Item =
                    await queryRunner.manager.save(defaultStrategy2Item);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
                this.logger.error(`create default trading strategies failed: ${error}`);
                throw new UnknownError(error);
            }
            finally {
                await queryRunner.release();
            }
        }
        return {
            strategies: [
                getTradingStrategyDto(defaultStrategy1, [defaultStrategy1Item]),
                getTradingStrategyDto(defaultStrategy2, [defaultStrategy2Item]),
            ],
        };
    }
    async getTradingStrategyDaoById(id: any, userId: any): Promise<TradingStrategy | null> {
        let strategy;
        try {
            strategy = await this.tradingStrategyRepository.findOneBy({
                id,
                userId,
            });
        }
        catch (error) {
            this.logger.error(`get trading strategy failed: ${error}`);
            throw new UnknownError(error);
        }
        return strategy;
    }
    async tradingStrategies(userId: any): Promise<TradingStrategiesDto> {
        let tradingStrategies;
        try {
            tradingStrategies = await this.tradingStrategyRepository.find({
                where: { userId, isAlive: true },
                order: { id: 'ASC' },
            });
        }
        catch (error) {
            this.logger.error(`get trading strategies failed: ${error}`);
            throw new UnknownError(error);
        }
        const tradingStrategyIds = tradingStrategies.map((v) => v.id);
        let tradingStrategyItems;
        try {
            tradingStrategyItems = await this.tradingStrategyItemRepository.find({
                where: {
                    strategyId: In(tradingStrategyIds),
                    isAlive: true,
                },
                order: {
                    strategyId: 'ASC',
                    id: 'ASC',
                },
            });
        }
        catch (error) {
            this.logger.error(`get trading strategy items failed: ${error}`);
            throw new UnknownError(error);
        }
        const strategies = tradingStrategies.map((strategy) => {
            const items = tradingStrategyItems.filter((item) => item.strategyId === strategy.id);
            return getTradingStrategyDto(strategy, items);
        });
        return {
            strategies,
        };
    }
    async validateUpdateStrategy(userId: any, updateStrategyDto: any) {
        if (updateStrategyDto.items.length === 0) {
            throw new BadRequestException('expected items');
        }
        if (updateStrategyDto.name.length === 0 ||
            updateStrategyDto.name.length > 16) {
            throw new BadRequestException('invalid strategy name');
        }
        const items = [];
        for (const item of updateStrategyDto.items) {
            let trigger;
            try {
                trigger = new Decimal(item.trigger);
            }
            catch {
                throw new BadRequestException('invalid trigger');
            }
            if (trigger.lessThanOrEqualTo(new Decimal(0))) {
                throw new BadRequestException('invalid trigger');
            }
            let sellRate;
            try {
                sellRate = new Decimal(item.sellRate);
            }
            catch {
                throw new BadRequestException('invalid sell rate');
            }
            if (sellRate.lessThanOrEqualTo(new Decimal(0))) {
                throw new BadRequestException('invalid sell rate');
            }
            items.push({
                trigger,
                sellRate,
                itemType: getItemType(item.itemType),
            });
        }
        const strategy = await this.getTradingStrategyDaoById(updateStrategyDto.id, userId);
        if (strategy === null) {
            throw new BadRequestException('invalid strategy');
        }
        return {
            strategy,
            items,
        };
    }
    async updateStrategy(userId: any, updateStrategyDto: any): Promise<TradingStrategyDto> {
        let { strategy, items: updateStrategyItems } = await this.validateUpdateStrategy(userId, updateStrategyDto);
        const now = new Date();
        let items;
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const oldStrategy = await queryRunner.manager.findOne(TradingStrategy, {
                where: {
                    id: updateStrategyDto.id,
                },
                lock: {
                    mode: 'pessimistic_write',
                },
            });
            if (oldStrategy === null) {
                throw new UnknownError('expected strategy');
            }
            strategy = oldStrategy;
            strategy.name = updateStrategyDto.name;
            strategy.isAlive = true;
            strategy.updatedAt = now;
            strategy = await queryRunner.manager.save(strategy);
            items = await queryRunner.manager.find(TradingStrategyItem, {
                where: {
                    strategyId: updateStrategyDto.id,
                },
                order: {
                    id: 'ASC',
                },
            });
            for (let i = 0; i < updateStrategyItems.length; i++) {
                if (i < items.length) {
                    items[i].trigger = updateStrategyItems[i].trigger.toString();
                    items[i].sellRate = updateStrategyItems[i].sellRate.toString();
                    items[i].itemType = updateStrategyItems[i].itemType;
                    items[i].isAlive = true;
                    items[i].updatedAt = now;
                    items[i] = await queryRunner.manager.save(items[i]);
                }
                else {
                    let newItem = this.tradingStrategyItemRepository.create({
                        id: v7(),
                        strategyId: updateStrategyDto.id,
                        itemType: updateStrategyItems[i].itemType,
                        trigger: updateStrategyItems[i].trigger.toString(),
                        sellRate: updateStrategyItems[i].sellRate.toString(),
                        isAlive: true,
                        createdAt: now,
                        updatedAt: now,
                    });
                    newItem = await queryRunner.manager.save(newItem);
                    items.push(newItem);
                }
            }
            if (items.length > updateStrategyItems.length) {
                for (let i = updateStrategyItems.length; i < items.length; i++) {
                    items[i].isAlive = false;
                    items[i].updatedAt = now;
                    items[i] = await queryRunner.manager.save(items[i]);
                }
            }
            await queryRunner.commitTransaction();
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`update trading strategy failed: ${error}`);
            throw new UnknownError(error);
        }
        finally {
            await queryRunner.release();
        }
        return getTradingStrategyDto(strategy, items);
    }
    async deleteStrategy(userId: any, deleteStrategyDto: any): Promise<void> {
        let strategy = await this.getTradingStrategyDaoById(deleteStrategyDto.id, userId);
        if (strategy === null) {
            throw new BadRequestException('invalid strategy id');
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const now = new Date();
            strategy.isAlive = false;
            strategy.updatedAt = now;
            strategy = await queryRunner.manager.save(strategy);
            // Also deactivate all associated strategy items
            const items = await this.tradingStrategyItemRepository.find({
                where: { strategyId: strategy.id, isAlive: true },
            });
            for (const item of items) {
                item.isAlive = false;
                item.updatedAt = now;
                await queryRunner.manager.save(item);
            }
            await queryRunner.commitTransaction();
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`delete trading strategy failed: ${error}`);
            throw new UnknownError(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async validateCreateStrategy(createStrategyDto: any) {
        if (createStrategyDto.items.length === 0) {
            throw new BadRequestException('expected items');
        }
        if (createStrategyDto.name.length === 0 ||
            createStrategyDto.name.length > 16) {
            throw new BadRequestException('invalid strategy name');
        }
        const items = [];
        for (const item of createStrategyDto.items) {
            let trigger;
            try {
                trigger = new Decimal(item.trigger);
            }
            catch {
                throw new BadRequestException('invalid trigger');
            }
            if (trigger.lessThanOrEqualTo(new Decimal(0))) {
                throw new BadRequestException('invalid trigger');
            }
            let sellRate;
            try {
                sellRate = new Decimal(item.sellRate);
            }
            catch {
                throw new BadRequestException('invalid sell rate');
            }
            if (sellRate.lessThanOrEqualTo(new Decimal(0))) {
                throw new BadRequestException('invalid sell rate');
            }
            items.push({
                trigger,
                sellRate,
                itemType: getItemType(item.itemType),
            });
        }
        return {
            name: createStrategyDto.name,
            items,
        };
    }
    async createStrategy(userId: any, createStrategyDto: any): Promise<TradingStrategyDto> {
        const { name, items: createStrategyItems } = await this.validateCreateStrategy(createStrategyDto);
        const now = new Date();
        let strategy = this.tradingStrategyRepository.create({
            id: v7(),
            userId,
            name,
            isAlive: true,
            createdAt: now,
            updatedAt: now,
        });
        const items = createStrategyItems.map((item) => {
            return this.tradingStrategyItemRepository.create({
                id: v7(),
                strategyId: strategy.id,
                itemType: item.itemType,
                trigger: item.trigger.toString(),
                sellRate: item.sellRate.toString(),
                isAlive: true,
                createdAt: now,
                updatedAt: now,
            });
        });
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            strategy = await queryRunner.manager.save(strategy);
            for (let i = 0; i < items.length; i++) {
                items[i] = await queryRunner.manager.save(items[i]);
            }
            await queryRunner.commitTransaction();
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`create trading strategy failed: ${error}`);
            throw new UnknownError(error);
        }
        finally {
            await queryRunner.release();
        }
        return getTradingStrategyDto(strategy, items);
    }
    async createOrder(orderType: any, userId: any, walletId: any, pool: any, amount: any, outAmount: any, slippage: any, priorityFee: any, briberyAmount: any, isAntiMev: any, triggerPriceUsd: any, autoTradeEventId: any): Promise<TradingOrderDto> {
        switch (orderType) {
            case OrderTypeDto.SwapBuy: {
                if (outAmount === null) {
                    throw new BadRequestException('expected out amount');
                }
                if (pool === null) {
                    throw new BadRequestException('expected pool');
                }
                return await this.swapBuy(userId, walletId, pool, amount, outAmount, slippage, priorityFee, briberyAmount, isAntiMev);
            }
            case OrderTypeDto.SwapSell: {
                if (outAmount === null) {
                    throw new BadRequestException('expected out amount');
                }
                if (pool === null) {
                    throw new BadRequestException('expected pool');
                }
                return await this.swapSell(userId, walletId, pool, amount, outAmount, slippage, priorityFee, briberyAmount, isAntiMev);
            }
            case OrderTypeDto.SwapSellForAutoTradeBaseIn: {
                if (outAmount === null) {
                    throw new BadRequestException('expected out amount');
                }
                if (autoTradeEventId === null) {
                    throw new BadRequestException('expected auto trade event id');
                }
                return await this.swapSellBaseInForAutoTrade(userId, walletId, amount, outAmount, slippage, priorityFee, briberyAmount, isAntiMev, autoTradeEventId);
            }
            case OrderTypeDto.SwapSellForAutoTradeBaseOut: {
                if (outAmount === null) {
                    throw new BadRequestException('expected out amount');
                }
                if (autoTradeEventId === null) {
                    throw new BadRequestException('expected auto trade event id');
                }
                return await this.swapSellBaseOutForAutoTrade(userId, walletId, amount, outAmount, slippage, priorityFee, briberyAmount, isAntiMev, autoTradeEventId);
            }
            case OrderTypeDto.LimitBuy: {
                if (triggerPriceUsd === null) {
                    throw new BadRequestException('expected trigger price usd');
                }
                if (pool === null) {
                    throw new BadRequestException('expected pool');
                }
                return await this.limitBuy(userId, walletId, pool, amount, slippage, priorityFee, briberyAmount, isAntiMev, triggerPriceUsd);
            }
            case OrderTypeDto.LimitSell: {
                if (triggerPriceUsd === null) {
                    throw new BadRequestException('expected trigger price usd');
                }
                if (pool === null) {
                    throw new BadRequestException('expected pool');
                }
                return await this.limitSell(userId, walletId, pool, amount, slippage, priorityFee, briberyAmount, isAntiMev, triggerPriceUsd);
            }
            case OrderTypeDto.NativeDeposit:
            case OrderTypeDto.NativeWithdraw:
            case OrderTypeDto.TokenDeposit:
            case OrderTypeDto.AutoTradeBuy:
            case OrderTypeDto.AutoTradeSell:
            case OrderTypeDto.TokenWithdraw: {
                throw new BadRequestException('invalid order type');
            }
        }
        throw new BadRequestException('invalid order type');
    }
    async getTokenInfo(mint: any): Promise<TokenInfo> {
        const token = await this.tokenService.findByMintAddress(mint);
        if (token === null) {
            throw new BadRequestException('invalid token mint');
        }
        return token;
    }
    async swapBuy(userId: any, walletId: any, pool: any, amount: any, outAmount: any, slippage: any, priorityFee: any, briberyAmount: any, isAntiMev: any): Promise<TradingOrderDto> {
        if (amount <= 0n) {
            throw new BadRequestException('invalid amount');
        }
        const [poolPrice, wallet] = await Promise.all([
            this.clickHouseService.getTokenPriceByPool(pool.toBase58()),
            this.walletService.getUserWalletInfo(userId, walletId),
        ]);
        if (isNullOrUndefined(poolPrice)) {
            throw new BadRequestException('invalid pool');
        }
        const tokenMintStr = poolPrice.baseMint;
        const tokenMint = new web3.PublicKey(tokenMintStr);
        const tokenInfo = await this.getTokenInfo(tokenMintStr);
        const solMintStr = poolPrice.quoteMint;
        const solMint = new web3.PublicKey(solMintStr);
        const solNormalizedAmount = new Decimal(amount.toString()).div(web3.LAMPORTS_PER_SOL);
        const outNormalizedAmount = new Decimal(outAmount.toString())
            .div(new Decimal(10).pow(tokenInfo.decimals))
            .toString();
        const now = new Date();
        let swap = {
            id: v7(),
            userId,
            walletId: wallet.id,
            walletAddress: bs58.decode(wallet.address),
            orderType: TradingOrderType.SwapBuy,
            pool: pool.toBuffer(),
            slippage: slippage.toString(),
            priorityFee: priorityFee.toString(),
            briberyAmount: briberyAmount.toString(),
            thresholdAmount: outAmount.toString(),
            thresholdNormalizedAmount: outNormalizedAmount,
            isAntiMev,
            txId: null,
            tokenMint: tokenMint.toBuffer(),
            tokenSymbol: tokenInfo.symbol,
            tokenAmount: null,
            tokenNormalizedAmount: null,
            tokenUsdPrice: null,
            solMint: solMint.toBuffer(),
            solAmount: amount.toString(),
            solNormalizedAmount: solNormalizedAmount.toString(),
            solUsdPrice: null,
            usdAmount: null,
            status: TradingOrderStatus.Created,
            triggerPriceUsd: null,
            errorReason: null,
            createdAt: now,
            updatedAt: now,
            confirmedTime: null,
            remoteId: null,
        };
        try {
            swap = await this.tradingOrderRepository.save(swap);
        }
        catch (error) {
            this.logger.error(`create swap buy order failed: ${error}`);
            throw new UnknownError(error);
        }
        new PendingOrder(swap, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifierService, this.tradingSettingRepository).wait().catch((error) => {
            this.logger.error(`PendingOrder.wait() failed for order ${swap.id}: ${error}`);
        });
        return getOrderDto(swap);
    }
    async swapSell(userId: any, walletId: any, pool: any, amount: any, outAmount: any, slippage: any, priorityFee: any, briberyAmount: any, isAntiMev: any): Promise<TradingOrderDto> {
        if (amount <= 0n) {
            throw new BadRequestException('invalid amount');
        }
        const [poolPrice, wallet] = await Promise.all([
            this.clickHouseService.getTokenPriceByPool(pool.toBase58()),
            this.walletService.getUserWalletInfo(userId, walletId),
        ]);
        if (isNullOrUndefined(poolPrice)) {
            throw new BadRequestException('invalid pool');
        }
        const solMint = new web3.PublicKey(poolPrice.quoteMint);
        const tokenMintStr = poolPrice.baseMint;
        const tokenMint = new web3.PublicKey(tokenMintStr);
        const tokenInfo = await this.getTokenInfo(tokenMintStr);
        const outNormalizedAmount = new Decimal(outAmount.toString())
            .div(web3.LAMPORTS_PER_SOL)
            .toFixed();
        const now = new Date();
        let swap = TradingOrder.createSwapSellOrder({
            userId,
            walletId: wallet.id,
            walletAddress: bs58.decode(wallet.address),
            pool,
            slippage,
            priorityFee,
            briberyAmount,
            outAmount,
            outNormalizedAmount,
            isAntiMev,
            tokenMint,
            tokenSymbol: tokenInfo.symbol,
            tokenDecimals: tokenInfo.decimals,
            amount,
            solMint,
        });
        try {
            swap = await this.tradingOrderRepository.save(swap);
        }
        catch (error) {
            this.logger.error(`create swap sell order failed: ${error}`);
            throw new UnknownError(error);
        }
        new PendingOrder(swap, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifierService, this.tradingSettingRepository).wait().catch((error) => {
            this.logger.error(`PendingOrder.wait() failed for order ${swap.id}: ${error}`);
        });
        return getOrderDto(swap);
    }
    async swapSellBaseInForAutoTrade(userId: any, walletId: any, amount: any, outAmount: any, slippage: any, priorityFee: any, briberyAmount: any, isAntiMev: any, autoTradeEventId: any): Promise<TradingOrderDto> {
        if (amount <= 0n) {
            throw new BadRequestException('invalid amount');
        }
        const [wallet, autoTradeEvent] = await Promise.all([
            this.walletService.getUserWalletInfo(userId, walletId),
            this.automaticStrategyEventRepository.findOneBy({ id: autoTradeEventId }),
        ]);
        if (isNullOrUndefined(autoTradeEvent)) {
            throw new BadRequestException('invalid auto trade event id');
        }
        if (autoTradeEvent.autoTradeStatus !== AutomaticTradeStatus.Pending) {
            throw new BadRequestException('invalid event status');
        }
        const solMint = new web3.PublicKey(WSOL);
        const tokenMintStr = autoTradeEvent.tokenMint;
        const tokenMint = new web3.PublicKey(tokenMintStr);
        const [tokenInfo, strategy] = await Promise.all([
            this.tokenService.getTokenInfoByMint(tokenMintStr, null),
            this.automaticStrategyRepository.findOneBy({
                id: autoTradeEvent.strategyId,
                userId,
            }),
        ]);
        if (isNullOrUndefined(strategy)) {
            this.logger.error(`invalid auto trade event id: ${autoTradeEventId}`);
            throw new BadRequestException('invalid auto trade event id');
        }
        if (isNullOrUndefined(tokenInfo)) {
            this.logger.error(`invalid token info: ${tokenMintStr}`);
            throw new UnknownError('invalid token info');
        }
        if (!tokenInfo.symbol) {
            this.logger.error(`invalid token info: ${tokenMintStr}`);
            throw new UnknownError('invalid token info');
        }
        if (!tokenInfo.decimals) {
            this.logger.error(`invalid token info: ${tokenMintStr}`);
            throw new UnknownError('invalid token info');
        }
        if (isNullOrUndefined(tokenInfo.pool_address)) {
            throw new BadRequestException(`token ${tokenMintStr} has no pool address`);
        }
        const outNormalizedAmount = new Decimal(outAmount.toString())
            .div(web3.LAMPORTS_PER_SOL)
            .toFixed();
        const sellOrders = await this.tradingOrderRepository.find({
            where: {
                userId,
                orderType: TradingOrderType.AutoTradeSell,
                remoteId: autoTradeEventId,
            },
        });
        await this.innerCancelOrders(sellOrders);
        let swap = TradingOrder.createSwapSellForAutoTradeBaseInOrder({
            userId,
            walletId: wallet.id,
            walletAddress: bs58.decode(wallet.address),
            pool: new web3.PublicKey(tokenInfo.pool_address),
            slippage,
            priorityFee,
            briberyAmount,
            outAmount,
            outNormalizedAmount,
            isAntiMev,
            tokenMint,
            tokenSymbol: tokenInfo.symbol,
            tokenDecimals: tokenInfo.decimals,
            amount,
            solMint,
            autoTradeEventId,
        });
        await this.tradingOrderRepository.save(swap);
        new PendingOrder(swap, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifierService, this.tradingSettingRepository).wait().catch((error) => {
            this.logger.error(`PendingOrder.wait() failed for order ${swap.id}: ${error}`);
        });
        return getOrderDto(swap);
    }
    async swapSellBaseOutForAutoTrade(userId: any, walletId: any, amount: any, outAmount: any, slippage: any, priorityFee: any, briberyAmount: any, isAntiMev: any, autoTradeEventId: any): Promise<TradingOrderDto> {
        if (amount <= 0n) {
            throw new BadRequestException('invalid amount');
        }
        const [wallet, autoTradeEvent] = await Promise.all([
            this.walletService.getUserWalletInfo(userId, walletId),
            this.automaticStrategyEventRepository.findOneBy({ id: autoTradeEventId }),
        ]);
        if (isNullOrUndefined(autoTradeEvent)) {
            throw new BadRequestException('invalid auto trade event id');
        }
        if (autoTradeEvent.autoTradeStatus !== AutomaticTradeStatus.Pending) {
            throw new BadRequestException('invalid event status');
        }
        const solMint = new web3.PublicKey(WSOL);
        const tokenMintStr = autoTradeEvent.tokenMint;
        const tokenMint = new web3.PublicKey(tokenMintStr);
        const [tokenInfo, strategy] = await Promise.all([
            this.tokenService.getTokenInfoByMint(tokenMintStr, null),
            this.automaticStrategyRepository.findOneBy({
                id: autoTradeEvent.strategyId,
                userId,
            }),
        ]);
        if (isNullOrUndefined(strategy)) {
            this.logger.error(`invalid auto trade event id: ${autoTradeEventId}`);
            throw new BadRequestException('invalid auto trade event id');
        }
        if (isNullOrUndefined(tokenInfo)) {
            this.logger.error(`invalid token info: ${tokenMintStr}`);
            throw new UnknownError('invalid token info');
        }
        if (!tokenInfo.symbol) {
            this.logger.error(`invalid token info: ${tokenMintStr}`);
            throw new UnknownError('invalid token info');
        }
        if (!tokenInfo.decimals) {
            this.logger.error(`invalid token info: ${tokenMintStr}`);
            throw new UnknownError('invalid token info');
        }
        if (isNullOrUndefined(tokenInfo.pool_address)) {
            throw new BadRequestException(`token ${tokenMintStr} has no pool address`);
        }
        const outNormalizedAmount = new Decimal(outAmount.toString())
            .div(web3.LAMPORTS_PER_SOL)
            .toFixed();
        // Cancel any pending AutoTradeSell for this event so the manual BaseOut sell
        // replaces the automatic one — matches BaseIn behavior and prevents
        // double-sell when a user manually exits a position while AutoTradeSell is pending.
        const pendingAutoSells = await this.tradingOrderRepository.find({
            where: {
                userId,
                orderType: TradingOrderType.AutoTradeSell,
                remoteId: autoTradeEventId,
            },
        });
        await this.innerCancelOrders(pendingAutoSells);
        let swap = TradingOrder.createSwapSellForAutoTradeBaseOutOrder({
            userId,
            walletId: wallet.id,
            walletAddress: bs58.decode(wallet.address),
            pool: new web3.PublicKey(tokenInfo.pool_address),
            slippage,
            priorityFee,
            briberyAmount,
            outAmount,
            outNormalizedAmount,
            isAntiMev,
            tokenMint,
            tokenSymbol: tokenInfo.symbol,
            tokenDecimals: tokenInfo.decimals,
            amount,
            solMint,
            autoTradeEventId,
        });
        await this.tradingOrderRepository.save(swap);
        new PendingOrder(swap, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifierService, this.tradingSettingRepository).wait().catch((error) => {
            this.logger.error(`PendingOrder.wait() failed for order ${swap.id}: ${error}`);
        });
        return getOrderDto(swap);
    }
    async limitBuy(userId: any, walletId: any, pool: any, amount: any, slippage: any, priorityFee: any, briberyAmount: any, isAntiMev: any, triggerPriceUsd: any): Promise<TradingOrderDto> {
        if (amount <= 0n) {
            throw new BadRequestException('invalid amount');
        }
        const [poolPrice, wallet] = await Promise.all([
            this.clickHouseService.getTokenPriceByPool(pool.toBase58()),
            this.walletService.getUserWalletInfo(userId, walletId),
        ]);
        if (isNullOrUndefined(poolPrice)) {
            throw new BadRequestException('invalid pool');
        }
        const solMintStr = poolPrice.quoteMint;
        const solMint = new web3.PublicKey(solMintStr);
        const tokenMintStr = poolPrice.baseMint;
        const tokenMint = new web3.PublicKey(tokenMintStr);
        const tokenInfo = await this.getTokenInfo(tokenMintStr);
        const solNormalizedAmount = new Decimal(amount.toString()).div(web3.LAMPORTS_PER_SOL);
        let swap = TradingOrder.createLimitBuyOrder({
            userId,
            walletId: wallet.id,
            walletAddress: bs58.decode(wallet.address),
            pool,
            slippage,
            priorityFee,
            briberyAmount,
            isAntiMev,
            tokenMint,
            tokenSymbol: tokenInfo.symbol,
            amount,
            solNormalizedAmount: solNormalizedAmount.toString(),
            solMint,
            triggerPriceUsd,
        });
        try {
            swap = await this.tradingOrderRepository.save(swap);
        }
        catch (error) {
            this.logger.error(`create limit buy order failed: ${error}`);
            throw new UnknownError(error);
        }
        new PendingOrder(swap, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifierService, this.tradingSettingRepository).wait().catch((error) => {
            this.logger.error(`PendingOrder.wait() failed for order ${swap.id}: ${error}`);
        });
        return getOrderDto(swap);
    }
    async limitSell(userId: any, walletId: any, pool: any, amount: any, slippage: any, priorityFee: any, briberyAmount: any, isAntiMev: any, triggerPriceUsd: any): Promise<TradingOrderDto> {
        if (amount <= 0n) {
            throw new BadRequestException('invalid amount');
        }
        const [poolPrice, wallet] = await Promise.all([
            this.clickHouseService.getTokenPriceByPool(pool.toBase58()),
            this.walletService.getUserWalletInfo(userId, walletId),
        ]);
        if (isNullOrUndefined(poolPrice)) {
            throw new BadRequestException('invalid pool');
        }
        const solMintStr = poolPrice.quoteMint;
        const tokenMintStr = poolPrice.baseMint;
        const solMint = new web3.PublicKey(solMintStr);
        const tokenMint = new web3.PublicKey(tokenMintStr);
        const tokenInfo = await this.getTokenInfo(tokenMintStr);
        let swap = TradingOrder.createLimitSellOrder({
            userId,
            walletId: wallet.id,
            walletAddress: bs58.decode(wallet.address),
            pool,
            slippage,
            priorityFee,
            briberyAmount,
            isAntiMev,
            tokenMint,
            tokenSymbol: tokenInfo.symbol,
            tokenDecimals: tokenInfo.decimals,
            amount,
            solMint,
            triggerPriceUsd,
        });
        try {
            swap = await this.tradingOrderRepository.save(swap);
        }
        catch (error) {
            this.logger.error(`create limit sell order failed: ${error}`);
            throw new UnknownError(error);
        }
        new PendingOrder(swap, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifierService, this.tradingSettingRepository).wait().catch((error) => {
            this.logger.error(`PendingOrder.wait() failed for order ${swap.id}: ${error}`);
        });
        return getOrderDto(swap);
    }
    async getOrderDetail(userId: any, id: any): Promise<TradingOrderDto> {
        const order = await this.getOrderDaoById(id, userId);
        if (order === null) {
            throw new BadRequestException('invalid order id');
        }
        return getOrderDto(order);
    }
    async getOrders(userId: any, pool: any, tokenMint: any, statuses: any, orderTypes: any, startId: any, orderBy: any, limit: any): Promise<TradingOrdersDto> {
        if (!limit) {
            limit = DEFAULT_LIMIT;
        }
        if (limit > MAX_LIMIT) {
            throw new BadRequestException('limit is too large');
        }
        const poolAddr = pool ? new web3.PublicKey(pool).toBuffer() : undefined;
        const statusFilter = statuses
            ? statuses.length === 0
                ? undefined
                : In(Array.from(new Set(statuses.map(getTradingOrderStatus))))
            : undefined;
        const orderTypesFilter = orderTypes
            ? orderTypes.length === 0
                ? undefined
                : In(Array.from(new Set(orderTypes.map(getTradingOrderType))))
            : undefined;
        const tokenMintAddr = tokenMint
            ? new web3.PublicKey(tokenMint).toBuffer()
            : undefined;
        let order: any;
        if (orderBy === null) {
            order = order = {
                id: 'DESC',
            };
        }
        else {
            switch (orderBy) {
                case TradingOrderByDto.CreatedTime: {
                    order = {
                        id: 'DESC',
                    };
                    break;
                }
                case TradingOrderByDto.UpdatedTime: {
                    order = {
                        updatedAt: 'DESC',
                    };
                    break;
                }
                default: {
                    assertNever(orderBy);
                }
            }
        }
        let orders;
        try {
            orders = await this.tradingOrderRepository.find({
                where: {
                    userId: userId,
                    pool: poolAddr,
                    tokenMint: tokenMintAddr,
                    id: startId ? LessThan(startId) : undefined,
                    status: statusFilter,
                    orderType: orderTypesFilter,
                },
                order,
                take: limit,
            });
        }
        catch (error) {
            this.logger.error(`get orders failed: ${error}`);
            throw new UnknownError(error);
        }
        const txs = orders.map(getOrderDto);
        return {
            txs,
        };
    }
    async getOrderDaoById(id: any, userId: any): Promise<TradingOrder | null> {
        try {
            return await this.tradingOrderRepository.findOneBy({ id, userId });
        }
        catch (error) {
            this.logger.error(`get order dao by id failed: ${error}`);
            throw new UnknownError(error);
        }
    }
    async cancelOrder(userId: any, id: any): Promise<TradingOrderDto> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let order = await queryRunner.manager.findOne(TradingOrder, {
                where: { id, userId },
                lock: { mode: 'pessimistic_write' },
            });
            if (order === null) {
                this.logger.error(`Cannot find order id ${id} for user ${userId}`);
                throw new BadRequestException('cannot find order id');
            }
            if (order.orderType !== TradingOrderType.LimitBuy &&
                order.orderType !== TradingOrderType.LimitSell &&
                order.orderType !== TradingOrderType.AutoTradeSell) {
                this.logger.error(`Invalid order id ${id} for user ${userId}`);
                throw new BadRequestException('invalid order id');
            }
            if (order.status === TradingOrderStatus.Success) {
                throw new BadRequestException('order already executed');
            }
            if (order.status === TradingOrderStatus.Failed) {
                throw new BadRequestException('order already failed');
            }
            if (order.status === TradingOrderStatus.Cancelled) {
                throw new BadRequestException('order already cancelled');
            }
            if (order.status === TradingOrderStatus.ChainTxPending ||
                order.status === TradingOrderStatus.Created) {
                const tx = await this.tradingClient.cancelOrder(id);
                if (tx.status === SwapTransactionStatus.Cancelled) {
                    order.status = TradingOrderStatus.Cancelled;
                    order.updatedAt = new Date();
                    order = await queryRunner.manager.save(order);
                }
            }
            else if (order.status === TradingOrderStatus.WaitingStart) {
                order.status = TradingOrderStatus.Cancelled;
                order.updatedAt = new Date();
                order = await queryRunner.manager.save(order);
            }
            await queryRunner.commitTransaction();
            return getOrderDto(order);
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof BadRequestException) throw error;
            this.logger.error(`cancel order failed: ${error}`);
            throw new UnknownError(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async innerCancelOrders(orders: any): Promise<TradingOrder[]> {
        // Use allSettled so one failing cancel doesn't block the others — previously
        // an upstream RPC error on a single order would reject the whole batch and
        // leave sibling orders uncancelled. Also expand acceptable statuses to match
        // the public `cancelOrder` path (Created OR ChainTxPending OR WaitingStart).
        const results = await Promise.allSettled(orders.map(async (order: any) => {
            if (order.status === TradingOrderStatus.WaitingStart) {
                order.status = TradingOrderStatus.Cancelled;
                order.updatedAt = new Date();
                return await this.tradingOrderRepository.save(order);
            }
            if (order.status !== TradingOrderStatus.Created &&
                order.status !== TradingOrderStatus.ChainTxPending) {
                return order;
            }
            try {
                const tx = await this.tradingClient.cancelOrder(order.id);
                if (tx.status === SwapTransactionStatus.Cancelled) {
                    order.status = TradingOrderStatus.Cancelled;
                    order.updatedAt = new Date();
                    return await this.tradingOrderRepository.save(order);
                }
            } catch (err) {
                this.logger.error(`Failed to cancel order ${order.id}: ${(err as Error)}`);
            }
            return order;
        }));
        return results.map((r, i) => r.status === 'fulfilled' ? r.value : orders[i]);
    }
}
