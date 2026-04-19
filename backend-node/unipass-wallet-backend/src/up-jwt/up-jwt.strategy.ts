import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class UpJwtStrategy extends PassportStrategy(Strategy) {
    constructor(apiConfig: any, logger: any, accountsDBService: any, customAuthDbService: any) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: apiConfig.jwtConfig.secret,
        });
        this.apiConfig = apiConfig;
        this.logger = logger;
        this.accountsDBService = accountsDBService;
        this.customAuthDbService = customAuthDbService;
        this.logger.setContext(UpJwtStrategy.name);
    }
    apiConfig: any;
    logger: any;
    accountsDBService: any;
    customAuthDbService: any;
    async validate(payload: any) {
            const { provider, email, sub, appId, isToB } = payload;
            let user;
            user = await (isToB
                ? this.customAuthDbService.findOne(sub, appId)
                : this.accountsDBService.findOneInfo(email, provider));
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
