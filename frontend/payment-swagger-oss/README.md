# `payment-swagger-oss`

替代 `frontend/payment-swagger-src/`（从生产 bundle 提取的反编译产物）。

## 上游

- **仓库**：`upstream/UniPass-Wallet-Docs/`
- **子路径**：`docs/develop/ + static swagger`
- **构建器**：docusaurus-v2

## 描述

Docusaurus 文档站（develop/swagger 子集）

## 构建

```bash
./scripts/build.sh
```

构建输出进入本目录的 `dist/`。

## 与 `-src/` 的对应关系

`-src/` 目录是从生产 minified bundle 解压的 `_assets/`/`_modules/` 结构，仅用于**字段级证据匹配**（如确认某个 route / i18n key / API 端点确实曾在生产中存在）。所有实际重建工作以上游为准。

## 未完成 / 待办

见 `frontend/PHASE_5_MAP.md` 中本项的状态行。
