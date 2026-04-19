import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Admin-only guard. Protects operator-level endpoints (system-wide config
 * mutation, wallet scoring leaderboards, KPI metrics, daily-loss override)
 * using the `x-admin-token` header matched against the ADMIN_TOKEN env var.
 *
 * Fails closed: if ADMIN_TOKEN is not configured, ALL requests are refused.
 * This prevents accidentally leaving admin endpoints unprotected on a fresh
 * deployment where the operator forgot to set the secret.
 *
 * These endpoints MUST NOT be exposed on the public API gateway — put them
 * behind an internal VPN or IP allowlist in addition to this guard.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const token: string | undefined = request.headers['x-admin-token'];
        const expected = this.configService.get<string>('ADMIN_TOKEN', '');
        if (!expected) {
            throw new UnauthorizedException(
                'Admin access disabled — ADMIN_TOKEN not configured',
            );
        }
        if (!token || token !== expected) {
            throw new UnauthorizedException('Invalid or missing x-admin-token header');
        }
        return true;
    }
}
