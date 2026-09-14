# POE 词缀库

流放之路（POE）词缀速查工具。单文件应用，零依赖，部署到 Cloudflare Pages。

- 线上版：https://poe-affix.pages.dev
- 仓库：https://github.com/pxhzaii/poe

## 功能

- 词缀卡片：名称与数值并列，点击即可复制
- 分类完全自定义：如「负电甲/召唤衣」「法血/戒指」
- 本地持久化：数据自动存 localStorage
- 导入导出：JSON 格式
- 云端同步：两个按钮，推送/拉取，零配置

## 使用方法

1. 打开线上版，或下载 `index.html` 双击用浏览器打开
2. 点击「添加词缀」→ 填分类、名称、数值 → 保存
3. 点击卡片上的名称或数值即可复制

## 云同步

**两个按钮，无需任何配置：**

- **☁️ 推送云端**：把当前词缀推送到 GitHub Gist 备份
- **⬇️ 拉取云端**：用云端数据覆盖本地

GitHub Token 由服务端（Cloudflare Pages 环境变量）保管，前端不接触任何凭据。Gist 自动创建和管理，用户无感知。

本地文件模式（双击 index.html）不支持云同步，请使用线上版。

## 部署（Cloudflare Pages）

仓库内置 GitHub Actions 自动部署，推送 main 分支或手动触发即可。

需要在仓库 Settings → Secrets → Actions 配置 3 个 secrets：

| Secret | 说明 |
|--------|------|
| `CF_API_TOKEN` | Cloudflare API Token（Pages 权限） |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID |
| `GIST_TOKEN` | GitHub Token（gist 权限，写入 Pages 环境变量） |

工作流自动：创建 Pages 项目 → 写入环境变量 → 部署。

## 数据格式

```json
[
  { "id": "xxx", "category": "负电甲/召唤衣", "name": "词缀名称", "value": "数值" }
]
```

Gist 文件 `poe-affix-data.json` 内容：

```json
{ "affixes": [...], "updated_at": "2026-01-01T00:00:00.000Z" }
```
