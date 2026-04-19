# 可砍清单 —— 6 项详细评估

> 共同前提：对这 6 项全仓搜索，`configs/`、`backend-node/`、`backend-rust/` **零引用**。
> 也就是说：删掉或冻结任何一项，**核心交易系统、钱包后端、API 服务完全不受影响**。
>
> 评估维度：业务关联 / 实际内容 / 替代方案 / 砍掉的代价 / 建议。

---

## 1. `hongkong-wanxiang-festival` (香港万象节活动页)

### 事实
- **标题**：`Scavenger Hunt in HK Web3 festival 2023` —— **2023 年**的过时活动页
- 目录：`frontend/hongkong-wanxiang-festival/` (2.1 MB，19 文件：1 html + 2 js + 11 png + 3 svg)
- `-src/` 只有 2 个 minified js，**无源码**
- 框架：Vite + 某前端（从 bundle hash 看是 Vue 或 React）

### 业务关联
- 零引用。跟交易、钱包、DEX 完全无关。
- 2023 年的线下活动寻宝游戏，**活动早已结束**。

### 替代方案
- **完全不需要替代**。活动已结束，重新做就是复刻一个没人用的页面。

### 砍的代价
- 无。删掉这个目录没有任何后果。

### 建议
**🗑 直接删除**，节省 2-3 人日的重写时间。

---

## 2. `unipass-wallet-official-website` (UniPass 钱包官网)

### 事实
- `frontend/unipass-wallet-official-website/`：12 KB，73 个文件（大部分是 svg/png/ttf 字体）
- 4 个 html + 3 个 js —— **纯静态营销页面**（多语言版本）
- `-src/` 16 KB、4 个 html + 1 个混淆 `.opq` 文件，**无业务代码**

### 业务关联
- 零引用。纯对外展示站。
- 主要作用：SEO、拉新、文档入口。

### 替代方案（按成本排序）
1. **Notion 公开页面** —— 15 分钟上线，$0
2. **GitHub Pages + 1 页 `README.md`** —— 半天，$0
3. **Astro 静态站** —— 3 天，完全可维护
4. **Next.js 重建** —— 1-2 周，过度设计

### 砍的代价
- 如果你的 UniPass 钱包还在拉新：需要一个替代的"官网"入口。**最小方案用 Notion/GitHub Pages 能 cover**。
- 如果钱包已停运或只服务内部：完全可删。

### 建议
**🔶 降级不重写**。用 Astro + Tailwind 写一页静态站，1 天完成。省下 1 周重写时间。

---

## 3. `blinks-miniapp` (Solana Blinks 窗口)

### 事实
- `frontend/blinks-miniapp/index.html` 标题 `Blinks Window` —— Solana [Actions/Blinks](https://solana.com/zh/docs/advanced/actions) 的弹窗 UI
- 1.3 MB bundle，只有 1 html + 1 js + 1 css + 1 jpg —— **单页应用**
- `-src/` 3.1 MB 纯 minified js，**无源码**

### 业务关联
- 零引用。
- **Blinks 是 Solana 2024 推的特性**（一个 Twitter URL 就能发起交易），但现在热度已降，且 X/Twitter 限制较多。
- 如果你不打算让用户通过分享链接发起交易，**这个特性不需要**。

### 替代方案
- 官方 SDK：`@solana/actions` + `dialect-labs/blinks` 模板——直接拿来用。
- **从零重写 1 周**，用官方模板**半天**。

### 砍的代价
- Blinks 功能丢失，但这是个可选锦上添花功能，**核心交易系统完全不依赖它**。

### 建议
**🗑 直接删除**。如果未来要加回来，用官方模板半天就能搞定。省 1 周。

---

## 4. `solana-wallet-mini-app-demo` (Solana 钱包小程序 demo)

### 事实
- `frontend/solana-wallet-mini-app-demo/`：2.5 MB，1 html + 1 js + 1 css + 1 svg —— **单页 Vite demo**
- `-src/` 6.4 MB 纯 minified，**无源码**
- **已经在 `upstream/smart-account-vite-demo/` 有原始仓** —— 上游可用

### 业务关联
- 零引用。
- 是一个 **Telegram Mini App** 的技术探索，展示如何在 TG 里用 Solana 钱包。
- 如果你做的是 Telegram 生态产品（与 Solagram 关联）就有用；否则是纯 demo。

### 替代方案
- **直接用 `upstream/smart-account-vite-demo/`**，已经是开源源码，无需重写。

### 砍的代价
- 零。上游源码已在本地。

### 建议
**✅ 保留，但不"重写"** —— 直接用 `upstream/smart-account-vite-demo/` 替换 minified bundle，**0 工作量**。不算在 16-20 周内。

---

## 5. `unipass-auth0-verify-code` (Auth0 验证码页)

### 事实
- `frontend/unipass-auth0-verify-code/`：**只有 1 个 shell 脚本，8 KB**
- `-src/`：**空目录**
- 根本不是一个完整的前端项目，只是某个 CI 工具脚本的残留

### 业务关联
- 零引用。
- 名字暗示是"用户注册时的验证码输入页"，但目录里连 html 都没有——**可能早就合并进主钱包了**。

### 替代方案
- 如果验证码流程还需要：**合并进 `unipass-wallet-frontend` 的登录流程**（3 行 React 代码）。
- 不需要作为独立应用。

### 砍的代价
- 零。它根本就不完整。

### 建议
**🗑 直接删除**。省 1 天"不知道怎么重写空目录"的困惑。

---

## 6. `unipass-cms-frontend` (UniPass 内部 CMS 后台)

### 事实
- `frontend/unipass-cms-frontend/`：**5.3 MB，256 个文件**，标题 `UniPass CMS 管理系统`
- 技术栈：**Ant Design Vue**（从 bundle chunk 名 `chunk-ant-design-vue.eb444f61.js` 确认）
- `-src/` 18 MB，只有 css/svg/html，**Vue 源码完全丢失**
- 用途：UniPass 内部管理后台（用户管理、权限、配置下发之类）

### 业务关联
- 零直接引用（前端调 API，不在 grep 能命中的地方）。
- 如果你：
  - **只是开发者** → 根本用不上 CMS
  - **不运营 UniPass 服务** → 用不上
  - **是 UniPass 运营方** → 需要一个后台，但**可用现成工具代替**

### 替代方案（按推荐度）
1. **NocoBase** (开源，自托管，零代码搭后台) —— 1 天
2. **Retool / AppSmith** (拖拽式后台) —— 2-3 天
3. **React-Admin + 现成 API** —— 1 周（写配置，不写 UI）
4. **从零重写 Ant Design Vue 版** —— 3-5 天（但每加新功能都是工程量）

### 砍的代价
- 如果是 UniPass 运营方：需要一个能增删改查 DB 的管理后台，**但完全不必重现原版 UI**。
- 内部工具"够用就好"。

### 建议
**🔶 降级不重写**：
- 如果你不运营 UniPass 服务 → **直接删**，省 5 天
- 如果要运营 → **用 NocoBase 代替**，1 天搭好，从此可维护

---

# 汇总对照表

| # | 项目 | 建议 | 省下时间 | 前提 |
|---|---|---|---:|---|
| 1 | `hongkong-wanxiang-festival` | 🗑 删 | 2-3 天 | 无（过时活动） |
| 2 | `unipass-wallet-official-website` | 🔶 Astro 静态站 | 4-6 天 | 若钱包还运营，做 1 页即可 |
| 3 | `blinks-miniapp` | 🗑 删 | 5-7 天 | 不需要 Solana Blinks 功能 |
| 4 | `solana-wallet-mini-app-demo` | ✅ 用上游源替换 | 0（原计划 3 天变 0） | 上游已克隆 |
| 5 | `unipass-auth0-verify-code` | 🗑 删 | 1 天 | 验证码已合并进主钱包 |
| 6 | `unipass-cms-frontend` | 🔶 NocoBase 代替 | 4-6 天 | 若需要管理后台 |

**总节省：16-23 天 ≈ 3-4 周。**

---

# 决策矩阵（你看着回答）

| 问题 | 如果答"是" → 砍 | 如果答"否" → 重建 |
|---|---|---|
| 你要运营 UniPass 作为**对外产品**吗？ | 保留官网 #2 / CMS #6 | 全砍 |
| 你要做 **Solana Blinks** 分享链接功能吗？ | 保留 #3 | 砍 |
| 香港 Web3 festival 2023 要重办？ | 保留 #1 | 砍 |

---

# 建议操作

**如果你的核心目标就是"链上自动化交易"，不运营 UniPass 品牌**，可以**全部 6 项直接砍**：
- `#1、#3、#5` 直接删目录
- `#2` 写一页 Astro 静态站（1 天）
- `#4` 用上游替换（0 天）
- `#6` 如果不需要管理后台，删；需要的话 NocoBase 1 天

**总工期从 24 周压到 20-21 周。**

---

# 执行命令（你点头我就跑）

```bash
cd /home/kai/桌面/55182/链上自动化交易源码
# 冷冻到归档目录而不是真删（保留恢复能力）
mkdir -p _archived/frontend
for name in hongkong-wanxiang-festival blinks-miniapp unipass-auth0-verify-code; do
  mv frontend/$name frontend/${name}-src _archived/frontend/ 2>/dev/null
done
# unipass-wallet-official-website 和 unipass-cms-frontend 视决策再处理
```
