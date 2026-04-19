import { ExecutionContext, Injectable } from '@nestjs/common';
import { AppLoggerService } from '../common/utils-service/logger.service';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
    constructor(private readonly logger: AppLoggerService, private reflector: Reflector) {
        super();
        this.logger.setContext(JwtGuard.name);
    }
    async canActivate(context: ExecutionContext): Promise<boolean> {
            const request = context.switchToHttp().getRequest();
            const path = request.route.path;
            try {
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
    async activate(context: ExecutionContext): Promise<boolean> {
            return (await super.canActivate(context)) as boolean;
        }
    async filterPath(context: ExecutionContext, path: string): Promise<boolean> {
            return true;
        }
}
