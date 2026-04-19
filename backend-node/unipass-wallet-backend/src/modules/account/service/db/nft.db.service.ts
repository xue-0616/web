import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NFTCollectionEntity, NFTTokenEntity } from '../../entities';

@Injectable()
export class NFTDBService {
    constructor(logger: any, @InjectRepository(NFTTokenEntity) tokenRepository: any, @InjectRepository(NFTCollectionEntity) collectionRepository: any) {
        this.logger = logger;
        this.tokenRepository = tokenRepository;
        this.collectionRepository = collectionRepository;
        this.logger.setContext(NFTDBService.name);
    }
    logger: any;
    tokenRepository: any;
    collectionRepository: any;
    async saveCollectionsToDb(list: any) {
            for (const item of list) {
                try {
                    await this.insertOneCollection(item);
                }
                catch (_a) {
                    continue;
                }
            }
        }
    async findOneCollection(address: any) {
            const data = await this.collectionRepository.findOne({
                where: { address: address.toLocaleLowerCase() },
            });
            return data;
        }
    async insertOneCollection(data: any) {
            const dbInfo = await this.findOneCollection(data.address);
            if (dbInfo) {
                const update = {
                    imageUrl: data.imageUrl,
                    symbol: data.symbol,
                    name: data.name,
                };
                await this.collectionRepository.update(dbInfo.id, update);
                return;
            }
            const entity = new NFTCollectionEntity();
            entity.address = data.address.toLocaleLowerCase();
            entity.slug = data.slug;
            entity.symbol = data.symbol;
            entity.name = data.name;
            entity.imageUrl = data.imageUrl;
            entity.createdAt = data.createdAt;
            try {
                await this.collectionRepository.insert(entity);
            }
            catch (error) {
                this.logger.warn(`[insertDB] nft db ${error}, entry = ${JSON.stringify(entity)}`);
            }
        }
    async saveNFTokenDb(list: any) {
            for (const item of list) {
                try {
                    await this.insertOneNFT(item);
                }
                catch (_a) {
                    continue;
                }
            }
        }
    async findOneNFT(address: any, tokenId: any) {
            const data = await this.tokenRepository.findOne({
                where: { address: address.toLocaleLowerCase(), tokenId },
            });
            return data;
        }
    async insertOneNFT(data: any) {
            const { address, tokenId, imageUrl, imagOriginalUrl, name } = data;
            const dbInfo = await this.findOneNFT(address, tokenId);
            if (dbInfo) {
                const update = { imageUrl, imageOriginalUrl: imagOriginalUrl, name };
                await this.tokenRepository.update(dbInfo.id, update);
                return;
            }
            const entity = new NFTTokenEntity();
            entity.address = address.toLocaleLowerCase();
            entity.tokenId = tokenId;
            entity.name = name;
            entity.imageUrl = imageUrl;
            entity.imageOriginalUrl = imagOriginalUrl;
            entity.createdAt = new Date();
            try {
                await this.tokenRepository.insert(entity);
            }
            catch (error) {
                this.logger.warn(`[insertDB] nft db ${error}, entry = ${JSON.stringify(entity)}`);
            }
        }
}
