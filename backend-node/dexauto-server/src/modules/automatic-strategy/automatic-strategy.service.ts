import { AutomaticStrategy, AutomaticStrategyStatus, AutoTradeStatus, TriggerItemType } from './entities/AutomaticStrategy.entity';
import { QueryRunner, MoreThan, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { CreateAutomaticStrategyDto } from './dto/create.dto';
import { AutomaticStrategiesDto, AutomaticStrategyDto, AutomaticStrategyEventsDto, ChainFMChannelInfoDto, AutomaticStrategyUnsoldEventsDto } from './dto/response.dto';
import { Wallet } from '../wallet/entities/wallet.entity';
import { UpdateAutomaticStrategyDto } from './dto/update.dto';
import { AutomaticStrategyEventsRequestDto, OrderDirection, AutomaticStrategyOrderByDto } from './dto/events.dto';
import { AutomaticStrategyEvent, AutomaticTradeStatus } from './entities/AutomaticStrategyEvent.entity';
import { TradingOrder } from '../trading/entities/tradingOrder.entity';
import { AutomaticStrategySyncerService } from '../automatic-strategy-syncer/automatic-strategy-syncer.service';
import { TokenService } from '../token/token.service';
import { AutomaticStrategyUnsoldEventsRequestDto } from './dto/unsold-events.dto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger } from 'nestjs-pino';
import { In } from 'typeorm';
import { v7 } from 'uuid';
import { BadRequestException, UnknownError } from '../../error';
import { WSOL, isNullOrUndefined } from '../../common/utils';
import { Chain } from '../../common/genericChain';
import { web3 } from '@coral-xyz/anchor';
import { ChainFMClient } from '../automatic-strategy-syncer/utils/chainFMClient';
import bs58 from 'bs58';
import Decimal from 'decimal.js';
import { toMonitorAddress, toTrigger, toAddressSub, toAutoTrade, toAutoTradeStatus, toAutomaticStrategyDto, toAutomaticStrategyEventDto, toAutomaticStrategyUnsoldEventDto } from './dto/response.dto';
import { getChainFMChannelId, AddressSub } from './entities/AutomaticStrategy.entity';
import { AutomaticStrategyStatusDto, toAutomaticStrategyStatus } from './dto/response.dto';

const MAX_EVENTS_LIMIT = 100;
enum AddressSubType {
    ChainFM = 'ChainFM',
    Wallet = 'Wallet',
}

const MAX_AUTOMATIC_STRATEGIES = 10;
const MAX_MONITOR_ADDRESSES = 300;
const MAX_ADDRESS_SUBS = 10;
const MAX_AUTO_TRADES = 1;
const MAX_TRIGGERS = 5;
const MAX_TRIGGER_ITEMS = 3;
const DEFAULT_AUTO_TRADE_EXEC_COUNT = '0';
const DEFAULT_AUTO_TRADE_EXEC_COUNT_24H = 0;
const DEFAULT_NOTIFY_EXEC_COUNT = '0';
const DEFAULT_NOTIFY_EXEC_COUNT_24H = 0;
const DEFAULT_STRATEGY_1_NAME = '聪明钱包共识(自动发现)';
// Monitor addresses are dynamically populated from SmartWalletSourceService (S/A tier active wallets).
// No hardcoded addresses — the system discovers, scores, and injects wallets automatically.
const DEFAULT_STRATEGY_1_MONITOR_ADDRESSES: Array<{ address: string; name: string }> = [
];
const DEFAULT_STRATEGY_1_ADDRESS_SUBS: any[] = [];
const DEFAULT_STRATEGY_1_TRIGGERS = [
    {
        index: 1,
        items: [
            {
                type: TriggerItemType.PurchaseAddrAndSolUpper,
                upperSolNormalizedAmount: '1',
                addressesCount: 2,
            },
            {
                type: TriggerItemType.PurchaseSolUpper,
                upperSolNormalizedAmount: '10',
            },
        ],
    },
    {
        index: 2,
        items: [
            {
                type: TriggerItemType.PurchaseAddrUpper,
                upperAddressesCount: 3,
            },
        ],
    },
];
const DEFAULT_STRATEGY_2_NAME = 'Pump聪明钱(自动发现)';
const DEFAULT_STRATEGY_2_MONITOR_ADDRESSES: any[] = [
];
const DEFAULT_STRATEGY_2_ADDRESS_SUBS = [
    {
        index: 1,
        type: AddressSubType.ChainFM,
        url: 'https://chain.fm/channel/1304082985779204100',
        name: '阴谋集团',
    },
    {
        index: 2,
        type: AddressSubType.ChainFM,
        url: 'https://chain.fm/channel/1304020211569004544',
        name: '每抄一个都是金狗，每抄一次都是底部（自我记录）',
    },
    {
        index: 3,
        type: AddressSubType.ChainFM,
        url: 'https://chain.fm/channel/1311951370709897216',
        name: 'RichGamersClub - 精选顶级地址 高效捕捉金狗',
    },
];
const DEFAULT_STRATEGY_2_TRIGGERS = [
    {
        index: 1,
        items: [
            {
                type: TriggerItemType.PurchaseAddrAndSolUpper,
                upperSolNormalizedAmount: '1',
                addressesCount: 2,
            },
        ],
    },
];
@Injectable()
export class AutomaticStrategyService {
    private automaticStrategyRepository: Repository<AutomaticStrategy>;
    private walletRepository: Repository<Wallet>;
    private logger: PinoLogger;
    private automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>;
    private tradingOrderRepository: Repository<TradingOrder>;
    private automaticStrategySyncer: AutomaticStrategySyncerService;
    private tokenService: TokenService;
    private chainFMClient: ChainFMClient;

    constructor(
        @InjectRepository(AutomaticStrategy) automaticStrategyRepository: Repository<AutomaticStrategy>,
        @InjectRepository(Wallet) walletRepository: Repository<Wallet>,
        @InjectPinoLogger(AutomaticStrategyService.name) logger: PinoLogger,
        @InjectRepository(AutomaticStrategyEvent) automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>,
        @InjectRepository(TradingOrder) tradingOrderRepository: Repository<TradingOrder>,
        automaticStrategySyncer: AutomaticStrategySyncerService,
        tokenService: TokenService,
    ) {
        this.automaticStrategyRepository = automaticStrategyRepository;
        this.walletRepository = walletRepository;
        this.logger = logger;
        this.automaticStrategyEventRepository = automaticStrategyEventRepository;
        this.tradingOrderRepository = tradingOrderRepository;
        this.automaticStrategySyncer = automaticStrategySyncer;
        this.tokenService = tokenService;
        this.chainFMClient = new ChainFMClient();
    }
    async createAutomaticStrategy(userId: any, createAutomaticStrategyDto: any): Promise<AutomaticStrategyDto> {
        const name = createAutomaticStrategyDto.name;
        const monitorAddresses = createAutomaticStrategyDto.monitorAddresses.map((monitorAddress: any) => toMonitorAddress(monitorAddress, this.logger));
        const triggers = createAutomaticStrategyDto.triggers.map((trigger: any, index: any) => toTrigger(trigger, this.logger, index + 1));
        const addressSubs = await Promise.all(createAutomaticStrategyDto.addressSubs.map(async (addressSub: any, index: any) => {
            const channelInfo = await this.getChainFMChannelInfo(addressSub.url);
            return toAddressSub(addressSub, index + 1, channelInfo.name);
        }));
        const wallets = await this.walletRepository.find({
            where: {
                userId,
                id: In(createAutomaticStrategyDto.autoTrades.map((autoTrade: any) => autoTrade.walletId)),
                isActive: true,
                chain: Chain.Solana,
            },
        });
        const autoTrades = createAutomaticStrategyDto.autoTrades.map((autoTrade: any, index: any) => {
            const wallet = wallets.find((wallet) => wallet.id === autoTrade.walletId);
            if (!wallet) {
                throw new BadRequestException(`Wallet not found: ${autoTrade.walletId}`);
            }
            return toAutoTrade(autoTrade, this.logger, wallet.index, new web3.PublicKey(wallet.address).toBase58(), index + 1);
        });
        const isSysNotifyOn = createAutomaticStrategyDto.isSysNotifyOn;
        if (monitorAddresses.length > MAX_MONITOR_ADDRESSES) {
            throw new BadRequestException(`Maximum number of monitor addresses reached: ${MAX_MONITOR_ADDRESSES}`);
        }
        if (addressSubs.length > MAX_ADDRESS_SUBS) {
            throw new BadRequestException(`Maximum number of address subs reached: ${MAX_ADDRESS_SUBS}`);
        }
        if (triggers.length > MAX_TRIGGERS) {
            throw new BadRequestException(`Maximum number of triggers reached: ${MAX_TRIGGERS}`);
        }
        if (autoTrades.length > MAX_AUTO_TRADES) {
            throw new BadRequestException(`Maximum number of auto trades reached: ${MAX_AUTO_TRADES}`);
        }
        if (triggers.some((trigger: any) => trigger.items.length > MAX_TRIGGER_ITEMS)) {
            throw new BadRequestException(`Maximum number of trigger items reached: ${MAX_TRIGGER_ITEMS}`);
        }
        let automaticStrategiesCount;
        try {
            automaticStrategiesCount = await this.automaticStrategyRepository.count({
                where: {
                    userId,
                    status: In([
                        AutomaticStrategyStatus.Active,
                        AutomaticStrategyStatus.Inactive,
                    ]),
                },
            });
        }
        catch (error) {
            this.logger.error(`Failed to get automatic strategies: ${error}`);
            throw new UnknownError('Failed to get automatic strategies');
        }
        if (automaticStrategiesCount >= MAX_AUTOMATIC_STRATEGIES) {
            throw new BadRequestException(`Maximum number of automatic strategies reached: ${MAX_AUTOMATIC_STRATEGIES}`);
        }
        if (monitorAddresses.length === 0 && addressSubs.length === 0) {
            this.logger.error('Monitor addresses or address subs are required');
            throw new BadRequestException('Monitor addresses or address subs are required');
        }
        const now = new Date();
        const automaticStrategy = new AutomaticStrategy();
        automaticStrategy.id = v7();
        automaticStrategy.userId = userId;
        automaticStrategy.name = name;
        automaticStrategy.monitorAddresses = monitorAddresses;
        automaticStrategy.addressSubs = addressSubs;
        automaticStrategy.triggers = triggers;
        automaticStrategy.autoTrades = autoTrades;
        automaticStrategy.autoTradeExecCount = DEFAULT_AUTO_TRADE_EXEC_COUNT;
        automaticStrategy.autoTradeStatus = AutoTradeStatus.Active;
        automaticStrategy.isSysNotifyOn = isSysNotifyOn;
        automaticStrategy.notifyExecCount = DEFAULT_NOTIFY_EXEC_COUNT;
        automaticStrategy.status = AutomaticStrategyStatus.Active;
        automaticStrategy.startAt = now;
        automaticStrategy.createdAt = now;
        automaticStrategy.updatedAt = now;
        automaticStrategy.triggerStartAt = now;
        try {
            await this.saveAutomaticStrategies([automaticStrategy]);
            await this.automaticStrategySyncer.addStrategies([automaticStrategy.id]);
            return toAutomaticStrategyDto(automaticStrategy, DEFAULT_AUTO_TRADE_EXEC_COUNT_24H, DEFAULT_NOTIFY_EXEC_COUNT_24H);
        }
        catch (error) {
            this.logger.error(`Failed to create automatic strategy: ${error}`);
            throw new UnknownError('Failed to create automatic strategy');
        }
    }
    async createDefaultAutomaticStrategy(userId: any, queryRunner: any): Promise<AutomaticStrategy[]> {
        const automaticStrategies = this.getDefaultAutomaticStrategies(userId);
        return await this.saveAutomaticStrategies(automaticStrategies, queryRunner);
    }
    async addStrategies(ids: any): Promise<void> {
        await this.automaticStrategySyncer.addStrategies(ids);
    }
    getDefaultAutomaticStrategies(userId: any): AutomaticStrategy[] {
        const now = new Date();
        const automaticStrategy1 = new AutomaticStrategy();
        automaticStrategy1.id = v7();
        automaticStrategy1.userId = userId;
        automaticStrategy1.name = DEFAULT_STRATEGY_1_NAME;
        automaticStrategy1.monitorAddresses = DEFAULT_STRATEGY_1_MONITOR_ADDRESSES;
        automaticStrategy1.addressSubs = DEFAULT_STRATEGY_1_ADDRESS_SUBS;
        automaticStrategy1.triggers = DEFAULT_STRATEGY_1_TRIGGERS;
        automaticStrategy1.autoTrades = [];
        automaticStrategy1.autoTradeExecCount = DEFAULT_AUTO_TRADE_EXEC_COUNT;
        automaticStrategy1.autoTradeStatus = AutoTradeStatus.Active;
        automaticStrategy1.isSysNotifyOn = true;
        automaticStrategy1.status = AutomaticStrategyStatus.Active;
        automaticStrategy1.startAt = now;
        automaticStrategy1.notifyExecCount = DEFAULT_NOTIFY_EXEC_COUNT;
        automaticStrategy1.createdAt = now;
        automaticStrategy1.updatedAt = now;
        automaticStrategy1.triggerStartAt = now;
        const automaticStrategy2 = new AutomaticStrategy();
        automaticStrategy2.id = v7();
        automaticStrategy2.userId = userId;
        automaticStrategy2.name = DEFAULT_STRATEGY_2_NAME;
        automaticStrategy2.monitorAddresses = DEFAULT_STRATEGY_2_MONITOR_ADDRESSES;
        automaticStrategy2.addressSubs = DEFAULT_STRATEGY_2_ADDRESS_SUBS;
        automaticStrategy2.triggers = DEFAULT_STRATEGY_2_TRIGGERS;
        automaticStrategy2.autoTrades = [];
        automaticStrategy2.autoTradeExecCount = DEFAULT_AUTO_TRADE_EXEC_COUNT;
        automaticStrategy2.autoTradeStatus = AutoTradeStatus.Active;
        automaticStrategy2.isSysNotifyOn = true;
        automaticStrategy2.status = AutomaticStrategyStatus.Active;
        automaticStrategy2.startAt = now;
        automaticStrategy2.notifyExecCount = DEFAULT_NOTIFY_EXEC_COUNT;
        automaticStrategy2.createdAt = now;
        automaticStrategy2.updatedAt = now;
        automaticStrategy2.triggerStartAt = now;
        return [automaticStrategy1, automaticStrategy2];
    }
    async saveAutomaticStrategies(automaticStrategies: any, queryRunner?: any): Promise<AutomaticStrategy[]> {
        if (queryRunner) {
            return await queryRunner.manager.save(automaticStrategies);
        }
        return await this.automaticStrategyRepository.save(automaticStrategies);
    }
    async getAutoStrategyNotifyExecCount24h(ids: string[]): Promise<any> {
        const counts = await Promise.all(ids.map((id) => this.automaticStrategySyncer.getStrategyNotify24hCount(id)));
        return ids.map((id) => {
            const count = counts.find((c) => c.id === id);
            if (!count) {
                return { id, count: DEFAULT_NOTIFY_EXEC_COUNT_24H };
            }
            return count;
        });
    }
    async getAutoStrategyAutoTradeExecCount24h(ids: string[]): Promise<any> {
        const counts = await Promise.all(ids.map((id) => this.automaticStrategySyncer.getStrategyAutoTrade24hCount(id)));
        return ids.map((id) => {
            const count = counts.find((c) => c.id === id);
            if (!count) {
                return { id, count: DEFAULT_AUTO_TRADE_EXEC_COUNT_24H };
            }
            return count;
        });
    }
    async getAutomaticStrategy(userId: any, id: any): Promise<AutomaticStrategyDto> {
        const [automaticStrategy, notifyExecCount24h, autoTradeExecCount24h] = await Promise.all([
            this.automaticStrategyRepository.findOne({
                where: {
                    id,
                    userId,
                    status: In([
                        AutomaticStrategyStatus.Active,
                        AutomaticStrategyStatus.Inactive,
                    ]),
                },
            }),
            this.getAutoStrategyNotifyExecCount24h([id]),
            this.getAutoStrategyAutoTradeExecCount24h([id]),
        ]);
        if (!automaticStrategy) {
            throw new BadRequestException('Automatic strategy not found');
        }
        return toAutomaticStrategyDto(automaticStrategy, autoTradeExecCount24h[0]?.count ?? DEFAULT_AUTO_TRADE_EXEC_COUNT_24H, notifyExecCount24h[0]?.count ?? DEFAULT_NOTIFY_EXEC_COUNT_24H);
    }
    async automaticStrategies(userId: any): Promise<AutomaticStrategiesDto> {
        try {
            const automaticStrategies = await this.automaticStrategyRepository.find({
                where: {
                    userId,
                    status: In([
                        AutomaticStrategyStatus.Active,
                        AutomaticStrategyStatus.Inactive,
                    ]),
                },
            });
            const strategyIds = automaticStrategies.map((strategy) => strategy.id);
            const [notifyExecCount24h, autoTradeExecCount24h] = await Promise.all([
                this.getAutoStrategyNotifyExecCount24h(strategyIds),
                this.getAutoStrategyAutoTradeExecCount24h(strategyIds),
            ]);
            const notifyExecCount24hMap = new Map();
            const autoTradeExecCount24hMap = new Map();
            notifyExecCount24h.forEach((item: any) => {
                notifyExecCount24hMap.set(item.id, item.count);
            });
            autoTradeExecCount24h.forEach((item: any) => {
                autoTradeExecCount24hMap.set(item.id, item.count);
            });
            const automaticStrategiesDto = automaticStrategies.map((strategy) => toAutomaticStrategyDto(strategy, autoTradeExecCount24hMap.get(strategy.id) ??
                DEFAULT_AUTO_TRADE_EXEC_COUNT_24H, notifyExecCount24hMap.get(strategy.id) ??
                DEFAULT_NOTIFY_EXEC_COUNT_24H));
            return { automaticStrategies: automaticStrategiesDto };
        }
        catch (error) {
            this.logger.error(`Failed to get automatic strategies: ${error}`);
            throw new UnknownError('Failed to get automatic strategies');
        }
    }
    async updateAutomaticStrategy(userId: any, updateAutomaticStrategyDto: any): Promise<AutomaticStrategyDto> {
        const [strategy, wallets] = await Promise.all([
            this.automaticStrategyRepository.findOne({
                where: {
                    id: updateAutomaticStrategyDto.id,
                    userId,
                    status: In([
                        AutomaticStrategyStatus.Active,
                        AutomaticStrategyStatus.Inactive,
                    ]),
                },
            }),
            (async () => {
                if (updateAutomaticStrategyDto.autoTrades &&
                    updateAutomaticStrategyDto.autoTrades.length > 0) {
                    return await this.walletRepository.find({
                        where: {
                            userId,
                            id: In(updateAutomaticStrategyDto.autoTrades.map((autoTrade: any) => autoTrade.walletId)),
                            isActive: true,
                            chain: Chain.Solana,
                        },
                    });
                }
                return [];
            })(),
        ]);
        if (!strategy) {
            throw new BadRequestException('Automatic strategy not found');
        }
        const { name, monitorAddresses, addressSubs, triggers, autoTrades, autoTradeSell, status, isSysNotifyOn, autoTradeStatus, } = updateAutomaticStrategyDto;
        const now = new Date();
        if (!isNullOrUndefined(name)) {
            strategy.name = name;
        }
        if (!isNullOrUndefined(monitorAddresses)) {
            strategy.monitorAddresses = monitorAddresses.map((monitorAddress: any) => toMonitorAddress(monitorAddress, this.logger));
            if (strategy.monitorAddresses.length > MAX_MONITOR_ADDRESSES) {
                this.logger.error(`Maximum number of monitor addresses reached: ${MAX_MONITOR_ADDRESSES}`);
                throw new BadRequestException(`Maximum number of monitor addresses reached: ${MAX_MONITOR_ADDRESSES}`);
            }
        }
        if (!isNullOrUndefined(addressSubs)) {
            strategy.addressSubs = await Promise.all(addressSubs.map(async (addressSub: any, index: any) => {
                const channelInfo = await this.getChainFMChannelInfo(addressSub.url);
                return toAddressSub(addressSub, index + 1, channelInfo.name);
            }));
            if (strategy.addressSubs.length > MAX_ADDRESS_SUBS) {
                throw new BadRequestException(`Maximum number of address subs reached: ${MAX_ADDRESS_SUBS}`);
            }
        }
        if (strategy.monitorAddresses.length === 0 &&
            strategy.addressSubs.length === 0) {
            throw new BadRequestException('Monitor addresses or address subs are required');
        }
        if (!isNullOrUndefined(triggers)) {
            strategy.triggers = triggers.map((trigger: any, index: any) => toTrigger(trigger, this.logger, index + 1));
            if (strategy.triggers.length > MAX_TRIGGERS) {
                throw new BadRequestException(`Maximum number of triggers reached: ${MAX_TRIGGERS}`);
            }
            // Also enforce per-trigger item limit on UPDATE, not just CREATE —
            // previously this let users bypass the cap by editing an existing strategy.
            if (strategy.triggers.some((trigger) => trigger.items.length > MAX_TRIGGER_ITEMS)) {
                throw new BadRequestException(`Maximum number of trigger items reached: ${MAX_TRIGGER_ITEMS}`);
            }
            strategy.triggerStartAt = now;
        }
        if (!isNullOrUndefined(autoTrades)) {
            strategy.autoTrades = autoTrades.map((autoTrade: any, index: any) => {
                const wallet = wallets.find((wallet) => wallet.id === autoTrade.walletId);
                if (!wallet) {
                    throw new BadRequestException(`Wallet not found: ${autoTrade.walletId}`);
                }
                return toAutoTrade(autoTrade, this.logger, wallet.index, new web3.PublicKey(wallet.address).toBase58(), index + 1);
            });
            if (strategy.autoTrades.length > MAX_AUTO_TRADES) {
                throw new BadRequestException(`Maximum number of auto trades reached: ${MAX_AUTO_TRADES}`);
            }
        }
        if (!isNullOrUndefined(autoTradeStatus)) {
            const [autoTradeStatusDao, autoTradesDao] = toAutoTradeStatus(autoTradeStatus, strategy.autoTrades);
            strategy.autoTradeStatus = autoTradeStatusDao;
            strategy.autoTrades = autoTradesDao;
        }
        if (!isNullOrUndefined(status)) {
            if (status === AutomaticStrategyStatusDto.Active &&
                (strategy.status === AutomaticStrategyStatus.Inactive ||
                    strategy.status === AutomaticStrategyStatus.Deleted)) {
                strategy.startAt = now;
            }
            strategy.status = toAutomaticStrategyStatus(status);
        }
        if (!isNullOrUndefined(isSysNotifyOn)) {
            strategy.isSysNotifyOn = isSysNotifyOn;
        }
        strategy.updatedAt = now;
        try {
            const [savedStrategy, notifyExecCount24h, autoTradeExecCount24h] = await Promise.all([
                (async () => {
                    const savedStrategy = await this.automaticStrategyRepository.save(strategy);
                    await this.automaticStrategySyncer.addStrategies([
                        savedStrategy.id,
                    ]);
                    return savedStrategy;
                })(),
                this.getAutoStrategyNotifyExecCount24h([strategy.id]),
                this.getAutoStrategyAutoTradeExecCount24h([strategy.id]),
            ]);
            return toAutomaticStrategyDto(savedStrategy, autoTradeExecCount24h[0]?.count ?? DEFAULT_AUTO_TRADE_EXEC_COUNT_24H, notifyExecCount24h[0]?.count ?? DEFAULT_NOTIFY_EXEC_COUNT_24H);
        }
        catch (error) {
            this.logger.error(`Failed to update automatic strategy: ${error}`);
            throw new UnknownError('Failed to update automatic strategy');
        }
    }
    async getAutomaticStrategyEvents(userId: any, req: any): Promise<AutomaticStrategyEventsDto> {
        const { strategyId, limit, startId, order, orderBy } = req;
        const limitFilter = limit ?? MAX_EVENTS_LIMIT;
        let startIdFilter = undefined;
        if (startId) {
            startIdFilter = MoreThan(startId);
        }
        const orderFilter = order ?? OrderDirection.DESC;
        const orderByFilter = orderBy ?? AutomaticStrategyOrderByDto.CreatedTime;
        let orderOption: any;
        if (orderFilter === OrderDirection.ASC &&
            orderByFilter === AutomaticStrategyOrderByDto.CreatedTime) {
            orderOption = { id: 'ASC' };
        }
        else if (orderFilter === OrderDirection.DESC &&
            orderByFilter === AutomaticStrategyOrderByDto.CreatedTime) {
            orderOption = { id: 'DESC' };
        }
        else {
            this.logger.error(`Invalid order or orderBy: ${order} ${orderBy}`);
            throw new BadRequestException('Invalid order or orderBy');
        }
        const strategy = await this.automaticStrategyRepository.findOne({
            where: { userId, id: strategyId },
        });
        if (!strategy) {
            throw new BadRequestException('Automatic strategy not found');
        }
        const events = await this.automaticStrategyEventRepository.find({
            where: { strategyId, id: startIdFilter },
            order: orderOption,
            take: limitFilter,
        });
        const eventTxIds = events.map((event) => event.autoTradeIds).flat();
        const eventTxs = await this.tradingOrderRepository.find({
            where: { id: In(eventTxIds) },
        });
        const eventTxsMap = new Map();
        eventTxs.forEach((tx) => {
            eventTxsMap.set(tx.id, tx);
        });
        const tokenMints = events.map((event) => event.tokenMint);
        const tokenUsdPrices = await this.tokenService._tokenPrices(tokenMints);
        const tokenUsdPricesMap = new Map();
        tokenUsdPrices.forEach((tokenUsdPrice) => {
            tokenUsdPricesMap.set(tokenUsdPrice.baseMint, tokenUsdPrice.latestPrice);
        });
        const eventsDto = events
            .map((event) => {
            if (event.autoTradeIds === null || event.autoTradeIds.length === 0) {
                return [
                    toAutomaticStrategyEventDto(event, null, tokenUsdPricesMap.get(event.tokenMint) ??
                        new Decimal(0)),
                ];
            }
            return event.autoTradeIds
                .map((id) => eventTxsMap.get(id))
                .filter((tx) => tx !== undefined)
                .map((tx) => toAutomaticStrategyEventDto(event, tx, tokenUsdPricesMap.get(event.tokenMint) ??
                new Decimal(0)));
        })
            .flat();
        return { events: eventsDto };
    }
    async getChainFMChannelInfo(url: any): Promise<ChainFMChannelInfoDto> {
        // AS-8: Validate the URL is specifically a chain.fm URL to prevent SSRF
        if (typeof url !== 'string' || url.length > 200) {
            throw new BadRequestException('invalid ChainFM url: must be a string');
        }
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            throw new BadRequestException('invalid ChainFM url: malformed URL');
        }
        if (parsedUrl.hostname !== 'chain.fm' && parsedUrl.hostname !== 'www.chain.fm') {
            throw new BadRequestException('invalid ChainFM url: must be a chain.fm URL');
        }
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            throw new BadRequestException('invalid ChainFM url: invalid protocol');
        }

        const channelId = getChainFMChannelId(url);
        if (!channelId) {
            this.logger.error(`Invalid ChainFM channel URL: ${url}`);
            throw new BadRequestException('invalid ChainFM url: could not extract channel ID');
        }
        const channelInfo = await this.chainFMClient.getChannelInfo(channelId);
        return {
            name: channelInfo.channel.name,
            addresses: channelInfo.addresses.map((address: any) => {
                return {
                    name: address.name || '',
                    address: address.address,
                };
            }),
        };
    }
    async getAutomaticStrategyUnsoldEvents(userId: any, { strategyId, limit, startId }: { strategyId: any; limit: any; startId: any }): Promise<AutomaticStrategyUnsoldEventsDto> {
        if (!startId) {
            startId = undefined;
        }
        if (!limit) {
            limit = undefined;
        }
        const [strategy, events] = await Promise.all([
            this.automaticStrategyRepository.findOne({
                where: { userId, id: strategyId },
            }),
            this.automaticStrategyEventRepository.find({
                where: {
                    strategyId,
                    id: startId,
                    autoTradeStatus: AutomaticTradeStatus.Pending,
                },
                order: { id: 'DESC' },
                take: limit,
            }),
        ]);
        if (!strategy) {
            throw new BadRequestException('Automatic strategy not found');
        }
        const autoTradeSellIds = events
            .map((event) => event.autoTrades
            ?.map((autoTrade) => autoTrade.sellId)
            .filter((sellId) => sellId !== undefined) || [])
            .flat();
        const autoTradeBuyIds = events
            .map((event) => event.autoTrades?.map((autoTrade) => autoTrade.buyId) || [])
            .flat();
        const tokenMints = events.map((event) => event.tokenMint);
        tokenMints.push(WSOL);
        const tokenUsdPrices = await this.tokenService._tokenPrices(tokenMints);
        const tokenUsdPricesMap = new Map();
        tokenUsdPrices.forEach((tokenUsdPrice) => {
            tokenUsdPricesMap.set(tokenUsdPrice.baseMint, tokenUsdPrice.latestPrice);
        });
        const solUsdPrice = tokenUsdPricesMap.get(WSOL);
        if (!solUsdPrice) {
            this.logger.error('Sol usd price is not found');
            throw new UnknownError('Sol usd price is not found');
        }
        const autoTrades = await this.tradingOrderRepository.find({
            where: { id: In(autoTradeSellIds.concat(autoTradeBuyIds)) },
        });
        const autoTradeMap = new Map();
        autoTrades.forEach((autoTrade) => {
            autoTradeMap.set(autoTrade.id, autoTrade);
        });
        const eventsDto = events.map((event) => {
            const autoTradeBuyEvent = event.autoTrades?.[0];
            const autoTradeBuyId = autoTradeBuyEvent?.buyId;
            if (!autoTradeBuyId) {
                this.logger.error('Auto trade is not found');
                throw new UnknownError('Auto trade is not found');
            }
            const autoTradeBuy = autoTradeMap.get(autoTradeBuyId);
            if (!autoTradeBuy) {
                this.logger.error('Auto trade is not found');
                throw new UnknownError('Auto trade is not found');
            }
            const autoTradeSellId = event.autoTrades?.[0].sellId;
            const autoTradeSell = autoTradeSellId
                ? autoTradeMap.get(autoTradeSellId) || null
                : null;
            const tokenUsdPrice = tokenUsdPricesMap.get(event.tokenMint);
            if (!tokenUsdPrice) {
                this.logger.error('Token usd price is not found');
                throw new UnknownError('Token usd price is not found');
            }
            return toAutomaticStrategyUnsoldEventDto(event, autoTradeBuy, autoTradeSell, tokenUsdPrice, solUsdPrice, this.logger);
        });
        return { events: eventsDto };
    }
}
