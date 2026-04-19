import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class UpJwtStrategy extends PassportStrategy(Strategy) {
    constructor(apiConfig: any, logger: any, customAuthDbService: any, customDbService: any) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: apiConfig.jwtConfig.secret,
        });
        this.apiConfig = apiConfig;
        this.logger = logger;
        this.customAuthDbService = customAuthDbService;
        this.customDbService = customDbService;
        this.logger.setContext(UpJwtStrategy.name);
    }
    apiConfig: any;
    logger: any;
    customAuthDbService: any;
    customDbService: any;
    async validate(payload: any) {
            const { sub, appId, isCustomer, provider } = payload;
            let user;
            user = isCustomer
                ? await this.customDbService.findOne({ sub, provider: provider })
                : await this.customAuthDbService.findOne(sub, appId);
            if (!user) {
                this.logger.warn(`token user not find data = ${JSON.stringify({
                    payload,
                })}`);
                throw new UnauthorizedException();
            }
            this.logger.log(`${JSON.stringify(user)}`);
            return user;
        }
}
