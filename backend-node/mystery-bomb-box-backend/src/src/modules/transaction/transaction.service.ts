import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TransactionEntity, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { DbService } from '../db/db.service';
import { MysteryBoxDbService } from '../db/mystery-boxs.service';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { GrabMysteryBoxDbService } from '../db/grab-mystery-boxs.service';
import { TransactionDbService } from '../db/transaction-db.service';
import { ActionInputDto, ActionParamInputDto } from './dto/action.input.dto';
import { ActionOutputDto } from './dto/action.output.dto';
import { GarbActionParamInputDto } from './dto/grab.action.input.dto';
import { Mutex } from 'async-mutex';
import { In } from 'typeorm';
import { decode, encode } from 'bs58';
import { sleep } from '../../common/utils/tools';
import { createMysteryBoxTransaction, grabMysteryBoxInstruction } from '../../common/utils/transaction';
import { createPostResponse } from '@solana/actions';
import { MysteryBoxStatus } from '../../database/entities/mystery-boxs.entity';
import { StatusName } from '../../common/utils/error.code';
import { validateBoxParams } from './validators';

@Injectable()
export class TransactionService implements OnModuleInit, OnModuleDestroy {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly dbService: DbService, private readonly mysteryBoxDbService: MysteryBoxDbService, private readonly grabMysteryBoxDbService: GrabMysteryBoxDbService, private readonly transactionDbService: TransactionDbService) {
        this.transactions = [];
        this.latestSuccessSignature = null;
        this.mutex = new Mutex();
        this.solanaClient = new Connection(appConfig.solanaRpcUrl);
        this.logger.setContext(TransactionService.name);
        // Rehearsal guard: without a valid base64-encoded 64-byte key
        // Keypair.fromSecretKey throws and the whole Nest boot dies.
        // When the key is missing, leave `submitter` null; any code
        // path that tries to sign will null-deref with a clear error,
        // while the rest of the service (reads, health probes) works.
        const rawKey = this.appConfig.submitterSecretKey;
        if (rawKey) {
            try {
                this.submitter = Keypair.fromSecretKey(Buffer.from(rawKey, 'base64'));
            }
            catch (e) {
                this.logger.warn(`[constructor] submitterSecretKey invalid (${(e as Error).message}) — signing disabled`);
                this.submitter = null;
            }
        }
        else {
            this.logger.warn('[constructor] submitterSecretKey missing — signing disabled');
            this.submitter = null;
        }
    }
    transactions: TransactionEntity[];
    latestSuccessSignature: string | null;
    private mutex: any;
    private submitter: any;
    solanaClient: Connection;
    // BUG-M7 (LOW) fix: flags that let watchTransactions co-operate
    // with NestJS's module-destroy lifecycle. Without these, SIGTERM
    // kills the process mid-iteration and any in-flight DB save can
    // commit partially.
    private shutdownRequested = false;
    private watchStopped = false;
    async onModuleInit(): Promise<void> {
            await this.init();
        }
    async onModuleDestroy(): Promise<void> {
            this.shutdownRequested = true;
            // Give the loop up to 5 s to observe the flag and exit
            // cleanly at a safe point (after a commit, before the
            // next iteration). Beyond that Nest will force-kill.
            const deadline = Date.now() + 5_000;
            while (!this.watchStopped && Date.now() < deadline) {
                await sleep(100);
            }
            this.logger.log(
                `[onModuleDestroy] watchTransactions stopped=${this.watchStopped}`,
            );
        }
    async init(): Promise<void> {
            const [transactions, latestSuccessTransaction] = await Promise.all([
                this.transactionDbService.find({
                    status: In([TransactionStatus.Pending, TransactionStatus.SentToChain]),
                }),
                this.transactionDbService.find({
                    status: TransactionStatus.Success,
                }, {
                    slot: 'DESC',
                    slotIndex: 'DESC',
                }, 1),
            ]);
            const release = await this.mutex.acquire();
            try {
                this.transactions = transactions;
                if (this.latestSuccessSignature === null) {
                    this.latestSuccessSignature = latestSuccessTransaction[0]
                        ? encode(new Uint8Array(latestSuccessTransaction[0].txSig ?? []))
                        : null;
                }
            }
            finally {
                release();
            }
            this.watchTransactions();
        }
    async addTransaction(transaction: TransactionEntity): Promise<void> {
            const release = await this.mutex.acquire();
            try {
                this.transactions.push(transaction);
            }
            finally {
                release();
            }
        }
    async watchTransactions(): Promise<void> {
            // BUG-M7 (LOW) fix: cooperative shutdown. The loop now
            // checks `shutdownRequested` between iterations and on
            // each chunk of the 300 s error back-off, so SIGTERM /
            // OnModuleDestroy can stop the poller without killing
            // Node mid-commit.
            this.watchStopped = false;
            while (!this.shutdownRequested) {
                try {
                    const blockHeight = await this.solanaClient.getBlockHeight('confirmed');
                    const signatures = await this.solanaClient.getSignaturesForAddress(this.submitter.publicKey, {
                        limit: 1000,
                        until: this.latestSuccessSignature ?? undefined,
                    }, 'confirmed');
                    if (signatures.length > 0) {
                        const transactions = await this.solanaClient.getTransactions(signatures.map((signature) => signature.signature), {
                            maxSupportedTransactionVersion: 0,
                            commitment: 'confirmed',
                        });
                        for (const transaction of transactions.reverse()) {
                            if (!transaction || !transaction.meta) {
                                continue;
                            }
                            if (transaction.meta.err) {
                                continue;
                            }
                            let logInfo: { type: 'create' | 'grab'; boxId: any; grabId?: any } | null = null;
                            (transaction.meta.logMessages ?? []).find((log) => {
                                const createBoxInfo = extractCreateBoxInfo(log);
                                if (createBoxInfo) {
                                    logInfo = { type: 'create', ...createBoxInfo };
                                    return true;
                                }
                                const grabBoxInfo = extractGrabBoxInfo(log);
                                if (grabBoxInfo) {
                                    logInfo = { type: 'grab', ...grabBoxInfo };
                                    return true;
                                }
                                return false;
                            });
                            if (logInfo) {
                                const info: { type: 'create' | 'grab'; boxId: any; grabId?: any } = logInfo;
                                const slot = await this.solanaClient.getBlock(transaction.slot, {
                                    commitment: 'confirmed',
                                    maxSupportedTransactionVersion: 0,
                                });
                                if (!slot) {
                                    continue;
                                }
                                switch (info.type) {
                                    case 'create': {
                                        await this.dbService.successCreateMysteryBox(info.boxId, BigInt(transaction.slot), slot, Buffer.from(decode(transaction.transaction.signatures[0])));
                                        break;
                                    }
                                    case 'grab':
                                        await this.dbService.successGrabMysteryBox(info.boxId, info.grabId, BigInt(transaction.slot), slot, Buffer.from(decode(transaction.transaction.signatures[0])));
                                        break;
                                }
                            }
                        }
                        const release = await this.mutex.acquire();
                        try {
                            this.latestSuccessSignature = signatures[0].signature;
                        }
                        finally {
                            release();
                        }
                    }
                    const timeoutTxs = this.transactions.filter((tx) => tx.txBlockHeight + 200n < blockHeight);
                    for (const tx of timeoutTxs) {
                        switch (tx.txOrderType) {
                            case TransactionType.CreateMysteryBox: {
                                await this.dbService.failCreateMysteryBox(tx.txOrderId, 'timeout', null);
                                break;
                            }
                            case TransactionType.GrabMysteryBox: {
                                await this.dbService.failGrabMysteryBox(tx.txOrderId, 'timeout', null);
                                break;
                            }
                            case TransactionType.DistributeMysteryBox: {
                                // BUG-M3 (HIGH) fix: previously this
                                // case was missing, so timed-out
                                // distribute txs left the box in
                                // DISTRIBUTE_PENDING forever and all
                                // user funds (grab amounts + box
                                // amount) stayed locked in the
                                // submitter account. Marking the box
                                // DISTRIBUTE_FAILED surfaces the
                                // incident for operator-led refund.
                                this.logger.warn(
                                    `[watchTransactions] Distribute tx timed out for box ${tx.txOrderId} (blockHeight=${blockHeight}, txBlockHeight=${tx.txBlockHeight}); marking DISTRIBUTE_FAILED`,
                                );
                                await this.dbService.failDistributeMysteryBox(tx.txOrderId, 'timeout', null);
                                break;
                            }
                        }
                        const release = await this.mutex.acquire();
                        try {
                            this.transactions = this.transactions.filter((t) => t.id !== tx.id);
                        }
                        finally {
                            release();
                        }
                    }
                    await sleep(1000);
                }
                catch (error) {
                    this.logger.error(String(error));
                    // BUG-M7: chunk the back-off so the shutdown flag
                    // is re-checked every 100 ms instead of blocking
                    // for a full 5 minutes.
                    const errorBackoffDeadline = Date.now() + 300_000;
                    while (!this.shutdownRequested && Date.now() < errorBackoffDeadline) {
                        await sleep(100);
                    }
                }
            }
            this.watchStopped = true;
            this.logger.log('[watchTransactions] loop exited (shutdown requested)');
        }
    async createMysteryBoxTransaction(param: ActionParamInputDto, input: ActionInputDto): Promise<ActionOutputDto> {
            const { bombNumber, amount } = param;
            const { account } = input;
            const publicKey = new PublicKey(account);
            // BUG-M1 / BUG-M5 hardening: reject malformed box parameters
            // before anything touches the DB. See validators.ts for full
            // rationale and test coverage.
            const totalBoxCount = Number(this.appConfig.actionInfo.totalBoxCount);
            const v = validateBoxParams(amount, bombNumber, totalBoxCount);
            if (!v.ok) {
                throw new BadRequestException(`${StatusName.ParameterException}: ${v.reason}`);
            }
            const bigIntAmount = v.lamports!;
            const mysteryBox = await this.mysteryBoxDbService.insert(publicKey, bigIntAmount, bombNumber, BigInt(this.appConfig.actionInfo.totalBoxCount));
            if (!mysteryBox) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            const tx = await createMysteryBoxTransaction(publicKey, mysteryBox.id, bigIntAmount, bombNumber, this.submitter, this.solanaClient);
            const { tx: txEntity } = await this.dbService.generateMysteryBox(mysteryBox, tx);
            await this.addTransaction(txEntity);
            const resp = (await createPostResponse({
                fields: {
                    type: 'transaction',
                    transaction: tx.tx,
                } as any,
            })) as any;
            const { transaction } = resp;
            return { transaction };
        }
    async grabMysteryBoxsTransaction(param: GarbActionParamInputDto, input: ActionInputDto): Promise<ActionOutputDto> {
            const { id } = param;
            const { account } = input;
            const publicKey = new PublicKey(account);
            const mysteryBox = await this.mysteryBoxDbService.findOne({
                id: BigInt(id),
                status: MysteryBoxStatus.GRABBING,
            });
            if (!mysteryBox) {
                this.logger.warn(`[grabMysteryBoxsTransaction] ${id} not match`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            // Capacity guard: refuse to mint more grab txs than the box allows.
            // Without this check concurrent grabbers can each pass the
            // status=GRABBING check and overcommit the payout pool.
            const openCount = BigInt((mysteryBox as any).openCount ?? 0);
            const openLimit = BigInt((mysteryBox as any).openLimit ?? 0);
            if (openLimit > 0n && openCount >= openLimit) {
                this.logger.warn(
                    `[grabMysteryBoxsTransaction] box ${id} already full: ${openCount}/${openLimit}`,
                );
                throw new BadRequestException(StatusName.ParameterException);
            }
            const grabAmount = (BigInt(mysteryBox.amount) * BigInt(18)) / BigInt(10);
            const garbMysteryBox = await this.grabMysteryBoxDbService.insert(mysteryBox.id, publicKey, grabAmount);
            if (!garbMysteryBox) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            const tx = await grabMysteryBoxInstruction(mysteryBox.id, garbMysteryBox.id, publicKey, grabAmount, this.submitter, this.solanaClient);
            const { tx: txEntity } = await this.dbService.generateGrabMysteryBox(tx, garbMysteryBox);
            await this.addTransaction(txEntity);
            const resp = (await createPostResponse({
                fields: {
                    type: 'transaction',
                    transaction: tx.tx,
                } as any,
            })) as any;
            const { transaction } = resp;
            return { transaction };
        }
}

export function extractCreateBoxInfo(input: string): any | null {
    const regex = /Program log: Memo \(len (\d+)\): \"(\d+): Create (\d+(?:\.\d{1,3})?) SOL box with bomb number ([0-9]) in bombfun\.com\"/;
    const match = input.match(regex);
    if (match) {
        return {
            type: 'create',
            boxId: BigInt(match[2]),
            boxAmount: parseFloat(match[3]),
            bombNumber: parseInt(match[4], 10),
        };
    }
    return null;
}

export function extractGrabBoxInfo(input: string): any | null {
    const regex = /Program log: Memo \(len (\d+)\): \"(\d+)-(\d+): \[([1-9A-HJ-NP-Za-km-z]{32,44})\] Open in bombfun\.com\"/;
    const match = input.match(regex);
    if (match) {
        return {
            type: 'grab',
            boxId: BigInt(match[2]),
            grabId: BigInt(match[3]),
            account: match[4],
        };
    }
    return null;
}
