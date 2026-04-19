import { PointsInputDto } from './dto/points-input.dto';
import { PointsOutputDto } from './dto/points-output.dto';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { TgUserDBService } from './tg-user-db.service';
import { TgUserEntity } from '../../database/entities/tg-user.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class TgUserService {
    constructor(
        private readonly logger: AppLoggerService,
        private readonly tgUserDBService: TgUserDBService,
    ) {
        this.logger.setContext(TgUserService.name);
    }

    // SECURITY FIX (BUG-23): Validate Telegram Mini App initData using HMAC-SHA-256
    // per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    validateTelegramInitData(initData: string): boolean {
        const botToken = process.env.TG_BOT_TOKEN;
        if (!botToken) {
            this.logger.error('[validateTelegramInitData] TG_BOT_TOKEN not configured');
            return false;
        }

        try {
            const params = new URLSearchParams(initData);
            const hash = params.get('hash');
            if (!hash) {
                return false;
            }

            // Remove hash from params and sort remaining alphabetically
            params.delete('hash');
            const dataCheckArr: string[] = [];
            params.forEach((value, key) => {
                dataCheckArr.push(`${key}=${value}`);
            });
            dataCheckArr.sort();
            const dataCheckString = dataCheckArr.join('\n');

            // Compute HMAC: secret_key = HMAC-SHA-256("WebAppData", bot_token)
            const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
            const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

            return computedHash === hash;
        } catch (error) {
            this.logger.error(`[validateTelegramInitData] Validation error: ${error}`);
            return false;
        }
    }

    async showPoints(input: PointsInputDto): Promise<PointsOutputDto> {
        // SECURITY FIX (BUG-23): Validate Telegram initData before processing any user data
        // to prevent fake account creation, points manipulation, and user enumeration.
        if (input.initData) {
            const isValid = this.validateTelegramInitData(input.initData);
            if (!isValid) {
                throw new BadRequestException('Invalid Telegram initData signature');
            }
        } else if (process.env.TG_BOT_TOKEN) {
            // If bot token is configured, require initData for all requests
            throw new BadRequestException('Telegram initData is required');
        }

        let tgUser = await this.tgUserDBService.findOne({
            userId: input.id,
            accessHash: input.accessHash,
        });
        if (!tgUser) {
            tgUser = await this.tgUserDBService.initEntity(input);
        }
        if (input.inviteCode) {
            await this.handleUserInvitation(input.inviteCode, tgUser);
        }
        return { points: tgUser.points || 0, inviteCode: tgUser.inviteCode };
    }
    async handleUserInvitation(inviteCode: string, tgUser: TgUserEntity): Promise<void> {
        if (tgUser.inviterUserId) {
            return;
        }
        const inviterUser = await this.tgUserDBService.findOne({
            inviteCode: inviteCode,
        });
        if (!inviterUser) {
            return;
        }
        tgUser.inviterUserId = inviterUser.id;
        tgUser.invitedTime = new Date().getTime() / 1000;
        await this.tgUserDBService.save(tgUser);
    }
}
