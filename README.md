# POE 词缀库

流放之路（POE）词缀速查工具。单文件应用，零依赖，支持云端同步。

- 线上版：<https://poe.5as.cn>
- 仓库：<https://github.com/pxhzaii/poe>

## 功能

- 词缀卡片：点击即可复制词缀名称
- 两级分类：一级分类（衣服/鞋子/珠宝…）+ 二级分类（召唤头/爆炸头…），完全自定义
- 分类管理：双击分类名即可重命名，支持新增空分类
- 云端同步：通过密码验证后推送/拉取数据，数据存储在 GitHub Gist
- 本地持久化：数据自动存 localStorage，不输密码也能用
- 导入导出：JSON 格式
- 覆盖确认：推送/拉取云端数据时弹出确认提示

## 使用方法

1. 打开线上版，或下载 `index.html` 双击用浏览器打开
2. 页面直接进入本地模式，可正常添加/查看词缀
3. 如需云端同步：点击「☁️ 推送」或「⬇️ 拉取」，弹出密码框输入同步密码
4. 选择一级分类 → 选择/新建二级分类 → 在添加栏输入词缀名称，回车或点「添加」按钮
5. 点击词缀行复制名称，双击分类名可重命名

## 云端同步

- 数据存储在 GitHub Gist（secret gist），通过 Cloudflare Pages Functions 代理读写
- GitHub Token 存在 Cloudflare 环境变量中，前端不接触 Token
- 推送/拉取时需要输入同步密码（`APP_PASSWORD` 环境变量）
- 密码不持久化到 localStorage，刷新页面后需重新输入

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `APP_PASSWORD` | 云端同步密码 |
| `GIST_TOKEN` | GitHub Personal Access Token |
| `GIST_ID` | 存储词缀数据的 Gist ID |

## 部署

仓库内置 GitHub Actions（`.github/workflows/deploy.yml`），推送 main 分支即自动部署到 Cloudflare Pages。

GitHub Secrets 需配置：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`APP_PASSWORD`、`GIST_TOKEN`、`GIST_ID`

## 文件结构

```
index.html                    # 前端单文件（词缀库页面）
functions/api/data.js         # Pages Functions 后端（Gist 代理 + 密码验证）
.github/workflows/deploy.yml  # 自动部署工作流
```

## 数据格式

词缀数据（存储在 Gist 的 `affixes.json` 中）：

```json
{
  "affixes": [
    { "id": "xxx", "category": "衣服", "subcategory": "召唤头", "name": "词缀名称", "value": "" }
  ],
  "categories": [
    { "cat": "衣服", "subs": ["召唤头", "爆炸头"] }
  ],
  "updated_at": "2026-09-21T12:00:00.000Z"
}
```
