import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OPEN_ACCESS } from '../common/utils/const.config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Allow endpoints marked with @OpenAccess() to bypass auth
    const isOpenAccess = this.reflector.getAllAndOverride<boolean>(OPEN_ACCESS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOpenAccess) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      this.logger.warn(
        `Rejected request without API key from IP: ${request.ip || request._remoteAddress}`,
      );
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const expectedKey = this.configService.get<string>('PAYMASTER_API_KEY');
    if (!expectedKey) {
      this.logger.error('PAYMASTER_API_KEY environment variable is not configured');
      throw new UnauthorizedException('Server authentication not configured');
    }

    if (!this.constantTimeEquals(apiKey, expectedKey)) {
      const keyPrefix = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex')
        .substring(0, 8);
      this.logger.warn(
        `Rejected invalid API key (hash prefix: ${keyPrefix}) from IP: ${request.ip || request._remoteAddress}`,
      );
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach API key hash prefix to request for audit logging
    request.apiKeyHashPrefix = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex')
      .substring(0, 8);

    return true;
  }

  private constantTimeEquals(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'utf-8');
      const bufB = Buffer.from(b, 'utf-8');

      if (bufA.length !== bufB.length) {
        // Still do a comparison to avoid timing leak on length difference
        const dummy = Buffer.alloc(bufA.length);
        crypto.timingSafeEqual(bufA, dummy);
        return false;
      }

      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}
