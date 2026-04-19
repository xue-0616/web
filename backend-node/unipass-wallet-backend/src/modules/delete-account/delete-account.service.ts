import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeletedAccountEntity } from './entities/deleted-accounts.entity';
import { getAddress, keccak256, isAddress } from 'ethers';
import { StatusName } from '../../shared/utils';

@Injectable()
export class DeleteAccountService {
    constructor(logger: any, apiConfigService: any, @InjectRepository(DeletedAccountEntity) deletedAccountRepository: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.deletedAccountRepository = deletedAccountRepository;
        logger.setContext(DeleteAccountService.name);
    }
    logger: any;
    apiConfigService: any;
    deletedAccountRepository: any;
    async findOne({ address, source }: any) {
            const deleteData = await this.deletedAccountRepository.findOne({
                where: {
                    address,
                    source: source.toLowerCase(),
                },
            });
            return deleteData;
        }
    async updateOrInsert(input: any, isDeleted: any) {
            const deleteData = await this.findOne(input);
            try {
                if (deleteData) {
                    if (deleteData.status !== isDeleted) {
                        deleteData.status = isDeleted;
                        deleteData.updatedAt = new Date();
                        await this.deletedAccountRepository.save(deleteData);
                    }
                }
                else {
                    const entity = new DeletedAccountEntity();
                    entity.status = isDeleted;
                    entity.address = input.address;
                    entity.source = input.source;
                    entity.updatedAt = new Date();
                    entity.createdAt = new Date();
                    await this.deletedAccountRepository.insert(entity);
                }
            }
            catch (error) {
                const e = error as Error;
                if (!e.message.includes('Duplicate entry')) {
                    this.logger.warn(`[updateOrInsert] ${e}`);
                    return !isDeleted;
                }
            }
            return isDeleted;
        }
    verifyHeader(req: any, source: any) {
            const headers = req.headers;
            const upAppKey = headers['up-app-key'];
            if (source.toLowerCase() !==
                this.apiConfigService.getThirdPartyApiConfig.loaAppName.toLowerCase()) {
                this.logger.warn('source not match ');
                throw new UnauthorizedException();
            }
            if (!upAppKey ||
                upAppKey !== this.apiConfigService.getThirdPartyApiConfig.loaAppId) {
                this.logger.warn('upAppKey not find or not match ');
                throw new UnauthorizedException();
            }
        }
    async deleteAccount(input: any, req: any) {
            const isRequestOk = this.checkRequestValidity(input, req);
            if (!isRequestOk) {
                return {
                    success: false,
                };
            }
            const isDeleted = await this.updateOrInsert(input, true);
            return {
                success: isDeleted,
            };
        }
    async isAccountDeleted(input: any, req: any) {
            const isRequestOk = this.checkRequestValidity(input, req);
            if (!isRequestOk) {
                return {
                    deleted: false,
                };
            }
            const deleteData = await this.findOne(input);
            const isDeleted = deleteData ? deleteData.status : false;
            return {
                deleted: isDeleted,
            };
        }
    checkRequestValidity(input: any, req: any) {
            this.verifyHeader(req, input.source);
            if (!isAddress(input.address)) {
                this.logger.warn(`[checkRequestValidity] address error ${input.address} `);
                throw new BadRequestException(StatusName.ADDRESS_ERROR);
            }
            return true;
        }
}
