import { Injectable } from '@nestjs/common';

@Injectable()
export class UpJwtTokenService {
    constructor(jwtService: any, apiConfig: any, logger: any) {
        this.jwtService = jwtService;
        this.apiConfig = apiConfig;
        this.logger = logger;
        this.logger.setContext(UpJwtTokenService.name);
    }
    jwtService: any;
    apiConfig: any;
    logger: any;
    createToken(payload: any, expiresIn: any) {
            const authorization = this.jwtService.sign(payload, {
                expiresIn: expiresIn
                    ? expiresIn
                    : this.apiConfig.jwtConfig.signOptions.expiresIn,
            });
            return { authorization };
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
