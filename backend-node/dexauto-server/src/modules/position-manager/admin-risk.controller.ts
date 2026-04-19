import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards, UnauthorizedException, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DailyLossCircuitBreakerService } from './daily-loss-circuit-breaker.service';

/**
 * Operator-only admin endpoints for risk control overrides.
 *
 * Auth: plain shared-secret header `x-admin-token` matched against the
 * `ADMIN_TOKEN` env var. Deliberately kept minimal — these endpoints are
 * expected to be exposed ONLY on internal networks behind the operator's VPN.
 *
 * Do NOT route these through the user-facing API gateway.
 */
@ApiTags('admin-risk')
@Controller('admin/risk')
export class AdminRiskController {
  constructor(
    private readonly dailyLoss: DailyLossCircuitBreakerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Inspect today's PnL and pause status for a user.
   */
  @Get('status')
  @ApiOperation({ summary: 'Get daily PnL + pause status for a user (admin only)' })
  async getStatus(
    @Query('userId') userId: string,
    @Headers('x-admin-token') token?: string,
  ): Promise<{ userId: string; todayPnlSol: number; isPaused: boolean }> {
    this.authorize(token);
    if (!userId) throw new BadRequestException('userId is required');
    const [todayPnlSol, isPaused] = await Promise.all([
      this.dailyLoss.getTodayPnlSol(userId),
      this.dailyLoss.isTradingPaused(userId),
    ]);
    return { userId, todayPnlSol, isPaused };
  }

  /**
   * Resume trading for a user whose daily-loss circuit breaker tripped.
   * Logs the reason for audit.
   */
  @Post('resume')
  @ApiOperation({ summary: 'Manually lift daily-loss circuit breaker (admin only)' })
  @ApiResponse({ status: 200, description: 'Trading resumed' })
  async resume(
    @Body() body: { userId: string; reason: string },
    @Headers('x-admin-token') token?: string,
  ): Promise<{ ok: boolean }> {
    this.authorize(token);
    if (!body?.userId || !body?.reason) {
      throw new BadRequestException('userId and reason are both required');
    }
    await this.dailyLoss.resumeTrading(body.userId, body.reason);
    return { ok: true };
  }

  private authorize(token?: string): void {
    const expected = this.configService.get<string>('ADMIN_TOKEN', '');
    if (!expected) {
      // Fail-safe: if admin token is not configured, refuse all requests so
      // the endpoint isn't accidentally open. Operator must explicitly set
      // ADMIN_TOKEN to activate these routes.
      throw new UnauthorizedException('Admin access disabled — ADMIN_TOKEN not configured');
    }
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid or missing x-admin-token header');
    }
  }
}
