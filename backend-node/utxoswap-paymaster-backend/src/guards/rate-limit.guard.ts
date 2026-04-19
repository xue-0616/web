import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { OPEN_ACCESS } from '../common/utils/const.config';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip rate limiting for open-access endpoints
    const isOpenAccess = this.reflector.getAllAndOverride<boolean>(OPEN_ACCESS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOpenAccess) {
      return true;
    }

    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimitOptions) {
      return true; // No rate limit configured for this endpoint
    }

    const { limit, windowSeconds } = rateLimitOptions;
    const request = context.switchToHttp().getRequest();
    const clientIdentifier = this.getClientIdentifier(request);
    const handler = context.getHandler().name;
    const redisKey = `ratelimit:${handler}:${clientIdentifier}`;

    try {
      const current = await this.redis.incr(redisKey);

      if (current === 1) {
        // First request in the window, set TTL
        await this.redis.expire(redisKey, windowSeconds);
      }

      if (current > limit) {
        const ttl = await this.redis.ttl(redisKey);
        this.logger.warn(
          `Rate limit exceeded for ${clientIdentifier} on ${handler}: ${current}/${limit} (resets in ${ttl}s)`,
        );
        throw new HttpException(
          {
            code: 4290,
            message: `Rate limit exceeded. Maximum ${limit} requests per ${windowSeconds} seconds. Try again in ${ttl}s.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      // If Redis fails, allow the request but log the error
      this.logger.error(`Rate limit check failed: ${err}`);
      return true;
    }
  }

  private getClientIdentifier(request: any): string {
    // Use API key hash prefix if available (set by ApiKeyGuard), fallback to IP
    const apiKeyHash = request.apiKeyHashPrefix;
    const ip = request.ip || request._remoteAddress || 'unknown';

    if (apiKeyHash) {
      return `key:${apiKeyHash}`;
    }
    return `ip:${ip}`;
  }
}
