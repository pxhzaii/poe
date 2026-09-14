# POE 词缀库（lfzl.html）

流放之路（POE）词缀速查工具。单文件应用，零依赖，数据保存在本地浏览器，支持部署到 Cloudflare Pages。

- 线上版：https://poe-affix.pages.dev
- 仓库：https://github.com/pxhzaii/poe

## 功能

- 词缀卡片：名称与数值并列显示，点击任意一个即可复制
- 分类完全自定义：如「负电甲/召唤衣」「法血/戒指」，随意增删
- 本地持久化：数据自动存 localStorage
- 导入导出：JSON 格式
- 云端同步：GitHub Gist + AES-256-GCM 加密，密文上云

## 使用方法

1. 打开线上版，或下载 `index.html` 双击用浏览器打开
2. 点击右上角「添加词缀」→ 填分类、名称、数值 → 保存
3. 点击卡片上的名称或数值即可复制

## 云同步（Gist + AES 加密）

多台电脑之间同步词缀库。分两种模式，自动识别：

### 线上版（pages.dev，推荐）

Token 由服务端（Pages 环境变量）保管，前端不接触：

1. 点击「☁️ Gist 云同步」打开面板
2. Token 留空，填写：
   - **Gist ID**：首次留空，推送时自动创建
   - **同步密钥**：即部署时配置的 `SYNC_KEY`，用于访问控制 + AES 加密
3. 「💾 保存配置」→「⬆️ 推送到云端」
4. 换电脑：同样留空 Token，填相同 Gist ID + 同步密钥，「⬇️ 从云端拉取」

服务端代理（`functions/api/gist.js`）的安全设计：

- 只放行 Gist API 路径，禁止 DELETE 等危险方法
- 每个请求校验 `X-Sync-Key`，与 Pages 环境变量 `SYNC_KEY` 不一致直接 401
- GitHub Token 存 Pages 环境变量 `GIST_TOKEN`（secret 类型），前端永不携带

### 本地版（双击 index.html）

1. 自行生成 GitHub Token（需 `gist` 权限）
2. 面板中填写 Token + Gist ID（首次留空）+ 加密密码
3. 操作同上，浏览器直连 GitHub API

### 数据安全

- AES-256-GCM 加密，PBKDF2-SHA256 十万次迭代派生密钥
- Gist 上只存密文，没有密钥无法解密
- 线上版即使密钥泄露，攻击者也只能拿到 Gist 操作权，数据仍是密文

## 部署（Cloudflare Pages）

仓库内置 GitHub Actions 自动部署（`.github/workflows/deploy.yml`），推送 main 分支或手动触发即可。

需要在仓库 Settings → Secrets and variables → Actions 配置 4 个 secrets：

| Secret | 说明 |
|--------|------|
| `CF_API_TOKEN` | Cloudflare API Token（需 Pages:Edit 权限） |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID |
| `GIST_TOKEN` | GitHub Token（gist 权限，写入 Pages 环境变量 GIST_TOKEN） |
| `SYNC_KEY` | 自定义同步密钥（写入 Pages 环境变量 SYNC_KEY） |

工作流会自动：创建 Pages 项目 → 写入环境变量 → 部署静态页面与 `functions/` API。

手动部署（本机能连 Cloudflare 时）：

```bash
npx wrangler pages project create poe-affix --production-branch main
# 在 Dashboard 设置环境变量 GIST_TOKEN / SYNC_KEY（加密类型）
npx wrangler pages deploy public --project-name poe-affix
```

## 数据格式

```json
[
  { "id": "xxx", "category": "负电甲/召唤衣", "name": "词缀名称", "value": "数值" }
]
```

Gist 文件 `poe-affix-data.enc.json` 为加密信封：

```json
{ "v": 1, "salt": "...", "iv": "...", "data": "..." }
```
