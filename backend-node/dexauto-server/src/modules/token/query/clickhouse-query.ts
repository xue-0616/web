export const BANNED_TOKENS = [
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
    'So11111111111111111111111111111111111111112',
];
export const getTrendingTokensQuery = `;
  SELECT DISTINCT ON (base_mint)
    base_mint as base_mint,
    pool_address as pool_address,
    sum(trade_count) as trade_count,
    sum(buy_count) as buy_count,
    sum(sell_count) as sell_count,
    argMax(base_vault_balance, time_interval) as base_vault_balance,
    argMax(quote_vault_balance, time_interval) as quote_vault_balance,
    argMax(close_price, time_interval) as latest_price,
    SUM(total_volume) as total_volume
  FROM trades_1m_stats
  WHERE time_interval >= (now() - {seconds: UInt32})
    AND quote_mint = 'So11111111111111111111111111111111111111112'
    AND base_mint NOT IN (${BANNED_TOKENS.map((token) => `'${token}'`).join(',')})
  GROUP BY base_mint, pool_address
  ORDER BY total_volume DESC
  LIMIT {limit:UInt32}
  OFFSET {offset:UInt32}
`;
export const getPoolInfoByMintQuery = `;
  SELECT
    trimRight(toString(pool_address)) as pool_address,
    base_mint,
    argMax(base_vault_balance, block_time) as base_vault_balance,
    argMax(quote_vault_balance, block_time) as quote_vault_balance,
    argMax(latest_price, block_time) as latest_price
  FROM mv_pool_prices
  WHERE quote_mint = 'So11111111111111111111111111111111111111112'
    AND base_mint = {mintAddress:String}
  GROUP BY pool_address, base_mint
  ORDER BY base_vault_balance DESC
  LIMIT 1
`;
export const getTokenTradesQuery = `;
  SELECT
    tx_id,
    trimRight(toString(signer)) as signer,
    base_amount,
    quote_amount,
    usd_value,
    abs(usd_value / base_amount) as usd_price,
    block_time
  FROM dex_trades
 WHERE quote_mint = 'So11111111111111111111111111111111111111112'
   AND trimRight(toString(base_mint)) = {mintAddress:String}
   AND trimRight(toString(pool_address)) = {poolAddress:String}
   AND block_time < {startTime:Int64}
 ORDER BY block_time DESC
 LIMIT {limit:UInt32}
OFFSET {offset:UInt32}
`;
export const getPoolInfoByMintAndPoolQuery = `;
  SELECT
    pool_address,
    base_mint,
    base_vault_balance,
    quote_vault_balance,
    latest_price
  FROM mv_pool_prices
  WHERE quote_mint = 'So11111111111111111111111111111111111111112'
    AND pool_address = {poolAddress:String}
    AND base_mint = {mintAddress:String}
  ORDER BY block_time DESC
  LIMIT 1
`;
export const getPoolInfoByPoolAddressesQuery = `;
  SELECT
    trimRight(toString(pool_address)) as pool_address,
    base_mint,
    argMax(base_vault_balance, block_time) as base_vault_balance,
    argMax(quote_vault_balance, block_time) as quote_vault_balance,
    argMax(latest_price, block_time) as latest_price
  FROM mv_pool_prices
  WHERE quote_mint = 'So11111111111111111111111111111111111111112'
    AND pool_address IN ({poolAddresses:Array(String)})
  GROUP BY pool_address, base_mint
  ORDER BY base_vault_balance DESC
`;
export const getPoolInfoByMintAddressesQuery = `;
  SELECT DISTINCT ON (base_mint)
    trimRight(toString(pool_address)) as pool_address,
    base_mint,
    argMax(base_vault_balance, block_time) as base_vault_balance,
    argMax(quote_vault_balance, block_time) as quote_vault_balance,
    argMax(latest_price, block_time) as latest_price
  FROM mv_pool_prices
  WHERE quote_mint = 'So11111111111111111111111111111111111111112'
    AND base_mint IN ({mintAddresses:Array(String)})
  GROUP BY pool_address, base_mint
  ORDER BY base_vault_balance DESC
`;
export const getPoolInfoByAddressQuery = `;
  SELECT DISTINCT ON (base_mint)
    base_mint as base_mint,
    pool_address as pool_address,
    argMax(base_vault_balance, time_interval) as base_vault_balance,
    argMax(quote_vault_balance, time_interval) as quote_vault_balance,
    argMax(close_price, time_interval) as latest_price,
    SUM(total_volume) as total_volume
  FROM trades_1d_stats
  WHERE time_interval >= (now() - 86400)
    AND (pool_address = {address:String} OR base_mint = {address:String})
    AND quote_mint = 'So11111111111111111111111111111111111111112'
  GROUP BY base_mint, pool_address
  ORDER BY total_volume DESC
  LIMIT {limit:UInt32}
`;
export const getPoolsInfoByMintQuery = `;
  SELECT DISTINCT ON (base_mint)
    base_mint as base_mint,
    pool_address as pool_address,
    argMax(base_vault_balance, time_interval) as base_vault_balance,
    argMax(quote_vault_balance, time_interval) as quote_vault_balance,
    argMax(close_price, time_interval) as latest_price,
    SUM(total_volume) as total_volume
  FROM trades_1d_stats
  WHERE time_interval >= (now() - 86400)
    AND base_mint in ({mints:Array(String)})
    AND quote_mint = 'So11111111111111111111111111111111111111112'
  GROUP BY base_mint, pool_address
  ORDER BY total_volume DESC
  LIMIT {limit:UInt32}
`;
export const getTokenHistoryPriceQuery = `;
  SELECT
    toUnixTimestamp(time_interval) as timestamp,
    open_price,
    high_price,
    low_price,
    close_price,
    total_volume as volume
  FROM {table:Identifier}
  WHERE base_mint = {mintAddress:String}
    AND pool_address = {poolAddress:String}
    AND time_interval >= {startTime:UInt64}
    AND time_interval <= {endTime:UInt64}
  ORDER BY time_interval ASC
`;
export const getTokenTradesWithPoolQuery = `;
  SELECT
    base_mint as base_mint,
    pool_address as pool_address,
    argMax(quote_vault_balance, time_interval) as quote_vault_balance,
    argMax(base_vault_balance, time_interval) as base_vault_balance,
    argMax(close_price, time_interval) as latest_price,
    argMaxIf(close_price, time_interval, time_interval <= (now() - 300)) as price_5m_ago,
    argMaxIf(close_price, time_interval, time_interval <= (now() - 3600)) as price_1h_ago,
    argMaxIf(close_price, time_interval, time_interval <= (now() - 21600)) as price_6h_ago,
    argMin(open_price, time_interval) as price_24h_ago,
    sumIf(total_volume, time_interval >= now() - 300) as volume_5m,
    sumIf(total_volume, time_interval >= now() - 3600) as volume_1h,
    sumIf(total_volume, time_interval >= now() - 21600) as volume_6h,
    SUM(total_volume) as volume_24h,
    sumIf(buy_volume, time_interval >= now() - 300) as buy_volume_5m,
    sumIf(buy_volume, time_interval >= now() - 3600) as buy_volume_1h,
    sumIf(buy_volume, time_interval >= now() - 21600) as buy_volume_6h,
    SUM(buy_volume) as buy_volume_24h,
    sumIf(sell_volume, time_interval >= now() - 300) as sell_volume_5m,
    sumIf(sell_volume, time_interval >= now() - 3600) as sell_volume_1h,
    sumIf(sell_volume, time_interval >= now() - 21600) as sell_volume_6h,
    SUM(sell_volume) as sell_volume_24h,
    sumIf(buy_count, time_interval >= (now() - 300)) as buy_count_5m,
    sumIf(buy_count, time_interval >= (now() - 3600)) as buy_count_1h,
    sumIf(buy_count, time_interval >= (now() - 21600)) as buy_count_6h,
    sum(buy_count) as buy_count_24h,
    SUM(trade_count) as trade_count_24h,
    sumIf(sell_count, time_interval >= (now() - 300)) as sell_count_5m,
    sumIf(sell_count, time_interval >= (now() - 3600)) as sell_count_1h,
    sumIf(sell_count, time_interval >= (now() - 2160000)) as sell_count_6h,
    SUM(sell_count) as sell_count_24h
  FROM trades_1m_stats
  WHERE time_interval >= (now() - 86400)
    AND quote_mint = 'So11111111111111111111111111111111111111112'
    AND pool_address = {poolAddress:String}
    AND base_mint = {mintAddress:String}
  GROUP BY base_mint, pool_address
`;
export const getTokenTradesInfoQuery = `;
  SELECT
    base_mint as base_mint,
    pool_address as pool_address,
    argMax(close_price, time_interval) as latest_price,
    argMax(base_vault_balance, time_interval) as base_vault_balance,
    argMax(quote_vault_balance, time_interval) as quote_vault_balance,
    argMaxIf(close_price, time_interval, time_interval <= (now() - 300)) as price_5m_ago,
    argMaxIf(close_price, time_interval, time_interval <= (now() - 3600)) as price_1h_ago,
    argMaxIf(close_price, time_interval, time_interval <= (now() - 21600)) as price_6h_ago,
    argMin(open_price, time_interval) as price_24h_ago,
    sumIf(total_volume, time_interval >= now() - 300) as volume_5m,
    sumIf(total_volume, time_interval >= now() - 3600) as volume_1h,
    sumIf(total_volume, time_interval >= now() - 21600) as volume_6h,
    SUM(total_volume) as volume_24h,
    sumIf(buy_volume, time_interval >= now() - 300) as buy_volume_5m,
    sumIf(buy_volume, time_interval >= now() - 3600) as buy_volume_1h,
    sumIf(buy_volume, time_interval >= now() - 21600) as buy_volume_6h,
    SUM(buy_volume) as buy_volume_24h,
    sumIf(sell_volume, time_interval >= now() - 300) as sell_volume_5m,
    sumIf(sell_volume, time_interval >= now() - 3600) as sell_volume_1h,
    sumIf(sell_volume, time_interval >= now() - 21600) as sell_volume_6h,
    SUM(sell_volume) as sell_volume_24h,
    sumIf(buy_count, time_interval >= (now() - 300)) as buy_count_5m,
    sumIf(buy_count, time_interval >= (now() - 3600)) as buy_count_1h,
    sumIf(buy_count, time_interval >= (now() - 21600)) as buy_count_6h,
    sum(buy_count) as buy_count_24h,
    SUM(trade_count) as trade_count_24h,
    sumIf(sell_count, time_interval >= (now() - 300)) as sell_count_5m,
    sumIf(sell_count, time_interval >= (now() - 3600)) as sell_count_1h,
    sumIf(sell_count, time_interval >= (now() - 2160000)) as sell_count_6h,
    SUM(sell_count) as sell_count_24h
  FROM trades_1m_stats
  WHERE time_interval >= (now() - 86400)
    AND quote_mint = 'So11111111111111111111111111111111111111112'
    AND base_mint = {mintAddress:String}
  GROUP BY base_mint, pool_address
  ORDER BY volume_24h DESC
  LIMIT 1
`;
export const getTokensTradesByMintsQuery = `;
  SELECT DISTINCT ON (base_mint)
    base_mint as base_mint,
    pool_address as pool_address,
    argMax(base_vault_balance, time_interval) as base_vault_balance,
    argMax(quote_vault_balance, time_interval) as quote_vault_balance,
    argMax(close_price, time_interval) as latest_price,
    argMaxIf(open_price, time_interval, time_interval <= (now() - 300)) as price_5m_ago,
    argMaxIf(open_price, time_interval, time_interval <= (now() - 3600)) as price_1h_ago,
    argMaxIf(open_price, time_interval, time_interval <= (now() - 21600)) as price_6h_ago,
    argMin(open_price, time_interval) as price_24h_ago,
    sumIf(total_volume, time_interval >= now() - 300) as volume_5m,
    sumIf(total_volume, time_interval >= now() - 3600) as volume_1h,
    sumIf(total_volume, time_interval >= now() - 21600) as volume_6h,
    SUM(total_volume) as volume_24h,
    sumIf(buy_count, time_interval >= (now() - 300)) as buy_count_5m,
    sumIf(buy_count, time_interval >= (now() - 3600)) as buy_count_1h,
    sumIf(buy_count, time_interval >= (now() - 21600)) as buy_count_6h,
    sum(buy_count) as buy_count_24h,
    sumIf(sell_count, time_interval >= (now() - 300)) as sell_count_5m,
    sumIf(sell_count, time_interval >= (now() - 3600)) as sell_count_1h,
    sumIf(sell_count, time_interval >= (now() - 21600)) as sell_count_6h,
    SUM(sell_count) as sell_count_24h
  FROM trades_1m_stats
  WHERE time_interval >= (now() - 86400)
    AND quote_mint = 'So11111111111111111111111111111111111111112'
    AND base_mint in ({mintAddresses:Array(String)})
  GROUP BY base_mint, pool_address
  ORDER BY volume_24h DESC
`;
export const getTokensTradesByPoolAddressesQuery = `;
  SELECT
    base_mint as base_mint,
    pool_address as pool_address,
    argMax(base_vault_balance, time_interval) as base_vault_balance,
    argMax(quote_vault_balance, time_interval) as quote_vault_balance,
    argMax(close_price, time_interval) as latest_price,
    argMaxIf(open_price, time_interval, time_interval <= (now() - 300)) as price_5m_ago,
    argMaxIf(open_price, time_interval, time_interval <= (now() - 3600)) as price_1h_ago,
    argMaxIf(open_price, time_interval, time_interval <= (now() - 21600)) as price_6h_ago,
    argMin(open_price, time_interval) as price_24h_ago,
    sumIf(total_volume, time_interval >= now() - 300) as volume_5m,
    sumIf(total_volume, time_interval >= now() - 3600) as volume_1h,
    sumIf(total_volume, time_interval >= now() - 21600) as volume_6h,
    SUM(total_volume) as volume_24h,
    sumIf(buy_count, time_interval >= (now() - 300)) as buy_count_5m,
    sumIf(buy_count, time_interval >= (now() - 3600)) as buy_count_1h,
    sumIf(buy_count, time_interval >= (now() - 21600)) as buy_count_6h,
    sum(buy_count) as buy_count_24h,
    sumIf(sell_count, time_interval >= (now() - 300)) as sell_count_5m,
    sumIf(sell_count, time_interval >= (now() - 3600)) as sell_count_1h,
    sumIf(sell_count, time_interval >= (now() - 21600)) as sell_count_6h,
    SUM(sell_count) as sell_count_24h
  FROM trades_1m_stats
  WHERE time_interval >= (now() - 86400)
    AND quote_mint = 'So11111111111111111111111111111111111111112'
    AND pool_address in ({poolAddresses:Array(String)})
  GROUP BY base_mint, pool_address
`;
export const getCreatedTimesQuery = `;
  SELECT
    pool_address as pool_address,
    block_time as createdTime
  FROM pool_created
  WHERE pool_address in ({poolAddresses:Array(String)})
`;
export const getSolPriceQuery = `;
  SELECT
    pool_address,
    base_mint,
    argMax(quote_vault_balance, block_time) as quote_vault_balance,
    argMax(base_vault_balance, block_time) as base_vault_balance,
    argMax(latest_price, block_time) as latest_price
  FROM mv_pool_prices
  WHERE base_mint = 'So11111111111111111111111111111111111111112'
    AND quote_mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  GROUP BY pool_address, base_mint
  ORDER BY base_vault_balance DESC
  LIMIT 1
`;
