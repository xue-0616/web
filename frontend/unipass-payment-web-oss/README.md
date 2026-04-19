# `unipass-payment-web-oss`

**绿地重写**（无上游可用）。替代 `frontend/unipass-payment-web-src/`（生产 nginx 裸页）。

## 技术栈

Vite + React + unipass-wallet-js

## 用途

UniPass 支付页 Web — 交易预览 + 扫码 + 确认签名

## 估工

约 **7 人日**。

## 构建

```bash
npm install
npm run build       # 产物输出到 dist/
```

## 状态

**🟡 Scaffold 阶段**：仓库结构 + 构建系统 + 占位路由 + Phase 6 tracker 登记。真正的 UI 页面按生产截图或设计稿补全。

## 与 Phase 5 的差别

Phase 5 是 **上游对齐**（有现成的开源仓库），本项是 **闭源重写**（无源代码可参考）。
