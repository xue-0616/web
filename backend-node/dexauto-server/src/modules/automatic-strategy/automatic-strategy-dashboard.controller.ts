import { Controller, Get, Post, Body, UseGuards, Request, Param, Query, Optional, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AutomaticStrategyService } from './automatic-strategy.service';
import { KpiDashboardService, SystemKPI } from '../wallet-scorer/kpi-dashboard.service';
import { FundAllocatorService, FundAllocationConfig, FundStatus } from '../position-manager/fund-allocator';
import { EntryDeviationMonitorService, DeviationStats, DeviationRecord } from '../position-manager/entry-deviation-monitor';
import { PositionManagerService, PositionSummary } from '../position-manager/position-manager.service';
import { WalletScorerService } from '../wallet-scorer/wallet-scorer.service';
import { BacktestService, BacktestConfig } from './backtest/backtest.service';
import { StrategyConfigService, StrategyRiskConfig } from './strategy-config.service';
import { buildSuccessResponse } from '../../common/dto/response';

@ApiTags('Dashboard')
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(
    private readonly kpiDashboard: KpiDashboardService,
    private readonly fundAllocator: FundAllocatorService,
    private readonly deviationMonitor: EntryDeviationMonitorService,
    private readonly positionManager: PositionManagerService,
    private readonly walletScorer: WalletScorerService,
    @Inject(forwardRef(() => AutomaticStrategyService))
    private readonly automaticStrategyService: AutomaticStrategyService,
    @Optional() private readonly backtestService?: BacktestService,
    @Optional() private readonly strategyConfig?: StrategyConfigService,
  ) {}

  /**
   * Verify the given strategyId belongs to the authenticated user. Without
   * this check any logged-in user could read or overwrite risk configuration
   * for any other user's strategy simply by passing a different ID in the URL.
   */
  private async assertStrategyOwnership(userId: string, strategyId: string): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('missing user identity');
    }
    // getAutomaticStrategy already filters by userId and throws BadRequest
    // when the strategy doesn't exist or isn't owned by the user — reuse it
    // as our ownership check.
    await this.automaticStrategyService.getAutomaticStrategy(userId, strategyId);
  }

  // ── KPI Endpoints ─────────────────────────────────────────────────

  @Get('kpi/live')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getLiveKPI(): Promise<any> {
    return buildSuccessResponse(this.kpiDashboard.getLiveKPI());
  }

  @Get('kpi/history')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getKPIHistory(@Query('days') days?: string): Promise<any> {
    const d = parseInt(days || '30', 10);
    const history = await this.kpiDashboard.getKPIHistory(Math.min(d, 90));
    return buildSuccessResponse(history);
  }

  @Get('kpi/:date')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getKPIByDate(@Param('date') date: string): Promise<any> {
    const kpi = await this.kpiDashboard.getHistoricalKPI(date);
    return buildSuccessResponse(kpi);
  }

  // ── Fund Allocation Endpoints ─────────────────────────────────────

  @Get('fund/status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getFundStatus(@Request() req: any): Promise<any> {
    const status = await this.fundAllocator.getFundStatus(req.userId);
    return buildSuccessResponse(status);
  }

  @Get('fund/config')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getFundConfig(): Promise<any> {
    return buildSuccessResponse(this.fundAllocator.getConfig());
  }

  @Post('fund/config')
  @UseGuards(AdminGuard)
  // SECURITY: system-wide fund allocation config — admin only.
  // Previously guarded only by AuthGuard which let ANY logged-in user rewrite
  // the global fund allocation parameters for every trader on the platform.
  async updateFundConfig(@Body() body: Partial<FundAllocationConfig>): Promise<any> {
    this.fundAllocator.updateConfig(body);
    return buildSuccessResponse(this.fundAllocator.getConfig());
  }

  // ── Entry Deviation Endpoints ─────────────────────────────────────

  @Get('deviation/stats')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getDeviationStats(): Promise<any> {
    return buildSuccessResponse(this.deviationMonitor.getStats());
  }

  @Get('deviation/records')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getDeviationRecords(@Query('limit') limit?: string): Promise<any> {
    const l = parseInt(limit || '50', 10);
    return buildSuccessResponse(this.deviationMonitor.getRecentRecords(Math.min(l, 200)));
  }

  // ── Position Endpoints ────────────────────────────────────────────

  @Get('positions')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getOpenPositions(@Request() req: any): Promise<any> {
    const positions = await this.positionManager.getOpenPositions(req.userId);
    return buildSuccessResponse(positions);
  }

  @Get('positions/:tokenMint')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getPositionDetail(@Request() req: any, @Param('tokenMint') tokenMint: string): Promise<any> {
    const position = await this.positionManager.getPosition(req.userId, tokenMint);
    return buildSuccessResponse(position);
  }

  // ── Wallet Scorer Endpoints ───────────────────────────────────────

  @Get('wallets/tiers')
  @UseGuards(AdminGuard)
  // SECURITY: leaks proprietary wallet scoring + full smart-money leaderboard.
  // Restricted to admin — previously every authenticated user could exfiltrate
  // the entire scoring model output.
  async getWalletTiers(): Promise<any> {
    const scores = this.walletScorer.getAllScores();
    const tiers = { S: 0, A: 0, B: 0, C: 0 };
    const wallets: any[] = [];
    for (const [addr, score] of scores.entries()) {
      tiers[score.tier]++;
      wallets.push({
        address: addr,
        tier: score.tier,
        score: score.compositeScore,
        lastScored: new Date(score.lastScoredMs).toISOString(),
      });
    }
    wallets.sort((a, b) => b.score - a.score);
    return buildSuccessResponse({
      tiers,
      total: wallets.length,
      wallets: wallets.slice(0, 100),
    });
  }

  // ── Backtest Endpoints ────────────────────────────────────────────

  @Post('backtest/run')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async runBacktest(@Body() body: {
    config?: Partial<BacktestConfig>;
    smartMoneyAddresses?: string[];
  }): Promise<any> {
    if (!this.backtestService) {
      return buildSuccessResponse({ error: 'Backtest service not available' });
    }
    const result = await this.backtestService.runBacktest(
      body.config,
      body.smartMoneyAddresses,
    );
    return buildSuccessResponse(result);
  }

  // ── Strategy Config Endpoints ─────────────────────────────────────

  @Get('config/entry-deviation')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getDeviationConfig(): Promise<any> {
    return buildSuccessResponse({
      maxDeviationPct: 0.15,
      reduceThresholdPct: 0.05,
    });
  }

  @Post('config/entry-deviation')
  @UseGuards(AdminGuard)
  // SECURITY: system-wide deviation thresholds — admin only.
  // Any user could otherwise slam `maxDeviationPct` to 0 and block all copy
  // trades across the platform, or raise it to disable deviation protection.
  async updateDeviationConfig(@Body() body: {
    maxDeviationPct?: number;
    reduceThresholdPct?: number;
  }): Promise<any> {
    this.deviationMonitor.updateConfig(body);
    return buildSuccessResponse({ updated: true });
  }

  // ── Per-Strategy Risk Config ──────────────────────────────────────

  @Get('strategy-config/:strategyId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  // SECURITY: enforce strategy ownership. Previously any authenticated user
  // could read ANY user's risk configuration by guessing the strategy UUID.
  async getStrategyConfig(
    @Request() req: any,
    @Param('strategyId') strategyId: string,
  ): Promise<any> {
    await this.assertStrategyOwnership(req.userId, strategyId);
    if (!this.strategyConfig) {
      return buildSuccessResponse({});
    }
    const config = await this.strategyConfig.getConfig(strategyId);
    return buildSuccessResponse(config);
  }

  @Post('strategy-config/:strategyId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  // SECURITY: enforce strategy ownership. Without this check any authenticated
  // user could rewrite another user's stop-loss / position-sizing / circuit-
  // breaker config and effectively sabotage their trading.
  async updateStrategyConfig(
    @Request() req: any,
    @Param('strategyId') strategyId: string,
    @Body() body: Partial<StrategyRiskConfig>,
  ): Promise<any> {
    await this.assertStrategyOwnership(req.userId, strategyId);
    if (!this.strategyConfig) {
      return buildSuccessResponse({ error: 'Strategy config service not available' });
    }
    const config = await this.strategyConfig.updateConfig(strategyId, body);
    return buildSuccessResponse(config);
  }

  @Post('strategy-config/:strategyId/reset')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  // SECURITY: enforce strategy ownership — same reasoning as update/get above.
  async resetStrategyConfig(
    @Request() req: any,
    @Param('strategyId') strategyId: string,
  ): Promise<any> {
    await this.assertStrategyOwnership(req.userId, strategyId);
    if (!this.strategyConfig) {
      return buildSuccessResponse({ error: 'Strategy config service not available' });
    }
    await this.strategyConfig.resetConfig(strategyId);
    return buildSuccessResponse({ reset: true });
  }
}
