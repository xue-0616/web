# 全项目功能清单 — Complete Feature Inventory

> 基于所有 36 个子项目源码深度分析，按业务领域分类整理

---

## Category 1: DexAuto — Solana 自动交易系统 ⭐

### 1.1 dexauto-server (backend-node) — 策略引擎 + 数据分析

| # | 功能名称 | 描述 |
|---|---------|------|
| 1 | 用户登录/认证 (`user.controller`) | Telegram MiniApp OAuth 登录，JWT 令牌签发，语言偏好设置 |
| 2 | 钱包签名认证 (`user.controller /auth`) | 用户通过 Solana 钱包签名进行身份验证 |
| 3 | KMS 托管钱包 (`kms.module`) | 通过 AWS KMS 为每个用户生成独立 Solana 钱包，私钥加密存储 |
| 4 | 手动交易下单 (`trading.controller /order/create`) | 用户手动选择代币、金额、滑点创建买/卖订单 |
| 5 | 订单管理 (`trading.controller /orders, /order/detail, /order/cancel`) | 订单列表查询、详情查看、取消订单 |
| 6 | 交易策略管理 (`trading.controller /strategy/*`) | 创建、更新、删除手动交易策略模板 |
| 7 | 交易设置 (`trading.controller /settings`) | 配置 MEV 保护、滑点百分比、优先费、Jito 贿赂金额 |
| 8 | 自动跟单策略 (`automatic-strategy.controller`) | 创建/编辑自动跟单策略，监控 KOL 钱包地址（最多 300 个） |
| 9 | 跟单事件查询 (`automatic-strategy.controller /events`) | 查询自动跟单触发的买入事件记录 |
| 10 | 未卖出持仓事件 (`automatic-strategy.controller /unsold/events`) | 查询跟单买入但尚未卖出的持仓 |
| 11 | ChainFM 频道信息 (`automatic-strategy.controller /chainCM/channel`) | 获取 ChainFM 频道信息用于跟单信号源 |
| 12 | 策略回测 (`backtest.service / dashboard /backtest/run`) | 基于历史数据回测跟单策略效果 |
| 13 | 实时 KPI 仪表盘 (`dashboard.controller /kpi/*`) | 实时和历史 KPI 指标（盈亏率、胜率等） |
| 14 | 资金分配管理 (`dashboard.controller /fund/*`) | 查看和配置跟单资金分配策略 |
| 15 | 入场偏差监控 (`dashboard.controller /deviation/*`) | 监控跟单入场价与 KOL 入场价的偏差统计 |
| 16 | 持仓管理 (`dashboard.controller /positions`) | 查看当前所有持仓和单个代币持仓详情 |
| 17 | 钱包评分系统 (`wallet-scorer.service`) | 对监控的 KOL 钱包进行多维度评分（PnL/胜率/持仓时间/Rug参与度） |
| 18 | 钱包分层 (`dashboard.controller /wallets/tiers`) | 将钱包评分为 S/A/B/C 四个等级，支持交易风格分类（sniper/narrative/diamond） |
| 19 | AI 代理检测 (`ai-agent-detector.service`) | 检测监控地址是否为 AI 交易代理（机器人） |
| 20 | 地址聚类 (`address-cluster.service`) | 识别同一实体控制的多个钱包地址 |
| 21 | 策略风险配置 (`dashboard /strategy-config/*`) | 为每个策略独立配置风险参数 |
| 22 | 热门代币排行 (`token.controller /trending`) | 按交易量/次数展示热门代币（5min/1h/24h） |
| 23 | 代币搜索 (`token.controller /search, /searchByAddress`) | 按 Symbol 或地址搜索代币信息 |
| 24 | 代币详情 (`token.controller /:mintAddress`) | 获取代币完整信息（含池子信息） |
| 25 | 持仓分布 (`token.controller /holders, /holdersNumber`) | 查看代币头部持仓地址和持仓人数 |
| 26 | 历史价格K线 (`token.controller /price`) | 查询代币历史价格（可配置时间范围和间隔） |
| 27 | 交易记录 (`token.controller /trades`) | 查询代币链上交易记录 |
| 28 | 代币配置 (`token.controller /configurations`) | 获取代币系统配置（支持的 DEX 等） |
| 29 | 代币收藏 (`favorite.controller`) | 添加/移除/查询代币收藏列表 |
| 30 | 代币安全检测 (`token-security.service`) | 检测代币合约安全性（蜜罐/Rug 等） |
| 31 | 消息通知注册 (`message-notifier.controller /register`) | 注册 Firebase 推送 Token 接收交易通知 |
| 32 | 通知消息查询 (`message-notifier.controller /notifies`) | 查询历史推送通知记录 |
| 33 | Geyser 实时订阅 (`geyser-subscriber.service`) | 通过 Yellowstone gRPC 实时监听链上 DEX 交易（<1s 延迟） |
| 34 | 跟卖服务 (`follow-sell.service`) | 当 KOL 卖出时自动跟随卖出 |
| 35 | 爆发钱包检测 (`burst-wallet-detector.service`) | 检测突然大量交易的钱包地址 |
| 36 | 实时退出流动性 (`realtime-exit-liquidity.service`) | 实时监控流动性撤出事件 |
| 37 | ShredStream 预取 (`shredstream-prefetch.service`) | 通过 Jito ShredStream 预取交易数据加速响应 |
| 38 | WebSocket 转账监听 (`transfer-subscriber.service`) | 传统 WebSocket 方式监听钱包链上转账 |
| 39 | 转账同步 (`transfer-syncer.service`) | 同步和校验链上转账数据 |
| 40 | 链上数据流 (`stream.service`) | WebSocket 连接 Data Center 实时接收 DEX 交易数据流 |
| 41 | ClickHouse 分析 (`clickhouse.module`) | 连接 ClickHouse 进行 TB 级链上交易数据分析 |
| 42 | 智能钱包发现 (`smart-wallet-source / onchain-wallet-discovery`) | 链上发现高盈利的智能钱包地址 |
| 43 | 外部钱包导入 (`smart-wallet-source / external-wallet-import`) | 从外部来源导入要监控的钱包地址 |
| 44 | 持仓监控 (`position-monitor.service`) | 后台持续监控已持仓代币的价格变化 |
| 45 | 持仓管理器 (`position-manager.service`) | 管理跟单买入的持仓和止盈止损 |
| 46 | 跟单策略同步 (`automatic-strategy-syncer.service`) | 当 KOL 交易信号到达时执行跟单逻辑 |

### 1.2 dexauto-trading-server (backend-rust) — 交易执行引擎

| # | 功能名称 | 描述 |
|---|---------|------|
| 47 | Swap 交易构建 (`trading_swap/swap`) | 构建 Solana DEX Swap 交易（Jupiter 路由） |
| 48 | 交易取消 (`trading_swap/cancel_tx`) | 取消待处理的交易 |
| 49 | 操作密钥管理 (`op_key/create_op_key, get_op_keys`) | 创建和查询交易操作密钥 |
| 50 | Jito Bundle 提交 (`tx_submitter`) | 通过 Jito Bundle 提交交易实现 MEV 保护 |
| 51 | 共识投票信号 (`SignalStrength`) | 根据共识投票数调整交易提交优先级 |
| 52 | Staked RPC 降级 (`staked_rpc`) | 备用 Staked RPC 节点用于 SWQoS |

### 1.3 auto-dex-site / auto-dex-site-src (frontend) — DexAuto 交易 UI

| # | 功能名称 | 描述 |
|---|---------|------|
| 53 | 热门代币页面 (`/hot`) | 展示热门代币排行和实时行情 |
| 54 | Solana 代币详情 (`/token/solana/:address`) | 代币详情页（K线图、交易记录、持仓分布） |
| 55 | 代币市场详情 (`/token/solana/:address/:marketAddress`) | 特定交易池的市场数据 |
| 56 | ETH 代币页面 (`/token/eth/:address`) | 以太坊代币信息展示 |
| 57 | 账户管理 (`/account`) | 用户账户信息和钱包管理 |
| 58 | 安全设置 (`/security`) | 安全相关配置页面 |
| 59 | 通用设置 (`/setting`) | 交易参数设置（MEV/滑点/优先费） |
| 60 | 创建跟单任务 (`/tasks/create`) | 创建自动跟单策略的表单页面 |
| 61 | 跟单任务详情 (`/tasks/detail/:id`) | 单个跟单策略的详情和历史事件 |
| 62 | 跟单任务列表 (`/tasks/:id`) | 所有跟单策略的列表管理 |
| 63 | 应用下载 (`/download`) | App 下载页面 |
| 64 | AI 代理 (`/agent`) | AI 代理交易界面 |
| 65 | TradingView K线图 (`charting_library`) | 集成 TradingView 图表库展示 K 线 |
| 66 | Firebase 推送 (`firebase-messaging-sw.js`) | Service Worker 接收 Firebase 推送通知 |
| 67 | Solana 钱包连接 (`WalletProvider`) | 集成 Solana Wallet Adapter 连接钱包 |
| 68 | 多语言国际化 (`i18n`) | 支持多语言切换 |

---

## Category 2: UniPass — 智能合约钱包系统

### 2.1 unipass-wallet-backend (backend-node) — 钱包核心后端

| # | 功能名称 | 描述 |
|---|---------|------|
| 69 | 用户注册 (`account.controller /signUp`) | 通过邮箱注册创建智能合约钱包账户 |
| 70 | 用户登录 (`account.controller /signInAccount`) | 邮箱 OTP 验证登录 |
| 71 | 密钥集查询 (`account.controller /getAccountKeyset`) | 查询账户的公钥集合（多密钥管理） |
| 72 | 账户地址查询 (`account.controller /getAccountAddress`) | 通过邮箱查询合约钱包地址 |
| 73 | 密码令牌获取 (`account.controller /getPasswordToken`) | 获取密码操作的临时令牌 |
| 74 | 社交恢复-发送链接 (`account.controller /senGuardianLink`) | 发送 Guardian 恢复验证链接 |
| 75 | 社交恢复-验证 (`account.controller /verifyGuardian`) | 验证 Guardian 身份完成社交恢复 |
| 76 | Guardian 状态查询 (`account.controller /getGuardianToken`) | 查询社交恢复 Guardian 的状态 |
| 77 | 云端密钥备份 (`account.controller /uploadRecoveryKey`) | 上传云端恢复密钥 |
| 78 | 恢复邮件发送 (`account.controller /sendRecoveryEmail`) | 发送账户恢复验证邮件 |
| 79 | 恢复邮件状态 (`account.controller /getReceiveRecoveryEmailStatus`) | 查询恢复邮件是否被接收 |
| 80 | OTP 验证码发送 (`otp.controller /sendCode`) | 发送邮箱 OTP 验证码（区分注册/登录/恢复） |
| 81 | OTP 验证码验证 (`otp.controller /verifyOtpCode`) | 验证 OTP 码 |
| 82 | 配置获取 (`config.controller /getConfig`) | 获取钱包系统公开配置 |
| 83 | 邮件接收处理 (`receive-email.controller`) | 处理 AWS SES 接收到的邮件（用于 DKIM 验证） |
| 84 | 密钥数据库管理 (`key.db.service`) | 管理用户多密钥的增删改查 |
| 85 | 账户交易服务 (`account.transaction.service`) | 处理账户相关的数据库事务 |

### 2.2 unipass-wallet-oauth (backend-node) — OAuth 认证服务

| # | 功能名称 | 描述 |
|---|---------|------|
| 86 | OAuth2 客户端注册 (`oauth2.controller /client`) | 注册 OAuth2 应用客户端 |
| 87 | OAuth2 授权 (`oauth2.controller /authorize`) | OAuth2 授权码流程 |
| 88 | OAuth2 令牌交换 (`oauth2.controller /token`) | 授权码兑换 Access Token |
| 89 | 用户信息获取 (`oauth2.controller /userInfo`) | 通过 Access Token 获取用户邮箱信息 |
| 90 | 邮箱验证码发送 (`oauth2.controller /start`) | OAuth 流程中发送邮箱验证码 |
| 91 | 邮箱验证码验证 (`oauth2.controller /verify`) | OAuth 流程中验证邮箱验证码 |

### 2.3 unipass-wallet-relayer (backend-rust) — 交易中继器

| # | 功能名称 | 描述 |
|---|---------|------|
| 92 | Chain ID 查询 (`/chain-id`) | 查询当前连接的区块链 ID |
| 93 | Meta Nonce 查询 (`/meta-nonce`) | 查询合约钱包的 Meta Nonce |
| 94 | Nonce 查询 (`/nonce`) | 查询链上交易 Nonce |
| 95 | 交易模拟 (`/simulate`) | 模拟合约钱包交易（估算 Gas） |
| 96 | 交易提交 (`/transactions`) | 代用户提交合约钱包交易（Gas-less） |
| 97 | 交易回执查询 (`/receipt`) | 查询交易执行结果和回执 |
| 98 | 提交者列表 (`/submitters`) | 查询可用的 Relayer 提交者地址 |
| 99 | Redis 交易队列 (`relayer-redis`) | Redis Stream 消费交易队列异步处理 |
| 100 | 执行验证器 (`execute-validator`) | 解析和验证合约交易的合法性 |
| 101 | 合约模拟器 (`anvil_simulator`) | 使用 Anvil 模拟合约执行 |

### 2.4 unipass-snap-service (backend-rust binary) — MetaMask Snap 服务

| # | 功能名称 | 描述 |
|---|---------|------|
| 102 | Snap 登录 (`account/login`) | MetaMask Snap 用户登录认证 |
| 103 | 免费配额查询 (`account/get_free_quota`) | 查询每日免费 Gas 配额 |
| 104 | 交易费授权 (`transaction/authorize_transaction_fees`) | 授权扣除交易手续费 |
| 105 | 单笔手续费查询 (`transaction/get_single_transaction_fee`) | 查询单笔交易的手续费金额 |
| 106 | 交易费验证 (`transaction/verify_transaction_fees`) | 验证交易费扣除是否成功 |
| 107 | 交易回调 (`transaction/callback`) | 交易完成后的回调处理 |
| 108 | 价格预言机 (`price_oracle`) | CoinMarketCap API 获取代币价格 |

### 2.5 unipass-cms-backend (backend-node) — CMS 管理后台

| # | 功能名称 | 描述 |
|---|---------|------|
| 109 | 管理员登录 (`login.controller`) | CMS 管理后台登录 |
| 110 | 用户管理 (`system/user`) | 管理后台用户 CRUD |
| 111 | 角色管理 (`system/role`) | 角色权限配置 |
| 112 | 菜单管理 (`system/menu`) | 后台菜单配置 |
| 113 | 部门管理 (`system/dept`) | 组织部门结构管理 |
| 114 | 操作日志 (`system/log`) | 系统操作日志查询 |
| 115 | 在线用户 (`system/online`) | 查看当前在线管理员 |
| 116 | 参数配置 (`system/param-config`) | 系统参数键值对配置 |
| 117 | 定时任务 (`system/task`) | 后台定时任务管理 |
| 118 | 服务监控 (`system/serve`) | 服务器资源监控 |
| 119 | WebSocket 通信 (`ws.module`) | 管理后台 WebSocket 实时消息 |
| 120 | UniPass 用户查询 (`unipass.controller /account/db/info`) | 查询钱包用户的数据库信息 |
| 121 | 链上账户查询 (`unipass.controller /account/chain/info`) | 查询用户的链上账户信息 |
| 122 | 注册统计 (`unipass.controller /statistics/signup`) | 钱包注册量统计 |
| 123 | 登录统计 (`unipass.controller /statistics/login`) | 钱包登录量统计 |
| 124 | 单日数据统计 (`unipass.controller /statistics/oneday`) | 单日综合数据统计 |
| 125 | 交易统计 (`unipass.controller /statistics/accounts/transaction`) | 账户交易数据统计 |
| 126 | Gas 费统计 (`unipass.controller /statistics/gas/*`) | Relayer Gas 费用追踪和收益统计 |
| 127 | 交易发送 (`unipass.controller /send/tranascation`) | 管理端发送链上交易 |
| 128 | 事件列表 (`unipass.controller /tranascation/event/*`) | 交易事件日志查询 |
| 129 | DKIM 监控 (`monitor/dkim.service`) | 监控 DKIM 邮件验证状态 |
| 130 | OpenID 监控 (`monitor/open.id.service`) | 监控 OpenID 认证状态 |
| 131 | 积分发放 (`ap/action-point.issue`) | Action Point 积分发放管理 |
| 132 | Snap 应用统计 (`payment_snap/statistics`) | MetaMask Snap 应用使用统计 |

### 2.6 unipass-activity-backend (backend-node) — 活动服务

| # | 功能名称 | 描述 |
|---|---------|------|
| 133 | 代币铸造查询 (`/universe/mint.token`) | 查询活动代币铸造信息 |
| 134 | 短链接获取 (`/universe/short.key`) | 生成活动分享短链接 |
| 135 | 活动领取 (`/universe/claim`) | 用户领取活动奖励的交易构建 |

### 2.7 tss-ecdsa-server (backend-rust) — 门限签名服务

| # | 功能名称 | 描述 |
|---|---------|------|
| 136 | KeyGen Phase 1 (`/keygen/first`) | TSS 密钥生成第一阶段（承诺） |
| 137 | KeyGen Phase 2 (`/keygen/second`) | TSS 密钥生成第二阶段（DLog 证明 + Paillier 设置） |
| 138 | KeyGen Phase 3 (`/keygen/third`) | TSS 密钥生成第三阶段（PDL 证明，最终密钥） |
| 139 | Sign Phase 1 (`/sign/first`) | TSS 签名第一阶段（临时 R1 + EC-DDH 证明） |
| 140 | Sign Phase 2 (`/sign/second`) | TSS 签名第二阶段（计算最终 ECDSA 签名） |
| 141 | 会话管理 | 自动过期清理的会话管理（Lindell 2017 协议） |

### 2.8 UniPass 前端项目

| # | 功能名称 | 子项目 | 描述 |
|---|---------|-------|------|
| 142 | 钱包前端 | unipass-wallet-frontend | UniPass 钱包主界面（已编译） |
| 143 | CMS 管理前端 | unipass-cms-frontend | 管理后台 UI（Vue.js） |
| 144 | 移动 H5 应用 | unipass-app-h5 | 手机端 H5 钱包（含邀请/社区/奖励/订单/PayPal/推荐模块） |
| 145 | 支付 Web 组件 | unipass-payment-web | 嵌入式支付小组件（Next.js + Rive 动画） |
| 146 | Snap 前端 | unipass-snap-frontend | MetaMask Snap 管理界面 |
| 147 | Snap GitHub 包 | unipass-snap-github | MetaMask Snap 插件包（snap + site） |
| 148 | 钱包 JS SDK | unipass-wallet-js-github | UniPass 钱包 JS SDK 全栈（abi/deployer/dkim/keys/provider/relayer/sdk/wallet 等 14 个包） |
| 149 | Snap SDK 包 | unipass-wallet-snap-github | Snap 前端和 Snap 插件代码 |
| 150 | 官网 | unipass-wallet-official-website | UniPass 官方网站（静态页面） |

---

## Category 3: UTXOSwap — CKB DEX 去中心化交易所

### 3.1 utxo-swap-sequencer (backend-rust) — DEX 撮合引擎

| # | 功能名称 | 描述 |
|---|---------|------|
| 151 | 精确输入 Swap (`/intents/swap-exact-input-for-output`) | 指定输入金额的代币兑换 |
| 152 | 精确输出 Swap (`/intents/swap-input-for-exact-output`) | 指定输出金额的代币兑换 |
| 153 | 添加流动性 (`/intents/add-liquidity`) | 向流动性池添加流动性 |
| 154 | 移除流动性 (`/intents/remove-liquidity`) | 从流动性池移除流动性 |
| 155 | 意图状态查询 (`/intents/status`) | 查询交易意图的执行状态 |
| 156 | 流动性池列表 (`/pools`) | 获取所有流动性池列表 |
| 157 | 按代币查池子 (`/pools/by-tokens`) | 按代币对查找对应的流动性池 |
| 158 | 池子状态 (`/pools/status`) | 查看池子实时状态（TVL/交易量） |
| 159 | 交易记录 (`/pools/transactions`) | 查询池子的交易历史 |
| 160 | K线数据 (`/pools/candlestick`) | 获取池子的 K 线蜡烛图数据 |
| 161 | 创建流动性池 (`/pools-admin/create`) | 管理员创建新的流动性池（需 JWT） |
| 162 | 代币列表 (`/tokens`) | 获取支持的代币列表 |
| 163 | 热门代币 (`/tokens/top`) | 获取交易量最高的代币 |
| 164 | 任务列表 (`/tasks`) | 查询交易任务列表 |
| 165 | 任务领取 (`/tasks-auth/claim`) | 用户领取任务奖励（需 JWT） |
| 166 | 账户登录 (`/accounts/login`) | CKB 地址签名登录 |
| 167 | 账户信息 (`/accounts/info`) | 查询用户账户信息 |
| 168 | 链信息 (`/chains-info`) | 获取 CKB 链配置信息 |
| 169 | 系统配置 (`/configurations`) | 获取系统全局配置 |
| 170 | UTXO Global 集成 (`/external/utxo-global`) | 外部 UTXO Global 钱包集成 |
| 171 | GitHub Issue (`/github/issue, /upload`) | 提交问题反馈和上传截图 |
| 172 | 后台代币管理 (`tokens_manager`) | 后台定时同步代币信息 |
| 173 | 流动性对管理 (`liquidity_pairs/manager`) | 后台定时更新流动性对数据 |
| 174 | 任务管理器 (`tasks_manager`) | 后台执行定时任务 |
| 175 | Intent Solver (`intent-solver`) | CKB UTXO 交易构建和提交引擎 |
| 176 | OpenAPI 文档 (`/docs`) | Swagger/Redoc API 文档 |

### 3.2 utxoswap-farm-sequencer (backend-rust) — Farm/Staking 引擎

| # | 功能名称 | 描述 |
|---|---------|------|
| 177 | 创建 Farm 池意图 (`/intents/create-pool`) | 提交创建 Farm 池的意图 |
| 178 | 提交 Farm 池 (`/intents/submit-create-pool`) | 确认并提交 Farm 池创建 |
| 179 | Farm 意图提交 (`/intents/submit`) | 提交 Staking/Farming 意图 |
| 180 | Farm 意图状态 (`/intents/status`) | 查询 Farm 操作状态 |
| 181 | Farm 池列表 (`/pools`) | 获取所有 Farm/Staking 池 |
| 182 | 系统配置 (`/configurations`) | 获取 Farm 系统配置 |

### 3.3 utxoswap-paymaster-backend (backend-node) — Gas 代付服务

| # | 功能名称 | 描述 |
|---|---------|------|
| 183 | UDT 配额估算 (`/paymaster/estimate-udt-amount`) | 估算 UDT 代币兑换 CKB 的数量 |
| 184 | CKB Cell 获取 (`/paymaster/get-ckb-cell`) | 获取用于 Gas 代付的 CKB Cell |
| 185 | 签名请求 (`/paymaster/request-paymaster-sig`) | 请求 Paymaster 签名以赞助 Gas 费 |
| 186 | 候选 Cell 管理 (`candidate-cell-manager.service`) | 管理可用的候选 CKB Cell 池 |
| 187 | 流动性池服务 (`liquidity-pool.service`) | 管理 Paymaster 的流动性池 |

### 3.4 UTXOSwap 前端

| # | 功能名称 | 子项目 | 描述 |
|---|---------|-------|------|
| 188 | DEX 交易界面 | utxo-swap-site | UTXOSwap 去中心化交易所前端 UI |

---

## Category 4: HueHub — NFT/DOBs 数字对象平台

### 4.1 huehub-dex-backend (backend-node) — RGB++ 代币市场

| # | 功能名称 | 描述 |
|---|---------|------|
| 189 | RGB++ 代币列表 (`rgbpp.controller /tokens`) | 获取所有 RGB++ 代币列表 |
| 190 | 代币搜索 (`rgbpp.controller /searchTokens`) | 搜索 RGB++ 代币 |
| 191 | 代币详情 (`rgbpp.controller /tokenInfo`) | 获取单个代币的详细信息 |
| 192 | 代币统计 (`rgbpp.controller /getTokenStaticsList`) | 获取代币交易统计数据 |
| 193 | NFT/代币挂单 (`rgbpp.controller /listItems`) | 将 RGB++ 代币/NFT 挂单出售 |
| 194 | 获取 PSBT (`rgbpp.controller /getItemPSBT`) | 获取部分签名比特币交易（PSBT）用于购买 |
| 195 | 购买代币 (`rgbpp.controller /buyItems`) | 购买挂单的 RGB++ 代币 |
| 196 | 取消挂单 (`rgbpp.controller /unlistItems`) | 取消已挂单的代币 |
| 197 | 我的订单 (`rgbpp.controller /queryOrders`) | 查询用户的买卖订单 |
| 198 | 修复订单 (`rgbpp.controller /fixOrder`) | 修复异常状态的订单 |
| 199 | 交易活动 (`rgbpp.controller /getActivities`) | 获取代币交易活动记录 |
| 200 | 持有者列表 (`rgbpp.controller /getHolders`) | 获取代币持有者列表 |
| 201 | 待处理订单 (`rgbpp.controller /getOrderPending`) | 获取待确认的订单 |
| 202 | Cell 分割 (`rgbpp.controller /splitSells`) | 管理员触发 CKB Cell 分割（准备交易 Cell） |
| 203 | 代币部署 (`tokens/deployment.token.service`) | RGB++ 代币部署服务 |
| 204 | 代币铸造 (`tokens/token.mint.service`) | RGB++ 代币铸造服务 |
| 205 | 市场代币管理 (`tokens/market.tokens.service`) | 管理市场上架的代币 |
| 206 | Launchpad 项目状态 (`launchpad.controller /getProjectsStatus`) | 查看 Launchpad 项目状态 |
| 207 | Launchpad 轮次 (`launchpad.controller /showRounds`) | 查看代币发行轮次 |
| 208 | 铸造检查 (`launchpad.controller /mintCheck`) | 检查用户是否有铸造资格（白名单） |
| 209 | 代币铸造 (`launchpad.controller /mintToken`) | 在 Launchpad 中铸造新代币 |
| 210 | BTC 链信息 (`btc.controller /getChainInfo`) | 获取 Bitcoin 链信息 |
| 211 | 资产快照 (`external.controller /assetSnapshot`) | 获取 RGB++ 资产快照（空投用） |
| 212 | 用户认证 (`user.controller`) | HueHub 用户登录认证 |
| 213 | RGB++ 资产索引 (`indexer.service`) | RGB++ 资产链上索引 |
| 214 | 资产服务 (`asset/asset.service`) | RGB++ 资产查询和管理 |
| 215 | CKB Explorer 集成 (`ckb/ckb.explorer.api.service`) | CKB Explorer API 集成 |
| 216 | RGB++ 代币分发 (`ckb/rgbpp-distributor.service`) | RGB++ 代币空投分发 |
| 217 | 定时任务 (`tasks.service`) | 后台定时任务（数据同步等） |

### 4.2 huehub-dex-dobs-backend (backend-node) — DOBs 数字对象市场

| # | 功能名称 | 描述 |
|---|---------|------|
| 218 | DOBs 集合列表 (`collection.controller /collections`) | 获取 DOBs 集合列表 |
| 219 | 集合详情 (`collection.controller /collectionInfo`) | 获取单个集合的详细信息 |
| 220 | DOBs 项目列表 (`collection.controller /items`) | 获取集合内的 DOBs 项目 |
| 221 | DOBs 挂单 (`collection.controller /listItems`) | 将 DOBs 挂单出售 |
| 222 | DOBs PSBT (`collection.controller /getItemPSBT`) | 获取 DOBs 购买的 PSBT |
| 223 | 购买 DOBs (`collection.controller /buyItems`) | 购买挂单的 DOBs |
| 224 | 取消挂单 (`collection.controller /unlistItems`) | 取消 DOBs 挂单 |
| 225 | DOBs 订单查询 (`collection.controller /queryOrders`) | 查询 DOBs 买卖订单 |
| 226 | DOBs 活动记录 (`collection.controller /getActivities`) | 获取 DOBs 交易活动 |
| 227 | 集合统计 (`statisics.service`) | 集合地板价和交易量统计 |
| 228 | DOBs 索引器 (`indexer.service`) | DOBs 链上数据索引 |
| 229 | 市场交易构建 (`market/tx.service`) | 构建 DOBs 市场交易 |
| 230 | PSBT 构建 (`market/psbt.service`) | 构建部分签名比特币交易 |
| 231 | BTC 资产服务 (`btc/btc.assets.service`) | BTC 相关资产查询 |
| 232 | 定时任务 (`task.service`) | 后台同步和清理任务 |

### 4.3 huehub-token-distributor (backend-rust) — 代币分发服务

| # | 功能名称 | 描述 |
|---|---------|------|
| 233 | 代币分发任务 (`process_distributions`) | 后台轮询执行待处理的代币分发（空投/解锁） |
| 234 | CKB 交易构建 | 构建 xUDT 铸造或转移交易 |
| 235 | 分发状态追踪 (`distributor_tx`) | 追踪每笔分发的执行状态 |

### 4.4 HueHub 前端

| # | 功能名称 | 子项目 | 描述 |
|---|---------|-------|------|
| 236 | HueHub DEX 界面 | huehub-dex-site | HueHub RGB++/DOBs 市场交易界面 |

---

## Category 5: BTC Assets — Bitcoin/RGB++ 资产 API

### 5.1 btc-assets-api (backend-node, Fastify) — BTC 资产网关

| # | 功能名称 | 描述 |
|---|---------|------|
| 237 | RGB++ 交易提交 (`/rgbpp/transaction`) | 提交 RGB++ 跨链交易 |
| 238 | RGB++ 资产查询 (`/rgbpp/assets`) | 查询 RGB++ 资产信息 |
| 239 | 地址资产查询 (`/rgbpp/address`) | 按 BTC/CKB 地址查询 RGB++ 持仓 |
| 240 | BTC SPV 验证 (`/rgbpp/btc-spv`) | Bitcoin SPV 轻验证服务 |
| 241 | RGB++ Paymaster (`/rgbpp/paymaster`) | RGB++ 交易 Gas 代付服务 |
| 242 | 交易处理定时任务 (`cron/process-transactions`) | 后台定时处理待确认交易 |
| 243 | Cell 解锁定时任务 (`cron/unlock-cells`) | 后台定时解锁过期锁定的 Cell |
| 244 | CKB 服务 (`services/ckb`) | CKB 链交互服务 |
| 245 | Bitcoin 服务 (`services/bitcoin`) | BTC 链交互（Electrs/Mempool 双后端） |
| 246 | SPV 服务 (`services/spv`) | SPV 验证服务 |
| 247 | Cell 解锁器 (`services/unlocker`) | 自动解锁过期 Cell |
| 248 | JWT 认证 (`plugins/jwt`) | JWT Token 认证 |
| 249 | 限流 (`plugins/rate-limit`) | API 请求频率限制 |
| 250 | IP 封禁 (`plugins/ip-block`) | 恶意 IP 封禁 |
| 251 | 缓存 (`plugins/cache`) | Redis 请求结果缓存 |

---

## Category 6: Solagram — Solana 社交交易平台

### 6.1 solagram-backend (backend-node) — 社交交易后端

| # | 功能名称 | 描述 |
|---|---------|------|
| 252 | TG 用户认证 (`tg-user.controller /auth`) | Telegram 用户 OAuth 认证 |
| 253 | 加密密钥上传 (`tg-user.controller /uploadEncryptedKey`) | 上传用户加密后的私钥 |
| 254 | Mini App 入口 (`tg-user / mini-app.controller`) | Telegram MiniApp 入口端点 |
| 255 | AWS 用户服务 (`tg-user / aws-user.service`) | AWS Cognito/KMS 用户管理 |
| 256 | Blink 短链接 (`blink.controller /getUrlByShortCode`) | 通过短码获取完整 Blink URL |
| 257 | 短链接生成 (`blink.controller /getShortCode`) | 生成 Solana Blink 短链接 |
| 258 | Blink 解析 (`parse.blink.service`) | 解析 Blink 链接获取交易参数 |
| 259 | Solana 代币信息 (`solana.controller /getTokenInfo`) | 查询 Solana 代币基本信息 |
| 260 | 地址转账记录 (`solana.controller /getAddressTransfers`) | 查询地址的转账历史 |
| 261 | 钱包连接 (`wallet.controller /connect`) | Solana 钱包 WalletConnect 消息中继 |
| 262 | Solana API 转发 (`wallet.controller /forwardingSolanaApi`) | 转发 Solana RPC 调用 |
| 263 | TG Bot Webhook (`tg-bot / webhook.controller`) | Telegram Bot Webhook 处理 |
| 264 | TG Bot 消息 (`tg-bot / message.service`) | Telegram Bot 消息收发 |
| 265 | 机器人通知 (`notify.controller /notify`) | 发送 Bot 通知消息 |
| 266 | 群组统计 (`bot-statistics / bot-group-db.service`) | Telegram 群组统计数据 |
| 267 | 用户关注 (`bot-statistics / user-follow-db.service`) | 用户关注关系管理 |
| 268 | Blink 回复统计 (`bot-statistics / bot-reply-blink-db.service`) | Bot 回复 Blink 统计 |
| 269 | 应用行为统计 (`bot-statistics / open-app-action-db.service`) | 用户使用行为统计 |

### 6.2 solagram-web-site (frontend) — Solagram Web UI

| # | 功能名称 | 描述 |
|---|---------|------|
| 270 | Solagram 网站 | Solana 社交交易 Web 界面（Next.js SSR） |

---

## Category 7: Mystery Bomb — NFT 盲盒/抽奖

### 7.1 mystery-bomb-box-backend (backend-node)

| # | 功能名称 | 描述 |
|---|---------|------|
| 271 | 创建盲盒交易 (`mystery.controller /createMysteryBoxTransaction`) | 创建链上盲盒（含限流 10次/60秒） |
| 272 | 抢盲盒交易 (`mystery.controller /grabMysteryBoxsTransaction`) | 抢购/开启盲盒（含限流） |
| 273 | Blink 列表 (`blink.controller /queryBlinkList`) | 查询盲盒 Blink 链接列表 |
| 274 | 盲盒数据管理 (`mystery-boxs.service`) | 盲盒创建和状态管理 |
| 275 | 抢盲盒记录 (`grab-mystery-boxs.service`) | 记录抢盲盒的参与者 |
| 276 | 交易追踪 (`transaction-db.service`) | 追踪盲盒相关的链上交易 |
| 277 | Bot 通知 (`bot-notify/bot.notify.service`) | 盲盒开启结果的 Bot 通知 |
| 278 | Blink Action (`blink/action/*`) | Solana Actions/Blink 协议集成 |

### 7.2 bomb-fun-site (frontend)

| # | 功能名称 | 描述 |
|---|---------|------|
| 279 | Bomb.fun 界面 | 盲盒/抽奖活动前端界面 |

---

## Category 8: Bridge — 跨链桥

### 8.1 unipass-bridge-validator (backend-rust) — 跨链桥验证器

| # | 功能名称 | 描述 |
|---|---------|------|
| 280 | 跨链支付 (`validator/api/payment`) | 发起跨链支付请求 |
| 281 | 支付详情 (`validator/api/payment_details`) | 查询跨链支付详情 |
| 282 | 支付状态 (`validator/api/payment_status`) | 查询跨链支付执行状态 |
| 283 | 签名收集 (`validator/api/collect_signature`) | 收集验证器节点的多签签名 |
| 284 | 验证器状态 (`validator/api/validator_status`) | 查询验证器节点运行状态 |
| 285 | Webhook 回调 (`validator/api/webhook`) | 跨链交易完成回调 |
| 286 | 链上监控 (`validator-monitor`) | 持续监控源链和目标链的区块和交易 |
| 287 | 任务调度 (`validator-scheduler`) | 调度跨链验证和提交任务 |
| 288 | 交易提交 (`validator-submitter`) | 向目标链提交已验证的跨链交易 |
| 289 | 消息队列 (`validator-mq`) | Redis 消息队列（生产者/消费者模式） |
| 290 | 签名服务 (`validator-signer`) | 使用私钥对跨链消息签名 |
| 291 | API Key 认证 (`middleware`) | API Key 中间件保护端点 |
| 292 | 速率限制 | 全局 60 req/min 速率限制 |
| 293 | 优雅关机 | 支持 SIGINT 信号优雅关闭 |

---

## Category 9: 基础设施 & 工具服务

### 9.1 payment-server (backend-rust) — 支付网关

| # | 功能名称 | 描述 |
|---|---------|------|
| 294 | 用户注册 (`/account/register`) | 支付系统用户注册 |
| 295 | 用户登录 (`/account/login`) | 支付系统用户登录 |
| 296 | 账户恢复 (`/account/recovery`) | 账户恢复流程 |
| 297 | 密钥备份更新 (`/account/backup`) | 更新加密备份密钥 |
| 298 | 资产列表 (`/assets/list`) | 查询用户持有的加密资产 |
| 299 | 费用估算 (`/assets/estimated-fee`) | 估算交易手续费 |
| 300 | 资产交易 (`/assets/transaction`) | 创建资产转账交易 |
| 301 | 法币入金 (`/ramp/on-ramp`) | 法币购买加密货币（AlchemyPay） |
| 302 | 法币出金 (`/ramp/off-ramp`) | 加密货币兑换法币 |
| 303 | 入金 Webhook (`/ramp/webhook/alchemy-pay/on-ramp`) | AlchemyPay 入金回调处理 |
| 304 | 出金 Webhook (`/ramp/webhook/alchemy-pay/off-ramp`) | AlchemyPay 出金回调处理 |
| 305 | 创建发票 (`/invoice/create`) | 创建支付发票/收款码 |
| 306 | 发票历史 (`/invoice/history`) | 查询发票/收款历史 |
| 307 | 支付配置 (`/payment/config`) | 获取支付系统配置 |
| 308 | 支付详情 (`/payment/details`) | 查询支付订单详情 |
| 309 | 发送支付 (`/payment/send`) | 发起支付（加密货币转账） |
| 310 | 通知历史 (`/history/notifications`) | 查询支付通知历史 |
| 311 | 邀请统计 (`/referral/statistics`) | 推荐邀请统计数据 |
| 312 | 提交邀请码 (`/referral/submit-code`) | 提交邀请码建立推荐关系 |
| 313 | 商城下单 (`/shopping/order`) | 商城商品购买下单 |
| 314 | 系统配置 (`/config`) | 获取支付网关公开配置 |
| 315 | 交易监控 (`monitor_transactions_manager`) | 后台监控待确认交易 |
| 316 | 交易提交器 (`payment_manager/submitter`) | 后台异步提交链上交易 |
| 317 | 智能账户钱包 (`smart-account-wallet`) | 智能合约钱包集成 |

### 9.2 opentg-backend (backend-node) — Telegram 社群 Bot

| # | 功能名称 | 描述 |
|---|---------|------|
| 318 | Blink 可信域名列表 (`blink.controller /list`) | 获取所有可信的 Blink Action 域名 |
| 319 | TG 用户积分查询 (`tg-user.controller /showPoints`) | 查询 Telegram 用户的积分 |

---

## 汇总统计

| 类别 | 子项目数 | 功能数 |
|------|---------|--------|
| DexAuto — Solana 自动交易 | 3 (server + trading + frontend) | 68 |
| UniPass — 智能合约钱包 | 11 (backend×5 + frontend×6) | 82 |
| UTXOSwap — CKB DEX | 4 (sequencer + farm + paymaster + site) | 38 |
| HueHub — NFT/DOBs | 4 (dex-backend + dobs-backend + distributor + site) | 48 |
| BTC Assets — RGB++ 资产 | 1 | 15 |
| Solagram — 社交交易 | 2 (backend + site) | 19 |
| Mystery Bomb — 盲盒 | 2 (backend + site) | 9 |
| Bridge — 跨链桥 | 1 | 14 |
| 基础设施（Payment + OpenTG） | 2 | 26 |
| **总计** | **30 个子项目** | **319 个功能点** |

### 覆盖的区块链

| 链 | 用途 |
|----|------|
| **Solana** | DexAuto 自动交易（主战场）、Solagram 社交交易、Mystery Bomb 盲盒 |
| **CKB (Nervos)** | UTXOSwap DEX、HueHub RGB++/DOBs 市场、BTC Assets |
| **Bitcoin** | RGB++ 资产（通过 CKB 二层）、HueHub PSBT 交易 |
| **Ethereum** | UniPass 智能合约钱包、跨链桥、MetaMask Snap |
| **Arbitrum** | UniPass Snap 服务（Gas 估算） |

### 技术栈汇总

| 层次 | 技术 |
|------|------|
| 后端 (Node.js) | NestJS, Fastify, TypeORM, Bull Queue, WebSocket |
| 后端 (Rust) | Actix-Web, Sea-ORM, SQLx, Tokio, ethers-rs, solana-sdk |
| 前端 | React, Next.js, Vue.js, TailwindCSS, TradingView |
| 数据库 | PostgreSQL, MySQL, ClickHouse, Redis |
| 区块链 RPC | Helius (Solana), CKB Node, Ethereum/Arbitrum, Jito |
| 云服务 | AWS KMS/SES/S3, Firebase, DigitalOcean |
| 安全 | JWT, OAuth2, TSS-ECDSA, DKIM, HMAC |
