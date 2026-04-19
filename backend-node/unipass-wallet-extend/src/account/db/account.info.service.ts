import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountsEntity } from '../../entities/accounts.entity';
import { OriHashEntity } from '../../entities/ori.hash.entity';
import { Repository } from 'typeorm';
import { AccountService } from '../account.service';
import { getLogger } from '../../common/logger/logger.helper';

@Injectable()
export class AccountInfoService {
    constructor(@InjectRepository(AccountsEntity, 'mainnet') private readonly accountMainnetRepository: Repository<AccountsEntity>, @InjectRepository(OriHashEntity, 'mainnet') private readonly oriHashMainnetRepository: Repository<OriHashEntity>, @InjectRepository(AccountsEntity, 'testnet') private readonly accountTestnetRepository: Repository<AccountsEntity>, @InjectRepository(OriHashEntity, 'testnet') private readonly oriHashTestnetRepository: Repository<OriHashEntity>, private readonly accountService: AccountService) {
        this.logger = getLogger('api');
    }
    private logger: any;
    async findOneAccountKeysetJsonHashByAddress(address: string): Promise<string | undefined> {
            let isMainnet = true;
            let dbData = await this.accountMainnetRepository.findOne({
                where: { address, status: 2 },
            });
            if (!dbData) {
                isMainnet = false;
                dbData = await this.accountTestnetRepository.findOne({
                    where: { address, status: 2 },
                });
                if (!dbData) {
                    this.logger.warn(`[findOneAccountKeysetJsonHashByAddress] user not find`);
                    return undefined;
                }
            }
            this.logger.log(`[findOneAccountKeysetJsonHashByAddress] address:${address} isMainnet ${isMainnet}`);
            const keysetJson = await this.getKeyset(dbData.keysetHash, isMainnet);
            if (!keysetJson) {
                return undefined;
            }
            return keysetJson;
        }
    async getKeyset(keysetHash: string, isMainnet: boolean): Promise<string | undefined> {
            const oriHashData = isMainnet
                ? await this.oriHashMainnetRepository.findOne({
                    where: { hash: keysetHash },
                })
                : await this.oriHashTestnetRepository.findOne({
                    where: { hash: keysetHash },
                });
            if (!oriHashData) {
                return undefined;
            }
            const keyset = JSON.parse(oriHashData.raw);
            return keyset.keyset;
        }
}
