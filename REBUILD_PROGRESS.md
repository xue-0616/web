# 项目重建进度追踪

> 目标：把整个项目转为可维护、可二次开发的代码库。
> 起点：2026-04-18

## 当前 TypeScript Strict 模式基线错误数

| # | 项目 | 非-strict | strict | 优先级 | 状态 |
|---|---|---|---|---|---|
| 1 | btc-assets-api | 0 | 0 | — | ✅ 已清洁 |
| 2 | unipass-wallet-oauth | 0 | 10 | 低 | ⏳ Phase 1 |
| 3 | opentg-backend | 0 | 14 | 低 | ⏳ Phase 1 |
| 4 | unipass-activity-backend | 0 | 30 | 低 | ⏳ Phase 1 |
| 5 | utxoswap-paymaster-backend | 0 | 52 | 中 | ⏳ Phase 1 |
| 6 | unipass-wallet-custom | 0 | 72 | 中 | ⏳ Phase 1 |
| 7 | unipass-wallet-extend | 0 | 95 | 中 | ⏳ Phase 1 |
| 8 | solagram-backend | 0 | 183 | 中 | ⏳ Phase 2 |
| 9 | mystery-bomb-box-backend | 0 | 196 | 中 | ⏳ Phase 2 |
| 10 | unipass-wallet-backend | 0 | 200 | 高 (钱包核心) | ⏳ Phase 2 |
| 11 | huehub-dex-dobs-backend | 0 | 464 | 中 | ⏳ Phase 3 |
| 12 | unipass-cms-backend | 0 | 508 | 高 (CMS) | ⏳ Phase 3 |
| 13 | huehub-dex-backend | 0 | 597 | 高 (DEX) | ⏳ Phase 3 |
| 14 | dexauto-server | 0 | 1068 | 高 (交易) | ⏳ Phase 4 |

**Strict 错误总计：3489**

## 阶段划分

### Phase 1 — 小项目验证方法（10-100 错误）— ✅ COMPLETE

- [x] unipass-wallet-oauth (10 → **0**) ✅
- [x] opentg-backend (14 → **0**) ✅
- [x] unipass-activity-backend (30 → **0**) ✅
- [x] utxoswap-paymaster-backend (52 → **0**) ✅
- [x] unipass-wallet-custom (72 → **0**) ✅
- [x] unipass-wallet-extend (95 → **0**) ✅

**Phase 1 合计修复：273 strict 错误全清。**

**Strict 剩余总计：3489 − 273 = 3216**

### Phase 2 — 中等项目（180-200 错误）— ✅ COMPLETE
- [x] solagram-backend (183 → **0**) ✅
- [x] mystery-bomb-box-backend (196 → **0**) ✅
- [x] unipass-wallet-backend (200 → **0**) ✅

**Phase 2 合计修复：579 strict 错误全清。**
**累计清除：273 + 579 = 852 / 3489**

### Phase 3 — 大项目（460-600 错误）— ✅ COMPLETE
- [x] huehub-dex-dobs-backend (464 → **0**) ✅
- [x] unipass-cms-backend (508 → **0**) ✅
- [x] huehub-dex-backend (597 → **0**) ✅

**Phase 3 合计修复：1569 strict 错误全清。**
**累计清除：273 + 579 + 1569 = 2421 / 3489**

### Phase 4 — 最大项目 — ✅ COMPLETE
- [x] dexauto-server (1068 → **0**) ✅

**Phase 4 合计修复：1068 strict 错误全清。**
**累计清除：273 + 579 + 1569 + 1068 = 3489 / 3489 — 100% 🎉**

## 全部 14 个后端项目 TypeScript strict 全清。

## 修复原则

1. **不修改业务逻辑** — 仅修类型、字段声明顺序、可选链等反编译失真
2. **保留审计修复** — 过去发现的所有 bug 修复不能被回滚
3. **增量 strict 启用** — tsconfig 里开一个 strict 子项，修完再开下一个
4. **测试优先**（Phase 5）— 补齐 jest.config.js 和关键路径的集成测试

## 反编译典型 pattern（供修复参考）

### Pattern 1: 字段声明在构造函数之后
```typescript
constructor(svc: Service) { this.svc = svc; }  // OK 运行
private svc: Service;   // TS: property before use
```
**修复**: 把字段声明移到构造函数前，保持构造函数赋值不变。

### Pattern 2: 方法体额外缩进
```typescript
async foo() {
        const x = 1;   // 额外 4 空格
        return x;
    }
```
**修复**: 纯视觉问题，不影响 strict —— 不需要修。

### Pattern 3: Optional chaining 丢失
```typescript
const x = obj.field.sub;   // TS: obj 可能 null
// 应为
const x = obj?.field?.sub;
```
**修复**: 根据上下文判断是加 `?.` 还是加断言。

### Pattern 4: `any` 显式类型
```typescript
private logger: any;   // 应为 PinoLogger
```
**修复**: 对照 .d.ts 恢复正确类型。

### Pattern 5: 构造函数参数简写丢失
```typescript
// 原本可能是
constructor(private readonly svc: Svc) {}
// 反编译成
private svc: Svc;
constructor(svc: Svc) { this.svc = svc; }
```
**修复**: 行为一致，可以保留反编译版本或还原简写；strict 模式下两种都通过。

## Phase 5+（后续）

- [ ] 前端：用 `*-github/` 上游替换 `-src` 反编译版
- [ ] 二进制替换：TSS Rust 源、stackup-bundler 上游、substreams 官方版
- [ ] 单元测试
- [ ] CI/CD 配置
- [ ] 架构文档
