# 深度审计报告：HueHub-DEX-Backend 未审计文件
**审计日期**: 2026-04-16  
**审计范围**: 24个未审计文件（1个文件不存在）  
**审计重点**: 资金损失、双花、金额错误、竞态条件、输入验证

---

## 🔴 严重漏洞 (CRITICAL) — 可直接导致资金损失

### CRITICAL-01: 部署费验证用 `&&` 代替 `||`，可绕过费用检查
**文件**: `src/modules/rgbpp/asset/asset.service.ts` → `verifyLaunchBtcTx()`  
**行为**: 
```typescript
if (outputs[1].address !== paymasterAddress && outputs[1].value !== deployFee)
```
**漏洞**: 使用 `&&`（AND）意味着**仅当地址和金额同时错误**时才拒绝。攻击者可以：
- 发送正确地址但金额为0 → 绕过检查（地址正确，AND条件不成立）
- 发送错误地址但正确金额 → 同样绕过  
**修复**: 改为 `||`（OR）：`if (address !== expected || value !== expectedFee)`  
**影响**: **直接资金损失** — 部署token无需支付平台费

---

### CRITICAL-02: Launchpad铸造竞态条件 — 可超额铸造
**文件**: `src/modules/launchpad/launchpad.service.ts` → `mintToken()` / `mintTransactionStatus()`  
**行为**: 
1. `mintCheck()` 检查用户是否可铸造（读取 `mintCount`）
2. `mintToken()` 调用 `initMintByTransaction()` 写入数据库
3. 两步之间**无原子锁**  
**漏洞**: 同一用户并发发送多个铸造请求时：
- 多个请求同时通过 `mintCount < mintLimit` 检查
- 所有请求都成功写入，突破 `addressMintLimit` 限制
- 类似地，`round.mintedAmount < round.roundSupply` 也可被并发请求突破  
**修复**: 在 `mintToken()` 中使用 Redis 分布式锁或数据库悲观锁包裹检查+写入操作  
**影响**: **超额铸造** — 用户可获得超过限额的代币，稀释其他持有者

---

### CRITICAL-03: 市场费用验证可完全跳过
**文件**: `src/modules/rgbpp/rgbpp.service.ts` → `checkBuyRgbppBtcTransaction()`  
**行为**:
```typescript
if (parseInt(marketFee) >= this.appConfig.rgbPPConfig.minMarketFee) {
    // 只在 marketFee >= minMarketFee 时才验证费用输出
}
```
**漏洞**: 如果前端传入 `marketFee = "0"` 或 `marketFee = "-1"` 或 `marketFee = "abc"`（NaN），整个市场费用验证被跳过。买家可以**零手续费**购买代币。  
**修复**: 无论 `marketFee` 值如何，都必须验证至少 `minMarketFee` 被支付  
**影响**: **平台收入损失** — 所有交易可免手续费

---

### CRITICAL-04: `hash.reverse()` 原地修改Buffer，破坏PSBT内部状态
**文件**: `src/modules/launchpad/launchpad.transaction.service.ts` → `verifyMintPsbt()`  
**文件**: `src/modules/rgbpp/asset/asset.service.ts` → `verifyLaunchBtcTx()` / `prepareLaunchCkbTx()`  
**行为**: 
```typescript
let txHash = input.hash.reverse().toString('hex');
```
**漏洞**: `Buffer.reverse()` 是**原地修改**操作。调用后：
1. PSBT对象内部的hash被永久反转
2. 后续对同一PSBT的操作（如 `extractTransaction()`）使用错误的hash
3. 在 `asset.service.ts` 中，`reverse()` 被调用两次，第二次反转回错误方向  
**修复**: 使用 `Buffer.from(input.hash).reverse()` 创建副本  
**影响**: **交易构建错误** — 可能导致资金发送到错误地址或交易失败锁定资金

---

## 🟠 高危漏洞 (HIGH) — 可能导致资金异常

### HIGH-01: 交易费用计算膨胀300倍
**文件**: `src/common/utils/ckb.virtual.tx.ts`  
**行为**: 
```typescript
const GAS_TIMES = 300;
const txSize = getTransactionSize(ckbRawTx) + RGBPP_TX_WITNESS_MAX_SIZE * GAS_TIMES;
```
**问题**: 交易费基于 `实际大小 + 见证最大值×300` 计算。每笔交易多扣约300倍见证费用。  
**影响**: **资金慢性流失** — 每笔CKB交易过度支付手续费

### HIGH-02: `generateRgbLockCellTransaction` 使用MAX_FEE但不重新计算
**文件**: `src/modules/ckb/transaction-builder.ts`  
**行为**: `txFee = MAX_FEE` 直接从容量中扣除，但不像 `generateCandidateCellTransaction` 那样根据实际交易大小重新计算。  
**影响**: 每笔RGB锁定交易多付 `MAX_FEE - actual_fee` 的CKB

### HIGH-03: 部署交易缺少签名验证
**文件**: `src/modules/rgbpp/asset/asset.service.ts` → `verifyLaunchBtcTx()`  
**行为**: 铸造流程调用 `validateSignaturesOfAllInputs()`，但部署流程直接调用 `finalizeAllInputs()` 无签名验证。  
**影响**: 可能接受未签名的交易输入

### HIGH-04: `sendCkbTransaction` 中 sleep 未 await
**文件**: `src/modules/rgbpp/rgbpp.service.ts`  
**行为**: 
```typescript
sleep(1000);  // 缺少 await
await this.service.sendRgbppCkbTransaction(...);
```
**问题**: `sleep(1000)` 返回Promise但未await，重试立即执行。若BTC交易已发送但CKB交易失败，资产状态不一致。  
**影响**: BTC/CKB交易状态不一致，可能导致资产锁定

### HIGH-05: `totalSum.toNumber()` 大数精度丢失
**文件**: `src/modules/rgbpp/rgbpp.service.ts` → `checkBuyRgbppBtcTransaction()`  
**行为**: `BigInt(amount)` 使用 `totalSum.toNumber()` 转换的值，超过 `2^53` 时精度丢失。  
**影响**: 高价值代币转账金额可能不正确

### HIGH-06: 硬编码 paymasterBalance 隐藏真实余额
**文件**: `src/modules/btc/btc.service.ts` → `getBtcChainInfo()`  
**行为**: 
```typescript
paymasterBalance: new Decimal(2000000),  // 硬编码！
```
实际余额已获取但未使用。前端/调用方永远看到余额充足。  
**影响**: 当paymaster余额不足时无法预警，导致交易失败

### HIGH-07: UTXO缓存键不含地址，可跨用户污染
**文件**: `src/modules/launchpad/launchpad.transaction.service.ts` → `verifyAddressUtxo()`  
**行为**: 缓存键为 `Utxo:${txHash}`，但UTXO是按特定 `address` 获取的。  
**漏洞**: 用户A的UTXO可能被缓存后被用于验证用户B的请求（如果txHash相同）。  
**影响**: UTXO所有权验证可能被绕过

---

## 🟡 中危漏洞 (MEDIUM)

### MED-01: 松散比较 `!=` 替代严格比较 `!==`
**文件**: `launchpad.transaction.service.ts` → `verifyMintPsbt()`  
**行为**: `output.value != mintFee` 和 `output.value != paymentAmount`  
**问题**: `!=` 在 number/string 间做类型转换，可能导致验证通过不该通过的情况

### MED-02: `getLaunchpadStatus` 可返回 undefined
**文件**: `src/modules/launchpad/launchpad.service.ts`  
**行为**: 如果没有 InProgress 的轮次，`data` 未赋值就返回  
**影响**: 调用方收到 undefined，可能导致前端崩溃或逻辑错误

### MED-03: `serviceFeeAmount + ckbCellCost` 潜在字符串拼接
**文件**: `src/modules/launchpad/launchpad.service.ts` → `mintToken()`  
**行为**: 配置值可能是字符串类型，`+` 操作变成拼接而非加法  
**影响**: 费用验证金额错误（如 "100" + "200" = "100200" 而非 300）

### MED-04: Decimal 解析 hex 字符串可能错误
**文件**: `src/modules/ckb/rgbpp-distributor.service.ts`  
**行为**: `new Decimal(x.output.capacity)` — CKB容量值可能是hex格式  
**影响**: 如果是hex，余额计算完全错误

### MED-05: `checkUtxoStatusAndOwnership` 函数体为空
**文件**: `src/modules/btc/btc.service.ts`  
**行为**: 函数声明了但没有实现  
**影响**: 依赖此函数的代码得不到任何验证

### MED-06: BTC价格缓存12小时过长
**文件**: `src/modules/btc/btc.service.ts`  
**行为**: `TIME.HALF_HOUR * 24` = 12小时  
**影响**: BTC价格波动剧烈时，用户看到的价格严重过时

### MED-07: `queyPendingActivities` / `queyActivities` 共享QueryBuilder引用
**文件**: `src/modules/rgbpp/order/item.service.ts`  
**行为**: `let countBuilder = queryBuilder` 是引用赋值，后续修改 queryBuilder 同时影响 countBuilder  
**影响**: 分页计数可能不正确

### MED-08: `getPreDeploy` 可使用未确认UTXO
**文件**: `src/modules/rgbpp/asset/asset.service.ts`  
**行为**: 排序将未确认UTXO放最后，但如果所有UTXO都未确认，仍然选择第一个  
**影响**: 部署交易可能因UTXO未确认而失败

---

## 🟢 低危漏洞 (LOW)

### LOW-01: `canonical` 选项已弃用
**文件**: `src/common/utils/deterministic-ecdsa.ts`  
**行为**: 应使用 `lowS: true` 替代 `canonical: true`

### LOW-02: 私钥作为类属性长期驻留内存
**文件**: `src/modules/ckb/transaction-builder.ts`  
**行为**: `this.ownerKey = ownerKey` 在服务生命周期内持久化

### LOW-03: CMC API密钥出现在URL查询参数中
**文件**: `src/modules/btc/btc.service.ts`  
**行为**: `CMC_PRO_API_KEY=${this.appConfig.cmcApiKey}` 可能被日志记录

### LOW-04: `icon` 字段误设为 `tokenInfo.name`
**文件**: `src/modules/external/external.service.ts`  
**行为**: `icon: tokenInfo.name` 应为 `icon: tokenInfo.iconUrl`

### LOW-05: `getFloorPriceForItem` 可能除以零
**文件**: `src/common/utils/tools.ts`  
**行为**: 当 `tokenAmount = 0` 时无保护

### LOW-06: `mintedRatio` 可超过1.0
**文件**: `src/modules/rgbpp/tokens/token.mint.service.ts`  
**行为**: 竞态条件下 count 可能超过 limitedCount

### LOW-07: `queryInitMintTransactionTask` 仅在构造函数运行一次
**文件**: `src/modules/launchpad/launchpad.task.service.ts`  
**行为**: 无cron装饰器，初始化后不再定期执行

### LOW-08: `resendMintTransaction` 可能无限循环
**文件**: `src/modules/launchpad/launchpad.transaction.service.ts`  
**行为**: "Transaction not found" → resend → 再次 "not found" → 再次 resend

---

## 📋 不存在的文件

- `src/common/rgbpp/sport.batch.transfer.ts` — **文件不存在**，项目中也无相关引用

---

## 📊 统计摘要

| 严重程度 | 数量 | 
|---------|------|
| 🔴 CRITICAL | 4 |
| 🟠 HIGH | 7 |
| 🟡 MEDIUM | 8 |
| 🟢 LOW | 8 |
| **总计** | **27** |

### 最紧急修复优先级：
1. **CRITICAL-01**: 部署费 `&&`→`||` 修复（一行代码，影响巨大）
2. **CRITICAL-02**: 铸造竞态条件（需加分布式锁）
3. **CRITICAL-03**: 市场费绕过（需重构验证逻辑）
4. **CRITICAL-04**: `hash.reverse()` Buffer污染（需创建副本）
5. **HIGH-01/02**: 交易费计算过高（资金慢性流失）
