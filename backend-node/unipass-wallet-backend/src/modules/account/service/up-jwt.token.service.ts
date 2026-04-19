import { Injectable } from '@nestjs/common';
import { TIME } from '../../../shared/utils';

@Injectable()
export class UpJwtTokenService {
    constructor(jwtService: any, apiConfig: any, logger: any, redisService: any) {
        this.jwtService = jwtService;
        this.apiConfig = apiConfig;
        this.logger = logger;
        this.redisService = redisService;
        this.logger.setContext(UpJwtTokenService.name);
    }
    jwtService: any;
    apiConfig: any;
    logger: any;
    redisService: any;
    createToken(payload: any, expiresIn?: any) {
            const authorization = this.jwtService.sign(payload, {
                expiresIn: expiresIn
                    ? expiresIn
                    : this.apiConfig.jwtConfig.signOptions.expiresIn,
            });
            return { authorization };
        }
    async createUpSignToken(email: any, provider: any, duration: any, sub: any) {
            const payload = {
                email,
                provider,
                sub,
            };
            const { authorization } = this.createToken(payload);
            const exp = duration ? `${duration}m` : `${TIME.HALF_HOUR}s`;
            const upSignPayload = {
                email,
                provider,
                isDisposable: duration ? false : true,
                isUpSignToken: true,
            };
            const { authorization: upSignToken } = this.createToken(upSignPayload, exp);
            if (upSignPayload.isDisposable) {
                await this.redisService.saveCacheData(`up_sign_token_${email}_${provider}`, upSignToken, TIME.HALF_HOUR);
            }
            return { authorization, upSignToken };
        }
    refreshToken(user: any) {
            const playload = {
                sub: user.sub,
                email: user.emailInLowerCase,
                provider: user.provider,
            };
            return this.createToken(playload);
        }
    verifyToken(token: any, path: any) {
            try {
                const data = this.jwtService.verify(token);
                return data;
            }
            catch (error) {
                try {
                    const data = this.jwtService.decode(token);
                    this.logger.warn(`${error}, data = ${JSON.stringify({ path, token, data })}`);
                }
                catch (_a) {
                    this.logger.warn(`${error}, data = ${JSON.stringify({
                        path,
                        token,
                        data: undefined,
                    })}`);
                }
                return undefined;
            }
        }
}
