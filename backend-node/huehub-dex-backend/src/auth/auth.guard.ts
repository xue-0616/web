import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AppLoggerService } from '../common/utils-service/logger.service';
import { UserService } from '../modules/user/user.service';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JWT, OPEN_ACCESS } from '../common/utils/const.config';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
    constructor(private readonly logger: AppLoggerService, private readonly userService: UserService, private reflector: Reflector) {
        super();
        this.logger.setContext(JwtGuard.name);
    }
    async canActivate(context: ExecutionContext): Promise<boolean> {
            const request = context.switchToHttp().getRequest();
            const openAccess = this.reflector.get(OPEN_ACCESS, context.getHandler());
            if (openAccess) {
                return true;
            }
            const path = request.route.path;
            try {
                const accessToken = request.get(JWT.authorization);
                if (!accessToken) {
                    throw new UnauthorizedException(JWT.tokenNotFind);
                }
                const token = accessToken.replace('Bearer ', '');
                const isValidAccessToken = this.userService.verifyToken(token);
                if (!isValidAccessToken) {
                    throw new UnauthorizedException(JWT.tokenExp);
                }
                return await this.activate(context);
            }
            catch (error) {
                this.logger.error(`[${(error as Error).message}] data = ${JSON.stringify({
                    path,
                })}`);
                return false;
            }
        }
    async activate(context: ExecutionContext): Promise<boolean> {
            return (await super.canActivate(context)) as boolean;
        }
}
