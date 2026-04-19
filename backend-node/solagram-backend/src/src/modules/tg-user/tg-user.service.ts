import { BadRequestException, Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { JwtService } from '@nestjs/jwt';
import { LoginOutputDto } from './dto/login.output.dto';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { LoginInputDto } from './dto/login.input.dto';
import { BotStatisticsService } from '../bot-statistics/bot-statistics.service';
import { MiniAppActionInputDto } from './dto/mini-app-action.input.dto';
import { AuthDataValidator, objectToAuthDataMap } from '@telegram-auth/server';
import { StatusName } from '../../common/utils/error.code';
import { FollowStatus, FollowType } from '../../database/entities/user-follows.entity';

@Injectable()
export class TgUserService {
    constructor(private readonly logger: AppLoggerService, private readonly jwtService: JwtService, private readonly appConfig: AppConfigService, private readonly botStatisticsService: BotStatisticsService) {
        this.logger.setContext(TgUserService.name);
        this.validator = new AuthDataValidator({
            botToken: this.appConfig.tgBotInfo.walletBotToken,
            inValidateDataAfter: 86400,
            throwIfEmptyData: true,
        });
    }
    private validator: any;
    async auth(input: LoginInputDto): Promise<LoginOutputDto> {
            let signData = null;
            if (input.receiver) {
                signData = {
                    ...input,
                    user: JSON.stringify(input.user),
                    receiver: JSON.stringify(input.receiver),
                };
            }
            else {
                signData = {
                    ...input,
                    user: JSON.stringify(input.user),
                };
            }
            if (input.chat) {
                signData = {
                    ...signData,
                    chat: JSON.stringify(input.chat),
                };
            }
            const authDataMap = objectToAuthDataMap(signData as Record<string, string | number>);
            try {
                await this.validator.validate(authDataMap);
            }
            catch (error) {
                this.logger.error(`auth ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.AuthError);
            }
            let userData = input.user;
            const payload = {
                telegram_id: userData.id,
                username: userData.username,
                avatar_url: userData.photo_url,
                sub: userData.id.toString(),
                name: userData.first_name,
                iss: 'https://telegram.com',
            };
            const jwt = this.jwtService.sign(payload);
            await this.botStatisticsService.updateUserFollowsData(userData.id, FollowType.WalletApp, FollowStatus.Following);
            return { jwt };
        }
    async recordMiniAppAction(input: MiniAppActionInputDto): Promise<void> {
            try {
                await this.botStatisticsService.updateBlinkAction(input);
            }
            catch (error) {
                this.logger.error(`[recordMiniAppAction] error ${(error as Error)?.stack}`);
            }
        }
}
