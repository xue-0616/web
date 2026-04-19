/**
 * ClickHouse dex_trades TTL migration
 *
 * This migration adds a 180-day TTL to the dex_trades table in ClickHouse.
 * It must be executed directly against ClickHouse (not via TypeORM QueryRunner).
 *
 * Run manually:
 *   clickhouse-client --query "ALTER TABLE dex_trades MODIFY TTL block_time + INTERVAL 180 DAY"
 *
 * Why 180 days:
 * - The smart wallet discovery system only queries the last 30 days
 * - 180 days provides 6x buffer for historical analysis / backtesting
 * - Prevents unbounded disk growth from accumulating all DEX trades forever
 *
 * To verify after applying:
 *   clickhouse-client --query "SHOW CREATE TABLE dex_trades"
 *   -- Should include: TTL block_time + toIntervalDay(180)
 */

const CLICKHOUSE_TTL_SQL = `
ALTER TABLE dex_trades
  MODIFY TTL block_time + INTERVAL 180 DAY;
`;

export class DexTradesTTL1744600000000 {
  async up(): Promise<void> {
    console.log(
      '[DexTradesTTL] This migration must be run directly against ClickHouse:\n' +
        CLICKHOUSE_TTL_SQL,
    );
  }

  async down(): Promise<void> {
    console.log(
      '[DexTradesTTL] To remove TTL, run against ClickHouse:\n' +
        'ALTER TABLE dex_trades REMOVE TTL;',
    );
  }
}
