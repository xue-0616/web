import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { UserAuthResponseDto, UserInfoDto, UserLoginResponseDto, getUserInfoDto } from './dto/response.dto';
import { WalletService } from '../wallet/wallet.service';
import { AuthService } from '../auth/auth.service';
import { TradingService } from '../trading/trading.service';
import { ConfigService } from '@nestjs/config';
import { TransferSyncerService } from '../transfer-syncer/transfer-syncer.service';
import * as locale from 'locale-codes';
import { getByTag } from 'locale-codes';
import { PinoLogger } from 'nestjs-pino';
import { Chain } from '../../common/genericChain';
import { AutomaticStrategyService } from '../automatic-strategy/automatic-strategy.service';
import { v7 } from 'uuid';
import { LoginMessage } from './common/loginMessage';
import { BadRequestException, UnknownError } from '../../error';
import { GenericContractAddress } from '../../common/genericContractAddress';
import { TradingClient } from '../../common/tradingClient';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { createHash } from 'crypto';

// Whitelist loaded from ADDRESS_WHITE_LIST env var (comma-separated) or config.
// Defaults to empty if not provided.
function loadAddressWhiteList(): string[] {
    const envList = process.env.ADDRESS_WHITE_LIST;
    if (envList) {
        return envList.split(',').map((addr) => addr.trim()).filter((addr) => addr.length > 0);
    }
    return [];
}
export const ADDRESS_WHITE_LIST: string[] = loadAddressWhiteList();
@Injectable()
export class UserService {
    private userRepository: Repository<User>;
    private dataSource: DataSource;
    private walletService: WalletService;
    private authService: AuthService;
    private tradingService: TradingService;
    private transferSyncerService: TransferSyncerService;
    private automaticStrategyService: AutomaticStrategyService;
    private logger: PinoLogger;
    private configService!: ConfigService;
    private tradingClient: TradingClient;
    private redisClient: Redis;

    constructor(
        @InjectRepository(User) userRepository: Repository<User>,
        dataSource: DataSource,
        walletService: WalletService,
        authService: AuthService,
        @Inject(forwardRef(() => TradingService)) tradingService: TradingService,
        transferSyncerService: TransferSyncerService,
        @Inject(forwardRef(() => AutomaticStrategyService)) automaticStrategyService: AutomaticStrategyService,
        @InjectPinoLogger(UserService.name) logger: PinoLogger,
        configService: ConfigService,
        @Inject('REDIS_CLIENT') redisClient: Redis,
    ) {
        this.userRepository = userRepository;
        this.dataSource = dataSource;
        this.walletService = walletService;
        this.authService = authService;
        this.tradingService = tradingService;
        this.transferSyncerService = transferSyncerService;
        this.automaticStrategyService = automaticStrategyService;
        this.logger = logger;
        this.tradingClient = new TradingClient(configService.getOrThrow('tradingServerUrl'));
        this.redisClient = redisClient;
    }
    /**
     * Reject a login message/signature that has already been used.
     *
     * LoginMessage.validate enforces a ≤1h signing window, but during that
     * window the same (message, signature) pair could otherwise be replayed
     * by anyone who intercepts it (e.g. leaked from client-side logs, a
     * compromised proxy, or a malicious browser extension) to mint a fresh
     * 30-day JWT. Using SET NX + PEXPIRE we reserve a Redis slot keyed by the
     * hash of `message||sig`; if the slot already exists we reject the login.
     *
     * The TTL is set to the remaining lifetime of the login message plus a
     * small margin, which bounds memory usage while still covering the entire
     * replay window.
     */
    private async assertLoginNotReplayed(
        message: string,
        sig: string,
        expirationTime: Date,
    ): Promise<void> {
        const digest = createHash('sha256')
            .update(message)
            .update('|')
            .update(sig)
            .digest('hex');
        const env = (process.env.NODE_ENV || 'DEV').toUpperCase();
        const key = `${env}:DEXAUTO:LOGIN_NONCE:${digest}`;
        // Margin beyond expirationTime to defend against clock skew between
        // web nodes when the expiration is very close to now.
        const ttlMs = Math.max(
            60_000,
            expirationTime.getTime() - Date.now() + 60_000,
        );
        const ok = await this.redisClient.set(key, '1', 'PX', ttlMs, 'NX');
        if (ok !== 'OK') {
            throw new BadRequestException('login message already used');
        }
    }
    async login(dto: any): Promise<UserLoginResponseDto> {
        const { message, signature: sig } = dto;
        const loginMsg = LoginMessage.parse(message);
        loginMsg.validate(sig);
        // Replay protection — must happen AFTER signature validation so an
        // attacker cannot burn nonces by submitting random messages, and
        // BEFORE any DB writes / JWT issuance.
        await this.assertLoginNotReplayed(message, sig, loginMsg.expirationTime);
        let user = await this.getUserByBoundAddr(loginMsg.addr.chain, loginMsg.addr.addressBuffer());
        let solanaWallets = [];
        let evmWallets = [];
        if (user === null) {
            const now = new Date();
            user = this.userRepository.create({
                id: v7(),
                boundAddr: loginMsg.addr.addressBuffer(),
                boundChain: loginMsg.addr.chain,
                createdAt: now,
                updatedAt: now,
            });
            const walletIndex = 1;
            let contractWallet;
            try {
                contractWallet = await GenericContractAddress.fromApi(this.tradingClient, loginMsg.addr, walletIndex);
            }
            catch (error) {
                this.logger.error(`Failed to create contract wallet: ${error}`);
                throw new UnknownError('Failed to create contract wallet');
            }
            let strategies;
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                user = await queryRunner.manager.save(user);
                const userSolanaWallet = await this.walletService.createUserWalletByWalletIndex(user.id, walletIndex, contractWallet, true, undefined, queryRunner);
                await this.tradingService.createDefault(user.id, queryRunner);
                strategies =
                    await this.automaticStrategyService.createDefaultAutomaticStrategy(user.id, queryRunner);
                await queryRunner.commitTransaction();
                solanaWallets.push(userSolanaWallet);
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
                this.logger.error(`create user failed: ${error}`);
                throw error;
            }
            finally {
                await queryRunner.release();
            }
            this.automaticStrategyService.addStrategies(strategies.map((strategy) => strategy.id));
            this.transferSyncerService.addAccount(solanaWallets.map((wallet) => wallet.id));
        }
        else {
            const wallets = await this.walletService.getUserWallets(user.id);
            solanaWallets = wallets.solanaWallets;
            evmWallets = wallets.evmWallets;
        }
        const accessToken = await this.authService.generateJwt(user.id);
        return {
            user: getUserInfoDto(user, evmWallets, solanaWallets),
            accessToken,
        };
    }
    async userInfo(userId: any): Promise<UserInfoDto> {
        const [user, { solanaWallets, evmWallets }] = await Promise.all([
            this.getUserById(userId),
            this.walletService.getUserWallets(userId),
        ]);
        if (user === null) {
            throw new BadRequestException('invalid user id');
        }
        return getUserInfoDto(user, evmWallets, solanaWallets);
    }
    async updateLanguage(userId: any, language: any): Promise<UserInfoDto> {
        const languageCode = getByTag(language);
        if (!languageCode) {
            throw new BadRequestException('invalid language code');
        }
        let [user, { solanaWallets, evmWallets }] = await Promise.all([
            this.getUserById(userId),
            this.walletService.getUserWallets(userId),
        ]);
        if (user === null) {
            throw new BadRequestException('invalid user id');
        }
        user = await this.updateLanguageDao(user, languageCode);
        return getUserInfoDto(user, evmWallets, solanaWallets);
    }
    async getUserById(id: any): Promise<User | null> {
        try {
            const user = await this.userRepository.findOneBy({ id });
            return user;
        }
        catch (error) {
            this.logger.error('get user by id failed');
            throw new UnknownError('get user failed');
        }
    }
    async getUserByBoundAddr(boundChain: any, boundAddr: any): Promise<User | null> {
        try {
            return this.userRepository.findOneBy({ boundChain, boundAddr });
        }
        catch (error) {
            this.logger.error('get user by bound addr failed');
            throw new UnknownError('get user failed');
        }
    }
    async updateLanguageDao(user: any, language: any): Promise<User> {
        user.language = language.tag;
        user.updatedAt = new Date();
        try {
            return await this.userRepository.save(user);
        }
        catch (error) {
            this.logger.error(`update user language failed: ${error}`);
            throw new UnknownError(error);
        }
    }
    async auth(userAddr: string): Promise<UserAuthResponseDto> {
        return { isWhiteList: ADDRESS_WHITE_LIST.includes(userAddr) };
    }
}
