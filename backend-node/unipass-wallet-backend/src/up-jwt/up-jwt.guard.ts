import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MSG } from '../shared/utils';

@Injectable()
export class UpJwtGuard extends AuthGuard('jwt') {
    constructor(logger: any, upJwtTokenService: any) {
        super();
        this.logger = logger;
        this.upJwtTokenService = upJwtTokenService;
        this.logger.setContext(UpJwtGuard.name);
    }
    logger: any;
    upJwtTokenService: any;
    async canActivate(context: any): Promise<boolean> {
            const request = context.switchToHttp().getRequest();
            const path = request.route.path;
            try {
                const accessToken = request.get(MSG.AUTHORIZATION);
                if (!accessToken) {
                    throw new UnauthorizedException(MSG.AC_TOKEN_NOT_FIND);
                }
                const token = accessToken.replace('Bearer ', '');
                const isValidAccessToken = this.upJwtTokenService.verifyToken(token, path);
                if (!isValidAccessToken) {
                    throw new UnauthorizedException(MSG.AC_TOKEN_EXPIRE);
                }
                return await this.activate(context);
            }
            catch (error) {
                const e = error as Error;
                this.logger.error(`[${e.message}] data = ${JSON.stringify({
                    path,
                })}`);
                return false;
            }
        }
    async activate(context: any): Promise<boolean> {
            return (await super.canActivate(context)) as boolean;
        }
}
