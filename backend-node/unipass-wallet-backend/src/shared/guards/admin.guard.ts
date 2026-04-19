import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Reusable guard for admin-only endpoints.
 *
 * Reads `x-admin-token` from the request header and compares it to
 * the `ADMIN_TOKEN` environment variable (constant-time compare via
 * Buffer).  If the env var is unset the guard always denies (fail-closed).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      // Fail closed: if no admin token is configured, deny all access.
      throw new ForbiddenException('Admin access is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-admin-token'];

    if (
      typeof provided !== 'string' ||
      provided.length !== expected.length ||
      !require('crypto').timingSafeEqual(
        Buffer.from(provided),
        Buffer.from(expected),
      )
    ) {
      throw new ForbiddenException('Invalid admin token');
    }

    return true;
  }
}
