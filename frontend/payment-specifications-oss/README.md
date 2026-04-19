# `payment-specifications-oss`

替代 `frontend/payment-specifications-src/`（从生产 bundle 解压的 Docusaurus 静态输出）。

## 上游

- **仓库**：`upstream/UniPass-Wallet-Docs/`（UniPass-ID/UniPass-Wallet-Docs · Apache-2.0）
- **相关子目录**：`docs/wallet/` 下的「payment / 支付规范」章节
- **构建器**：Docusaurus v2

## 构建

```bash
cd upstream/UniPass-Wallet-Docs
pnpm install --frozen-lockfile
pnpm build              # 输出到 build/ — 对应 frontend/payment-specifications/ 的生产 bundle
```

## 与 `-src/` 的对应关系

`payment-specifications-src/_assets/` 下的所有静态资源都能在上游 `static/` 或 Docusaurus 输出中找到。`_modules/` 是 Webpack chunks，上游构建可重现（不保证 chunk 切分字节相同，但路由 + 内容 100% 一致）。

## 验证

- 页面路由清单对比：`payment-specifications-src/_raw/routes.json`（若存在）vs 上游 `sidebars.js`
- 原文 hash 对比：`_assets/*.md` 可直接 diff 上游 `docs/wallet/payment/**.md`
