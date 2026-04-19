import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';
import { getLogger } from '../logger/logger.helper';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
    logger!: Logger;
    getRequestResponse(context: ExecutionContext): {
        req: any;
        res: any;
    } {
            const gqlCtx = GqlExecutionContext.create(context);
            const ctx = gqlCtx.getContext();
            const ip = this.getTracker(ctx.req);
            const ua = this.getUserAgent(ctx.req);
            getLogger('access-logs').info(`ip = ${ip};user-agent = ${ua}`);
            return { req: ctx.req, res: ctx.res };
        }
    getTracker(req: any): any {
            const ip = req.ip;
            if (!ip.includes('127.0.0.1') && !ip.includes('::1')) {
                return ip;
            }
            return req.headers['x-real-ip'];
        }
    getUserAgent(req: any): string {
            return req.headers['user-agent'];
        }
}
