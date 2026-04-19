import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectPinoLogger } from 'nestjs-pino';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { UnauthorizedError } from '../../error';

@Injectable()
export class AuthGuard implements CanActivate {
    private jwtService: JwtService;
    private configService: ConfigService;
    private logger: PinoLogger;

    constructor(
        jwtService: JwtService,
        configService: ConfigService,
        @InjectPinoLogger(AuthGuard.name) logger: PinoLogger,
    ) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.logger = logger;
    }
    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            return await this.innerCanActivate(context);
        }
        catch (error) {
            this.logger.error(error);
            throw error;
        }
    }
    async innerCanActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
            throw new UnauthorizedError('expected token');
        }
        try {
            // Use getOrThrow — a missing jwtSecret must fail hard at startup rather
            // than silently let verifyAsync run with secret=undefined. Without this
            // guard a misconfigured deployment could produce unpredictable auth
            // outcomes across requests.
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.getOrThrow('jwtSecret'),
            });
            // Also validate the payload shape — a token signed with a different
            // payload schema (e.g. legacy `userId` instead of `sub`) would set
            // request.userId = undefined and silently pass downstream as "no user",
            // which several services coerce into a wildcard query. Reject instead.
            if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) {
                throw new UnauthorizedError('invalid token payload');
            }
            request['userId'] = payload.sub;
        }
        catch (error) {
            throw new UnauthorizedError('invalid or expired token');
        }
        return true;
    }
    extractTokenFromHeader(request: any) {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
