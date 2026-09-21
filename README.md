# POE 词缀库

流放之路（POE）词缀速查工具。单文件应用，零依赖，支持多用户云端同步。

- 线上版：https://poe-affix.pages.dev
- 云同步 API：https://poe-affix.a353000446.workers.dev
- 仓库：https://github.com/pxhzaii/poe

## 功能

- 词缀卡片：点击即可复制词缀名称
- 两级分类：一级分类（衣服/鞋子/珠宝/药剂…）+ 二级分类/分组（召唤头/爆炸头/灵体头…）
- 分类完全自定义：无固定前缀/后缀/特殊，用户自己输入分类名
- 多用户云端同步：注册账号后数据按用户隔离，多设备可用
- 本地持久化：数据自动存 localStorage
- 导入导出：JSON 格式
- 覆盖确认：推送/拉取云端数据时都会弹出覆盖提示，避免误操作

## 使用方法

1. 打开线上版，或下载 `index.html` 双击用浏览器打开
2. 首次使用：注册账号（或点「暂不登录」用本地模式）
3. 点击「添加词缀」→ 选择/新建一级分类 → 输入词缀名称 → 保存
4. 点击词缀行即可复制名称

## 云同步（多用户）

**注册/登录后自动云同步：**

- 数据按用户名隔离在 Cloudflare KV 中，互不可见
- **☁️ 推送云端**：把当前词缀覆盖推送到当前账号云端
- **⬇️ 拉取云端**：用云端数据覆盖本地
- 推送/拉取前均有覆盖确认提示

## 部署

### Worker（云同步 API）

```bash
npx wrangler deploy
```

需要绑定 KV 命名空间：

```toml
[[kv_namespaces]]
binding = "AFFIX_KV"
id = "你的KV命名空间ID"
```

### 前端（Cloudflare Pages）

仓库内置 GitHub Actions 自动部署，推送 main 分支即可。

## 数据格式

```json
[
  { "id": "xxx", "category": "衣服", "subcategory": "召唤头", "name": "词缀名称" }
]
```

云端 KV（按用户隔离）：

- `user:<username>` → `{ passwordHash, salt }`
- `data:<username>` → `{ affixes: [...], updated_at: "..." }`
- `token:<token>` → `{ username, expires }`