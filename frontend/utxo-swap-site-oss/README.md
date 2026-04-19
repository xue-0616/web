# `utxo-swap-site-oss`

替代 `frontend/utxo-swap-site-src/`（从生产 bundle 提取的反编译产物）。

## 上游

- **仓库**：`upstream/utxo-stack-sdk/`
- **子路径**：`packages/branch + packages/leap + examples/`
- **构建器**：pnpm-monorepo + 薄 UI

## 描述

UTXO-Stack SDK + 待补充的 swap 站点 UI 层

## 构建

```bash
./scripts/build.sh
```

构建输出进入本目录的 `dist/`。

## 与 `-src/` 的对应关系

`-src/` 目录是从生产 minified bundle 解压的 `_assets/`/`_modules/` 结构，仅用于**字段级证据匹配**（如确认某个 route / i18n key / API 端点确实曾在生产中存在）。所有实际重建工作以上游为准。

## 未完成 / 待办

见 `frontend/PHASE_5_MAP.md` 中本项的状态行。
