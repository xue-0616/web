import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChainDto } from '../../common/dto/chain';
import { Chain } from '../../common/genericChain';
import { GenericContractAddress } from '../../common/genericContractAddress';
import { TokenService } from '../token/token.service';
import { User } from '../user/entities/user.entity';
import { WalletInfoDto, WalletOverviewDto } from './dto/response.dto';
import { Wallet } from './entities/wallet.entity';
import { TokenInfo } from '../token/entities/token-info.entity';
import { WalletOrderStatistic } from './entities/walletOrderStatistic.entity';
import { PinoLogger } from 'nestjs-pino';
import { v7 } from 'uuid';
import { web3 } from '@coral-xyz/anchor';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, unpackAccount } from '@solana/spl-token';
import { GenericAddress } from '../../common/genericAddress';
import { TradingClient } from '../../common/tradingClient';
import { BadRequestException, UnknownError } from '../../error';
import { DeleteWalletMessage } from './common/deleteWalletMessage';
import Decimal from 'decimal.js';
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger } from 'nestjs-pino';
import { In } from 'typeorm';
import { getChain, getChainDto } from '../../common/dto/chain';
import { getWalletInfo } from './dto/response.dto';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WSOL, isNullOrUndefined } from '../../common/utils';

const MAX_USER_WALLET_COUNT = 10;
const MAX_ALIAS_LEN = 16;
@Injectable()
export class WalletService {
    private walletRepository: Repository<Wallet>;
    private userRepository: Repository<User>;
    private walletOrderStatisticRepository: Repository<WalletOrderStatistic>;
    private logger: PinoLogger;
    private dataSource: DataSource;
    private tokenService: TokenService;
    private tradingClient: TradingClient;
    private solanaClient: any;

    constructor(
        @InjectRepository(Wallet) walletRepository: Repository<Wallet>,
        @InjectRepository(User) userRepository: Repository<User>,
        @InjectRepository(WalletOrderStatistic) walletOrderStatisticRepository: Repository<WalletOrderStatistic>,
        @InjectPinoLogger(WalletService.name) logger: PinoLogger,
        dataSource: DataSource,
        tokenService: TokenService,
        configService: ConfigService,
    ) {
        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
        this.walletOrderStatisticRepository = walletOrderStatisticRepository;
        this.logger = logger;
        this.dataSource = dataSource;
        this.tokenService = tokenService;
        this.tradingClient = new TradingClient(configService.getOrThrow('tradingServerUrl'));
        this.solanaClient = new web3.Connection(configService.getOrThrow('solanaRpcUrl'));
    }
    async getUserLatestWallet(userId: any, chain: any): Promise<Wallet> {
        let wallet = null;
        try {
            wallet = await this.walletRepository.findOne({
                where: {
                    userId: userId,
                    chain,
                },
                order: {
                    index: 'DESC',
                },
            });
        }
        catch (error) {
            this.logger.error(`get user latest wallet failed: ${error}`);
            throw new UnknownError(error);
        }
        if (wallet === null) {
            this.logger.error(`expected at least one wallet for user[${userId}]`);
            throw new UnknownError(`expected at least one wallet for user[${userId}]`);
        }
        return wallet;
    }
    async createUserWallet(user: any, chainDto: any, alias: any): Promise<WalletInfoDto> {
        if (chainDto === ChainDto.Evm) {
            this.logger.error('evm not supported');
            throw new BadRequestException('evm not supported');
        }
        const chain = getChain(chainDto);
        const [walletCount, latestWallet] = await Promise.all([
            this.getUserWalletsCount(user.id, chain),
            this.getUserLatestWallet(user.id, chain),
        ]);
        if (walletCount >= MAX_USER_WALLET_COUNT) {
            this.logger.error('wallet exceed limit');
            throw new BadRequestException('wallet exceed limit');
        }
        const newWalletIndex = latestWallet.index + 1;
        const newWallet = await GenericContractAddress.fromApi(this.tradingClient, new GenericAddress(user.boundChain, user.boundAddr), newWalletIndex);
        const wallet = await this.createUserWalletByWalletIndex(user.id, newWalletIndex, newWallet, false, alias);
        return wallet;
    }
    async createUserWalletByWalletIndex(userId: any, index: any, contractWallet: any, isDefault: any, alias: any, queryRunner?: any): Promise<WalletInfoDto> {
        const now = new Date();
        const address = contractWallet.address;
        let wallet = this.walletRepository.create({
            id: v7(),
            userId,
            index,
            chain: address.chain,
            address: contractWallet.address.addressBuffer(),
            opKey: contractWallet.opKeyAddress.addressBuffer(),
            isActive: true,
            isDefault,
            alias,
            createdAt: now,
            updatedAt: now,
        });
        if (queryRunner) {
            wallet = await queryRunner.manager.save(wallet);
        }
        else {
            wallet = await this.walletRepository.save(wallet);
        }
        return getWalletInfo(wallet);
    }
    async getUserWallet(userId: any, walletId: any): Promise<Wallet> {
        let wallet = null;
        try {
            wallet = await this.walletRepository.findOneBy({
                id: walletId,
                userId: userId,
                isActive: true,
            });
        }
        catch (error) {
            this.logger.error(`Cannot find wallet id ${walletId} for user ${userId}`);
            throw new UnknownError(error);
        }
        if (wallet === null) {
            this.logger.error('invalid wallet id');
            throw new BadRequestException('invalid wallet id');
        }
        return wallet;
    }
    async getUserWalletInfo(userId: any, walletId: any): Promise<WalletInfoDto> {
        const wallet = await this.getUserWallet(userId, walletId);
        return getWalletInfo(wallet);
    }
    async getUserWallets(userId: string): Promise<any> {
        let walletDaos = [];
        try {
            walletDaos = await this.walletRepository.find({
                where: { userId: userId, isActive: true },
                order: {
                    index: 'DESC',
                },
            });
        }
        catch (error) {
            this.logger.error(`Cannot find wallets for user ${userId}`);
            throw new UnknownError(error);
        }
        const wallets = walletDaos.map(getWalletInfo);
        return {
            solanaWallets: wallets.filter((wallet) => wallet.chain === ChainDto.Solana),
            evmWallets: wallets.filter((wallet) => wallet.chain === ChainDto.Evm),
        };
    }
    async getUserWalletsCount(userId: any, chain: any): Promise<number> {
        let count = 0;
        try {
            count = await this.walletRepository.countBy({
                userId: userId,
                chain,
                isActive: true,
            });
        }
        catch (error) {
            this.logger.error(`Cannot find wallets count for user ${userId}`);
            throw new UnknownError(error);
        }
        return count;
    }
    async deleteWallet(userId: any, walletId: any, msg: any, sig: any): Promise<void> {
        let wallet = null;
        let user = null;
        try {
            [wallet, user] = await Promise.all([
                this.walletRepository.findOneBy({
                    id: walletId,
                    userId: userId,
                    isActive: true,
                }),
                this.userRepository.findOneBy({
                    id: userId,
                }),
            ]);
        }
        catch (error) {
            this.logger.error(`Cannot find wallet id ${walletId} for user ${userId}`);
            throw new UnknownError(error);
        }
        if (wallet === null) {
            this.logger.error('invalid wallet id');
            throw new BadRequestException('invalid wallet id');
        }
        if (user === null) {
            this.logger.error('invalid user id');
            throw new BadRequestException('invalid user id');
        }
        if (wallet.isDefault) {
            this.logger.error('should not delete default wallet');
            throw new BadRequestException('should not delete default wallet');
        }
        const deleteWalletMessage = DeleteWalletMessage.parse(wallet.chain, msg);
        const walletAddress = new GenericAddress(wallet.chain, wallet.address);
        if (!deleteWalletMessage.addr.isEqual(walletAddress)) {
            this.logger.error('invalid wallet address');
            throw new BadRequestException('invalid wallet address');
        }
        const userAddr = new GenericAddress(user.boundChain, user.boundAddr);
        deleteWalletMessage.validate(userAddr, sig);
        if (wallet.isActive) {
            wallet.isActive = false;
            wallet.updatedAt = new Date();
            try {
                wallet = await this.walletRepository.save(wallet);
            }
            catch (error) {
                this.logger.error(`Cannot save wallet ${walletId} for user ${userId}`);
                throw new UnknownError(error);
            }
        }
        return;
    }
    async setWalletDefault(userId: any, walletId: any): Promise<WalletInfoDto> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            // Use pessimistic_write lock to prevent race conditions
            let wallet = await queryRunner.manager.findOne(Wallet, {
                where: {
                    id: walletId,
                    userId: userId,
                    isActive: true,
                },
                lock: { mode: 'pessimistic_write' },
            });
            if (wallet === null) {
                throw new BadRequestException('invalid wallet id');
            }
            if (wallet.isDefault) {
                await queryRunner.commitTransaction();
                return getWalletInfo(wallet);
            }
            let defaultWallet = await queryRunner.manager.findOne(Wallet, {
                where: {
                    userId,
                    chain: wallet.chain,
                    isDefault: true,
                },
                lock: { mode: 'pessimistic_write' },
            });
            if (defaultWallet === null) {
                this.logger.error(`expected default wallet for chain[${wallet.chain}], user id[${userId}]`);
                throw new UnknownError('expected default wallet');
            }
            const now = new Date();
            defaultWallet.isDefault = false;
            defaultWallet.updatedAt = now;
            defaultWallet = await queryRunner.manager.save(defaultWallet);
            wallet.isDefault = true;
            wallet.updatedAt = now;
            wallet = await queryRunner.manager.save(wallet);
            await queryRunner.commitTransaction();
            return getWalletInfo(wallet);
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof BadRequestException) throw error;
            this.logger.error(`set wallet default failed: ${error}`);
            throw new UnknownError(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async setWalletAlias(userId: any, walletId: any, alias: any): Promise<WalletInfoDto> {
        if (alias.length > MAX_ALIAS_LEN) {
            this.logger.error(`alias length should not greater than ${MAX_ALIAS_LEN}`);
            throw new BadRequestException(`alias length should not greater than ${MAX_ALIAS_LEN}`);
        }
        if (alias.length === 0) {
            this.logger.error('expected alias');
            throw new BadRequestException('expected alias');
        }
        const regex = /^[a-zA-Z0-9]+$/;
        if (!regex.test(alias)) {
            this.logger.error('invalid alias');
            throw new BadRequestException('invalid alias');
        }
        let wallet = null;
        try {
            wallet = await this.walletRepository.findOneBy({
                id: walletId,
                userId,
                isActive: true,
            });
        }
        catch (error) {
            this.logger.error(`Get wallet failed: ${error}`);
            throw new UnknownError(error);
        }
        if (wallet === null) {
            this.logger.error('invalid wallet id');
            throw new BadRequestException('invalid wallet id');
        }
        wallet.alias = alias;
        wallet.updatedAt = new Date();
        try {
            wallet = await this.walletRepository.save(wallet);
        }
        catch (error) {
            this.logger.error(`Save wallet failed: ${error}`);
            throw new UnknownError(error);
        }
        return getWalletInfo(wallet);
    }
    async getWalletOverview(userId: any, walletId: any): Promise<WalletOverviewDto> {
        const wallet = await this.getUserWallet(userId, walletId);
        switch (wallet.chain) {
            case Chain.Evm:
                this.logger.error('evm not supported');
                throw new BadRequestException('evm not supported');
            case Chain.Solana:
                const walletAddress = new web3.PublicKey(wallet.address);
                let nativeBalanceAmount, tokenAccounts, tokenAccounts_2022;
                try {
                    [nativeBalanceAmount, tokenAccounts, tokenAccounts_2022] = await Promise.all([
                        this.solanaClient.getBalance(walletAddress),
                        this.solanaClient.getTokenAccountsByOwner(walletAddress, {
                            programId: TOKEN_PROGRAM_ID,
                        }),
                        this.solanaClient.getTokenAccountsByOwner(new web3.PublicKey(wallet.address), { programId: TOKEN_2022_PROGRAM_ID }),
                    ]);
                } catch (error) {
                    this.logger.error(`Solana RPC call failed for wallet ${walletId}: ${error}`);
                    throw new UnknownError('failed to fetch wallet data from Solana');
                }
                const nativeBalance = new Decimal(nativeBalanceAmount.toString()).div(LAMPORTS_PER_SOL);
                const tokenAccountMap = tokenAccounts.value
                    .concat(tokenAccounts_2022.value)
                    .reduce((acc: any, tokenAccount: any) => {
                    let unpacked;
                    try {
                        unpacked = unpackAccount(tokenAccount.pubkey, tokenAccount.account, tokenAccount.account.owner);
                    }
                    catch (error) {
                        this.logger.error(`failed to unpack token account: ${error}, token account: ${JSON.stringify(tokenAccount)}`);
                        throw new UnknownError(error);
                    }
                    acc.set(unpacked.mint.toString(), unpacked);
                    return acc;
                }, new Map());
                const tokenAddresses: string[] = Array.from(tokenAccountMap.keys()) as string[];
                const [tokenPrices, tokenAccountsInfo, walletOrderStatistics] = await Promise.all([
                    this.tokenService._tokenPrices(tokenAddresses.concat([WSOL])),
                    this.tokenService.findByMintAddresses(tokenAddresses),
                    this.walletOrderStatisticRepository.findBy({
                        walletId: wallet.id,
                        tokenAddr: In(tokenAddresses.map((addr: string) => new web3.PublicKey(addr).toBuffer())),
                    }),
                ]);
                const tokenPricesMap = new Map();
                tokenPrices.forEach((price) => {
                    tokenPricesMap.set(price.baseMint, price);
                });
                const walletOrderStatisticsMap = walletOrderStatistics.reduce((acc, stat) => {
                    const mintAddress = new web3.PublicKey(stat.tokenAddr).toString();
                    acc.set(mintAddress, stat);
                    return acc;
                }, new Map());
                const tokenInfoMap = tokenAccountsInfo.reduce((acc, token) => {
                    acc.set(token.mintAddress, token);
                    return acc;
                }, new Map());
                const solPrice = tokenPricesMap.get(WSOL)?.latestPrice;
                if (isNullOrUndefined(solPrice)) {
                    this.logger.error('sol price not found');
                    throw new UnknownError('sol price not found');
                }
                const tokenAccountsData = tokenAccountsInfo
                    .map((tokenAccountInfo) => {
                    const tokenInfo = tokenInfoMap.get(tokenAccountInfo.mintAddress);
                    if (!tokenInfo) {
                        this.logger.error(`token info not found for mint address: ${tokenAccountInfo.mintAddress}`);
                        return null;
                    }
                    const tokenAccount = tokenAccountMap.get(tokenAccountInfo.mintAddress);
                    if (!tokenAccount) {
                        this.logger.error(`token account not found for mint address: ${tokenAccountInfo.mintAddress}`);
                        return null;
                    }
                    const tokenPrice = tokenPricesMap.get(tokenAccountInfo.mintAddress);
                    if (!tokenPrice) {
                        this.logger.error(`token price not found for mint address: ${tokenAccountInfo.mintAddress}`);
                        return null;
                    }
                    const balance = new Decimal(tokenAccount.amount.toString()).div(new Decimal(10).pow(tokenInfo.decimals));
                    const balanceUsd = balance.mul(tokenPrice.latestPrice);
                    const walletOrderStatistic = walletOrderStatisticsMap.get(tokenAccountInfo.mintAddress);
                    const buyPrice = walletOrderStatistic &&
                        !new Decimal(walletOrderStatistic.buyNormalizedAmount).eq(0)
                        ? new Decimal(walletOrderStatistic.buyAmountUsd).div(walletOrderStatistic.buyNormalizedAmount)
                        : new Decimal(0);
                    const unrealizedProfitUsd = new Decimal(tokenPrice.latestPrice)
                        .sub(buyPrice)
                        .mul(balance.toString());
                    return {
                        tokenAddress: tokenAccountInfo.mintAddress,
                        tokenAccount: tokenAccount.address.toString(),
                        tokenName: tokenInfo.name,
                        tokenSymbol: tokenInfo.symbol,
                        tokenDecimals: tokenInfo.decimals,
                        tokenIcon: tokenInfo.icon,
                        balance: balance.toString(),
                        rawBalance: tokenAccount.amount.toString(),
                        balanceUsd: balanceUsd.toString(),
                        unrealizedProfitUsd: unrealizedProfitUsd.toString(),
                    };
                })
                    .filter((tokenAccountData) => tokenAccountData !== null);
                const nativeBalanceUsd = new Decimal(nativeBalance.toString()).mul(solPrice);
                const unrealizedProfitUsd = tokenAccountsData.reduce((acc, tokenAccountData) => {
                    return acc.add(new Decimal(tokenAccountData.unrealizedProfitUsd));
                }, new Decimal(0));
                const totalBalanceUsd = tokenAccountsData
                    .reduce((acc, tokenAccountData) => {
                    return acc.add(tokenAccountData.balanceUsd);
                }, new Decimal(0))
                    .add(nativeBalanceUsd);
                return {
                    id: wallet.id,
                    index: wallet.index,
                    chain: getChainDto(wallet.chain),
                    chainIds: null,
                    address: walletAddress.toBase58(),
                    nativeBalance: nativeBalance.toFixed(),
                    nativeBalanceUsd: nativeBalanceUsd.toString(),
                    unrealizedProfitUsd: unrealizedProfitUsd.toString(),
                    realizedProfitUsd: wallet.realizedProfitUsd,
                    totalProfitUsd: unrealizedProfitUsd
                        .add(wallet.realizedProfitUsd)
                        .toString(),
                    totalBalanceUsd: totalBalanceUsd.toString(),
                    buyTxsCount: wallet.buyTxsCount,
                    sellTxsCount: wallet.sellTxsCount,
                    tradingTxCount: wallet.tradingTxCount,
                    totalBuyAmountUsd: wallet.totalBuyAmountUsd,
                    totalSellAmountUsd: wallet.totalSellAmountUsd,
                    depositTxCount: wallet.depositTxsCount,
                    withdrawTxCount: wallet.withdrawTxsCount,
                    transferTxCount: wallet.transferTxsCount,
                    totalDepositAmountUsd: wallet.totalDepositAmountUsd,
                    totalWithdrawAmountUsd: wallet.totalWithdrawAmountUsd,
                    tokenBalances: tokenAccountsData,
                };
        }
    }
    async holdings(userId: string): Promise<any> {
        const wallets = await this.walletRepository.find({
            where: { userId, chain: Chain.Solana, isActive: true },
        });
        let tokenMints = (await Promise.all(wallets.map(async (wallet) => {
            const walletAddress = new web3.PublicKey(wallet.address);
            const [tokenAccounts, tokenAccounts_2022] = await Promise.all([
                this.solanaClient.getTokenAccountsByOwner(walletAddress, {
                    programId: TOKEN_PROGRAM_ID,
                }),
                this.solanaClient.getTokenAccountsByOwner(new web3.PublicKey(wallet.address), { programId: TOKEN_2022_PROGRAM_ID }),
            ]);
            return tokenAccounts.value
                .concat(tokenAccounts_2022.value)
                .map((tokenAccount: any) => {
                let unpacked;
                try {
                    unpacked = unpackAccount(tokenAccount.pubkey, tokenAccount.account, tokenAccount.account.owner);
                }
                catch (error) {
                    this.logger.error(`failed to unpack token account: ${error}, token account: ${JSON.stringify(tokenAccount)}`);
                    throw new UnknownError(error);
                }
                return unpacked.mint.toBase58();
            });
        }))).flat();
        tokenMints = [...new Set(tokenMints)];
        return this.tokenService.getTokensByMintAddresses(tokenMints);
    }
}
