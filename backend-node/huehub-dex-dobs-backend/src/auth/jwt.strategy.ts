import { Injectable } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwt } from '../common/interface/jwt';
import { AppConfigService } from '../common/utils.service/app.config.services';
import { AppLoggerService } from '../common/utils.service/logger.service';
import { PassportStrategy } from '@nestjs/passport';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly appConfig: AppConfigService, private readonly logger: AppLoggerService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: appConfig.jwtConfig.secret,
        });
        this.logger.setContext(JwtStrategy.name);
    }
    async validate(payload: IJwt): Promise<IJwt> {
            return payload;
        }
}
