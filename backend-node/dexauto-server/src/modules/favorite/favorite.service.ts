import { DataSource, Repository } from 'typeorm';
import { FavoriteDto } from './dto/favorite.dto';
import { Favorite } from './entities/favorite.entity';
import { TokenService } from '../token/token.service';
import { Chain } from '../../common/genericChain';
import { v7 } from 'uuid';
import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GenericAddress } from '../../common/genericAddress';
import bs58 from 'bs58';

@Injectable()
export class FavoriteService {
    private favoriteRepository: Repository<Favorite>;
    private dataSource: DataSource;
    private tokenService: TokenService;
    private logger: Logger;

    constructor(
        @InjectRepository(Favorite) favoriteRepository: Repository<Favorite>,
        dataSource: DataSource,
        @Inject(forwardRef(() => TokenService)) tokenService: TokenService,
    ) {
        this.favoriteRepository = favoriteRepository;
        this.dataSource = dataSource;
        this.tokenService = tokenService;
        this.logger = new Logger(FavoriteService.name);
    }

    /** Maximum number of favorites per user to prevent database bloat. */
    private static readonly MAX_FAVORITES_PER_USER = 500;

    async add(userId: string, favoriteDto: FavoriteDto): Promise<void> {
        // F-3: Enforce per-user favorites limit
        const currentCount = await this.favoriteRepository.count({ where: { userId } });
        if (currentCount >= FavoriteService.MAX_FAVORITES_PER_USER) {
            throw new BadRequestException(`Maximum favorites limit (${FavoriteService.MAX_FAVORITES_PER_USER}) reached`);
        }
        const poolAddr = new GenericAddress(favoriteDto.chain, favoriteDto.poolAddress);
        const existingFavorite = await this.favoriteRepository.findOne({
            where: {
                userId,
                poolAddress: poolAddr.addressBuffer(),
                chain: poolAddr.chain,
            },
        });
        if (existingFavorite) {
            throw new BadRequestException('already exists');
        }
        const softDeletedFavorite = await this.favoriteRepository.findOne({
            where: {
                userId,
                poolAddress: poolAddr.addressBuffer(),
                chain: poolAddr.chain,
            },
            withDeleted: true,
        });
        if (softDeletedFavorite && softDeletedFavorite.deletedAt) {
            await this.favoriteRepository.restore({
                userId,
                poolAddress: poolAddr.addressBuffer(),
                chain: poolAddr.chain,
            });
            return;
        }
        const now = new Date();
        const favorite = this.favoriteRepository.create({
            id: v7(),
            userId,
            poolAddress: poolAddr.addressBuffer(),
            chain: poolAddr.chain,
            createdAt: now,
            updatedAt: now,
        });
        await this.favoriteRepository.save(favorite);
    }

    async remove(userId: string, favoriteDto: FavoriteDto): Promise<void> {
        const poolAddr = new GenericAddress(favoriteDto.chain, favoriteDto.poolAddress);
        await this.favoriteRepository.softDelete({
            userId,
            poolAddress: poolAddr.addressBuffer(),
            chain: poolAddr.chain,
        });
    }

    async getAllFavorites(userId: string): Promise<any> {
        const result: Record<number, string[]> = {
            [Chain.Evm]: [] as string[],
            [Chain.Solana]: [] as string[],
        };
        try {
            const favorites = await this.favoriteRepository.find({
                where: { userId },
            });
            favorites.forEach((favorite) => {
                result[favorite.chain].push(bs58.encode(favorite.poolAddress));
            });
        } catch (error: any) {
            this.logger.error(`Get favorites for ${userId} failed, error: ${(error as Error).message}`);
        }
        return result;
    }

    async getFavoriteList(userId: string, chain: number): Promise<any> {
        try {
            const favorites = await this.favoriteRepository.find({
                where: { userId, chain },
            });
            const pools = favorites.map((favorite) => bs58.encode(favorite.poolAddress));
            const tokens = await this.tokenService.getTokensByPoolAddresses(pools);
            return tokens;
        } catch (error: any) {
            this.logger.error(`Failed to get favorite list: ${(error as Error).message}`);
            return [];
        }
    }
}
