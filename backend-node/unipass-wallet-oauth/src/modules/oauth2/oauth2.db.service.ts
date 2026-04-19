// Recovered from dist/oauth2.db.service.js.map (source: ../../../src/modules/oauth2/oauth2.db.service.ts)
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { AppLoggerService } from '../../shared/services';
import { ClientInput } from './dto';
import { OAuth2ClientEntity } from './entities/oauth2.client.entity';
import { OAuth2EmailEntity } from './entities/oauth2.email.entity';

@Injectable()
export class OAuth2DBService {
    constructor(
        @InjectRepository(OAuth2ClientEntity)
        private readonly oAuth2ClientRepository: Repository<OAuth2ClientEntity>,
        @InjectRepository(OAuth2EmailEntity)
        private readonly oAuth2EmailEntityRepository: Repository<OAuth2EmailEntity>,
        private readonly logger: AppLoggerService,
    ) {}

    async findOne(clientId?: string): Promise<OAuth2ClientEntity | undefined> {
        if (!clientId) {
            return undefined;
        }
        return await this.oAuth2ClientRepository.findOne({ where: { clientId } });
    }

    async findOneOAuthEmail(where: Partial<OAuth2EmailEntity>, select?: (keyof OAuth2EmailEntity)[]): Promise<OAuth2EmailEntity | undefined> {
        return await this.oAuth2EmailEntityRepository.findOne({ where, select: select as any });
    }

    async updateDB(clientId: string, update: Partial<OAuth2ClientEntity>): Promise<void> {
        await this.oAuth2ClientRepository.update(clientId, update);
    }

    async updateDBOAuthEmail(id: number, update: Partial<OAuth2EmailEntity>): Promise<void> {
        await this.oAuth2EmailEntityRepository.update(id, update);
    }

    async insertDB(input: ClientInput): Promise<string> {
        const data = await this.findOne(input.clientId);
        if (data) {
            await this.updateDB(data.clientId, { ...input, updatedAt: new Date() } as any);
            return data.clientId;
        }
        const crypto = require('crypto');
        const entity = new OAuth2ClientEntity();
        entity.clientId = crypto.randomBytes(16).toString('hex');
        entity.clientSecret = crypto.randomBytes(32).toString('hex');
        entity.resourceIds = input.resourceIds;
        entity.emailTemplate = input.emailTemplate ?? '';
        entity.webServerRedirectUri = input.webServerRedirectUri ?? '';
        entity.createdAt = new Date();
        entity.updatedAt = new Date();
        try {
            await this.oAuth2ClientRepository.insert(entity);
        } catch (error) {
            this.logger.warn(`[insertDB] ${error}`);
        }
        return entity.clientId;
    }

    async insertDBOAuthEmail(input: { email: string; clientId: string; emailVerified: boolean }): Promise<void> {
        const authEmail = input.email.toLocaleLowerCase();
        const data = await this.findOneOAuthEmail({ clientId: input.clientId, email: authEmail });
        if (data) {
            await this.updateDBOAuthEmail(data.id, { emailVerified: input.emailVerified, updatedAt: new Date() });
            return;
        }
        const entity = new OAuth2EmailEntity();
        entity.clientId = input.clientId;
        entity.email = authEmail;
        entity.sub = uuidv5(`${authEmail}:${input.clientId}:${uuidv4()}`, uuidv5.DNS).replace(/-/g, '');
        entity.emailVerified = input.emailVerified;
        entity.createdAt = new Date();
        entity.updatedAt = new Date();
        try {
            await this.oAuth2EmailEntityRepository.insert(entity);
        } catch (error) {
            this.logger.warn(`[insertDBOAuthEmail] ${error}`);
        }
    }
}
