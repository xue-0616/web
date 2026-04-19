import { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, In, Repository } from 'typeorm';
import { Wallet } from '../wallet/entities/wallet.entity';
import { TradingOrder } from '../trading/entities/tradingOrder.entity';
import { TokenService } from '../token/token.service';
import { MessageNotifierService } from '../message-notifier/message-notifier.service';
import { TokenPrice } from '../../infrastructure/clickhouse/clickhouse.service';
type NativeTransfer = any;
type TokenTransfer = any;
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { InjectPinoLogger } from 'nestjs-pino';
import { web3 } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { Queue, Worker } from 'bullmq';
import Decimal from 'decimal.js';
import { UnknownError } from '../../error';

const QUEUE = `{${process.env.NODE_ENV?.toUpperCase() || 'DEV'}_DEXAUTO_TRANSFER_SYNCER_QUEUE}`;
const NATIVE_SOL_SYMBOL = 'Sol';
const USD_PRECISION = 8;
@Injectable()
export class TransferSyncerService implements OnModuleDestroy {
    private logger: PinoLogger;
    private walletRepository: Repository<Wallet>;
    private tradingOrderRepository: Repository<TradingOrder>;
    private tokenService: TokenService;
    private redisClient: Redis;
    private messageNotifyService: MessageNotifierService;
    private dataSource: DataSource;
    private queue: Queue;
    public wallets: Map<string, Wallet> | undefined;
    private worker: Worker | undefined;
    private queueFunc: ((addresses: string[]) => Promise<void>) | undefined;

    constructor(
        @InjectPinoLogger(TransferSyncerService.name) logger: PinoLogger,
        @InjectRepository(Wallet) walletRepository: Repository<Wallet>,
        @InjectRepository(TradingOrder) tradingOrderRepository: Repository<TradingOrder>,
        tokenService: TokenService,
        @Inject('REDIS_CLIENT') redisClient: Redis,
        messageNotifyService: MessageNotifierService,
        @InjectDataSource() dataSource: DataSource,
    ) {
        this.logger = logger;
        this.walletRepository = walletRepository;
        this.tradingOrderRepository = tradingOrderRepository;
        this.tokenService = tokenService;
        this.redisClient = redisClient;
        this.messageNotifyService = messageNotifyService;
        this.dataSource = dataSource;
        this.queue = new Queue(QUEUE, {
            connection: this.redisClient,
        });
    }
    /** Maximum number of retry attempts for wallet initialization before giving up. */
    private static readonly MAX_INIT_RETRIES = 60;

    async initWallets(): Promise<void> {
        let times = 0;
        while (times < TransferSyncerService.MAX_INIT_RETRIES) {
            try {
                if (!this.wallets) {
                    const wallets = await this.walletRepository.find({
                        where: {
                            isActive: true,
                        },
                    });
                    this.wallets = new Map(wallets.map((wallet) => [
                        new web3.PublicKey(wallet.address).toBase58(),
                        wallet,
                    ]));
                }
                break;
            }
            catch (error) {
                times++;
                if (times % 10 === 0) {
                    this.logger.error(`init wallets failed (attempt ${times}/${TransferSyncerService.MAX_INIT_RETRIES}): ${(error as Error).message}`);
                }
                if (times >= TransferSyncerService.MAX_INIT_RETRIES) {
                    this.logger.error(`init wallets failed after ${TransferSyncerService.MAX_INIT_RETRIES} attempts, giving up`);
                    throw new Error(`init wallets failed after ${TransferSyncerService.MAX_INIT_RETRIES} attempts`);
                }
                await new Promise((resolve) => setTimeout(resolve, 30000));
            }
        }
        this.logger.info(`init wallets success`);
    }
    async initQueue(queueFunc: any) {
        this.queueFunc = queueFunc;
        while (true) {
            try {
                if (!this.worker) {
                    this.worker = new Worker(QUEUE, async (job) => {
                        const wallets = await this.walletRepository.find({
                            where: {
                                id: In(job.data),
                            },
                        });
                        for (const wallet of wallets) {
                            this.wallets?.set(new web3.PublicKey(wallet.address).toBase58(), wallet);
                        }
                        const walletAddresses = wallets.map((wallet) => new web3.PublicKey(wallet.address).toBase58());
                        await this.queueFunc?.(walletAddresses);
                    }, { connection: this.redisClient, removeOnComplete: { count: 1000 } });
                    this.worker.on('completed', (job) => {
                        this.logger.info(`Job ${job.id} completed`);
                    });
                    this.worker.on('failed', (job, err) => {
                        this.logger.error(`Job ${job?.id} failed: ${(err as Error)}`);
                    });
                    this.worker.on('error', (err) => {
                        this.logger.error(`Worker error: ${(err as Error)}`);
                    });
                }
                const isRunning = this.worker.isRunning();
                if (!isRunning) {
                    await this.worker.run();
                }
                break;
            }
            catch (error) {
                this.logger.error(`init queue failed: ${(error as Error).message}`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
        this.logger.info(`init queue success`);
    }
    async onModuleDestroy(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
        }
        this.logger.info('Transfer syncer service destroyed');
    }
    /**
     * Validate that a transfer object has the required numeric fields.
     * Returns false if any field is missing or not a valid number.
     */
    private isValidTransferAmount(transfer: any): boolean {
        if (transfer.amount === undefined || transfer.amount === null ||
            transfer.raw_amount === undefined || transfer.raw_amount === null) {
            return false;
        }
        // Verify amount is a valid number (string or number)
        const amount = Number(transfer.amount);
        if (isNaN(amount)) return false;
        // Verify raw_amount can be parsed as a bigint-like string
        try {
            BigInt(String(transfer.raw_amount).replace(/\.\d+$/, ''));
        } catch {
            return false;
        }
        return true;
    }

    async syncNativeTransfers(nativeTransfers: any, solPrice: any): Promise<void> {
        for (const transfer of nativeTransfers) {
            try {
                if (transfer.is_inner_instruction === 'true') {
                    continue;
                }
                // SY-6: Validate transfer data types before arithmetic operations
                if (!transfer.tx_id || typeof transfer.tx_id !== 'string') {
                    this.logger.error('syncNativeTransfers: invalid transfer — missing or invalid tx_id');
                    continue;
                }
                if (!this.isValidTransferAmount(transfer)) {
                    this.logger.error(`syncNativeTransfers: invalid transfer amounts for tx ${transfer.tx_id}`);
                    continue;
                }
                if (!transfer.block_time || isNaN(Number(transfer.block_time))) {
                    this.logger.error(`syncNativeTransfers: invalid block_time for tx ${transfer.tx_id}`);
                    continue;
                }
                const tx = await this.tradingOrderRepository.findOne({
                    where: {
                        txId: Buffer.from(bs58.decode(transfer.tx_id)),
                    },
                });
                if (tx) {
                    continue;
                }
                const wallet = this.wallets?.get(transfer.source);
                if (wallet) {
                    const now = new Date();
                    const confirmedTime = new Date(Number(transfer.block_time) * 1000);
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    await queryRunner.startTransaction();
                    let newWallet;
                    let order;
                    const usdAmount = solPrice.latestPrice.mul(transfer.amount);
                    try {
                        const dbWallet = await queryRunner.manager.findOne(Wallet, {
                            where: {
                                id: wallet.id,
                            },
                            lock: { mode: 'pessimistic_write' },
                        });
                        if (!dbWallet) {
                            throw new Error(`Wallet ${wallet.id} not found`);
                        }
                        newWallet = dbWallet;
                        newWallet.withdrawTxsCount = (BigInt(newWallet.withdrawTxsCount) + 1n).toString();
                        newWallet.totalWithdrawAmountUsd = new Decimal(newWallet.totalWithdrawAmountUsd)
                            .add(usdAmount)
                            .toFixed(USD_PRECISION);
                        newWallet.transferTxsCount = (BigInt(newWallet.transferTxsCount) + 1n).toString();
                        newWallet.updatedAt = now;
                        order = TradingOrder.createNativeWithdrawOrder({
                            txId: transfer.tx_id,
                            userId: wallet.userId,
                            walletId: wallet.id,
                            walletAddress: wallet.address,
                            tokenNormalizedAmount: transfer.amount,
                            tokenAmount: transfer.raw_amount,
                            usdAmount: usdAmount,
                            confirmedTime,
                        });
                        await queryRunner.manager.save(order);
                        await queryRunner.manager.save(newWallet);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw error;
                    }
                    finally {
                        await queryRunner.release();
                    }
                    this.wallets?.set(new web3.PublicKey(newWallet.address).toBase58(), newWallet);
                    await this.messageNotifyService.notifyNativeWithdraw(wallet, new Decimal(transfer.amount));
                }
                else {
                    const wallet = this.wallets?.get(transfer.destination);
                    if (wallet) {
                        const now = new Date();
                        const confirmedTime = new Date(Number(transfer.block_time) * 1000);
                        const queryRunner = this.dataSource.createQueryRunner();
                        await queryRunner.connect();
                        await queryRunner.startTransaction();
                        let newWallet;
                        let order;
                        const usdAmount = solPrice.latestPrice.mul(transfer.amount);
                        try {
                            const dbWallet = await queryRunner.manager.findOne(Wallet, {
                                where: {
                                    id: wallet.id,
                                },
                                lock: { mode: 'pessimistic_write' },
                            });
                            if (!dbWallet) {
                                throw new Error(`Wallet ${wallet.id} not found`);
                            }
                            newWallet = dbWallet;
                            newWallet.depositTxsCount = (BigInt(newWallet.depositTxsCount) + 1n).toString();
                            newWallet.totalDepositAmountUsd = new Decimal(newWallet.totalDepositAmountUsd)
                                .add(usdAmount)
                                .toFixed(USD_PRECISION);
                            newWallet.transferTxsCount = (BigInt(newWallet.transferTxsCount) + 1n).toString();
                            newWallet.updatedAt = now;
                            order = TradingOrder.createNativeDepositOrder({
                                txId: transfer.tx_id,
                                userId: wallet.userId,
                                walletId: wallet.id,
                                walletAddress: wallet.address,
                                tokenNormalizedAmount: transfer.amount,
                                tokenAmount: transfer.raw_amount,
                                usdAmount: usdAmount,
                                confirmedTime,
                            });
                            await queryRunner.manager.save(order);
                            await queryRunner.manager.save(newWallet);
                            await queryRunner.commitTransaction();
                        }
                        catch (error) {
                            await queryRunner.rollbackTransaction();
                            throw error;
                        }
                        finally {
                            await queryRunner.release();
                        }
                        this.wallets?.set(new web3.PublicKey(newWallet.address).toBase58(), newWallet);
                        await this.messageNotifyService.notifyNativeDeposit(wallet, new Decimal(transfer.amount));
                    }
                }
            }
            catch (error) {
                this.logger.error(`syncNativeTransfers failed: ${(error as Error).message}`);
            }
        }
    }
    async syncTokenTransfers(tokenTransfers: any, tokenPricesMap: any): Promise<void> {
        for (const transfer of tokenTransfers) {
            try {
                if (transfer.is_inner_instruction === 'true') {
                    continue;
                }
                // SY-6: Validate transfer data types before arithmetic operations
                if (!transfer.tx_id || typeof transfer.tx_id !== 'string') {
                    this.logger.error('syncTokenTransfers: invalid transfer — missing or invalid tx_id');
                    continue;
                }
                if (!this.isValidTransferAmount(transfer)) {
                    this.logger.error(`syncTokenTransfers: invalid transfer amounts for tx ${transfer.tx_id}`);
                    continue;
                }
                if (!transfer.block_time || isNaN(Number(transfer.block_time))) {
                    this.logger.error(`syncTokenTransfers: invalid block_time for tx ${transfer.tx_id}`);
                    continue;
                }
                if (!transfer.token_mint || typeof transfer.token_mint !== 'string') {
                    this.logger.error(`syncTokenTransfers: missing token_mint for tx ${transfer.tx_id}`);
                    continue;
                }
                const tx = await this.tradingOrderRepository.findOne({
                    where: {
                        txId: Buffer.from(bs58.decode(transfer.tx_id)),
                    },
                });
                if (tx) {
                    continue;
                }
                const wallet = this.wallets?.get(transfer.source_authority);
                if (wallet) {
                    const tokenInfo = await this.tokenService.findByMintAddress(transfer.token_mint);
                    if (!tokenInfo) {
                        continue;
                    }
                    const now = new Date();
                    const confirmedTime = new Date(Number(transfer.block_time) * 1000);
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    await queryRunner.startTransaction();
                    let newWallet;
                    const tokenPrice = tokenPricesMap.get(transfer.token_mint);
                    if (!tokenPrice) {
                        throw new UnknownError('Cannot get token price');
                    }
                    const usdAmount = tokenPrice.latestPrice.mul(transfer.amount);
                    let order;
                    try {
                        const dbWallet = await queryRunner.manager.findOne(Wallet, {
                            where: {
                                id: wallet.id,
                            },
                            lock: { mode: 'pessimistic_write' },
                        });
                        if (!dbWallet) {
                            throw new Error(`Wallet ${wallet.id} not found`);
                        }
                        newWallet = dbWallet;
                        newWallet.withdrawTxsCount = (BigInt(newWallet.withdrawTxsCount) + 1n).toString();
                        newWallet.totalWithdrawAmountUsd = new Decimal(newWallet.totalWithdrawAmountUsd)
                            .add(usdAmount)
                            .toFixed(USD_PRECISION);
                        newWallet.transferTxsCount = (BigInt(newWallet.transferTxsCount) + 1n).toString();
                        newWallet.updatedAt = now;
                        order = TradingOrder.createTokenWithdrawOrder({
                            txId: transfer.tx_id,
                            userId: wallet.userId,
                            walletId: wallet.id,
                            walletAddress: wallet.address,
                            tokenNormalizedAmount: transfer.amount,
                            tokenAmount: transfer.raw_amount,
                            usdAmount: usdAmount,
                            confirmedTime,
                            tokenMint: transfer.token_mint,
                            tokenSymbol: tokenInfo.symbol,
                        });
                        await queryRunner.manager.save(order);
                        await queryRunner.manager.save(newWallet);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw error;
                    }
                    finally {
                        await queryRunner.release();
                    }
                    this.wallets?.set(new web3.PublicKey(newWallet.address).toBase58(), newWallet);
                    await this.messageNotifyService.notifyTokenWithdraw(wallet, tokenInfo.symbol, new Decimal(transfer.amount));
                }
                else {
                    const wallet = this.wallets?.get(transfer.destination_authority);
                    if (wallet) {
                        const tokenInfo = await this.tokenService.findByMintAddress(transfer.token_mint);
                        if (!tokenInfo) {
                            continue;
                        }
                        const tokenPrice = tokenPricesMap.get(transfer.token_mint);
                        if (!tokenPrice) {
                            throw new UnknownError('Cannot get token price');
                        }
                        const usdAmount = tokenPrice.latestPrice.mul(transfer.amount);
                        const now = new Date();
                        const confirmedTime = new Date(Number(transfer.block_time) * 1000);
                        const queryRunner = this.dataSource.createQueryRunner();
                        await queryRunner.connect();
                        await queryRunner.startTransaction();
                        let newWallet;
                        let order;
                        try {
                            const dbWallet = await queryRunner.manager.findOne(Wallet, {
                                where: {
                                    id: wallet.id,
                                },
                                lock: { mode: 'pessimistic_write' },
                            });
                            if (!dbWallet) {
                                throw new Error(`Wallet ${wallet.id} not found`);
                            }
                            newWallet = dbWallet;
                            newWallet.depositTxsCount = (BigInt(newWallet.depositTxsCount) + 1n).toString();
                            newWallet.totalDepositAmountUsd = new Decimal(newWallet.totalDepositAmountUsd)
                                .add(usdAmount)
                                .toFixed(USD_PRECISION)
                                .toString();
                            newWallet.transferTxsCount = (BigInt(newWallet.transferTxsCount) + 1n).toString();
                            newWallet.updatedAt = now;
                            order = TradingOrder.createTokenDepositOrder({
                                txId: transfer.tx_id,
                                userId: wallet.userId,
                                walletId: wallet.id,
                                walletAddress: wallet.address,
                                tokenNormalizedAmount: transfer.amount,
                                tokenAmount: transfer.raw_amount,
                                usdAmount: usdAmount,
                                confirmedTime,
                                tokenMint: transfer.token_mint,
                                tokenSymbol: tokenInfo.symbol,
                            });
                            await queryRunner.manager.save(order);
                            await queryRunner.manager.save(newWallet);
                            await queryRunner.commitTransaction();
                        }
                        catch (error) {
                            await queryRunner.rollbackTransaction();
                            throw error;
                        }
                        finally {
                            await queryRunner.release();
                        }
                        this.wallets?.set(new web3.PublicKey(newWallet.address).toBase58(), newWallet);
                        await this.messageNotifyService.notifyTokenDeposit(wallet, tokenInfo.symbol, new Decimal(transfer.amount));
                    }
                }
            }
            catch (error) {
                this.logger.error(`syncTokenTransfers failed: ${(error as Error).message}`);
            }
        }
    }
    async addAccount(walletIds: any): Promise<void> {
        try {
            await this.queue.add(QUEUE, walletIds);
        }
        catch (error) {
            this.logger.error(`add account failed: ${error}`);
            throw new UnknownError(error);
        }
    }
}
