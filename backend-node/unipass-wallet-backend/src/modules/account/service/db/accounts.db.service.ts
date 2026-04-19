import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountStatus, AccountsEntity, ProviderType } from '../../entities';
import { StatusName, formatEmail } from '../../../../shared/utils';

@Injectable()
export class AccountsDBService {
    constructor(@InjectRepository(AccountsEntity) accountRepository: any, logger: any) {
        this.accountRepository = accountRepository;
        this.logger = logger;
        this.logger.setContext(AccountsDBService.name);
    }
    accountRepository: any;
    logger: any;
    async findOneAddress() {
            const data = await this.accountRepository.findOne();
            if (!data) {
                return '';
            }
            return data.address;
        }
    async findOneByAddress(address: any) {
            const data = await this.accountRepository.findOne({
                where: { address },
            });
            return data;
        }
    async getAccountIdByAddress(address: any) {
            const account = await this.findOneByAddress(address);
            if (!account) {
                this.logger.warn(`[getAccountIdByAddress] ${address} account not find `);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            return account.id;
        }
    async findAccountByEmail(email: any) {
            const data = await this.accountRepository.find({
                where: { email, status: AccountStatus.committed },
                select: ['address', 'email', 'status', 'provider'],
            });
            return data;
        }
    async updateEmailInLowerCase(account: any) {
            if (account.emailInLowerCase) {
                return;
            }
            const update = {
                emailInLowerCase: formatEmail(account.email).toLocaleLowerCase(),
            };
            await this.updateDB(account.id, update);
        }
    async insertDB(address: any, email: any, status: any = AccountStatus.pending, provider: any = ProviderType.google, sub: any, pepper: any, source: any = 'unipass') {
            const data = await this.findOneInfo(email, provider);
            this.logger.log(`[insertDB] params address:${address}  email:${email} status:${status}, provider:${provider}`);
            if (data) {
                await this.updateDB(data.id, {
                    address,
                    status,
                    pepper,
                    source,
                    updatedAt: new Date(),
                });
                return data.id;
            }
            const entity = new AccountsEntity();
            entity.address = address;
            entity.email = email;
            if (sub) {
                entity.sub = sub;
            }
            entity.provider = provider;
            entity.emailInLowerCase = formatEmail(email).toLocaleLowerCase();
            entity.status = status;
            entity.source = source;
            if (pepper) {
                entity.pepper = pepper;
            }
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            let accountId = 0;
            this.logger.log(`[insertDB]AccountsEntity = ${JSON.stringify(entity)} `);
            try {
                const dbData = await this.accountRepository.insert(entity);
                accountId = dbData.identifiers[0].id;
            }
            catch (error) {
                this.logger.warn(`[insertDB] ${error}, entry = ${JSON.stringify(entity)}`);
            }
            return accountId;
        }
    async updateDB(id: any, update: any) {
            await this.accountRepository.update(id, update);
        }
    async findOneInfo(email: any, provider: any) {
            const data = await this.accountRepository.findOne({
                where: { email, provider },
            });
            return data;
        }
    async updatePendingData(accountId: any, keysetHash: any) {
            const accountUpdate = {
                pendingKeysetHash: keysetHash,
                pendingCreatedAt: new Date(),
                updatedAt: new Date(),
            };
            await this.updateDB(accountId, accountUpdate);
        }
    async updateCancelPendingData(accountId: any) {
            const accountUpdate = {
                pendingKeysetHash: undefined,
                pendingCreatedAt: undefined,
                updatedAt: new Date(),
            };
            await this.updateDB(accountId, accountUpdate);
        }
    async updateCompletedRecoveryData(accountId: any, pendingKeysetHash: any) {
            const accountUpdate = {
                pendingKeysetHash: undefined,
                pendingCreatedAt: undefined,
                keysetHash: pendingKeysetHash,
                updatedAt: new Date(),
            };
            await this.updateDB(accountId, accountUpdate);
        }
}
