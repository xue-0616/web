export { WalletScorerModule } from './wallet-scorer.module';
export {
  WalletScorerService,
  WalletScore,
  WalletMetrics,
  WalletTier,
  TradingStyle,
  TIER_WEIGHTS,
} from './wallet-scorer.service';
export {
  AddressClusterService,
  WalletCluster,
  ClusterEvidence,
} from './address-cluster.service';
export {
  ExitLiquidityDetectorService,
  WalletBehaviorProfile,
  ExitLiquidityResult,
} from './exit-liquidity-detector';
export {
  WashTradeDetectorService,
  WashTradeAlert,
  DeduplicatedConsensus,
  ConsensusTx,
} from './wash-trade-detector';
export {
  KpiDashboardService,
  SystemKPI,
  MetricCounters,
} from './kpi-dashboard.service';
export {
  AIAgentDetectorService,
  AIAgentProfile,
  AIAgentSignal,
  AIAgentStats,
} from './ai-agent-detector.service';
